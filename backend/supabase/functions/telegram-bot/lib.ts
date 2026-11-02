// EVSA SHOP bot — общие помощники: Telegram API, PostgREST (service role), форматирование.
// Порт evsa_admin/evsa_pay/bot.py (Python, бокс) → Supabase Edge Function. Секреты не логируются.

export const SHOP_URL = "https://evsey67018.github.io/evsa-shop/";
export const OWNER_ID = 5327129904; // @evssssa — как DEFAULT_OWNER_ID в evsa_admin.py
export const SUPPORT = "@evssssa";

const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? "";
export const cfg = {
  token: () => env("TELEGRAM_BOT_TOKEN"),
  base: () => env("SUPABASE_URL").replace(/\/+$/, ""),
  key: () => env("SUPABASE_SERVICE_ROLE_KEY"),
};

export function safeErr(e: unknown): string {
  const s = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  const t = cfg.token();
  const k = cfg.key();
  let out = t ? s.split(t).join("***") : s;
  if (k) out = out.split(k).join("***");
  return out;
}

export function log(...a: unknown[]) {
  console.log(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
}

// ---------- Telegram ----------
export class TgError extends Error {
  constructor(public description: string, public status: number) {
    super(description);
    this.name = "TgError";
  }
}

// call(): как bot.call — HTTP-ошибка Telegram (4xx/5xx) = исключение.
export async function call(method: string, params: Record<string, unknown> = {}, timeoutMs = 30000): Promise<any> {
  const r = await fetch(`https://api.telegram.org/bot${cfg.token()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const txt = await r.text();
  let j: any = null;
  try {
    j = JSON.parse(txt);
  } catch { /* not json */ }
  if (!r.ok) throw new TgError((j && j.description) || `HTTP ${r.status}`, r.status);
  return j ?? {};
}

export async function callMultipart(method: string, files: Record<string, { name: string; data: Uint8Array; type: string }>,
  params: Record<string, unknown>): Promise<any> {
  // multipart собираем вручную: FormData превращает \n в строковых полях в \r\n (подпись приветствия должна совпадать байт в байт)
  const boundary = "----evsa" + crypto.randomUUID().replace(/-/g, "");
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const [k, v] of Object.entries(params)) {
    chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n` +
      (typeof v === "object" ? JSON.stringify(v) : String(v)) + "\r\n"));
  }
  for (const [k, f] of Object.entries(files)) {
    chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"; filename="${f.name}"\r\nContent-Type: ${f.type}\r\n\r\n`));
    chunks.push(f.data, enc.encode("\r\n"));
  }
  chunks.push(enc.encode(`--${boundary}--\r\n`));
  const body = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let o = 0;
  for (const c of chunks) { body.set(c, o); o += c.length; }
  const r = await fetch(`https://api.telegram.org/bot${cfg.token()}/${method}`, {
    method: "POST", headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` }, body, signal: AbortSignal.timeout(120000),
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new TgError(j.description || `HTTP ${r.status}`, r.status);
  return j;
}

// tg_try(): (result|null, описание ошибки|null)
export async function tgTry(method: string, params: Record<string, unknown> = {}): Promise<[any, string | null]> {
  try {
    return [await call(method, params), null];
  } catch (e) {
    if (e instanceof TgError) return [null, e.description || `HTTP ${e.status}`];
    return [null, safeErr(e)];
  }
}

// ---------- PostgREST (service role) ----------
export type Q = Record<string, string | number | undefined>;

// как urllib.parse.urlencode(q, safe=",.:()*")
export function qs(q: Q): string {
  return Object.entries(q).filter(([, v]) => v !== undefined).map(([k, v]) => enc(k) + "=" + enc(String(v))).join("&");
}
function enc(s: string): string {
  return encodeURIComponent(s).replace(/%2C/gi, ",").replace(/%3A/gi, ":").replace(/%20/g, "+")
    .replace(/!/g, "%21").replace(/'/g, "%27");
}

function hdr(extra: Record<string, string> = {}): Record<string, string> {
  const k = cfg.key();
  return { apikey: k, Authorization: "Bearer " + k, ...extra };
}

export class HttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP Error ${status}`);
    this.name = "HTTPError";
  }
}

async function req(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const r = await fetch(cfg.base() + "/rest/v1/" + path, { ...init, signal: AbortSignal.timeout(init.timeoutMs ?? 15000) });
  if (!r.ok) {
    const b = await r.text().catch(() => "");
    throw new HttpError(r.status, b);
  }
  return r;
}

export async function get(table: string, q: Q = {}): Promise<any[]> {
  const r = await req(table + "?" + qs(q), { headers: hdr() });
  const t = await r.text();
  return t ? JSON.parse(t) : [];
}

export async function count(table: string, q: Q = {}): Promise<number> {
  const qq = { select: "*", ...q };
  const r = await req(table + "?" + qs(qq), { method: "HEAD", headers: hdr({ Prefer: "count=exact", Range: "0-0" }) });
  const cr = r.headers.get("Content-Range") || "";
  const n = parseInt(cr.split("/").pop() || "", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function write(method: string, path: string, body?: unknown, prefer = "return=minimal"): Promise<any> {
  const r = await req(path, {
    method, headers: hdr({ "Content-Type": "application/json", Prefer: prefer }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export class PayError extends Error {
  constructor(public code: string) {
    super(code);
    this.name = "PayError";
  }
}

// evsa_pay.rpc: ошибки PostgREST → PayError(bad_amount|no_profile|banned|too_many|db); сетевые ошибки пробрасываются
export async function rpc(name: string, args: unknown, timeoutMs = 8000): Promise<any> {
  const r = await fetch(cfg.base() + "/rest/v1/rpc/" + name, {
    method: "POST", headers: hdr({ "Content-Type": "application/json" }), body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const t = await r.text();
  if (!r.ok) {
    let msg = "";
    try {
      msg = JSON.parse(t || "{}").message || "";
    } catch { /* */ }
    for (const code of ["bad_amount", "no_profile", "banned", "too_many"]) if (msg.includes(code)) throw new PayError(code);
    log("supabase rpc failed:", name, r.status);
    throw new PayError("db");
  }
  return t ? JSON.parse(t) : null;
}

// ---------- форматирование (как в evsa_admin.py) ----------
export const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const plen = (s: string) => Array.from(s).length;
const pslice = (s: string, a: number, b?: number) => Array.from(s).slice(a, b).join("");

export function clip(s: unknown, n: number): string {
  const v = String(s || "").replace(/\s+/g, " ").trim();
  return plen(v) <= n ? v : pslice(v, 0, n - 1) + "…";
}

export function clipLines(s: unknown, n: number): string {
  let v = String(s || "").replace(/[ \t\r\f\v]+/g, " ").trim();
  v = v.replace(/\n{3,}/g, "\n\n");
  return plen(v) <= n ? v : pslice(v, 0, n - 1) + "…";
}

function group3(intStr: string): string {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// rub_fmt без «₽»: 200 → '200', 1234.5 → '1 234,50'
export function rubNum(x: unknown): string | null {
  if (x === null || x === undefined || x === "") return null;
  const v = Number(x);
  if (!Number.isFinite(v)) return null;
  const neg = v < 0;
  const a = Math.abs(v);
  let s: string;
  if (a === Math.trunc(a)) s = group3(String(a));
  else {
    const [i, f] = a.toFixed(2).split(".");
    s = group3(i) + "," + f;
  }
  return (neg ? "-" : "") + s;
}

export function rub(x: unknown): string {
  const v = rubNum(x || 0);
  return v === null ? String(x) : v + " ₽";
}

export function rubFmt(x: unknown): string {
  const v = rubNum(x);
  return v === null ? String(x) : v;
}

// ---------- время ----------
export function parseTs(s: unknown): Date | null {
  if (!s) return null;
  if (s instanceof Date) return s;
  let v = String(s).trim().replace(" ", "T");
  // микросекунды → миллисекунды; без зоны = UTC (как monitor.parse_ts)
  v = v.replace(/(\.\d{3})\d+/, "$1");
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(v)) v += "Z";
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

type Parts = { y: number; m: number; d: number; H: number; M: number; S: number };
const fmtCache: Record<string, Intl.DateTimeFormat> = {};
export function tzParts(d: Date, tz: string): Parts {
  const f = fmtCache[tz] ??= new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, H: +o.hour % 24, M: +o.minute, S: +o.second };
}
const p2 = (n: number) => String(n).padStart(2, "0");
export const LONDON = "Europe/London";

// evsa_admin.dt: '%d.%m %H:%M' по Лондону
export function dt(s: unknown): string {
  if (!s) return "—";
  const d = parseTs(s);
  if (!d) return esc(s).slice(0, 16);
  const p = tzParts(d, LONDON);
  return `${p2(p.d)}.${p2(p.m)} ${p2(p.H)}:${p2(p.M)}`;
}

export function londonNowStr(fmt: "full" | "short", now = new Date()): string {
  const p = tzParts(now, LONDON);
  return fmt === "full" ? `${p2(p.d)}.${p2(p.m)}.${p.y} ${p2(p.H)}:${p2(p.M)}` : `${p2(p.d)}.${p2(p.m)} ${p2(p.H)}:${p2(p.M)}`;
}

// локальная полночь в зоне tz → UTC Date
export function tzMidnight(now: Date, tz: string): Date {
  const p = tzParts(now, tz);
  let guess = Date.UTC(p.y, p.m - 1, p.d);
  for (let i = 0; i < 3; i++) {
    const q = tzParts(new Date(guess), tz);
    const local = Date.UTC(q.y, q.m - 1, q.d, q.H, q.M, q.S);
    const want = Date.UTC(p.y, p.m - 1, p.d);
    guess += want - local;
  }
  return new Date(guess);
}

export function todayIso(now = new Date()): string {
  return tzMidnight(now, LONDON).toISOString();
}

export function tzDate(d: Date, tz: string): string {
  const p = tzParts(d, tz);
  return `${p.y}-${p2(p.m)}-${p2(p.d)}`;
}

// МСК (UTC+3, без перехода на летнее время)
export function mskParts(d: Date): Parts {
  const x = new Date(d.getTime() + 3 * 3600 * 1000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate(), H: x.getUTCHours(), M: x.getUTCMinutes(), S: x.getUTCSeconds() };
}
export function mskDate(d: Date): string {
  const p = mskParts(d);
  return `${p.y}-${p2(p.m)}-${p2(p.d)}`;
}
// evsa_monitor.msk: 'HH:MM' или 'dd.mm HH:MM', если не сегодня по Москве
export function msk(s: unknown, now?: Date): string {
  const d = parseTs(s);
  if (!d) return "—";
  const p = mskParts(d);
  const today = mskDate(now || new Date());
  return mskDate(d) === today ? `${p2(p.H)}:${p2(p.M)}` : `${p2(p.d)}.${p2(p.m)} ${p2(p.H)}:${p2(p.M)}`;
}

export const nowIso = () => new Date().toISOString();

// ---------- состояние бота в БД (bot_state: key → value jsonb) ----------
export async function stateGet(key: string): Promise<any> {
  const rows = await get("bot_state", { select: "value", key: "eq." + key, limit: "1" });
  return rows.length ? rows[0].value : null;
}
export async function stateSet(key: string, value: unknown): Promise<void> {
  await write("POST", "bot_state?on_conflict=key", { key, value, updated_at: nowIso() },
    "return=minimal,resolution=merge-duplicates");
}
export async function stateDel(key: string): Promise<void> {
  await write("DELETE", "bot_state?" + qs({ key: "eq." + key }));
}

export function fitText(text: string, limit = 4000): string {
  const a = Array.from(text);
  if (a.length <= limit) return text;
  const head = a.slice(0, limit - 20).join("");
  const i = head.lastIndexOf("\n");
  return (i >= 0 ? head.slice(0, i) : head) + "\n…";
}
