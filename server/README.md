# EVSA SHOP — сервер (каркас)

Заготовка backend на **Node.js + Express + PostgreSQL**. Живой сайт на GitHub Pages работает **без** этого сервера (демо-режим, данные в localStorage).

Что уже есть в каркасе:
- проверка подписи Telegram Login Widget (`/api/auth/telegram`), один Telegram = один аккаунт;
- каталог и создание товаров (PREMIUM — списание 19 ₽ в транзакции);
- покупка с резервом денег, защита от двойной покупки (`Idempotency-Key`, `SELECT … FOR UPDATE`);
- подтверждение получения → перевод денег продавцу;
- пополнение Telegram Stars (XTR) через `createInvoiceLink` и однократное зачисление по `successful_payment`;
- заявки на вывод с ручной обработкой администратором, бан, журнал действий админа;
- схема БД: `db/schema.sql`.

## Запуск
```bash
cp .env.example .env   # заполнить значения на сервере
npm install
npm run migrate
npm start
```

## Безопасность
- Токен бота хранится **только** в переменной окружения `TELEGRAM_BOT_TOKEN` на сервере. Никогда не вставляйте его в HTML/JS и не коммитьте в GitHub.
- `.env` уже в `.gitignore`.
- Telegram-бот — отдельный процесс; он должен вызывать `creditStarsPayment()` при `successful_payment`.
