// Порт evsa_withdraw.py: заявки на вывод (карточки владельцу, кнопки, завершение/отклонение).
import { clip, dt, esc, fitText, get, londonNowStr, log, nowIso, OWNER_ID, qs, rpc, rub, write } from "./lib.ts";
import type { Send } from "./admin.ts";

export const STAR_RATE = 0.8;
export const MIN_RUB = 50;
export const MAX_AGE_DAYS = 7;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const COLS = "id,user_id,amount_rub,status,tg_id,tg_username,created_at,processed_at";
export const STATUS: Record<string, string> = { pending: "⏳ В ожидании", completed: "✅ Завершён", rejected: "❌ Отклонён" };
const HOME_BTN = [{ text: "⬅️ Меню", callback_data: "adm:home" }];
const kb = (rows: any[]) => ({ inline_keyboard: rows });

export function starsFor(r: unknown): number {
  const v = Number(r);
  if (r === null || r === undefined || r === "" || !Number.isFinite(v)) return 0;
  return Math.max(1, Math.trunc(v * STAR_RATE + 0.5));
}

async function mark(wid: string) {
  await write("PATCH", "withdrawals?" + qs({ id: "eq." + wid, notified_at: "is.null" }), { notified_at: nowIso() });
}

export async function unnotified(): Promise<any[]> {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400e3).toISOString();
  return await get("withdrawals", { select: COLS, status: "eq.pending", notified_at: "is.null", created_at: "gt." + since,
    order: "created_at.asc", limit: "20" });
}

export async function getOne(wid: string): Promise<any> {
  if (!UUID_RE.test(wid || "")) return null;
  const rows = await get("withdrawals", { select: COLS, id: "eq." + wid, limit: "1" });
  return rows.length ? rows[0] : null;
}

export async function pendingList(limit = 10) {
  return await get("withdrawals", { select: COLS, status: "eq.pending", order: "created_at.asc", limit: String(limit + 1) });
}

export async function balances(uids: unknown[]): Promise<Record<string, any>> {
  const s = [...new Set(uids.filter(Boolean) as string[])].sort();
  if (!s.length) return {};
  const rows = await get("wallets", { select: "user_id,balance,unlimited", user_id: "in.(" + s.join(",") + ")" });
  return Object.fromEntries(rows.map((r: any) => [r.user_id, r]));
}

async function profilesByIds(ids: unknown[]) {
  const A = await import("./admin.ts");
  return A.profilesByIds(ids);
}

export const complete = async (wid: string) => (await rpc("withdrawal_complete", { p_id: wid }, 15000)) || {};
export const reject = async (wid: string) => (await rpc("withdrawal_reject", { p_id: wid }, 15000)) || {};

export function tgLink(w: any, p?: any): string | null {
  const u = w.tg_username || (p || {}).username;
  return u ? "https://t.me/" + u : null;
}

export function tgIdOf(w: any): number {
  const t = Number(w.tg_id || 0);
  if (!Number.isFinite(t)) return 0;
  const i = Math.trunc(t);
  return i > 0 ? i : 0;
}

export function tgUserHtml(w: any, p?: any): string {
  const u = w.tg_username || (p || {}).username;
  if (u) return `<a href="https://t.me/${esc(u)}">@${esc(u)}</a>`;
  const tid = tgIdOf(w);
  const name = esc(clip((p || {}).name, 40)) || "пользователь";
  if (tid) return `<a href="tg://user?id=${tid}">${name}</a> (без username, открыть по ID)`;
  return "без username";
}

export function card(w: any, p?: any, wal?: any, result?: string | null): string {
  const amt = Math.trunc(Number(w.amount_rub || 0));
  const name = (p || {}).name;
  const lines = ["<b>💸 Запрос на вывод</b> · <code>#" + esc(String(w.id).slice(-6)) + "</code>",
    `Сумма: <b>${rub(amt)}</b> ≈ <b>${starsFor(amt)} ⭐</b>`,
    "", "<b>👤 Профиль</b>",
    `Ник на сайте: ${name ? esc(clip(name, 60)) : "—"}`,
    "Telegram: " + tgUserHtml(w, p),
    `Telegram ID: <code>${esc(w.tg_id)}</code>`];
  if (wal !== null && wal !== undefined) {
    const bal = wal.unlimited ? "∞" : rub(wal.balance);
    lines.push(`Баланс сейчас: <b>${bal}</b>` + (w.status === "pending" ? " (сумма вывода уже списана)" : ""));
  }
  lines.push(`Создан: ${dt(w.created_at)} (Лондон)`);
  const st = w.status;
  if (result) lines.push("", result);
  else if (st === "pending") {
    lines.push("", `🎁 Отправьте пользователю подарок за звёзды в Telegram (≈ ${starsFor(amt)} ⭐), затем нажмите «✅ Вывод завершён».`,
      ...((w.tg_username || (p || {}).username) ? [] :
        [`ℹ️ У пользователя нет @username: откройте его по ссылке выше (tg://user?id=${tgIdOf(w)}) ` +
          "или найдите по Telegram ID, и отправьте подарок из его профиля."]),
      "«❌ Отклонить» — сумма вернётся на баланс пользователя.");
  } else lines.push("", `Статус: <b>${STATUS[st] ?? esc(st)}</b> · ${dt(w.processed_at)}`);
  return lines.join("\n");
}

export function buttons(w: any, src = "n", p?: any, confirmReject = false) {
  const wid = w.id;
  const rows: any[] = [];
  if (w.status === "pending") {
    if (confirmReject) {
      rows.push([{ text: "❌ Да, отклонить и вернуть деньги", callback_data: `wd:no:${src}:${wid}` }]);
      rows.push([{ text: "⬅️ Назад", callback_data: `wd:bk:${src}:${wid}` }]);
    } else {
      rows.push([{ text: "✅ Вывод завершён", callback_data: `wd:ok:${src}:${wid}` },
        { text: "❌ Отклонить", callback_data: `wd:rq:${src}:${wid}` }]);
    }
  }
  const link = tgLink(w, p);
  if (link && !confirmReject) rows.push([{ text: "💬 Открыть Telegram пользователя", url: link }]);
  if (src === "l") rows.push([{ text: "⬅️ Выводы", callback_data: "adm:wd:0" }, ...HOME_BTN]);
  return { inline_keyboard: rows };
}

export function userText(status: string, amt: unknown): string {
  if (status === "completed") {
    return `✅ Вывод ${rub(amt)} завершён.\n\n🎁 Подарок за звёзды отправлен вам в Telegram. ` +
      "Спасибо, что пользуетесь EVSA SHOP!";
  }
  return `❌ Вывод ${rub(amt)} отклонён, деньги вернулись на баланс.\n\nВопросы — напишите в поддержку на сайте.`;
}

export const RESULT: Record<string, string> = { completed: "✅ <b>Вывод завершён</b>", rejected: "❌ <b>Вывод отклонён</b> — деньги возвращены на баланс" };

const TG_ERRORS: [string, string][] = [["blocked", "пользователь заблокировал бота"], ["chat not found", "пользователь не запускал бота"],
  ["deactivated", "аккаунт пользователя удалён"], ["can't initiate", "пользователь не запускал бота"]];

export async function applyAction(wid: string, action: string, tgSend: Send): Promise<[string, string | null, string]> {
  const res: any = action === "ok" ? await complete(wid) : await reject(wid);
  const st = res.status, wst = res.withdrawal_status, amt = res.amount;
  if (st === "not_found") return ["Заявка не найдена", null, ""];
  if (st === "conflict") {
    const s = String(STATUS[wst] ?? wst);
    const i = s.indexOf(" ");
    return [`Заявка уже ${(i >= 0 ? s.slice(i + 1) : s).toLowerCase()} — действие не выполнено`, wst, ""];
  }
  if (st === "already") return ["Уже обработано ранее", wst, ""];
  if (st !== "ok") return ["Не удалось обновить заявку", null, ""];
  let note = "";
  const tid = res.tg_id;
  if (tid && Math.trunc(Number(tid)) > 0) {
    const [ok, err] = await tgSend(Math.trunc(Number(tid)), userText(wst, amt));
    if (ok) note = "Пользователь уведомлён в Telegram.";
    else {
      const low = (err || "").toLowerCase();
      const reason = TG_ERRORS.find(([k]) => low.includes(k))?.[1] ?? "ошибка Telegram";
      note = `⚠️ Уведомить пользователя не удалось: ${reason}.`;
    }
  }
  return [wst === "completed" ? "Вывод завершён" : "Вывод отклонён, деньги возвращены", wst, note];
}

export function resultLine(status: string, note = ""): string {
  const s = (RESULT[status] ?? STATUS[status] ?? status) + ` · ${londonNowStr("short")}`;
  return s + (note ? "\n" + esc(note) : "");
}

export type SendKb = (chatId: number, text: string, markup: any) => Promise<[boolean, string | null]>;

export async function notifyNew(tgSendKb: SendKb): Promise<number> {
  const rows = await unnotified();
  if (!rows.length) return 0;
  const profs = await profilesByIds(rows.map((r) => r.user_id));
  let bals: Record<string, any> = {};
  try {
    bals = await balances(rows.map((r) => r.user_id));
  } catch {
    bals = {};
  }
  const owner = OWNER_ID;
  let done = 0;
  for (const w of rows) {
    const p = profs[w.user_id];
    const [ok, err] = await tgSendKb(owner, card(w, p, bals[w.user_id] ?? { balance: 0 }), buttons(w, "n", p));
    if (!ok) {
      log("withdraw notify owner failed:", String(w.id).slice(-6), err);
      continue;
    }
    await mark(w.id);
    done += 1;
  }
  return done;
}

export async function adminList(_page = 0): Promise<[string, any]> {
  let rows = await pendingList(10);
  const more = rows.length > 10;
  rows = rows.slice(0, 10);
  const profs = await profilesByIds(rows.map((r: any) => r.user_id));
  const lines = ["<b>💸 Выводы — в ожидании</b> (старые сверху)\n"];
  const btns: any[] = [];
  rows.forEach((w: any, j: number) => {
    const i = j + 1;
    const p = profs[w.user_id] || {};
    const u = w.tg_username, tid = tgIdOf(w);
    const who = u ? "@" + esc(u) : (tid ? `<a href="tg://user?id=${tid}">без username</a>` : "без username");
    lines.push(`${i}. <b>${rub(w.amount_rub)}</b> ≈ ${starsFor(w.amount_rub)} ⭐ · ` +
      `${esc(clip(p.name, 24)) || "—"} · ${who}\n` +
      `   ID <code>${esc(w.tg_id)}</code> · ${dt(w.created_at)} · <code>#${esc(String(w.id).slice(-6))}</code>`);
    btns.push([{ text: `${i}. Открыть (${rub(w.amount_rub)})`, callback_data: "wd:op:l:" + w.id }]);
  });
  if (!rows.length) lines.push("Заявок в ожидании нет 🎉");
  else if (more) lines.push("\n<i>Показаны первые 10.</i>");
  return [lines.join("\n"), kb([...btns, [{ text: "🔄 Обновить", callback_data: "adm:wd:0" }, ...HOME_BTN]])];
}

export async function openCard(wid: string, src = "l", result: string | null = null, confirmReject = false): Promise<[string, any]> {
  const w = await getOne(wid);
  if (!w) return ["Заявка не найдена", kb([[{ text: "⬅️ Выводы", callback_data: "adm:wd:0" }, ...HOME_BTN]])];
  const p = (await profilesByIds([w.user_id]))[w.user_id];
  let wal: any;
  try {
    wal = (await balances([w.user_id]))[w.user_id] ?? { balance: 0 };
  } catch {
    wal = null;
  }
  return [fitText(card(w, p, wal, result)), buttons(w, src, p, confirmReject)];
}
