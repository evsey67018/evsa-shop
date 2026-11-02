// Порт bot.py (обработчики апдейтов) + evsa_pay.py + evsa_login.py. Тексты, кнопки и записи в БД — как в Python.
// Состояние, которое в Python было в памяти/файлах, хранится в БД:
//   awaiting_amount / awaiting_lookup → bot_chat_state; admin_reply_state.json → bot_state 'admin_reply';
//   welcome_anim_id.txt → bot_state 'welcome_anim'; start_chats.jsonl → bot_start_chats;
//   payments.jsonl + pending_credits.json → bot_payment_events (ключ telegram_payment_charge_id).
import { call, callMultipart, esc, get, log, nowIso, OWNER_ID, PayError, qs, rpc, rubFmt, safeErr, SHOP_URL, stateDel, stateGet,
  stateSet, SUPPORT, tgTry, write } from "./lib.ts";
import * as A from "./admin.ts";
import * as W from "./withdraw.ts";
import { ALIASES, Monitor, setEnabled } from "./monitor.ts";

const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? "";
export const PAYMENTS_ENABLED = () => env("EVSA_PAYMENTS") !== "0";
export const TOPUP_MIN = 10, TOPUP_MAX = 12500;
export const DISCOUNT = 0.20;
export const SOON_TEXT = "Пополнение звёздами временно недоступно. Попробуйте позже 🙏";

export const WELCOME = "<b>🎃👻 Добро пожаловать в EVSA SHOP! 🦇🕸\n\n" +
  "🕯 Здесь собраны самые популярные игры и сервисы: Roblox, Brawl Stars, Standoff 2, " +
  "PUBG Mobile, Fortnite, Minecraft, Genshin Impact, Telegram, TikTok, нейросети и многое другое.\n\n" +
  "🎃 Донат, игровая валюта, предметы и подписки\n" +
  "🧙 Удобный каталог и быстрый поиск\n" +
  "💀 Безопасные сделки через чат\n\n" +
  "🍬 Ты точно найдёшь свой вариант! 🍭\n\n" +
  "Жми кнопку ниже 👇🎃</b>";
export const LOGIN_OK = "Вход выполнен ✅ Вернись на сайт";
export const LOGIN_FAIL = "Ссылка для входа устарела или уже использована. Нажми «Войти через Telegram» на сайте ещё раз.";
export const WELCOME_MARKUP = { inline_keyboard: [[{ text: "🎃 Открыть EVSA SHOP", url: SHOP_URL, style: "danger" }]] };

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

// ---------- приветствие (анимация по file_id, иначе загрузка mp4, иначе текст) ----------
async function readAnim(): Promise<Uint8Array> {
  const D = (globalThis as any).Deno;
  const url = new URL("./assets/evsa_logo_anim.mp4", import.meta.url);
  try {
    return await D.readFile(url);
  } catch {
    return await D.readFile(decodeURIComponent(url.pathname));
  }
}

export async function sendWelcome(chatId: number): Promise<any> {
  let animId: string | null = null;
  try {
    animId = ((await stateGet("welcome_anim")) || {}).file_id || null;
    const kw = { chat_id: chatId, caption: WELCOME, parse_mode: "HTML", reply_markup: WELCOME_MARKUP };
    let res: any;
    if (animId) {
      res = await call("sendAnimation", { animation: animId, ...kw });
    } else {
      res = await callMultipart("sendAnimation", { animation: { name: "evsa_logo_anim.mp4", data: await readAnim(), type: "video/mp4" } }, kw);
      if (res.ok) {
        const r = res.result || {};
        const fid = (r.animation || r.video || r.document || {}).file_id;
        if (fid) await stateSet("welcome_anim", { file_id: fid }).catch((e) => log("welcome id save failed:", safeErr(e)));
      }
    }
    if (res.ok) {
      log(ts(), "welcome sent (animation) to", chatId);
      return res;
    }
    log("sendAnimation not ok:", res);
    await stateDel("welcome_anim").catch(() => {});
  } catch (e) {
    log("sendAnimation failed:", safeErr(e));
    if (animId) await stateDel("welcome_anim").catch(() => {});
  }
  const res = await call("sendMessage", { chat_id: chatId, text: WELCOME, parse_mode: "HTML", reply_markup: WELCOME_MARKUP });
  log(ts(), "welcome sent (text) to", chatId, res.ok);
  return res;
}

export const NEED_LOGIN = "Чтобы пополнить баланс, сначала войди на сайт через Telegram (кнопка «Войти через Telegram»), " +
  "затем нажми «Пополнить» в профиле или снова напиши /topup.";
export const PAYSUPPORT = `<b>Помощь с оплатой</b>\n\nЕсли звёзды списались, а баланс не пополнился, или нужен возврат — ` +
  `напиши ${SUPPORT} и пришли время оплаты и сумму. Обычно баланс зачисляется сразу после оплаты.`;
const g3 = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
export const PAY_ERRORS: Record<string, string> = {
  bad_amount: `Сумма пополнения: от ${TOPUP_MIN} до ${TOPUP_MAX} ₽.`,
  no_profile: NEED_LOGIN,
  banned: "Аккаунт заблокирован — пополнение недоступно.",
  too_many: "Слишком много счетов подряд. Подожди 10 минут и попробуй снова.",
  db: "Не удалось создать счёт. Попробуй ещё раз чуть позже.",
};
export const ASK_AMOUNT = `Сколько рублей пополнить? Напиши число от ${TOPUP_MIN} до ${g3(TOPUP_MAX)} (например, 200).`;

// ---------- чистая логика ----------
export const rubToStars = (rub: number) => Math.max(1, Math.trunc(Math.floor(rub * (1 - DISCOUNT) + 0.5)));

export function parseAmount(s: string | null | undefined): number | null {
  const v = (s || "").trim().split(" ").join("").split("₽").join("").split("руб").join("");
  if (!/^\d{1,7}$/.test(v)) return null;
  return parseInt(v, 10);
}

export function amountError(rub: number | null): string | null {
  if (rub === null) return `Не понял сумму 🤔 Напиши целое число рублей от ${TOPUP_MIN} до ${g3(TOPUP_MAX)}.`;
  if (rub < TOPUP_MIN || rub > TOPUP_MAX) return `Сумма пополнения: от ${TOPUP_MIN} до ${g3(TOPUP_MAX)} ₽. Попробуй другую сумму.`;
  return null;
}

export function buildTopupReply(rub: number, invoiceUrl: string): [string, any] {
  const stars = rubToStars(rub);
  const text = `<b>Пополнение баланса EVSA SHOP: ${rub} ₽ → ${stars} ⭐</b> (скидка ${Math.trunc(DISCOUNT * 100)}%)\n\n` +
    "Звёзд нужно на 20% меньше, чем рублей. После оплаты на баланс придёт вся сумма.";
  return [text, { inline_keyboard: [[{ text: `Оплатить ${stars} ⭐`, url: invoiceUrl }],
    [{ text: "Открыть EVSA SHOP", url: SHOP_URL + "#/profile" }]] }];
}

// Python str.split(maxsplit=1)
export function split1(text: string): string[] {
  const t = text.replace(/^\s+/, "");
  if (!t) return [];
  const m = t.match(/^(\S+)\s+([\s\S]*)$/);
  if (!m) return [t];
  return m[2] ? [m[1], m[2]] : [m[1]];
}

export function parseStart(text: string): [string, any] {
  const parts = split1(text || "");
  const payload = parts.length > 1 ? parts[1].trim() : "";
  if (!/^[A-Za-z0-9_-]{0,64}$/.test(payload)) return ["welcome", null];
  const lm = payload.match(/^login_([A-Za-z0-9]{32})$/);
  if (lm) return ["login", lm[1]];
  const m = payload.match(/^topup(?:_(\d{1,7}))?$/);
  if (!m) return ["welcome", null];
  return ["topup", m[1] ? parseInt(m[1], 10) : null];
}

export function cmd(text: string): [string, string] {
  const parts = split1(text || "");
  return [parts.length ? parts[0].split("@")[0].toLowerCase() : "", parts.length > 1 ? parts[1].trim() : ""];
}

// ---------- evsa_pay ----------
export async function createPayment(telegramId: number, rub: number): Promise<any> {
  const rows = await rpc("stars_create_payment", { p_amount: Math.trunc(rub), p_telegram_id: Math.trunc(Number(telegramId)) });
  if (!rows || !rows.length) throw new PayError("db");
  return rows[0];
}
export async function setInvoiceLink(paymentId: string, url: string) {
  try {
    await write("PATCH", "star_payments?id=eq." + paymentId, { invoice_link: url });
  } catch { /* как в Python: ошибки игнорируются */ }
}
export async function markFailed(paymentId: string) {
  try {
    await write("PATCH", "star_payments?id=eq." + paymentId + "&status=eq.pending", { status: "failed" });
  } catch { /* */ }
}
export async function precheck(payload: string, total: unknown, currency: string): Promise<boolean> {
  try {
    return (await rpc("stars_precheck", { p_payload: payload, p_total: Math.trunc(Number(total)), p_currency: currency }, 6000)) === true;
  } catch {
    return false;
  }
}
export async function credit(rec: any): Promise<any> {
  return await rpc("stars_credit", {
    p_payload: rec.payload, p_charge_id: rec.telegram_payment_charge_id, p_provider_charge_id: rec.provider_payment_charge_id || "",
    p_payer_telegram_id: rec.user_id ? Math.trunc(Number(rec.user_id)) : null, p_total: Math.trunc(Number(rec.total_amount)),
    p_currency: rec.currency,
  }, 15000);
}

// ---------- evsa_login ----------
export async function grantLogin(nonce: string, user: any): Promise<boolean> {
  if (!/^[A-Za-z0-9]{32}$/.test(nonce || "")) return false;
  const since = new Date(Date.now() - 300e3).toISOString();
  const q = qs({ nonce: "eq." + nonce, telegram_id: "is.null", used_at: "is.null", created_at: "gt." + since });
  const body = {
    telegram_id: Math.trunc(Number(user.id)), tg_username: user.username ?? null,
    tg_first_name: Array.from(String(user.first_name || "")).slice(0, 64).join(""),
    tg_last_name: Array.from(String(user.last_name || "")).slice(0, 64).join(""),
    granted_at: nowIso(),
  };
  try {
    const rows = await write("PATCH", "login_nonces?" + q, body, "return=representation");
    return Array.isArray(rows) && rows.length === 1;
  } catch (e) {
    log("login grant failed:", (e as Error).name, (e as any).status ?? "");
    return false;
  }
}

export async function recordStart(chat: any, user: any) {
  try {
    await write("POST", "bot_start_chats?on_conflict=chat_id", {
      chat_id: chat.id, chat_type: chat.type ?? null, user_id: user.id ?? null, username: user.username ?? null,
      first_name: user.first_name ?? null, at: new Date().toISOString().slice(0, 19) + "+00:00",
    }, "return=minimal,resolution=ignore-duplicates");
  } catch (e) {
    log("record_start failed:", safeErr(e));
  }
}

// ---------- состояние чатов (в Python — множества в памяти) ----------
const AWAIT_TTL_MS = 24 * 3600e3;
type Flag = "awaiting_amount" | "awaiting_lookup";
export async function flagGet(chatId: number, f: Flag): Promise<boolean> {
  try {
    return await flagRead(chatId, f);
  } catch (e) {
    log("chat state read failed:", safeErr(e));
    return false;
  }
}
async function flagRead(chatId: number, f: Flag): Promise<boolean> {
  const rows = await get("bot_chat_state", { select: `${f},updated_at`, chat_id: "eq." + chatId, limit: "1" });
  if (!rows.length || !rows[0][f]) return false;
  return Date.now() - new Date(rows[0].updated_at).getTime() < AWAIT_TTL_MS;
}
export async function flagSet(chatId: number, f: Flag, on: boolean) {
  try {
    await flagWrite(chatId, f, on);
  } catch (e) {
    log("chat state write failed:", safeErr(e));
  }
}
async function flagWrite(chatId: number, f: Flag, on: boolean) {
  if (on) {
    await write("POST", "bot_chat_state?on_conflict=chat_id", { chat_id: chatId, [f]: true, updated_at: nowIso() },
      "return=minimal,resolution=merge-duplicates");
  } else {
    await write("PATCH", "bot_chat_state?" + qs({ chat_id: "eq." + chatId, [f]: "is.true" }), { [f]: false });
  }
}

// ---------- пополнение ----------
async function createInvoiceLink(rub: number, payload: string): Promise<string> {
  const stars = rubToStars(rub);
  const res = await call("createInvoiceLink", {
    title: `Пополнение на ${rub} ₽`, description: `Пополнение баланса EVSA SHOP: ${rub} ₽ за ${stars} ⭐`,
    payload, provider_token: "", currency: "XTR", prices: [{ label: `${rub} ₽ на баланс`, amount: stars }],
  });
  if (!res.ok) throw new Error("createInvoiceLink failed: " + String(res.description));
  return res.result;
}

export async function sendTopup(chatId: number, rub: number, tgUserId: number): Promise<any> {
  const err = amountError(rub);
  if (err) return call("sendMessage", { chat_id: chatId, text: err });
  if (!PAYMENTS_ENABLED()) return call("sendMessage", { chat_id: chatId, text: SOON_TEXT });
  let pay: any;
  try {
    pay = await createPayment(tgUserId, rub);
  } catch (e) {
    if (e instanceof PayError) {
      if (e.code === "no_profile") return call("sendMessage", { chat_id: chatId, text: NEED_LOGIN, reply_markup: WELCOME_MARKUP });
      return call("sendMessage", { chat_id: chatId, text: PAY_ERRORS[e.code] || PAY_ERRORS.db });
    }
    log("create_payment error:", safeErr(e));
    return call("sendMessage", { chat_id: chatId, text: PAY_ERRORS.db });
  }
  if (Math.trunc(Number(pay.stars)) !== rubToStars(rub)) {
    await markFailed(pay.payment_id);
    log("stars mismatch between bot and db");
    return call("sendMessage", { chat_id: chatId, text: PAY_ERRORS.db });
  }
  let url: string;
  try {
    url = await createInvoiceLink(rub, pay.payload);
  } catch (e) {
    await markFailed(pay.payment_id);
    log("invoice error:", safeErr(e));
    return call("sendMessage", { chat_id: chatId, text: PAY_ERRORS.db });
  }
  await setInvoiceLink(pay.payment_id, url);
  const [text, markup] = buildTopupReply(rub, url);
  return call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup });
}

export async function handleCallback(cq: any): Promise<any> {
  const data = cq.data || "";
  if (data.startsWith("adm:")) return handleAdminCallback(cq);
  if (data.startsWith("wd:")) return handleWithdrawCallback(cq);
  if (data.startsWith("pay_")) {
    return call("answerCallbackQuery", { callback_query_id: cq.id, show_alert: true,
      text: "Эта кнопка устарела. Нажми «Пополнить» в профиле на сайте или напиши /topup." });
  }
  return call("answerCallbackQuery", { callback_query_id: cq.id });
}

export async function handlePreCheckout(pq: any): Promise<any> {
  const payload = pq.invoice_payload || "";
  const ok = /^stars_[0-9a-f]{32}$/.test(payload) && pq.currency === "XTR" && await precheck(payload, pq.total_amount || 0, "XTR");
  if (ok) return call("answerPreCheckoutQuery", { pre_checkout_query_id: pq.id, ok: true });
  return call("answerPreCheckoutQuery", { pre_checkout_query_id: pq.id, ok: false,
    error_message: "Этот счёт устарел или уже оплачен. Создай новый: «Пополнить» в профиле на сайте." });
}

// ---------- зачисление: сначала запись в bot_payment_events, потом stars_credit (повтор безопасен) ----------
export async function creditPayment(rec: any): Promise<boolean> {
  let r: any;
  try {
    r = await credit(rec);
  } catch (e) {
    log("credit error (will retry):", safeErr(e));
    return false;
  }
  const st = (r || {}).status;
  if (st === "credited") {
    await call("sendMessage", { chat_id: rec.chat_id, parse_mode: "HTML",
      text: `Баланс пополнен на <b>${rubFmt(r.amount)} ₽</b> ✅\nБаланс: <b>${rubFmt(r.balance)} ₽</b>`,
      reply_markup: { inline_keyboard: [[{ text: "Открыть EVSA SHOP", url: SHOP_URL + "#/profile" }]] } })
      .catch((e) => log("credited notice failed:", safeErr(e)));
    return true;
  }
  if (st === "duplicate") return true;
  if (st === "conflict") {
    log("credit conflict, refunding:", { payload: rec.payload, reason: r.reason });
    let refunded = false;
    try {
      const res = await call("refundStarPayment", { user_id: rec.user_id, telegram_payment_charge_id: rec.telegram_payment_charge_id });
      refunded = !!res.ok;
    } catch (e) {
      log("refund error:", safeErr(e));
    }
    await call("sendMessage", { chat_id: rec.chat_id,
      text: refunded ? "Не удалось зачислить оплату, звёзды возвращены 🙏 Создай новый счёт в профиле на сайте." :
        `Не удалось зачислить оплату. Напиши ${SUPPORT} — разберёмся и вернём звёзды.` })
      .catch((e) => log("conflict notice failed:", safeErr(e)));
    return true;
  }
  log("credit unexpected result:", r);
  return false;
}

async function paymentDone(chargeId: string, result: string) {
  await write("PATCH", "bot_payment_events?" + qs({ charge_id: "eq." + chargeId }),
    { status: "done", result, done_at: nowIso() }).catch((e) => log("payment done mark failed:", safeErr(e)));
}

// → false, если запись платежа не сохранилась и зачислить не удалось (тогда вебхук вернёт 500 и Telegram повторит апдейт)
export async function handleSuccessfulPayment(m: any): Promise<boolean> {
  const sp = m.successful_payment;
  const rec = { at: Math.trunc(Date.now() / 1000), user_id: (m.from || {}).id ?? null, chat_id: m.chat.id,
    payload: sp.invoice_payload ?? null, currency: sp.currency ?? null, total_amount: sp.total_amount ?? null,
    telegram_payment_charge_id: sp.telegram_payment_charge_id ?? null, provider_payment_charge_id: sp.provider_payment_charge_id ?? null };
  log("successful_payment:", { at: rec.at, user_id: rec.user_id, chat_id: rec.chat_id, currency: rec.currency, total_amount: rec.total_amount });
  let stored = false, fresh = true;
  try {
    const ins = await write("POST", "bot_payment_events?on_conflict=charge_id",
      { charge_id: rec.telegram_payment_charge_id, rec, status: "pending", last_attempt_at: nowIso() },
      "return=representation,resolution=ignore-duplicates");
    stored = true;
    fresh = !Array.isArray(ins) || ins.length > 0; // повторная доставка того же платежа — уже в очереди, «Оплата получена» не дублируем
  } catch (e) {
    log("payment log write failed:", safeErr(e));
  }
  if (await creditPayment(rec)) {
    if (stored) await paymentDone(rec.telegram_payment_charge_id, "final");
    return true;
  }
  if (!stored) return false;
  if (!fresh) return true;
  await call("sendMessage", { chat_id: rec.chat_id, text: "Оплата получена ✅ Зачисляем на баланс — это может занять пару минут." });
  return true;
}

export async function retryPending(): Promise<number> {
  const cutoff = new Date(Date.now() - 50e3).toISOString();
  const rows = await get("bot_payment_events", { select: "charge_id,rec,attempts", status: "eq.pending",
    last_attempt_at: "lt." + cutoff, order: "created_at.asc", limit: "20" });
  let n = 0;
  for (const row of rows) {
    await write("PATCH", "bot_payment_events?" + qs({ charge_id: "eq." + row.charge_id }),
      { last_attempt_at: nowIso(), attempts: (row.attempts || 0) + 1 });
    if (await creditPayment(row.rec)) {
      await paymentDone(row.charge_id, "final");
      n++;
    }
  }
  return n;
}

// ---------- поддержка / админ ----------
export const REPLY_TTL = 15 * 60;
export const CANCEL_KB = { inline_keyboard: [[{ text: "Отмена", callback_data: "adm:rpx" }]] };

export async function replyGet(): Promise<any> {
  try {
    const st = await stateGet("admin_reply");
    if (st && st.owner === A.ownerId() && (st.until || 0) > Date.now() / 1000) {
      const k = A.parseKey(st.uid || "");
      if (k && k[0] === "user") return st;
    }
  } catch (e) {
    log("reply state read failed:", safeErr(e));
  }
  await replyClear();
  return null;
}
export const replySet = (uid: string) => stateSet("admin_reply", { owner: A.ownerId(), uid, until: Date.now() / 1000 + REPLY_TTL });
export const replyClear = () => stateDel("admin_reply").catch(() => {});

async function sendPlain(chatId: number, text: string): Promise<[boolean, string | null]> {
  const [r, err] = await tgTry("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
  return [!!(r && r.ok), err];
}

async function doOwnerReply(chatId: number, uid: string, text: string) {
  const [ok, saved, err] = await A.sendReply(uid, text, sendPlain);
  const openKb = { inline_keyboard: [[{ text: "Открыть переписку", callback_data: "adm:sc:" + uid }], A.SUP_BTN] };
  let t: string;
  if (ok) t = "✅ Ответ доставлен пользователю." + (saved ? "" : "\n⚠️ Но не сохранился в базе — в истории его не будет.");
  else t = `❌ Не доставлено: ${esc(err)}.` + (saved ? " Ответ сохранён в переписке — пользователь увидит его на сайте." : "");
  await call("sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", reply_markup: openKb });
}

async function handleUserSupportReply(m: any, text: string): Promise<boolean> {
  const rt = m.reply_to_message || {};
  if (m.chat.type !== "private" || !(rt.from || {}).is_bot || !(rt.text || "").startsWith(A.REPLY_PREFIX)) return false;
  const chatId = m.chat.id;
  if (!text) {
    await call("sendMessage", { chat_id: chatId, text: "Пока в поддержку можно отвечать только текстом." });
    return true;
  }
  let p: any;
  try {
    [, p] = await A.saveUserMessage(m.from || {}, text);
  } catch (e) {
    if (e instanceof A.SupportError) {
      const msg: Record<string, string> = { short: "Сообщение слишком короткое.", long: "Слишком длинно — до 1500 символов.",
        no_profile: `Не нашёл ваш аккаунт на сайте. Войдите на сайт через Telegram или напишите ${SUPPORT}.` };
      await call("sendMessage", { chat_id: chatId, text: msg[e.code] || "Не удалось отправить." });
      return true;
    }
    log("support save error:", safeErr(e));
    await call("sendMessage", { chat_id: chatId, text: `Не удалось отправить в поддержку. Попробуйте позже или напишите ${SUPPORT}.` });
    return true;
  }
  await call("sendMessage", { chat_id: chatId, text: "✅ Сообщение отправлено в поддержку. Ответ придёт сюда." });
  const [nt, nk] = A.ownerNotice(p, text);
  const [r, err] = await tgTry("sendMessage", { chat_id: A.ownerId(), text: nt, parse_mode: "HTML", reply_markup: nk });
  if (!r) log("owner notify failed:", err);
  return true;
}

async function handleAdminMessage(m: any, text: string): Promise<boolean> {
  const chatId = m.chat.id;
  if (m.chat.type !== "private" || !A.isOwner(m.from)) return false;
  const [c, arg] = cmd(text);
  if (c === "/cancel" && await replyGet()) {
    await replyClear();
    await call("sendMessage", { chat_id: chatId, text: "Ответ отменён.", reply_markup: { inline_keyboard: [A.SUP_BTN] } });
    return true;
  }
  if (!text.startsWith("/")) {
    const st = await replyGet();
    if (st) {
      if (!text) {
        await call("sendMessage", { chat_id: chatId, text: "Пока можно отвечать только текстом. Напишите ответ или нажмите «Отмена».",
          reply_markup: CANCEL_KB });
        return true;
      }
      await replyClear();
      try {
        await doOwnerReply(chatId, st.uid, text);
      } catch (e) {
        log("admin reply error:", safeErr(e));
        await call("sendMessage", { chat_id: chatId, text: "Не удалось отправить ответ. Попробуй ещё раз." });
      }
      return true;
    }
  }
  if (["/monitor", "/monitor_on", "/monitor_off"].includes(c)) return handleMonitorCmd(chatId, c, arg);
  let t: string, mk: any;
  try {
    if (c === "/admin" || c === "/db") {
      await Promise.all([flagSet(chatId, "awaiting_lookup", false), flagSet(chatId, "awaiting_amount", false)]);
      [t, mk] = arg ? await A.lookup(arg) : (await A.screen("adm:home"))!;
    } else if (text && !text.startsWith("/") && await flagGet(chatId, "awaiting_lookup")) {
      await flagSet(chatId, "awaiting_lookup", false);
      [t, mk] = await A.lookup(text);
    } else return false;
  } catch (e) {
    log("admin error:", safeErr(e));
    [t, mk] = ["Не удалось прочитать базу. Попробуй ещё раз.", { inline_keyboard: [A.HOME_BTN] }];
  }
  await call("sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", reply_markup: mk, disable_web_page_preview: true });
  return true;
}

// ---------- мониторинг: сообщения только владельцу ----------
export async function monitorSend(text: string, markup?: any): Promise<[boolean, string | null]> {
  const kw = markup ? { reply_markup: markup } : {};
  const [r, err] = await tgTry("sendMessage", { chat_id: OWNER_ID, text, parse_mode: "HTML", disable_web_page_preview: true, ...kw });
  return [!!(r && r.ok), err];
}

async function handleMonitorCmd(chatId: number, c: string, arg: string): Promise<boolean> {
  if (c !== "/monitor") {
    const key = ALIASES[arg.trim().toLowerCase()];
    if (!key) {
      await call("sendMessage", { chat_id: chatId, text: "Не понял, что переключить. Варианты: события, сводка, здоровье, бэкап, выводы, все." });
      return true;
    }
    await setEnabled(key, c === "/monitor_on");
    log(ts(), "monitor:", key, "->", c === "/monitor_on" ? "on" : "off");
  }
  const mon = await Monitor.load(monitorSend);
  await call("sendMessage", { chat_id: chatId, text: mon.statusText(), parse_mode: "HTML", disable_web_page_preview: true });
  return true;
}

async function handleAdminCallback(cq: any): Promise<any> {
  const msg = cq.message || {};
  if ((msg.chat || {}).type !== "private" || !A.isOwner(cq.from)) return call("answerCallbackQuery", { callback_query_id: cq.id });
  const data = cq.data || "";
  const chatId = msg.chat.id;
  if (data === "adm:noop") return call("answerCallbackQuery", { callback_query_id: cq.id });
  if (data === "adm:rpx") {
    await replyClear();
    await call("answerCallbackQuery", { callback_query_id: cq.id, text: "Отменено" });
    return tgTry("editMessageText", { chat_id: chatId, message_id: msg.message_id, text: "Ответ отменён.",
      reply_markup: { inline_keyboard: [A.SUP_BTN] } });
  }
  if (data.startsWith("adm:rp:")) {
    const uid = data.slice(7);
    let p: any = null;
    try {
      p = await A.replyTarget(uid);
    } catch (e) {
      log("admin error:", safeErr(e));
      p = null;
    }
    if (!p) return call("answerCallbackQuery", { callback_query_id: cq.id, text: "Этому пользователю нельзя ответить в боте", show_alert: true });
    await Promise.all([flagSet(chatId, "awaiting_lookup", false), flagSet(chatId, "awaiting_amount", false)]);
    await replySet(uid);
    await call("answerCallbackQuery", { callback_query_id: cq.id });
    return call("sendMessage", { chat_id: chatId, text: A.replyPrompt(p), parse_mode: "HTML", reply_markup: CANCEL_KB });
  }
  if (data === "adm:find") {
    await replyClear();
    await flagSet(chatId, "awaiting_lookup", true);
    await call("answerCallbackQuery", { callback_query_id: cq.id });
    return call("sendMessage", { chat_id: chatId, text: A.FIND_PROMPT });
  }
  let res: [string, any] | null;
  try {
    res = await A.screen(data);
  } catch (e) {
    log("admin error:", safeErr(e));
    return call("answerCallbackQuery", { callback_query_id: cq.id, text: "Не удалось прочитать базу", show_alert: true });
  }
  if (!res) return call("answerCallbackQuery", { callback_query_id: cq.id });
  await call("answerCallbackQuery", { callback_query_id: cq.id });
  const send = () => call("sendMessage", { chat_id: chatId, text: res![0], parse_mode: "HTML", reply_markup: res![1], disable_web_page_preview: true });
  if ((msg.text || "").startsWith("🆘 Новое")) return send();
  try {
    return await call("editMessageText", { chat_id: chatId, message_id: msg.message_id, text: res[0], parse_mode: "HTML",
      reply_markup: res[1], disable_web_page_preview: true });
  } catch {
    return send();
  }
}

// ---------- вывод средств ----------
export const WD_RE = /^wd:(ok|no|rq|bk|op):([nl]):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

async function wdUserSend(chatId: number, text: string): Promise<[boolean, string | null]> {
  const [r, err] = await tgTry("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: "История выводов", url: SHOP_URL + "#/profile/withdrawals" }]] } });
  return [r !== null, err];
}
export async function wdOwnerSend(chatId: number, text: string, markup: any): Promise<[boolean, string | null]> {
  const [r, err] = await tgTry("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup, disable_web_page_preview: true });
  return [r !== null, err];
}
async function wdShow(chatId: number, messageId: number, res: [string, any], edit = true) {
  const [t, mk] = res;
  if (edit) {
    const [r, err] = await tgTry("editMessageText", { chat_id: chatId, message_id: messageId, text: t, parse_mode: "HTML",
      reply_markup: mk, disable_web_page_preview: true });
    if (r !== null || (err || "").includes("not modified")) return r;
  }
  return (await tgTry("sendMessage", { chat_id: chatId, text: t, parse_mode: "HTML", reply_markup: mk, disable_web_page_preview: true }))[0];
}

async function handleWithdrawCallback(cq: any): Promise<any> {
  const msg = cq.message || {};
  if ((msg.chat || {}).type !== "private" || !A.isOwner(cq.from)) return call("answerCallbackQuery", { callback_query_id: cq.id });
  const m = (cq.data || "").match(WD_RE);
  if (!m) return call("answerCallbackQuery", { callback_query_id: cq.id });
  const [, act, src, wid] = m;
  const chatId = msg.chat.id, mid = msg.message_id;
  let toast: string, status: string | null, note: string;
  try {
    if (["op", "rq", "bk"].includes(act)) {
      const res = await W.openCard(wid, src, null, act === "rq");
      await call("answerCallbackQuery", { callback_query_id: cq.id });
      return wdShow(chatId, mid, res);
    }
    [toast, status, note] = await W.applyAction(wid, act, wdUserSend);
    log(ts(), "withdrawal", wid.slice(-6), act, "->", status);
  } catch (e) {
    log("withdraw action error:", safeErr(e));
    return call("answerCallbackQuery", { callback_query_id: cq.id, text: "Не удалось обновить базу. Попробуй ещё раз.", show_alert: true });
  }
  await call("answerCallbackQuery", { callback_query_id: cq.id, text: toast, ...(status === null ? { show_alert: true } : {}) });
  if (status === null) return null;
  let res: [string, any];
  try {
    res = await W.openCard(wid, src, W.resultLine(status, note));
  } catch (e) {
    log("withdraw card error:", safeErr(e));
    return null;
  }
  return wdShow(chatId, mid, res);
}

// ---------- сообщения ----------
export async function handleMessage(m: any): Promise<any> {
  const chatId = m.chat.id;
  if (m.successful_payment) return handleSuccessfulPayment(m);
  const text = (m.text || "").trim();
  if (await handleAdminMessage(m, text)) return;
  if (await handleUserSupportReply(m, text)) return;
  const from = m.from || {};
  if (text.startsWith("/start")) {
    log(ts(), "/start from", from.id, "chat", chatId, JSON.stringify(text.slice(0, 40)));
    if (m.chat.type === "private") await recordStart(m.chat, from);
    const [kind, val] = parseStart(text);
    if (kind === "login") {
      await flagSet(chatId, "awaiting_amount", false);
      const ok = await grantLogin(val, from);
      return call("sendMessage", { chat_id: chatId, text: ok ? LOGIN_OK : LOGIN_FAIL, reply_markup: WELCOME_MARKUP });
    }
    if (kind === "topup") {
      if (val === null) {
        await flagSet(chatId, "awaiting_amount", true);
        return call("sendMessage", { chat_id: chatId, text: ASK_AMOUNT });
      }
      await flagSet(chatId, "awaiting_amount", false);
      return sendTopup(chatId, val, from.id);
    }
    await flagSet(chatId, "awaiting_amount", false);
    return sendWelcome(chatId);
  }
  if (m.chat.type !== "private") return;
  if (text === "/paysupport" || text === "/help") return call("sendMessage", { chat_id: chatId, text: PAYSUPPORT, parse_mode: "HTML" });
  if (text.startsWith("/topup")) {
    const rub = text.slice(6).trim() ? parseAmount(text.slice(6)) : null;
    if (rub === null) {
      await flagSet(chatId, "awaiting_amount", true);
      return call("sendMessage", { chat_id: chatId, text: ASK_AMOUNT });
    }
    await flagSet(chatId, "awaiting_amount", false);
    return sendTopup(chatId, rub, from.id);
  }
  if (text && await flagGet(chatId, "awaiting_amount")) {
    const rub = parseAmount(text);
    const err = amountError(rub);
    if (err) return call("sendMessage", { chat_id: chatId, text: err });
    await flagSet(chatId, "awaiting_amount", false);
    return sendTopup(chatId, rub!, from.id);
  }
}

export async function orderSend(chatId: number, text: string): Promise<[boolean, string | null]> {
  const [r, err] = await tgTry("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: "Открыть сайт", url: SHOP_URL + "#/profile/sells" }]] } });
  return [r !== null, err];
}
