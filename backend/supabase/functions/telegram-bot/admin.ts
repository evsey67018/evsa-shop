// Порт evsa_admin.py: экраны владельца (/admin, /db), поддержка. Только чтение, кроме раздела «Поддержка».
import {
  clip, clipLines, count, dt, esc, get, londonNowStr, OWNER_ID, parseTs, qs, rub, fitText, todayIso, write, nowIso,
} from "./lib.ts";
import * as W from "./withdraw.ts";

export const ownerId = () => OWNER_ID;
export const isOwner = (u: any) => !!u && u.is_bot !== true && u.id === ownerId();

export const PAGE = 8;
export const LIMIT = 4000;

export async function profilesByIds(ids: Iterable<unknown>): Promise<Record<string, any>> {
  const s = [...new Set([...ids].filter(Boolean) as string[])].sort();
  if (!s.length) return {};
  const rows = await get("profiles", { select: "id,telegram_id,username,name", id: "in.(" + s.join(",") + ")" });
  return Object.fromEntries(rows.map((r: any) => [r.id, r]));
}

export function who(p: any): string {
  if (!p) return "—";
  return esc(p.username ? "@" + p.username : (clip(p.name, 24) || p.telegram_id));
}

export const kb = (rows: any[]) => ({ inline_keyboard: rows });
export const HOME_BTN = [{ text: "⬅️ Меню", callback_data: "adm:home" }];

export function menuRows() {
  return [[{ text: "👤 Пользователи", callback_data: "adm:users:0" }, { text: "🛍 Товары", callback_data: "adm:prod:0" }],
    [{ text: "⭐ Пополнения", callback_data: "adm:pay:0" }, { text: "🆘 Поддержка", callback_data: "adm:sup:0" }],
    [{ text: "💸 Выводы", callback_data: "adm:wd:0" }, { text: "🔎 Найти пользователя", callback_data: "adm:find" }],
    [{ text: "🔄 Обновить", callback_data: "adm:home" }]];
}

const sum = (a: any[], k: string) => a.reduce((s, x) => s + Number(x[k] || 0), 0);

export async function overview(): Promise<[string, any]> {
  const t = todayIso();
  const jobs: Record<string, () => Promise<any>> = {
    users: () => count("profiles"), users_t: () => count("profiles", { created_at: "gte." + t }),
    banned: () => count("profiles", { banned: "is.true" }),
    prod: () => count("products"), prod_a: () => count("products", { status: "eq.active" }),
    prod_t: () => count("products", { created_at: "gte." + t }),
    chats: () => count("chats"), msgs: () => count("messages"), msgs_t: () => count("messages", { created_at: "gte." + t }),
    orders: () => count("orders"), reviews: () => count("reviews"),
    tix: () => count("support_tickets", { kind: "eq.user" }),
    tix_t: () => count("support_tickets", { kind: "eq.user", created_at: "gte." + t }),
    tix_new: () => count("support_tickets", { kind: "eq.user", seen_at: "is.null" }),
    wallets: () => get("wallets", { select: "balance,unlimited", limit: "100000" }),
    paid: () => get("star_payments", { select: "amount_rub,stars,paid_at", status: "eq.paid", limit: "100000" }),
    pending: () => count("star_payments", { status: "eq.pending" }),
    wd_p: () => count("withdrawals", { status: "eq.pending" }),
  };
  const keys = Object.keys(jobs);
  const vals = await Promise.all(keys.map((k) => jobs[k]()));
  const r: Record<string, any> = Object.fromEntries(keys.map((k, i) => [k, vals[i]]));
  const lim = r.wallets.filter((w: any) => !w.unlimited);
  const unl = r.wallets.length - lim.length;
  const bal = lim.reduce((s: number, w: any) => s + Number(w.balance || 0), 0);
  const paid = r.paid;
  const t0 = new Date(t).getTime();
  const paidT = paid.filter((p: any) => p.paid_at && (parseTs(p.paid_at)?.getTime() ?? 0) >= t0);
  const text = "<b>📊 База EVSA SHOP</b>\n" +
    `<i>${londonNowStr("full")} (Лондон)</i>\n\n` +
    `👤 Пользователи: <b>${r.users}</b> (сегодня +${r.users_t}, заблокировано ${r.banned})\n` +
    `🛍 Товары: <b>${r.prod}</b> (активных ${r.prod_a}, сегодня +${r.prod_t})\n` +
    `💬 Чаты: <b>${r.chats}</b>, сообщений ${r.msgs} (сегодня +${r.msgs_t})\n` +
    `📦 Заказы: <b>${r.orders}</b> · ⭐ Отзывы: <b>${r.reviews}</b>\n` +
    `🆘 Поддержка: <b>${r.tix}</b> сообщений (сегодня +${r.tix_t}, непрочитанных ${r.tix_new})\n\n` +
    `💰 Балансы: <b>${rub(bal)}</b> на ${lim.length} кошельках` + (unl ? ` · ♾ безлимитных: ${unl}` : "") + "\n" +
    `⭐ Пополнения: <b>${paid.length}</b> на ${rub(sum(paid, "amount_rub"))} ` +
    `(${sum(paid, "stars")} ⭐), сегодня ${paidT.length} на ${rub(sum(paidT, "amount_rub"))}\n` +
    `⏳ Неоплаченных счетов: ${r.pending}\n` +
    `💸 Выводы в ожидании: <b>${r.wd_p}</b>`;
  return [text, kb(menuRows())];
}

export function pager(kind: string, page: number, hasNext: boolean) {
  const row: any[] = [];
  if (page > 0) row.push({ text: "◀️", callback_data: `adm:${kind}:${page - 1}` });
  row.push({ text: `стр. ${page + 1}`, callback_data: "adm:noop" });
  if (hasNext) row.push({ text: "▶️", callback_data: `adm:${kind}:${page + 1}` });
  return row;
}

const chunks = <T>(a: T[], n: number) => {
  const out: T[][] = [];
  for (let j = 0; j < a.length; j += n) out.push(a.slice(j, j + n));
  return out;
};

export async function usersPage(page: number): Promise<[string, any]> {
  let rows = await get("profiles", { select: "id,telegram_id,username,name,banned,created_at", order: "created_at.desc",
    offset: String(page * PAGE), limit: String(PAGE + 1) });
  const more = rows.length > PAGE;
  rows = rows.slice(0, PAGE);
  const lines = [`<b>👤 Пользователи</b> (новые сверху)\n`];
  const btns: any[] = [];
  rows.forEach((u: any, j: number) => {
    const i = page * PAGE + 1 + j;
    lines.push(`${i}. ${esc(clip(u.name, 30))} ${u.username ? "@" + esc(u.username) : ""}` +
      `${u.banned ? " 🚫" : ""}\n   ID <code>${pyStr(u.telegram_id)}</code> · ${dt(u.created_at)}`);
    btns.push({ text: `${i}`, callback_data: "adm:u:" + u.id });
  });
  if (!rows.length) lines.push("Пусто");
  const markup = [...chunks(btns, 4), pager("users", page, more), HOME_BTN];
  return [lines.join("\n"), kb(markup)];
}

// str(x) в Python для None → 'None'
export const pyStr = (x: unknown) => (x === null || x === undefined ? "None" : String(x));

export const STATUS: Record<string, string> = { active: "в продаже", sold: "продан", removed: "снят" };

export async function productsPage(page: number): Promise<[string, any]> {
  let rows = await get("products", { select: "id,seller_id,title,category,price,status,sales,created_at", order: "created_at.desc",
    offset: String(page * PAGE), limit: String(PAGE + 1) });
  const more = rows.length > PAGE;
  rows = rows.slice(0, PAGE);
  const ps = await profilesByIds(rows.map((r: any) => r.seller_id));
  const lines = ["<b>🛍 Товары</b> (новые сверху)\n"];
  rows.forEach((p: any, j: number) => {
    const i = page * PAGE + 1 + j;
    lines.push(`${i}. <b>${esc(clip(p.title, 50))}</b> — ${rub(p.price)}\n` +
      `   ${esc(clip(p.category, 20))} · ${STATUS[p.status] ?? esc(p.status)} · продаж ${p.sales || 0}` +
      ` · ${who(ps[p.seller_id])} · ${dt(p.created_at)}`);
  });
  if (!rows.length) lines.push("Пусто");
  return [lines.join("\n"), kb([pager("prod", page, more), HOME_BTN])];
}

export const PSTATUS: Record<string, string> = { paid: "✅ оплачен", pending: "⏳ ждёт оплаты", failed: "❌ ошибка", refunded: "↩️ возврат" };

export async function paymentsPage(page: number): Promise<[string, any]> {
  let rows = await get("star_payments", { select: "user_id,amount_rub,stars,status,payer_telegram_id,created_at,paid_at",
    order: "created_at.desc", offset: String(page * PAGE), limit: String(PAGE + 1) });
  const more = rows.length > PAGE;
  rows = rows.slice(0, PAGE);
  const ps = await profilesByIds(rows.map((r: any) => r.user_id));
  const lines = ["<b>⭐ Пополнения и счета</b> (новые сверху)\n"];
  rows.forEach((p: any, j: number) => {
    const i = page * PAGE + 1 + j;
    lines.push(`${i}. ${rub(p.amount_rub)} / ${p.stars} ⭐ — ${PSTATUS[p.status] ?? esc(p.status)}\n` +
      `   ${who(ps[p.user_id])} · ${dt(p.paid_at || p.created_at)}`);
  });
  if (!rows.length) lines.push("Пополнений пока нет");
  return [lines.join("\n"), kb([pager("pay", page, more), HOME_BTN])];
}

// ---------- поддержка ----------
export const SUP_PAGE = 6;
export const CONV_PAGE = 6;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SUP_COLS = "id,user_id,kind,source,category,text,name,username,contact,created_at,seen_at,delivered,error";
export const REPLY_PREFIX = "💬 Ответ поддержки EVSA SHOP:";
export const REPLY_HINT = "↩️ Чтобы ответить, ответьте на это сообщение (свайп влево или «Ответить»).";
export const REPLY_MAX = 3500;
export const SUP_BTN = [{ text: "⬅️ Поддержка", callback_data: "adm:sup:0" }];

const kindOf = (x: any) => x.kind ?? "user";
export const convKey = (row: any) => (row.user_id ? row.user_id : "g" + row.id);

export function parseKey(k: unknown): ["user" | "guest", string] | null {
  const s = String(k || "").toLowerCase();
  if (UUID_RE.test(s)) return ["user", s];
  if (s.startsWith("g") && UUID_RE.test(s.slice(1))) return ["guest", s.slice(1)];
  return null;
}

const convFilter = (kind: string, val: string) => (kind === "user" ? { user_id: "eq." + val } : { id: "eq." + val });

export function convTitle(key: string, rows: any[], prof: Record<string, any>): string {
  const p = prof[key];
  if (p) return who(p) + (p.telegram_id ? ` · ID <code>${p.telegram_id}</code>` : "");
  const r = rows.find((x) => x.kind === "user") ?? (rows.length ? rows[0] : {});
  const bits = [esc(clip(r.name, 30)) || "без имени", r.username ? "@" + esc(clip(r.username, 33)) : "",
    r.contact ? "контакт: " + esc(clip(r.contact, 60)) : ""];
  return (r.user_id ? "" : "Гость ") + bits.filter(Boolean).join(" ");
}

export async function supportList(page: number): Promise<[string, any]> {
  const rows = await get("support_tickets", { select: SUP_COLS, order: "created_at.desc", limit: "2000" });
  const convs: Record<string, any[]> = {};
  const order: string[] = [];
  for (const r of rows) {
    const k = convKey(r);
    if (!(k in convs)) {
      convs[k] = [];
      order.push(k);
    }
    convs[k].push(r);
  }
  const unreadTotal = order.filter((k) => convs[k].some((x) => kindOf(x) === "user" && !x.seen_at)).length;
  const openTotal = order.filter((k) => kindOf(convs[k][0]) === "user").length;
  const chunk = order.slice(page * SUP_PAGE, (page + 1) * SUP_PAGE);
  const prof = await profilesByIds(chunk.filter((k) => !k.startsWith("g")));
  const lines = [`<b>🆘 Поддержка</b> — диалогов ${order.length}, новых ${unreadTotal}, без ответа ${openTotal}`,
    "<i>🔴 есть непрочитанные · ⏳ ждёт ответа · ✅ отвечено</i>\n"];
  const btns: any[] = [];
  chunk.forEach((k, j) => {
    const i = page * SUP_PAGE + 1 + j;
    const c = convs[k];
    const last = c[0];
    const unread = c.filter((x) => kindOf(x) === "user" && !x.seen_at).length;
    const mark = unread ? "🔴" : (kindOf(last) === "user" ? "⏳" : "✅");
    const nuser = c.filter((x) => kindOf(x) === "user").length;
    lines.push(`${i}. ${mark} <b>${convTitle(k, c, prof)}</b>\n` +
      `   ${nuser} сообщ.${unread ? ` (новых ${unread})` : ""} · ${dt(last.created_at)}\n` +
      `   ${last.kind === "reply" ? "Вы: " : ""}${esc(clip(last.text, 90))}`);
    btns.push({ text: `${i}${unread ? " 🔴" : ""}`, callback_data: "adm:sc:" + k });
  });
  if (!order.length) lines.push("Пока никто не писал в поддержку.");
  const markup: any[] = [...chunks(btns, 3), pager("sup", page, order.length > (page + 1) * SUP_PAGE), HOME_BTN];
  return [lines.join("\n"), kb(markup)];
}

export async function markSeen(key: string) {
  const pk = parseKey(key);
  if (!pk) return;
  const q = { ...convFilter(pk[0], pk[1]), kind: "eq.user", seen_at: "is.null" };
  await write("PATCH", "support_tickets?" + qs(q), { seen_at: nowIso() });
}

export async function conversation(key: string, page = 0): Promise<[string, any]> {
  const pk = parseKey(key);
  if (!pk) return ["Диалог не найден", kb([SUP_BTN, HOME_BTN])];
  const [kind, val] = pk;
  let rows = await get("support_tickets", { select: SUP_COLS, order: "created_at.desc", offset: String(page * CONV_PAGE),
    limit: String(CONV_PAGE + 1), ...convFilter(kind, val) });
  const older = rows.length > CONV_PAGE;
  rows = rows.slice(0, CONV_PAGE);
  if (!rows.length && page === 0) return ["Сообщений нет", kb([SUP_BTN, HOME_BTN])];
  const prof = kind === "user" ? await profilesByIds([val]) : {};
  const p = prof[val];
  if (rows.some((r: any) => kindOf(r) === "user" && !r.seen_at)) {
    try {
      await markSeen(key);
    } catch { /* как в Python */ }
  }
  const head = [`<b>🆘 Переписка: ${convTitle(kind === "user" ? val : key, rows, prof)}</b>`];
  if (p && p.name) head.push(esc(clip(p.name, 60)));
  head.push(`<i>стр. ${page + 1}, новые снизу</i>\n`);
  const body: string[] = [];
  const budget = Math.floor((LIMIT - 300 - head.reduce((s, h) => s + Array.from(h).length, 0)) / Math.max(rows.length, 1));
  for (const r of [...rows].reverse()) {
    let h: string;
    if (kindOf(r) === "reply") {
      const st = r.delivered ? "✓ доставлено" : ("⚠️ не доставлено" + (r.error ? `: ${esc(clip(r.error, 80))}` : ""));
      h = `💬 <b>Поддержка</b> · ${dt(r.created_at)} · ${st}`;
    } else {
      const src = r.source === "bot" ? "бот" : "сайт";
      const nw = !r.seen_at ? " 🔴" : "";
      h = `👤 <b>Пользователь</b> · ${dt(r.created_at)} · ${src} · ${esc(clip(r.category, 30))}${nw}`;
      if (kind === "guest" && r.contact) h += `\nКонтакт: ${esc(clip(r.contact, 80))}`;
    }
    body.push(h + "\n" + esc(clipLines(r.text, Math.max(150, Math.min(1500, budget - Array.from(h).length - 10)))));
  }
  let text = head.join("\n") + body.join("\n\n");
  const nav: any[] = [];
  if (older) nav.push({ text: "◀️ Раньше", callback_data: `adm:sc:${key}:${page + 1}` });
  nav.push({ text: `стр. ${page + 1}`, callback_data: "adm:noop" });
  if (page > 0) nav.push({ text: "Новее ▶️", callback_data: `adm:sc:${key}:${page - 1}` });
  const markup: any[] = [];
  if (kind === "user" && p && p.telegram_id) markup.push([{ text: "✉️ Ответить", callback_data: "adm:rp:" + val }]);
  else if (kind === "guest") text += "\n\n<i>Гость без входа: ответить в боте нельзя — используйте контакт выше.</i>";
  markup.push(nav, [...SUP_BTN, ...HOME_BTN]);
  return [fit(text), kb(markup)];
}

export async function replyTarget(uid: string): Promise<any> {
  if (!UUID_RE.test(uid || "")) return null;
  const rows = await get("profiles", { select: "id,telegram_id,username,name", id: "eq." + uid, limit: "1" });
  return rows.length && rows[0].telegram_id ? rows[0] : null;
}

export function replyPrompt(p: any): string {
  return `✉️ Напишите ответ для ${who(p)} одним сообщением.\n` +
    `Он придёт от бота как «${REPLY_PREFIX}». Режим ответа закроется через 15 минут или по кнопке «Отмена».\n` +
    "<i>Команды (/admin и др.) работают как обычно и не отправляются.</i>";
}

export const TG_ERRORS: [string, string][] = [["blocked", "пользователь заблокировал бота"], ["chat not found", "пользователь не запускал бота"],
  ["deactivated", "аккаунт пользователя удалён"], ["can't initiate", "пользователь не запускал бота"]];

export type Send = (chatId: number, text: string) => Promise<[boolean, string | null]>;

export async function sendReply(uid: string, text: string, tgSend: Send): Promise<[boolean, boolean, string | null]> {
  text = (text || "").trim();
  if (!text) return [false, false, "пустой ответ"];
  const n = Array.from(text).length;
  if (n > REPLY_MAX) return [false, false, `слишком длинно (${n} > ${REPLY_MAX} символов)`];
  const p = await replyTarget(uid);
  if (!p) return [false, false, "у пользователя нет Telegram ID"];
  const tid = Number(p.telegram_id);
  let ok: boolean, err: string | null;
  if (tid < 0) {
    ok = false;
    err = "тестовый пользователь — сообщение не отправлялось";
  } else {
    [ok, err] = await tgSend(tid, `${REPLY_PREFIX}\n\n${text}\n\n${REPLY_HINT}`);
    if (!ok) {
      const low = (err || "").toLowerCase();
      err = TG_ERRORS.find(([k]) => low.includes(k))?.[1] ?? clip(err || "ошибка Telegram", 150);
    }
  }
  let saved = true;
  try {
    await write("POST", "support_tickets", { user_id: uid, kind: "reply", source: "bot", category: "Ответ поддержки",
      text, delivered: ok, error: ok ? null : clip(err, 200), seen_at: nowIso() });
  } catch {
    saved = false;
  }
  return [ok, saved, err];
}

export class SupportError extends Error {
  constructor(public code: "short" | "long" | "no_profile") {
    super(code);
  }
}

export async function saveUserMessage(fromUser: any, text: string): Promise<[string, any]> {
  text = (text || "").trim();
  const n = Array.from(text).length;
  if (n < 2) throw new SupportError("short");
  if (n > 1500) throw new SupportError("long");
  const rows = await get("profiles", { select: "id,telegram_id,username,name", telegram_id: "eq." + String(Math.trunc(Number(fromUser.id))), limit: "1" });
  if (!rows.length) throw new SupportError("no_profile");
  const p = rows[0];
  await write("POST", "support_tickets", { user_id: p.id, kind: "user", source: "bot", category: "Ответ в боте",
    text, name: clip(p.name || fromUser.first_name, 40) || null,
    username: (p.username || fromUser.username || null), notified_at: nowIso() });
  return [p.id, p];
}

export function ownerNotice(p: any, text: string): [string, any] {
  return [`🆘 Новое сообщение в поддержку (ответ в боте)\nОт: ${who(p)}\n\n${esc(clipLines(text, 1500))}`,
    kb([[{ text: "Открыть", callback_data: "adm:sc:" + p.id }]])];
}

export async function findProfile(q: string): Promise<any> {
  q = (q || "").trim();
  const m = /^@?([A-Za-z0-9_]{3,32})$/.exec(q);
  let rows: any[];
  if (/^\d{3,20}$/.test(q)) rows = await get("profiles", { select: "*", telegram_id: "eq." + q, limit: "1" });
  else if (m) rows = await get("profiles", { select: "*", username: "ilike." + m[1].replace(/_/g, "\\_"), limit: "1" });
  else return null;
  return rows.length ? rows[0] : null;
}

export async function userCard(p: any): Promise<[string, any]> {
  const uid = p.id;
  const [w, pays, np, nb, ns, nt] = await Promise.all([
    get("wallets", { select: "balance,unlimited", user_id: "eq." + uid }),
    get("star_payments", { select: "amount_rub,stars,status,created_at,paid_at", user_id: "eq." + uid, order: "created_at.desc", limit: "10" }),
    count("products", { seller_id: "eq." + uid }),
    count("orders", { buyer_id: "eq." + uid }),
    count("orders", { seller_id: "eq." + uid }),
    count("support_tickets", { user_id: "eq." + uid, kind: "eq.user" }),
  ]);
  const bal = w.length ? w[0].balance : 0;
  const unlimited = !!(w.length && w[0].unlimited);
  const paid = pays.filter((x: any) => x.status === "paid");
  const lines = [`<b>👤 ${esc(clip(p.name, 60))}</b>${p.banned ? " 🚫 заблокирован" : ""}`,
    `${p.username ? "@" + esc(p.username) : "без username"} · ID <code>${pyStr(p.telegram_id)}</code>`,
    `На сайте с ${dt(p.created_at)}`, "",
    unlimited ? `💰 Баланс: <b>∞</b> (безлимит)` : `💰 Баланс: <b>${rub(bal)}</b>`,
    `🛍 Товаров: ${np} · покупок: ${nb} · продаж: ${ns} · обращений: ${nt}`, "",
    pays.length ? "<b>Последние счета:</b>" : "Пополнений нет"];
  for (const x of pays) {
    lines.push(`• ${rub(x.amount_rub)} / ${x.stars} ⭐ — ${PSTATUS[x.status] ?? esc(x.status)} · ` +
      `${dt(x.paid_at || x.created_at)}`);
  }
  if (paid.length) lines.push(`\nВсего оплачено (из последних 10): ${rub(sum(paid, "amount_rub"))}`);
  const rows = nt ? [[{ text: "🆘 Переписка с поддержкой", callback_data: "adm:sc:" + uid }]] : [];
  return [lines.join("\n"), kb([...rows, [{ text: "🔎 Найти другого", callback_data: "adm:find" }], HOME_BTN])];
}

export async function userByUuid(uid: string): Promise<any> {
  if (!/^[0-9a-f-]{36}$/.test(uid || "")) return null;
  const rows = await get("profiles", { select: "*", id: "eq." + uid, limit: "1" });
  return rows.length ? rows[0] : null;
}

export const fit = (text: string) => fitText(text, LIMIT);

export const FIND_PROMPT = "🔎 Пришли Telegram ID (число) или @username пользователя.";

const isDigits = (s: string | undefined) => !!s && /^[0-9]+$/.test(s);

export async function screen(data: string): Promise<[string, any] | null> {
  const parts = data.split(":");
  const kind = parts.length > 1 ? parts[1] : "home";
  const page = parts.length > 2 && isDigits(parts[2]) ? parseInt(parts[2], 10) : 0;
  let t: string, m: any;
  if (kind === "home") [t, m] = await overview();
  else if (kind === "users") [t, m] = await usersPage(page);
  else if (kind === "prod") [t, m] = await productsPage(page);
  else if (kind === "pay") [t, m] = await paymentsPage(page);
  else if (kind === "wd") [t, m] = await W.adminList(page);
  else if (kind === "sup" || kind === "tix") [t, m] = await supportList(page);
  else if (kind === "sc") {
    return await conversation(parts.length > 2 ? parts[2] : "", parts.length > 3 && isDigits(parts[3]) ? parseInt(parts[3], 10) : 0);
  } else if (kind === "u") {
    const p = await userByUuid(parts.length > 2 ? parts[2] : "");
    if (!p) return ["Пользователь не найден", kb([HOME_BTN])];
    [t, m] = await userCard(p);
  } else return null;
  return [fit(t), m];
}

export async function lookup(q: string): Promise<[string, any]> {
  let p: any = null;
  try {
    p = await findProfile(q);
  } catch {
    p = null;
  }
  if (!p) return [`Не нашёл пользователя «${esc(clip(q, 40))}». ${FIND_PROMPT}`, kb([HOME_BTN])];
  const [t, m] = await userCard(p);
  return [fit(t), m];
}
