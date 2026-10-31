/*
 * EVSA SHOP — каркас backend (Express + PostgreSQL).
 * ВНИМАНИЕ: это заготовка. Живой сайт на GitHub Pages работает без неё (демо на localStorage).
 * Все секреты берутся только из переменных окружения (см. .env.example).
 */
'use strict';
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const env = process.env;
for (const k of ['DATABASE_URL', 'TELEGRAM_BOT_TOKEN', 'JWT_SECRET']) {
  if (!env[k]) { console.error('Не задана переменная окружения ' + k); process.exit(1); }
}
const pool = new Pool({ connectionString: env.DATABASE_URL });
const ADMIN_IDS = new Set(String(env.ADMIN_TG_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
const STAR_RATE = Number(env.STAR_RATE_RUB || 1.79);
const app = express();
app.use(helmet());
app.use(express.json({ limit: '200kb' }));
app.use((req, res, next) => { res.set('Access-Control-Allow-Origin', env.SITE_ORIGIN || ''); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key'); if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });
app.use('/api/', rateLimit({ windowMs: 60_000, max: 120 }));

const fail = (status, message) => Object.assign(new Error(message), { status });
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
async function tx(fn) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
  catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}

/* --- Вход через Telegram Login Widget: проверка подписи --- */
function checkTelegramAuth(data) {
  const { hash, ...rest } = data;
  if (!hash) return false;
  const check = Object.keys(rest).sort().map(k => k + '=' + rest[k]).join('\n');
  const secret = crypto.createHash('sha256').update(env.TELEGRAM_BOT_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secret).update(check).digest('hex');
  const fresh = Date.now() / 1000 - Number(rest.auth_date) < 86400;
  return fresh && crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(String(hash).padEnd(hmac.length).slice(0, hmac.length)));
}
app.post('/api/auth/telegram', wrap(async (req, res) => {
  if (!checkTelegramAuth(req.body || {})) throw fail(401, 'Неверная подпись Telegram');
  const b = req.body, name = [b.first_name, b.last_name].filter(Boolean).join(' ').slice(0, 64);
  const { rows } = await pool.query(
    `INSERT INTO users (tg_id, name, username, avatar_url, is_admin) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tg_id) DO UPDATE SET name = EXCLUDED.name, username = EXCLUDED.username, avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url)
     RETURNING *`, [b.id, name || 'Пользователь', b.username || null, b.photo_url || null, ADMIN_IDS.has(String(b.id))]);
  res.json({ token: jwt.sign({ uid: rows[0].id }, env.JWT_SECRET, { expiresIn: '30d' }), user: publicUser(rows[0]) });
}));
const publicUser = u => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar_url, balance: u.balance / 100, reserved: u.reserved / 100, banned: !!u.banned_at });

async function auth(req, res, next) {
  try {
    const t = String(req.headers.authorization || '').replace(/^Bearer /, '');
    const { uid } = jwt.verify(t, env.JWT_SECRET);
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [uid]);
    if (!rows[0]) throw 0;
    req.user = rows[0]; next();
  } catch (e) { res.status(401).json({ error: 'Требуется вход' }); }
}
const active = (req, res, next) => req.user.banned_at ? res.status(403).json({ error: 'Аккаунт заблокирован' }) : next();
const admin = (req, res, next) => req.user.is_admin ? next() : res.status(403).json({ error: 'Нет доступа' });

/* --- Каталог --- */
app.get('/api/products', wrap(async (req, res) => {
  const q = req.query, args = [], where = ["p.status = 'active'", 'u.banned_at IS NULL'];
  if (q.targetType) { args.push(q.targetType); where.push('p.target_type = $' + args.length); }
  if (q.targetId) { args.push(q.targetId); where.push('p.target_id = $' + args.length); }
  if (q.category) { args.push(q.category); where.push('p.category = $' + args.length); }
  if (q.search) { args.push('%' + String(q.search).slice(0, 60) + '%'); where.push('p.title ILIKE $' + args.length); }
  const order = { cheap: 'p.price ASC', expensive: 'p.price DESC', new: 'p.created_at DESC' }[q.sort] || 'p.premium DESC, p.sales DESC';
  const { rows } = await pool.query(`SELECT p.* FROM products p JOIN users u ON u.id = p.seller_id WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT 100`, args);
  res.json(rows);
}));
app.post('/api/products', auth, active, wrap(async (req, res) => {
  const b = req.body || {}, price = Math.round(Number(b.price) * 100);
  if (!b.title || b.title.length < 3 || b.title.length > 80) throw fail(400, 'Название: 3–80 символов');
  if (!(price > 0)) throw fail(400, 'Неверная цена');
  const premiumFee = b.premium ? 1900 : 0;
  const row = await tx(async c => {
    if (premiumFee) {
      const r = await c.query('UPDATE users SET balance = balance - $2 WHERE id = $1 AND balance >= $2 RETURNING id', [req.user.id, premiumFee]);
      if (!r.rowCount) throw fail(400, 'Недостаточно средств для PREMIUM');
      await c.query("INSERT INTO transactions (user_id, kind, amount, note) VALUES ($1,'premium',$2,'PREMIUM размещение')", [req.user.id, -premiumFee]);
    }
    const { rows } = await c.query(`INSERT INTO products (seller_id, target_type, target_id, category, title, description, delivery, image_url, price, old_price, premium)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.user.id, b.targetType, b.targetId, b.category, b.title, String(b.description || '').slice(0, 3000), b.delivery || null, b.imageUrl || null, price, b.oldPrice ? Math.round(b.oldPrice * 100) : null, !!b.premium]);
    return rows[0];
  });
  res.json(row);
}));

/* --- Покупка с резервом (безопасная сделка) --- */
app.post('/api/orders', auth, active, wrap(async (req, res) => {
  const key = String(req.headers['idempotency-key'] || '').slice(0, 80) || null;
  const order = await tx(async c => {
    if (key) { const ex = await c.query('SELECT * FROM orders WHERE idempotency_key = $1', [key]); if (ex.rows[0]) return ex.rows[0]; }
    const p = (await c.query("SELECT * FROM products WHERE id = $1 AND status = 'active' FOR UPDATE", [req.body.productId])).rows[0];
    if (!p) throw fail(404, 'Товар недоступен');
    if (String(p.seller_id) === String(req.user.id)) throw fail(400, 'Нельзя купить свой товар');
    const r = await c.query('UPDATE users SET balance = balance - $2, reserved = reserved + $2 WHERE id = $1 AND balance >= $2 RETURNING id', [req.user.id, p.price]);
    if (!r.rowCount) throw fail(400, 'Недостаточно средств');
    const chat = (await c.query(`INSERT INTO chats (buyer_id, seller_id, product_id) VALUES ($1,$2,$3)
      ON CONFLICT (buyer_id, seller_id, product_id) DO UPDATE SET product_id = EXCLUDED.product_id RETURNING id`, [req.user.id, p.seller_id, p.id])).rows[0];
    const o = (await c.query(`INSERT INTO orders (product_id, buyer_id, seller_id, chat_id, price, idempotency_key) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [p.id, req.user.id, p.seller_id, chat.id, p.price, key])).rows[0];
    await c.query("INSERT INTO transactions (user_id, kind, amount, note, ref) VALUES ($1,'purchase',$2,$3,$4)", [req.user.id, -p.price, 'Покупка (резерв)', 'order:' + o.id]);
    await c.query("UPDATE products SET sales = sales + 1, status = CASE WHEN category = 'accounts' THEN 'sold' ELSE status END WHERE id = $1", [p.id]);
    await c.query("INSERT INTO messages (chat_id, text) VALUES ($1, 'Сделка открыта. Деньги зарезервированы до подтверждения получения.')", [chat.id]);
    await c.query('INSERT INTO notifications (user_id, text, link) VALUES ($1,$2,$3)', [p.seller_id, 'Новая покупка: ' + p.title, '#/chat/' + chat.id]);
    return o;
  });
  res.json(order);
}));
app.post('/api/orders/:id/confirm', auth, active, wrap(async (req, res) => {
  const o = await tx(async c => {
    const o = (await c.query("SELECT * FROM orders WHERE id = $1 AND buyer_id = $2 AND status IN ('reserved','delivered') FOR UPDATE", [req.params.id, req.user.id])).rows[0];
    if (!o) throw fail(400, 'Сделку нельзя подтвердить');
    await c.query('UPDATE users SET reserved = reserved - $2 WHERE id = $1', [o.buyer_id, o.price]);
    await c.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [o.seller_id, o.price]);
    await c.query("UPDATE orders SET status = 'completed', completed_at = now() WHERE id = $1", [o.id]);
    await c.query("INSERT INTO transactions (user_id, kind, amount, note, ref) VALUES ($1,'sale',$2,'Продажа','order:' || $3)", [o.seller_id, o.price, o.id]);
    return o;
  });
  res.json({ ok: true, id: o.id });
}));

/* --- Пополнение Telegram Stars (XTR). Счёт создаётся через Bot API, зачисление — по successful_payment --- */
app.post('/api/deposits/stars', auth, active, wrap(async (req, res) => {
  const rub = Math.round(Number(req.body.amount));
  if (!(rub >= 10 && rub <= 100000)) throw fail(400, 'Сумма от 10 до 100 000 ₽');
  const stars = Math.ceil(rub / STAR_RATE);
  const d = (await pool.query("INSERT INTO deposits (user_id, method, amount, stars) VALUES ($1,'stars',$2,$3) RETURNING *", [req.user.id, rub * 100, stars])).rows[0];
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Пополнение EVSA SHOP', description: `Пополнение баланса на ${rub} ₽`, payload: 'dep:' + d.id, currency: 'XTR', prices: [{ label: 'Пополнение', amount: stars }] })
  }).then(x => x.json());
  if (!r.ok) throw fail(502, 'Не удалось создать счёт');
  res.json({ depositId: d.id, stars, link: r.result });
}));
/* Вызывается обработчиком бота при successful_payment (бот — отдельный процесс) */
async function creditStarsPayment(payload, chargeId, starsPaid) {
  const id = Number(String(payload).replace('dep:', ''));
  return tx(async c => {
    const d = (await c.query("SELECT * FROM deposits WHERE id = $1 FOR UPDATE", [id])).rows[0];
    if (!d || d.status !== 'pending' || d.stars !== starsPaid) return false;
    const dup = await c.query('SELECT 1 FROM deposits WHERE telegram_charge_id = $1', [chargeId]);
    if (dup.rowCount) return false;                                   // повтор — не засчитываем дважды
    await c.query("UPDATE deposits SET status = 'paid', telegram_charge_id = $2 WHERE id = $1", [id, chargeId]);
    await c.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [d.user_id, d.amount]);
    await c.query("INSERT INTO transactions (user_id, kind, amount, note, ref) VALUES ($1,'deposit',$2,'Пополнение Stars',$3)", [d.user_id, d.amount, chargeId]);
    return true;
  });
}

/* --- Вывод: деньги списываются сразу, админ обрабатывает вручную --- */
app.post('/api/withdrawals', auth, active, wrap(async (req, res) => {
  const amount = Math.round(Number(req.body.amount) * 100);
  if (!(amount >= 1500)) throw fail(400, 'Минимум 15 ₽');
  const w = await tx(async c => {
    const r = await c.query('UPDATE users SET balance = balance - $2 WHERE id = $1 AND balance >= $2 RETURNING id', [req.user.id, amount]);
    if (!r.rowCount) throw fail(400, 'Недостаточно средств');
    await c.query("INSERT INTO transactions (user_id, kind, amount, note) VALUES ($1,'withdraw',$2,'Заявка на вывод')", [req.user.id, -amount]);
    return (await c.query('INSERT INTO withdrawals (user_id, amount) VALUES ($1,$2) RETURNING *', [req.user.id, amount])).rows[0];
  });
  res.json(w);
}));

/* --- Админ --- */
app.post('/api/admin/users/:id/ban', auth, admin, wrap(async (req, res) => {
  await pool.query('UPDATE users SET banned_at = now(), ban_reason = $2 WHERE id = $1', [req.params.id, String(req.body.reason || '').slice(0, 300)]);
  await pool.query("INSERT INTO admin_logs (admin_id, action, details) VALUES ($1,'ban',$2)", [req.user.id, { userId: req.params.id, reason: req.body.reason }]);
  res.json({ ok: true });
}));
app.post('/api/admin/withdrawals/:id', auth, admin, wrap(async (req, res) => {
  const approve = req.body.status === 'approved';
  await tx(async c => {
    const w = (await c.query("SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending' FOR UPDATE", [req.params.id])).rows[0];
    if (!w) throw fail(400, 'Заявка уже обработана');
    await c.query('UPDATE withdrawals SET status = $2, processed_at = now() WHERE id = $1', [w.id, approve ? 'approved' : 'rejected']);
    if (!approve) await c.query('UPDATE users SET balance = balance + $2 WHERE id = $1', [w.user_id, w.amount]);
    await c.query('INSERT INTO admin_logs (admin_id, action, details) VALUES ($1,$2,$3)', [req.user.id, 'withdrawal', { id: w.id, approve }]);
  });
  res.json({ ok: true });
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => { if (!err.status) console.error(err); res.status(err.status || 500).json({ error: err.status ? err.message : 'Ошибка сервера' }); });
app.listen(Number(env.PORT || 3000), () => console.log('EVSA SHOP API запущен'));
module.exports = { creditStarsPayment };
