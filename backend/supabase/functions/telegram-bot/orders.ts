// Порт evsa_orders.py: уведомления о новых заказах владельцу (и продавцу).
import { clip, esc, get, log, nowIso, OWNER_ID, qs, rub, write } from "./lib.ts";
import { profilesByIds, who } from "./admin.ts";
import type { Send } from "./admin.ts";

export const MAX_AGE_DAYS = 3;

export async function pendingOrders(): Promise<any[]> {
  const since = new Date(Date.now() - MAX_AGE_DAYS * 86400e3).toISOString();
  return await get("orders", { select: "id,title,price,buyer_id,seller_id,created_at", status: "in.(paid,completed)",
    notified_at: "is.null", created_at: "gt." + since, order: "created_at.asc", limit: "20" });
}

export function orderText(o: any, buyer: any, seller: any, forSeller = false): string {
  const head = forSeller ? "🛒 Ваш товар купили!" : "🛒 Новый заказ на EVSA SHOP";
  const lines = [head, `Заказ: <code>#${esc(String(o.id).slice(-6))}</code>`, `Товар: ${esc(clip(o.title, 80))}`,
    `Цена: <b>${rub(o.price)}</b> (оплачено с баланса)`, `Покупатель: ${who(buyer)}`];
  if (!forSeller) {
    lines.push(`Продавец: ${who(seller)}`);
    lines.push(`ID заказа: <code>${esc(o.id)}</code>`);
  }
  lines.push("");
  lines.push(forSeller ? "Передайте товар покупателю в чате сделки на сайте." : "Выдача вручную: продавец передаёт товар в чате сделки.");
  return lines.join("\n");
}

export async function notifyNewOrders(tgSend: Send): Promise<number> {
  const rows = await pendingOrders();
  if (!rows.length) return 0;
  const profs = await profilesByIds([...rows.map((r) => r.buyer_id), ...rows.map((r) => r.seller_id)]);
  const owner = OWNER_ID;
  let done = 0;
  for (const o of rows) {
    const buyer = profs[o.buyer_id], seller = profs[o.seller_id];
    const [ok, err] = await tgSend(owner, orderText(o, buyer, seller));
    if (!ok) {
      log("order notify owner failed:", String(o.id).slice(-6), err);
      continue;
    }
    const sid = seller && seller.telegram_id;
    if (sid && Math.trunc(Number(sid)) !== owner) {
      const [ok2, err2] = await tgSend(Math.trunc(Number(sid)), orderText(o, buyer, seller, true));
      if (!ok2) log("order notify seller failed:", String(o.id).slice(-6), err2);
    }
    await write("PATCH", "orders?" + qs({ id: "eq." + o.id, notified_at: "is.null" }), { notified_at: nowIso() });
    done += 1;
  }
  return done;
}
