// Пополнение баланса звёздами Telegram.
// Сайт (вошедший пользователь) присылает {amount} в рублях → создаём платёж в star_payments (service role)
// и счёт в Telegram Stars (createInvoiceLink, XTR) на round(amount * 0.8) звёзд.
// Ссылку на счёт возвращаем сайту и дублируем кнопкой в чат с ботом.
// Деньги зачисляет ТОЛЬКО бот после successful_payment (stars_credit) — этот код баланс не трогает.
import { admin, anon, json, cors, tgSend, SITE_URL } from '../_shared/common.ts';

const MIN = 10, MAX = 12500;
const ERR: Record<string, [number, string]> = {
  bad_amount: [400, `Сумма пополнения: от ${MIN} до ${MAX.toLocaleString('ru-RU')} ₽`],
  no_profile: [404, 'Профиль не найден. Войдите через Telegram ещё раз'],
  banned: [403, 'Ваш аккаунт заблокирован'],
  too_many: [429, 'Слишком много счетов подряд. Подождите несколько минут'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await anon().auth.getUser(jwt);
  if (!u?.user) return json({ error: 'auth', message: 'Сначала войдите через Telegram' }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount < MIN || amount > MAX) return json({ error: 'bad_amount', message: ERR.bad_amount[1] }, 400);

  const token = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!token) { console.log('no bot token'); return json({ error: 'config', message: 'Оплата временно недоступна' }, 503); }

  const db = admin();
  const { data: rows, error } = await db.rpc('stars_create_payment', { p_amount: amount, p_user_id: u.user.id });
  if (error || !rows?.length) {
    const code = Object.keys(ERR).find((k) => (error?.message || '').includes(k));
    if (!code) console.log('stars_create_payment failed', error?.message);
    const [status, message] = code ? ERR[code] : [500, 'Не удалось создать счёт. Попробуйте ещё раз'];
    return json({ error: code || 'db', message }, status);
  }
  const p = rows[0];

  const r = await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `Пополнение на ${p.amount_rub} ₽`, // до 32 символов
      description: `Пополнение баланса EVSA SHOP на ${p.amount_rub} ₽ за ${p.stars} ⭐ (скидка 20%)`,
      payload: p.payload,
      provider_token: '',
      currency: 'XTR',
      prices: [{ label: `${p.amount_rub} ₽ на баланс`, amount: p.stars }],
    }),
  });
  const tg = await r.json().catch(() => ({}));
  if (!tg?.ok || typeof tg.result !== 'string') {
    console.log('createInvoiceLink failed', r.status, tg?.description);
    await db.from('star_payments').update({ status: 'failed' }).eq('id', p.payment_id).eq('status', 'pending');
    return json({ error: 'telegram', message: 'Telegram не создал счёт. Попробуйте ещё раз' }, 502);
  }
  const url: string = tg.result;
  await db.from('star_payments').update({ invoice_link: url }).eq('id', p.payment_id);

  // дублируем счёт в чат с ботом (пользователь уже запускал бота при входе)
  await tgSend(p.telegram_id, `💳 Пополнение баланса EVSA SHOP: ${p.amount_rub} ₽ → ${p.stars} ⭐\nНажми кнопку, чтобы оплатить звёздами. После оплаты ${p.amount_rub} ₽ сразу появятся на балансе.`, {
    inline_keyboard: [[{ text: `Оплатить ${p.stars} ⭐`, url }], [{ text: 'Открыть EVSA SHOP', url: SITE_URL + '#/profile' }]],
  }).catch(() => {});

  return json({ ok: true, url, amount: p.amount_rub, stars: p.stars, payment_id: p.payment_id });
});
