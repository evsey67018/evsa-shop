// Порт evsa_monitor.py: мониторинг сайта (события, здоровье, сводка 09:00 МСК, напоминания о выводах).
// Состояние — в таблице bot_state (ключи monitor / monitor_enabled / monitor_reset / monitor_backup), а не в monitor_seen.json.
// Тик запускает pg_cron каждые 20 с. Отчёт о бэкапе остаётся на box (backup_report.py), здесь его нет.
import { clip, count, esc, get, log as plog, msk, mskDate, mskParts, parseTs, rub, SHOP_URL, stateGet, stateSet } from "./lib.ts";
import { OWNER_ID } from "./lib.ts";
import { profilesByIds } from "./admin.ts";

export const INTERVAL = 20;
export const OVERLAP = 30;
export const HOLD_SUPPORT = 90;
export const FETCH_LIMIT = 200;
export const MAX_BACKOFF = 300;
export const ERR_NOTIFY_AFTER = 300;
export const HEALTH_EVERY = 240;
export const HEALTH_FAILS_DOWN = 2;
export const SUMMARY_HOUR_MSK = 9;
export const SUMMARY_LATEST_HOUR_MSK = 12;
export const WD_REMIND_AFTER = 2 * 3600;
export const WD_REMIND_EVERY = 6 * 3600;
export const PAY_WATCH_HOURS = 48;
export const HEARTBEAT = 900;
export const SLACK = 5; // с: тик cron ровно 20 с — не пропускаем цикл из-за долей секунды

export const TABLES = ["support_tickets", "profiles", "products", "orders", "chats", "messages", "reviews", "star_payments", "withdrawals"];
export const COLS: Record<string, string> = {
  support_tickets: "id,user_id,kind,source,category,text,name,username,created_at,notified_at",
  profiles: "id,telegram_id,username,name,created_at",
  products: "id,seller_id,title,price,old_price,status,created_at",
  orders: "id,product_id,buyer_id,seller_id,title,price,status,created_at",
  chats: "id,product_id,buyer_id,seller_id,created_at",
  messages: "id,chat_id,sender_id,text,created_at",
  reviews: "id,product_id,seller_id,buyer_id,rating,text,created_at",
  star_payments: "id,user_id,amount_rub,stars,status,created_at,paid_at",
  withdrawals: "id,user_id,amount_rub,status,tg_id,tg_username,created_at,processed_at",
};
export const FEATURES: Record<string, string> = { events: "события сайта", summary: "сводка в 09:00", health: "проверка сайта/базы",
  backup: "отчёт о бэкапе", wd: "напоминания о выводах" };
export const ALIASES: Record<string, string> = { "": "events", events: "events", "события": "events", summary: "summary", "сводка": "summary",
  health: "health", "здоровье": "health", backup: "backup", "бэкап": "backup",
  wd: "wd", withdrawals: "wd", "выводы": "wd", all: "all", "все": "all", "всё": "all" };

const log = (...a: unknown[]) => plog("monitor:", ...a);
export const iso = (d: Date) => d.toISOString();
const EPOCH = new Date(0);

export function defaultEnabled(): Record<string, boolean> {
  return Object.fromEntries(Object.keys(FEATURES).map((k) => [k, true]));
}
export function defaultSt(): any {
  return { tables: {}, pay_watch: {}, wd_reminded: {}, summary_date: null, health: { up: true, since: null } };
}
export function defaultRt(): any {
  return { started: null, last_check: null, last_ok: null, last_sent: null, fails: 0, fail_since: null, last_error: null,
    err_notified: false, next_events: 0, next_health: 0, next_misc: 0, next_wd: 0, last_heartbeat: 0, health_fails: 0,
    last_health: null, misc_error: null, reset_applied: null };
}

export function initTable(latest: any[]): any {
  const rows = (latest || []).filter((r) => r.id && parseTs(r.created_at));
  if (!rows.length) return { cursor: "1970-01-01T00:00:00+00:00", ids: {} };
  const cur = new Date(Math.max(...rows.map((r) => parseTs(r.created_at)!.getTime())));
  const lo = cur.getTime() - 2 * OVERLAP * 1000;
  const ids: Record<string, string> = {};
  for (const r of rows) {
    const c = parseTs(r.created_at)!;
    if (c.getTime() >= lo) ids[r.id] = iso(c);
  }
  return { cursor: iso(cur), ids };
}

export function isHeld(table: string, row: any, now: Date): boolean {
  if (table !== "support_tickets" || (row.kind ?? "user") !== "user" || row.notified_at) return false;
  const d = parseTs(row.created_at);
  return !!d && (now.getTime() - d.getTime()) / 1000 < HOLD_SUPPORT;
}

export function diff(table: string, rows: any[], ts: any, now: Date): [any[], any] {
  let seen: Record<string, string> = { ...(ts.ids || {}) };
  let cursor = parseTs(ts.cursor) || EPOCH;
  const fresh: any[] = [], held: Date[] = [];
  for (const r of rows) {
    const rid = r.id, c = parseTs(r.created_at);
    if (!rid || !c || rid in seen) continue;
    if (isHeld(table, r, now)) {
      held.push(c);
      continue;
    }
    fresh.push(r);
    seen[rid] = iso(c);
    if (c > cursor) cursor = c;
  }
  if (held.length) cursor = new Date(Math.min(cursor.getTime(), ...held.map((d) => d.getTime())));
  const lo = cursor.getTime() - 2 * OVERLAP * 1000;
  seen = Object.fromEntries(Object.entries(seen).filter(([, v]) => (parseTs(v)?.getTime() ?? lo) >= lo));
  return [fresh, { cursor: iso(cursor), ids: seen }];
}

export function visible(table: string, r: any): boolean {
  if (table === "support_tickets") return !((r.kind ?? "user") === "user" && r.notified_at);
  if (table === "orders") return !["paid", "completed"].includes(r.status);
  if (table === "withdrawals") return r.status !== "pending";
  return true;
}

export function filterNew(nw: Record<string, any[]>): Record<string, any[]> {
  const out: Record<string, any[]> = {};
  for (const [t, rows] of Object.entries(nw)) {
    const keep = rows.filter((r) => visible(t, r));
    if (keep.length) out[t] = keep;
  }
  return out;
}

export function starsOf(r: unknown): number {
  const v = Number(r);
  if (r === null || r === undefined || r === "" || !Number.isFinite(v)) return 0;
  return Math.max(1, Math.trunc(v * 0.8 + 0.5));
}

const pyNone = (x: unknown) => (x === null || x === undefined ? "None" : String(x));

export class Ctx {
  profiles: Record<string, any>;
  chats: Record<string, any>;
  products: Record<string, any>;
  ownerTg: number;
  now: Date;
  constructor(o: { profiles?: any; chats?: any; products?: any; ownerTg?: number; now?: Date } = {}) {
    this.profiles = o.profiles || {};
    this.chats = o.chats || {};
    this.products = o.products || {};
    this.ownerTg = o.ownerTg ?? OWNER_ID;
    this.now = o.now || new Date();
  }
  isOwner(p: any): boolean {
    const v = Number((p && p.telegram_id) || 0);
    return !!p && Number.isFinite(v) && Math.trunc(v) === Math.trunc(this.ownerTg);
  }
  who(uid: any, fallback?: string | null): string {
    const p = uid ? this.profiles[uid] : null;
    if (p) {
      const s = p.username ? "@" + p.username : (clip(p.name, 30) || `id ${pyNone(p.telegram_id)}`);
      return esc(s) + (this.isOwner(p) ? " (это ты)" : "");
    }
    if (fallback) return esc(fallback);
    return "кто-то";
  }
  title(productId: any, fallback?: string): string {
    const p = productId ? this.products[productId] : null;
    const t = (p || {}).title || fallback;
    return t ? "«" + esc(clip(t, 50)) + "»" : "товар";
  }
}

export const PAY_ST: Record<string, string> = { pending: "⏳ счёт создан, не оплачен", paid: "✅ оплачено", failed: "❌ ошибка", refunded: "↩️ возврат" };
export const WD_ST: Record<string, string> = { pending: "⏳ в ожидании", completed: "✅ выполнен", rejected: "❌ отклонён" };
export const ORD_ST: Record<string, string> = { requested: "⏳ запрошен", paid: "оплачен", completed: "✅ выполнен", cancelled: "❌ отменён" };
export const PROD_ST: Record<string, string> = { active: "", sold: " (продан)", removed: " (снят)" };

const qq = (s: unknown, n: number) => "«" + esc(clip(s, n)) + "»";
const intOr0 = (x: unknown) => {
  const v = Math.trunc(Number(x || 0));
  return Number.isFinite(v) ? v : 0;
};

export function sections(nw: Record<string, any[]>, ctx: Ctx, payChanges: any[] = []): [string, string[]][] {
  const T = (r: any, k = "created_at") => msk(r[k], ctx.now);
  const out: [string, string[]][] = [];
  let lines: string[] = [];
  for (const r of nw.support_tickets || []) {
    if (r.kind === "reply") {
      lines.push(`${T(r)} ↩️ ответ поддержки для ${ctx.who(r.user_id)} (это ты): ${qq(r.text, 150)}`);
    } else {
      const fb = r.username ? "@" + r.username : "гость " + (r.name || "без имени");
      const cat = r.category ? ` [${esc(clip(r.category, 30))}]` : "";
      lines.push(`${T(r)} ${ctx.who(r.user_id, fb)}${cat}: ${qq(r.text, 300)} — ❗ нужен ответ (/admin → Поддержка)`);
    }
  }
  if (lines.length) out.push(["🆘 Поддержка", lines]);
  lines = (nw.profiles || []).map((r) => `${T(r)} ${ctx.who(r.id, r.name)}` +
    (r.username && r.name ? ` (${esc(clip(r.name, 30))})` : ""));
  if (lines.length) out.push(["👤 Новые пользователи", lines]);
  lines = [];
  for (const r of nw.products || []) {
    const old = Number(r.old_price || 0) > 0 ? ` (было ${rub(r.old_price)})` : "";
    lines.push(`${T(r)} ${ctx.who(r.seller_id)}: ${qq(r.title, 60)} — ${rub(r.price)}${old}${PROD_ST[r.status] ?? ""}`);
  }
  if (lines.length) out.push(["📦 Новые товары", lines]);
  lines = (nw.orders || []).map((r) => `${T(r)} ${ctx.who(r.buyer_id)} → ${ctx.who(r.seller_id)}: ${qq(r.title, 50)} — ${rub(r.price)}, ` +
    `${ORD_ST[r.status] ?? esc(r.status)}`);
  if (lines.length) out.push(["🛒 Заказы", lines]);
  lines = [];
  for (const r of nw.chats || []) {
    lines.push(`${T(r)} новый чат: ${ctx.who(r.buyer_id)} ↔ ${ctx.who(r.seller_id)} по ${ctx.title(r.product_id)}`);
  }
  for (const r of nw.messages || []) {
    const ch = ctx.chats[r.chat_id] || {};
    const to = r.sender_id === ch.buyer_id ? ch.seller_id : ch.buyer_id;
    const about = ch.product_id ? ` (${ctx.title(ch.product_id)})` : "";
    lines.push(`${T(r)} ${ctx.who(r.sender_id)} → ${ctx.who(to)}${about}: ${qq(r.text, 200)}`);
  }
  if (lines.length) out.push(["💬 Чаты сделок", lines]);
  lines = (nw.reviews || []).map((r) => {
    const n = intOr0(r.rating);
    return `${T(r)} ${ctx.who(r.buyer_id)} о ${ctx.who(r.seller_id)}: ${"★".repeat(Math.max(0, n))}${"☆".repeat(Math.max(0, 5 - n))} ${qq(r.text, 150)}`;
  });
  if (lines.length) out.push(["⭐ Отзывы", lines]);
  lines = [];
  for (const r of [...(nw.star_payments || []), ...payChanges]) {
    const k = r.status === "paid" && r.paid_at ? "paid_at" : "created_at";
    const stars = r.stars || starsOf(r.amount_rub);
    lines.push(`${T(r, k)} ${ctx.who(r.user_id)}: ${rub(r.amount_rub)} / ${stars} ⭐ — ` +
      `${PAY_ST[r.status] ?? esc(r.status)}`);
  }
  if (lines.length) out.push(["💳 Пополнения звёздами", lines]);
  lines = (nw.withdrawals || []).map((r) => `${T(r)} ${ctx.who(r.user_id, r.tg_username ? "@" + r.tg_username : null)}: ${rub(r.amount_rub)} — ` +
    `${WD_ST[r.status] ?? esc(r.status)}`);
  if (lines.length) out.push(["💸 Выводы", lines]);
  return out;
}

const ulen = (s: string) => Array.from(s).length;

export function formatMessage(secs: [string, string[]][], now?: Date): string[] {
  if (!secs.length) return [];
  const n = secs.reduce((s, [, ls]) => s + ls.length, 0);
  const nn = now || new Date();
  const head = `🔔 <b>EVSA SHOP: новое (${n})</b> · ${msk(nn, nn)}`;
  const parts: string[] = [];
  let cur = head;
  for (const [title, ls] of secs) {
    const block = [`\n<b>${title}</b>`, ...ls.map((l) => "• " + l)];
    for (const line of block) {
      if (ulen(cur) + ulen(line) + 1 > 3900) {
        parts.push(cur);
        cur = "🔔 <b>EVSA SHOP (продолжение)</b>";
      }
      cur += "\n" + line;
    }
  }
  parts.push(cur);
  return parts;
}

export function summaryText(c: any, now?: Date): string {
  now = now || new Date();
  const L = [`📊 <b>EVSA SHOP: сводка за 24 ч</b> (до ${msk(now, now)})`, "",
    `👤 Новые пользователи: <b>${c.users}</b>`,
    `🛒 Заказы: <b>${c.orders}</b> на <b>${rub(c.orders_sum)}</b>` +
    (c.orders_other ? ` (ещё ${c.orders_other} без оплаты/отменённых)` : ""),
    `💳 Пополнения: <b>${c.pay_count}</b> оплачено на <b>${rub(c.pay_rub)}</b> / <b>${c.pay_stars} ⭐</b>`,
    `💸 Выводы: запрошено <b>${c.wd_req}</b> (${rub(c.wd_req_sum)}), выполнено <b>${c.wd_done}</b> ` +
    `(${rub(c.wd_done_sum)}), отклонено <b>${c.wd_rej}</b> (${rub(c.wd_rej_sum)})`,
    `🆘 Сообщения в поддержку: <b>${c.support}</b>`,
    `⭐ Отзывы: <b>${c.reviews}</b>`];
  if (c.wd_pending) L.push(`\n⏳ Сейчас ждут вывода: <b>${c.wd_pending}</b> заявк. на ${rub(c.wd_pending_sum)}`);
  return L.join("\n");
}

const sumK = (rows: any[], k: string) => rows.reduce((s, r) => s + Number(r[k] || 0), 0);

export async function summaryCounts(now?: Date): Promise<any> {
  now = now || new Date();
  const since = "gte." + iso(new Date(now.getTime() - 24 * 3600e3));
  const [orders, pays, wreq, wdone, wrej, wpend, users, support, reviews] = await Promise.all([
    get("orders", { select: "price,status", created_at: since, limit: "5000" }),
    get("star_payments", { select: "amount_rub,stars", status: "eq.paid", paid_at: since, limit: "5000" }),
    get("withdrawals", { select: "amount_rub", created_at: since, limit: "5000" }),
    get("withdrawals", { select: "amount_rub", status: "eq.completed", processed_at: since, limit: "5000" }),
    get("withdrawals", { select: "amount_rub", status: "eq.rejected", processed_at: since, limit: "5000" }),
    get("withdrawals", { select: "amount_rub", status: "eq.pending", limit: "5000" }),
    count("profiles", { created_at: since }),
    count("support_tickets", { kind: "eq.user", created_at: since }),
    count("reviews", { created_at: since }),
  ]);
  const okord = orders.filter((o: any) => ["paid", "completed"].includes(o.status));
  return { users, orders: okord.length, orders_sum: sumK(okord, "price"), orders_other: orders.length - okord.length,
    pay_count: pays.length, pay_rub: sumK(pays, "amount_rub"), pay_stars: Math.trunc(sumK(pays, "stars")),
    wd_req: wreq.length, wd_req_sum: sumK(wreq, "amount_rub"), wd_done: wdone.length, wd_done_sum: sumK(wdone, "amount_rub"),
    wd_rej: wrej.length, wd_rej_sum: sumK(wrej, "amount_rub"), wd_pending: wpend.length, wd_pending_sum: sumK(wpend, "amount_rub"),
    support, reviews };
}

export function summaryDue(st: any, now: Date): boolean {
  const h = mskParts(now).H;
  return st.summary_date !== mskDate(now) && SUMMARY_HOUR_MSK <= h && h < SUMMARY_LATEST_HOUR_MSK;
}

export function wdDue(rows: any[], reminded: Record<string, number>, now: Date): [any[], Record<string, number>] {
  const due: any[] = [], keep: Record<string, number> = {};
  const nowS = now.getTime() / 1000;
  for (const w of rows) {
    const c = parseTs(w.created_at);
    if (!c) continue;
    const last = reminded[w.id];
    if (last !== undefined && last !== null) keep[w.id] = last;
    if ((now.getTime() - c.getTime()) / 1000 < WD_REMIND_AFTER) continue;
    if (last === undefined || last === null || nowS - Number(last) >= WD_REMIND_EVERY) {
      due.push(w);
      keep[w.id] = nowS;
    }
  }
  return [due, keep];
}

export function wdText(rows: any[], ctx: Ctx): [string, any] {
  const L = [`⏰ <b>Вывод ждёт больше 2 ч</b> (${rows.length})`];
  for (const w of rows) {
    const h = Math.floor((ctx.now.getTime() - parseTs(w.created_at)!.getTime()) / 3600e3);
    const fb = w.tg_username ? "@" + w.tg_username : null;
    L.push(`• ${ctx.who(w.user_id, fb)}: <b>${rub(w.amount_rub)}</b> ≈ ${starsOf(w.amount_rub)} ⭐ — ` +
      `с ${msk(w.created_at, ctx.now)} (~${h} ч)`);
  }
  L.push("Открой заявку кнопкой ниже или /admin → «Выводы».");
  const kb = { inline_keyboard: rows.slice(0, 8).map((w) => [{ text: `Открыть ${rub(w.amount_rub)}`, callback_data: "wd:op:l:" + w.id }]) };
  return [L.join("\n"), kb];
}

export function healthTransition(h: any, problems: string[], rt: any, now: number): string | null {
  if (problems.length) {
    rt.health_fails = (rt.health_fails || 0) + 1;
    if ((h.up ?? true) && rt.health_fails >= HEALTH_FAILS_DOWN) {
      h.up = false;
      h.since = now;
      return "🚨 <b>EVSA SHOP: проблема</b>\n" + problems.map((p) => "• " + esc(p)).join("\n") +
        "\nНапишу, когда всё восстановится.";
    }
    return null;
  }
  rt.health_fails = 0;
  if (!(h.up ?? true)) {
    const mins = Math.floor((now - Number(h.since || now)) / 60);
    h.up = true;
    h.since = now;
    return `✅ <b>EVSA SHOP снова работает</b> (сайт и база отвечают; простой ~${mins} мин)`;
  }
  return null;
}

// ---------- сеть ----------
const latestRows = (t: string) => get(t, { select: "id,created_at", order: "created_at.desc", limit: "50" });
const fetchSince = (t: string, since: string) =>
  get(t, { select: COLS[t], order: "created_at.asc", limit: String(FETCH_LIMIT), created_at: "gte." + since });

async function byIds(table: string, cols: string, ids: Iterable<any>): Promise<Record<string, any>> {
  const s = [...new Set([...ids].filter(Boolean))].sort();
  if (!s.length) return {};
  const rows = await get(table, { select: cols, id: "in.(" + s.join(",") + ")" });
  return Object.fromEntries(rows.map((r: any) => [r.id, r]));
}

export async function buildCtx(nw: Record<string, any[]>, payChanges: any[], now: Date): Promise<Ctx> {
  const chats: Record<string, any> = Object.fromEntries((nw.chats || []).map((r) => [r.id, r]));
  const need = new Set((nw.messages || []).map((m) => m.chat_id).filter((c) => !(c in chats)));
  Object.assign(chats, await byIds("chats", "id,product_id,buyer_id,seller_id", need));
  const uids = new Set<string>();
  for (const rows of [...Object.values(nw), payChanges]) {
    for (const r of rows) for (const k of ["user_id", "seller_id", "buyer_id", "sender_id"]) if (r[k]) uids.add(r[k]);
  }
  for (const r of nw.profiles || []) uids.add(r.id);
  for (const c of Object.values(chats)) {
    uids.add(c.buyer_id);
    uids.add(c.seller_id);
  }
  const pids = new Set([...Object.values(chats).map((c: any) => c.product_id), ...(nw.reviews || []).map((r) => r.product_id)]);
  return new Ctx({ profiles: await profilesByIds([...uids]), chats, products: await byIds("products", "id,title", pids), now });
}

const ename = (e: unknown) => (e instanceof Error ? e.name : "Error");
const emsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const errStr = (e: unknown) => `${ename(e)}: ${emsg(e)}`;
const errClip = (e: unknown, n: number) => `${ename(e)}: ${clip(emsg(e), n)}`;

export async function httpOk(url: string, timeoutMs = 20000): Promise<boolean> {
  const r = await fetch(url, { headers: { "User-Agent": "EVSA-monitor/1.0" }, signal: AbortSignal.timeout(timeoutMs) });
  await r.body?.cancel();
  if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
  return r.status === 200;
}

export type MonSend = (text: string, markup?: any) => Promise<[boolean, string | null]>;

// ---------- монитор: состояние из БД, один тик ----------
export class Monitor {
  st: any;
  rt: any;
  enabled: Record<string, boolean>;
  backupDate: string | null = null;
  constructor(public send: MonSend, saved?: any, enabled?: any, backup?: any) {
    this.st = { ...defaultSt(), ...((saved && saved.st) || {}) };
    this.rt = { ...defaultRt(), ...((saved && saved.rt) || {}) };
    this.enabled = { ...defaultEnabled(), ...(enabled || {}) };
    this.backupDate = (backup && backup.backup_date) || null;
  }

  static async load(send: MonSend): Promise<Monitor> {
    const [saved, enabled, backup] = await Promise.all([stateGet("monitor"), stateGet("monitor_enabled"), stateGet("monitor_backup")]);
    return new Monitor(send, saved, enabled, backup);
  }

  async save() {
    await stateSet("monitor", { st: this.st, rt: this.rt });
  }

  statusText(): string {
    const en = this.enabled, rt = this.rt;
    const ts = (x: number | null) => (x ? msk(new Date(x * 1000)) : "—");
    const L = ["🛰 <b>Мониторинг EVSA SHOP</b>"];
    for (const [k, name] of Object.entries(FEATURES)) {
      const on = en[k] ?? true;
      L.push(`${on ? "🟢" : "⚪️"} ${name}: ${on ? "вкл" : "выкл"}`);
    }
    L.push("");
    L.push(`Последняя проверка событий: ${ts(rt.last_check)} (каждые ~${INTERVAL} с)`);
    L.push(`Последнее уведомление: ${ts(rt.last_sent)}`);
    if (rt.fails) L.push(`⚠️ Ошибки подряд: ${rt.fails} — ${esc(clip(rt.last_error, 200))}`);
    else L.push("Ошибок нет ✅");
    const h = this.st.health || {};
    L.push(`Сайт/база: ${(h.up ?? true) ? "✅ работают" : "❌ НЕ работают"}` + ` (проверка ${ts(rt.last_health)})`);
    if (rt.misc_error) L.push(`⚠️ Доп. задачи: ${esc(clip(rt.misc_error, 150))}`);
    L.push(`Сводка: ${this.st.summary_date || "—"}, отчёт о бэкапе: ${this.backupDate || "—"}`);
    L.push("\nВкл/выкл: /monitor_on, /monitor_off [события|сводка|здоровье|бэкап|выводы|все]");
    return L.join("\n");
  }

  async eventsCycle(now = new Date()): Promise<number> {
    const st = JSON.parse(JSON.stringify(this.st));
    const tables = st.tables ??= {};
    const nw: Record<string, any[]> = {};
    const errors: Record<string, string> = {};
    for (const t of TABLES) {
      try {
        if (!(t in tables)) {
          tables[t] = initTable(await latestRows(t));
          if (t === "star_payments") {
            const since = iso(new Date(now.getTime() - PAY_WATCH_HOURS * 3600e3));
            const rows = await get(t, { select: "id,created_at", status: "eq.pending", created_at: "gte." + since, limit: "500" });
            st.pay_watch ??= {};
            for (const r of rows) st.pay_watch[r.id] = r.created_at;
          }
          continue;
        }
        const since = new Date(parseTs(tables[t].cursor)!.getTime() - OVERLAP * 1000);
        const [fresh, ts] = diff(t, await fetchSince(t, iso(since)), tables[t], now);
        tables[t] = ts;
        if (fresh.length) nw[t] = fresh;
      } catch (e) {
        errors[t] = errClip(e, 120);
      }
    }
    const payChanges: any[] = [];
    const watch: Record<string, string> = st.pay_watch ??= {};
    for (const r of nw.star_payments || []) if (r.status === "pending") watch[r.id] = r.created_at;
    const newIds = new Set((nw.star_payments || []).map((r) => r.id));
    const oldIds = Object.keys(watch).filter((i) => !newIds.has(i));
    if (oldIds.length && !("star_payments" in errors)) {
      try {
        const rows = await get("star_payments", { select: COLS.star_payments, id: "in.(" + oldIds.sort().slice(0, 100).join(",") + ")" });
        for (const r of rows) {
          if (r.status !== "pending") {
            payChanges.push(r);
            delete watch[r.id];
          }
        }
      } catch (e) {
        errors["star_payments/status"] = errClip(e, 120);
      }
    }
    const lo = now.getTime() - PAY_WATCH_HOURS * 3600e3;
    st.pay_watch = Object.fromEntries(Object.entries(watch).filter(([, v]) => (parseTs(v)?.getTime() ?? lo) >= lo));
    const shown = filterNew(nw);
    const n = Object.values(shown).reduce((s, v) => s + v.length, 0) + payChanges.length;
    if (n) {
      const ctx = await buildCtx(shown, payChanges, now);
      for (const part of formatMessage(sections(shown, ctx, payChanges), now)) {
        const [ok, err] = await this.send(part, null);
        if (!ok) throw new Error("telegram: " + clip(String(err), 120));
      }
      this.rt.last_sent = Date.now() / 1000;
    }
    this.st.tables = st.tables;
    this.st.pay_watch = st.pay_watch;
    if (Object.keys(errors).length) throw new Error(Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join("; "));
    return n;
  }

  async eventsTick() {
    const now = Date.now() / 1000;
    if (now < this.rt.next_events - SLACK) return;
    this.rt.last_check = now;
    try {
      const n = await this.eventsCycle();
      if (n || now - this.rt.last_heartbeat >= HEARTBEAT) {
        log(`${n} new`);
        this.rt.last_heartbeat = now;
      }
      if (this.rt.fails) {
        log(`recovered after ${this.rt.fails} failed cycles`);
        if (this.rt.err_notified) await this.send("✅ Мониторинг EVSA SHOP снова работает.", null);
      }
      Object.assign(this.rt, { fails: 0, fail_since: null, err_notified: false, last_ok: now, next_events: now + INTERVAL });
    } catch (e) {
      this.rt.fails += 1;
      this.rt.fail_since = this.rt.fail_since || now;
      this.rt.last_error = errStr(e);
      const delay = Math.min(INTERVAL * 2 ** (this.rt.fails - 1), MAX_BACKOFF);
      this.rt.next_events = now + delay;
      log(`error (#${this.rt.fails}, retry in ${delay}s):`, clip(this.rt.last_error, 300));
      const healthDown = !((this.st.health || {}).up ?? true);
      if (!this.rt.err_notified && now - this.rt.fail_since >= ERR_NOTIFY_AFTER && !healthDown) {
        const [ok] = await this.send(`⚠️ Мониторинг EVSA SHOP не может проверить сайт уже ${Math.floor((now - this.rt.fail_since) / 60)} мин.\n` +
          `Ошибка: ${esc(clip(this.rt.last_error, 200))}\nПовторяю автоматически; /monitor — статус.`, null);
        this.rt.err_notified = !!ok;
      }
    }
  }

  async healthCheck(): Promise<string[]> {
    const problems: string[] = [];
    const [site, db] = await Promise.allSettled([httpOk(SHOP_URL), get("profiles", { select: "id", limit: "1" })]);
    if (site.status === "rejected") problems.push(`сайт: ${ename(site.reason)} ${clip(emsg(site.reason), 80)}`);
    else if (!site.value) problems.push("сайт: ответ не 200");
    if (db.status === "rejected") problems.push(`база: ${ename(db.reason)} ${clip(emsg(db.reason), 80)}`);
    return problems;
  }

  async healthTick() {
    const now = Date.now() / 1000;
    if (now < this.rt.next_health - SLACK) return;
    this.rt.next_health = now + HEALTH_EVERY;
    this.rt.last_health = now;
    const problems = await this.healthCheck();
    const h = this.st.health ??= { up: true, since: null };
    const msg = healthTransition(h, problems, this.rt, now);
    if (msg) {
      log("health:", problems.length ? "DOWN" : "UP", problems.join("; "));
      const [ok] = await this.send(msg, null);
      if (!ok) h.up = !h.up;
    } else if (problems.length) {
      log("health: problem (not yet down):", problems.join("; "));
      this.rt.next_health = now + 60;
    }
  }

  async miscTick() {
    const nowTs = Date.now() / 1000;
    if (nowTs < this.rt.next_misc - SLACK) return;
    this.rt.next_misc = nowTs + 60;
    const now = new Date();
    const en = this.enabled;
    const errs: string[] = [];
    if ((en.summary ?? true) && summaryDue(this.st, now)) {
      try {
        const [ok, err] = await this.send(summaryText(await summaryCounts(now), now), null);
        if (ok) {
          this.st.summary_date = mskDate(now);
          log("daily summary sent");
        } else errs.push(`сводка: ${err}`);
      } catch (e) {
        errs.push(`сводка: ${errStr(e)}`);
      }
    }
    // бэкап: отчёт шлёт box-скрипт /workspace/evsa-ops/backup_report.py сразу после бэкапа
    if ((en.wd ?? true) && nowTs >= (this.rt.next_wd || 0) - SLACK) {
      this.rt.next_wd = nowTs + 300;
      try {
        const rows = await get("withdrawals", { select: COLS.withdrawals, status: "eq.pending", order: "created_at.asc", limit: "50" });
        const prev = this.st.wd_reminded || {};
        const [due, keep] = wdDue(rows, prev, now);
        if (due.length) {
          const ctx = new Ctx({ profiles: await profilesByIds(due.map((w) => w.user_id)), now });
          const [t, kb] = wdText(due, ctx);
          const [ok, err] = await this.send(t, kb);
          if (!ok) throw new Error(`telegram: ${err}`);
          log(`withdrawal reminder sent (${due.length})`);
        }
        if (due.length || JSON.stringify(sortObj(keep)) !== JSON.stringify(sortObj(prev))) this.st.wd_reminded = keep;
      } catch (e) {
        errs.push(`выводы: ${errStr(e)}`);
      }
    }
    if (errs.length) {
      const msg = errs.join("; ");
      if (msg !== this.rt.misc_error) log("misc error:", clip(msg, 300));
      this.rt.misc_error = msg;
    } else this.rt.misc_error = null;
  }

  async tick() {
    const en = this.enabled;
    const steps: [string, () => Promise<void>][] = [["events", () => this.eventsTick()], ["health", () => this.healthTick()],
      ["misc", () => this.miscTick()]];
    for (const [name, fn] of steps) {
      if (name in en && !(en[name] ?? true)) continue;
      try {
        await fn();
      } catch (e) {
        log(`${name} tick crashed:`, ename(e), clip(emsg(e), 200));
      }
    }
  }
}

function sortObj(o: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// Команды /monitor_on|off: включение событий после выключения сбрасывает курсоры (как set_enabled в Python).
export async function setEnabled(feature: string, on: boolean): Promise<void> {
  const cur = { ...defaultEnabled(), ...((await stateGet("monitor_enabled")) || {}) };
  const keys = feature === "all" ? Object.keys(FEATURES) : [feature];
  let reset = false;
  for (const k of keys) {
    const was = cur[k] ?? true;
    cur[k] = !!on;
    if (k === "events" && on && !was) reset = true;
  }
  await stateSet("monitor_enabled", cur);
  if (reset) await stateSet("monitor_reset", { at: Date.now() / 1000 });
}
