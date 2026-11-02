// EVSA SHOP Telegram-бот (@EVSA_SHOP_bot) на Supabase Edge Functions.
//   POST /telegram-bot        — вебхук Telegram (заголовок X-Telegram-Bot-Api-Secret-Token = TELEGRAM_WEBHOOK_SECRET)
//   POST /telegram-bot/tick   — pg_cron каждые 20 с (заголовок x-cron-secret = BOT_CRON_SECRET):
//                               повтор зачислений, уведомления о заказах/выводах (2 раза за тик ≈ каждые 10 с), мониторинг.
import { log, rpc, safeErr, stateGet } from "./lib.ts";
import { handleCallback, handleMessage, handlePreCheckout, monitorSend, orderSend, retryPending, wdOwnerSend } from "./bot.ts";
import { notifyNewOrders } from "./orders.ts";
import { notifyNew } from "./withdraw.ts";
import { Monitor } from "./monitor.ts";

const env = (k: string) => Deno.env.get(k) ?? "";

function same(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });

async function handleUpdate(u: any): Promise<Response> {
  const m = u.message;
  if (m && m.successful_payment) {
    // деньги: без дедупликации по update_id — зачисление идемпотентно (stars_credit по telegram_payment_charge_id)
    try {
      const ok = await handleMessage(m);
      if (ok === false) return json({ ok: false, retry: true }, 500); // запись не сохранилась и зачислить не удалось → Telegram повторит
    } catch (e) {
      log("handler error (payment):", safeErr(e));
    }
    return json({ ok: true });
  }
  try {
    const fresh = await rpc("bot_update_seen", { p_update_id: u.update_id }, 5000);
    if (fresh === false) return json({ ok: true, duplicate: true });
  } catch (e) {
    log("update dedup unavailable:", safeErr(e));
  }
  try {
    if (m) await handleMessage(m);
    else if (u.callback_query) await handleCallback(u.callback_query);
    else if (u.pre_checkout_query) await handlePreCheckout(u.pre_checkout_query);
  } catch (e) {
    log(new Date().toISOString(), "handler error:", safeErr(e));
  }
  return json({ ok: true });
}

async function notifyAll(out: any) {
  try {
    out.orders = (out.orders || 0) + await notifyNewOrders(orderSend);
  } catch (e) {
    log("orders notify error:", safeErr(e));
  }
  try {
    out.withdrawals = (out.withdrawals || 0) + await notifyNew(wdOwnerSend);
  } catch (e) {
    log("withdrawals notify error:", safeErr(e));
  }
}

async function runMonitor(out: any) {
  const mon = await Monitor.load(monitorSend);
  const reset0 = await stateGet("monitor_reset");
  const at0 = reset0 && reset0.at ? reset0.at : null;
  if (at0 && at0 !== mon.rt.reset_applied) {
    mon.st.tables = {};
    mon.st.pay_watch = {};
    mon.rt.next_events = 0;
    mon.rt.reset_applied = at0;
  }
  if (!mon.rt.started) mon.rt.started = Date.now() / 1000;
  await mon.tick();
  const reset1 = await stateGet("monitor_reset").catch(() => reset0);
  const at1 = reset1 && reset1.at ? reset1.at : null;
  if (at1 !== at0) { // события перезапущены командой во время тика — не затираем сброс
    mon.st.tables = {};
    mon.st.pay_watch = {};
    mon.rt.next_events = 0;
  }
  await mon.save();
  out.monitor = { fails: mon.rt.fails, health_up: (mon.st.health || {}).up ?? true };
}

async function tick(): Promise<Response> {
  const t0 = Date.now();
  let got = false;
  try {
    got = (await rpc("bot_lease", { p_name: "tick", p_ttl_seconds: 110 }, 5000)) === true;
  } catch (e) {
    log("lease error:", safeErr(e));
    return json({ ok: false, error: "lease" }, 500);
  }
  if (!got) return json({ ok: true, skipped: "busy" });
  const out: any = {};
  try {
    try {
      out.credited = await retryPending();
    } catch (e) {
      log("retry error:", safeErr(e));
    }
    await notifyAll(out);
    try {
      await runMonitor(out);
    } catch (e) {
      log("monitor error:", safeErr(e));
    }
    const wait = 10000 - (Date.now() - t0);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    await notifyAll(out);
  } finally {
    await rpc("bot_lease_release", { p_name: "tick" }, 5000).catch((e) => log("lease release error:", safeErr(e)));
  }
  out.ms = Date.now() - t0;
  return json({ ok: true, ...out });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  if (path.endsWith("/tick")) {
    if (!same(req.headers.get("x-cron-secret") || "", env("BOT_CRON_SECRET"))) return new Response("forbidden", { status: 403 });
    return await tick();
  }
  if (!same(req.headers.get("x-telegram-bot-api-secret-token") || "", env("TELEGRAM_WEBHOOK_SECRET"))) {
    return new Response("forbidden", { status: 403 });
  }
  let u: any;
  try {
    u = await req.json();
  } catch {
    return json({ ok: false }, 400);
  }
  return await handleUpdate(u);
});
