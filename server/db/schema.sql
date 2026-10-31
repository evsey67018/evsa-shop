-- EVSA SHOP: схема PostgreSQL. Все деньги — в копейках (BIGINT), чтобы не было ошибок округления.
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT UNIQUE NOT NULL,              -- один Telegram = один аккаунт
  name TEXT NOT NULL, username TEXT, avatar_url TEXT,
  balance BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  reserved BIGINT NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  warnings INT NOT NULL DEFAULT 0,
  banned_at TIMESTAMPTZ, ban_reason TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  seller_id BIGINT NOT NULL REFERENCES users(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('game','site')), target_id TEXT NOT NULL,
  category TEXT NOT NULL, title TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 80),
  description TEXT NOT NULL, delivery TEXT, image_url TEXT,
  price BIGINT NOT NULL CHECK (price > 0), old_price BIGINT,
  premium BOOLEAN NOT NULL DEFAULT FALSE, sales INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS products_target ON products(target_type, target_id, category) WHERE status = 'active';
CREATE TABLE IF NOT EXISTS chats (
  id BIGSERIAL PRIMARY KEY, buyer_id BIGINT NOT NULL REFERENCES users(id), seller_id BIGINT NOT NULL REFERENCES users(id),
  product_id BIGINT REFERENCES products(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (buyer_id, seller_id, product_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY, chat_id BIGINT NOT NULL REFERENCES chats(id), sender_id BIGINT REFERENCES users(id), -- NULL = система
  text TEXT, image_url TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), read_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY, product_id BIGINT NOT NULL REFERENCES products(id),
  buyer_id BIGINT NOT NULL REFERENCES users(id), seller_id BIGINT NOT NULL REFERENCES users(id),
  chat_id BIGINT REFERENCES chats(id), price BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','delivered','completed','dispute','refunded')),
  idempotency_key TEXT UNIQUE,               -- защита от двойной покупки
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY, order_id BIGINT UNIQUE NOT NULL REFERENCES orders(id),
  seller_id BIGINT NOT NULL REFERENCES users(id), buyer_id BIGINT NOT NULL REFERENCES users(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5), text TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL, amount BIGINT NOT NULL, note TEXT, ref TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deposits (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id),
  method TEXT NOT NULL CHECK (method IN ('stars','gift')), amount BIGINT NOT NULL, stars INT, note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','rejected')),
  telegram_charge_id TEXT UNIQUE,            -- successful_payment засчитывается ровно один раз
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS withdrawals (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), amount BIGINT NOT NULL CHECK (amount >= 1500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), processed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), category TEXT NOT NULL, order_id BIGINT REFERENCES orders(id),
  status TEXT NOT NULL DEFAULT 'open', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGSERIAL PRIMARY KEY, ticket_id BIGINT NOT NULL REFERENCES tickets(id), from_admin BOOLEAN NOT NULL DEFAULT FALSE,
  text TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), text TEXT NOT NULL, link TEXT,
  read_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS favorites (user_id BIGINT REFERENCES users(id), product_id BIGINT REFERENCES products(id), PRIMARY KEY (user_id, product_id));
CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGSERIAL PRIMARY KEY, admin_id BIGINT NOT NULL REFERENCES users(id), action TEXT NOT NULL, details JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
