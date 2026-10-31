/* EVSA SHOP — локальное хранилище для демо-версии.
   ВНИМАНИЕ: в демо все данные живут в localStorage этого браузера.
   В рабочей версии те же операции выполняет сервер (/server) с PostgreSQL —
   там баланс нельзя изменить запросом из браузера. Интерфейс функций
   повторяет API сервера, чтобы фронтенд можно было переключить на него. */
'use strict';
(function () {
  var KEY = 'evsa_db_v1', SKEY = 'evsa_settings';
  var DAY = 86400000;

  /* ---------- настройки ---------- */
  var defSettings = { theme: 'dark', sound: true, notify: true, dnd: false, adminDemo: false };
  EVSA.settings = {
    get: function () { try { return Object.assign({}, defSettings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return Object.assign({}, defSettings); } },
    set: function (patch) { var s = Object.assign(this.get(), patch); localStorage.setItem(SKEY, JSON.stringify(s)); return s; }
  };

  /* ---------- утилиты ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return Date.now(); }
  function hashTg(str) { var h = 5381; for (var i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; return 100000000 + (h % 899999999); }
  function fail(msg) { var e = new Error(msg); e.userMessage = msg; throw e; }
  function money(n) { return Math.round(Number(n) * 100) / 100; }

  var D = null;
  var listeners = [];
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(D)); }
    catch (e) { fail('Хранилище браузера переполнено. Удалите старые объявления с фото или очистите демо-данные в настройках.'); }
    listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }

  function emptyDB() {
    return { v: 2, users: [], products: [], orders: [], transactions: [], reviews: [], chats: [], messages: [],
      tickets: [], notifications: [], withdrawals: [], deposits: [], bans: [], warnings: [], adminLogs: [], tasks: [], cart: {}, favs: {}, viewed: {}, currentUserId: null };
  }

  /* ---------- старт: пустой магазин (демо-товары, продавцы и отзывы удалены) ---------- */
  function seed() { D = emptyDB(); D.v = 2; save(); }

  /* Одноразовая чистка браузеров, где остались старые демо-данные (версия базы 1) */
  function purgeDemo() {
    var bad = {}, gone = {};
    D.users.forEach(function (u) { if (u.isSeed) bad[u.id] = 1; });
    D.products.forEach(function (p) { if (bad[p.sellerId]) gone[p.id] = 1; });
    D.orders.forEach(function (o) {
      if (!bad[o.sellerId] && !gone[o.productId]) return;
      var b = D.users.find(function (u) { return u.id === o.buyerId; });
      if (b && !bad[b.id] && (o.status === 'reserved' || o.status === 'delivered' || o.status === 'dispute')) {
        b.reserved = money(Math.max(0, (b.reserved || 0) - o.price)); b.balance = money((b.balance || 0) + o.price);
        D.transactions.push({ id: uid('t'), userId: b.id, type: 'refund', amount: money(o.price), note: 'Возврат: тестовый товар «' + o.title + '» удалён', ref: o.id, createdAt: now() });
      }
    });
    var badChat = {};
    D.chats.forEach(function (c) { if (bad[c.a] || bad[c.b] || gone[c.productId]) badChat[c.id] = 1; });
    D.users = D.users.filter(function (u) { return !bad[u.id]; });
    D.products = D.products.filter(function (p) { return !gone[p.id]; });
    D.orders = D.orders.filter(function (o) { return !bad[o.sellerId] && !gone[o.productId]; });
    D.reviews = D.reviews.filter(function (r) { return r.orderId !== 'seed' && !bad[r.sellerId] && !bad[r.buyerId]; });
    D.chats = D.chats.filter(function (c) { return !badChat[c.id]; });
    D.messages = D.messages.filter(function (m) { return !badChat[m.chatId]; });
    D.notifications = D.notifications.filter(function (n) { var m = /#\/chat\/([^/?#]+)/.exec(n.link || ''); return !(m && badChat[m[1]]); });
    D.tasks = [];
    ['cart', 'favs', 'viewed'].forEach(function (k) { Object.keys(D[k] || {}).forEach(function (uidk) { if (Array.isArray(D[k][uidk])) D[k][uidk] = D[k][uidk].filter(function (id) { return !gone[id]; }); }); });
    if (D.currentUserId && bad[D.currentUserId]) D.currentUserId = null;
    D.v = 2;
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {}
  }

  function load() {
    try { D = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { D = null; }
    if (!D || (D.v !== 1 && D.v !== 2)) seed();
    Object.keys(emptyDB()).forEach(function (k) { if (D[k] === undefined) D[k] = emptyDB()[k]; });
    if (D.v === 1) purgeDemo();
  }

  /* ---------- доступ ---------- */
  function user(id) { return D.users.find(function (u) { return u.id === id; }) || null; }
  function me() { return D.currentUserId ? user(D.currentUserId) : null; }
  function isBanned(u) { if (!u || !u.ban) return false; if (u.ban.perm) return true; if (u.ban.until > now()) return true; return false; }
  function requireMe() { var u = me(); if (!u) fail('Сначала войдите через Telegram'); return u; }
  function requireActive() { var u = requireMe(); if (isBanned(u)) fail(u.ban.perm ? 'Ваш аккаунт заблокирован навсегда' : 'Ваш аккаунт заблокирован до ' + new Date(u.ban.until).toLocaleString('ru-RU')); return u; }
  function requireAdmin() { if (!EVSA.settings.get().adminDemo) fail('Доступ только для администратора'); }
  function disc(p) { return p.oldPrice > p.price ? (p.oldPrice - p.price) / p.oldPrice : 0; }
  /* «онлайн»: текущий пользователь и часть демо-продавцов (детерминированно по часу) */
  function isOnline(u) { if (!u) return false; if (u.id === D.currentUserId) return true; return false; }
  function sellerStats(id) {
    var rv = D.reviews.filter(function (r) { return r.sellerId === id; });
    var avg = rv.length ? rv.reduce(function (s, r) { return s + r.rating; }, 0) / rv.length : 0;
    return { rating: Math.round(avg * 10) / 10, count: rv.length, sales: D.orders.filter(function (o) { return o.sellerId === id && o.status === 'completed'; }).length };
  }

  /* ---------- журнал ---------- */
  function tx(userId, type, amount, note, ref) { D.transactions.push({ id: uid('t'), userId: userId, type: type, amount: money(amount), note: note || '', ref: ref || null, createdAt: now() }); }
  function notify(userId, text, link, kind) {
    var n = { id: uid('n'), userId: userId, text: text, link: link || '', kind: kind || 'info', read: false, createdAt: now() };
    D.notifications.push(n);
    if (userId === D.currentUserId && EVSA.onNotify) setTimeout(function () { EVSA.onNotify(n); }, 0);
    return n;
  }
  function adminLog(action, targetId, details) { D.adminLogs.push({ id: uid('al'), action: action, targetId: targetId, details: details || '', createdAt: now() }); }
  function schedule(ms, type, payload) { D.tasks.push({ id: uid('k'), due: now() + ms, type: type, payload: payload }); }

  /* ---------- защита от повторных запросов ---------- */
  var inflight = {};
  function once(key, fn) {
    if (inflight[key]) fail('Операция уже выполняется, подождите…');
    inflight[key] = true;
    try { return fn(); } finally { setTimeout(function () { delete inflight[key]; }, 800); }
  }

  /* ---------- чаты ---------- */
  function getOrCreateChat(aId, bId, productId) {
    var c = D.chats.find(function (c) { return c.productId === productId && ((c.a === aId && c.b === bId) || (c.a === bId && c.b === aId)); });
    if (!c) { c = { id: uid('c'), a: aId, b: bId, productId: productId, orderId: null, lastAt: now(), unread: {} }; D.chats.push(c); }
    return c;
  }
  function pushMsg(chatId, from, text, sys) {
    var c = D.chats.find(function (x) { return x.id === chatId; });
    var m = { id: uid('m'), chatId: chatId, from: from, text: String(text).slice(0, 2000), system: !!sys, createdAt: now() };
    D.messages.push(m); c.lastAt = m.createdAt;
    [c.a, c.b].forEach(function (u) { if (u !== from) c.unread[u] = (c.unread[u] || 0) + 1; });
    return m;
  }

  /* ---------- фоновые задачи (сейчас нет; демо-боты удалены) ---------- */
  function runTasks() {
    if (!D || !D.tasks.length) return;
    var n = D.tasks.length; D.tasks = D.tasks.filter(function (t) { return t.due > now(); });
    if (D.tasks.length !== n) save();
  }

  /* =========================================================
     ПУБЛИЧНОЕ API (повторяет серверные эндпоинты /api/*)
     ========================================================= */
  EVSA.db = {
    init: function () { load(); setInterval(runTasks, 1000); runTasks(); },
    onChange: function (f) { listeners.push(f); },
    raw: function () { return D; },
    reset: function () { localStorage.removeItem(KEY); seed(); },
    me: me, user: user, isBanned: isBanned, sellerStats: sellerStats, isOnline: isOnline,

    /* --- авторизация (демо). В рабочей версии: Telegram Login Widget + проверка hash на сервере --- */
    login: function (data) {
      var name = String(data.name || '').trim().slice(0, 40), username = String(data.username || '').trim().replace(/^@/, '').slice(0, 32);
      if (name.length < 2) fail('Введите имя (минимум 2 символа)');
      if (username && !/^[A-Za-z0-9_]{3,32}$/.test(username)) fail('Username: латиница, цифры и _, от 3 символов');
      var tgId = hashTg((username || name).toLowerCase());
      var u = D.users.find(function (x) { return x.tgId === tgId; }); // один Telegram ID = один аккаунт
      if (u) { u.name = name; u.username = username; if (data.avatar) u.avatar = data.avatar; u.lastSync = now(); }
      else {
        u = { id: uid('u'), tgId: tgId, name: name, username: username, avatar: data.avatar || null, color: ['#8b5cf6', '#22d3ee', '#ec4899', '#f59e0b', '#22c55e'][tgId % 5],
          balance: 0, reserved: 0, warnings: 0, ban: null, createdAt: now(), lastSync: now() };
        D.users.push(u);
        notify(u.id, 'Добро пожаловать в EVSA SHOP, ' + name + '!', '#/', 'info');
      }
      D.currentUserId = u.id; save(); return u;
    },
    loginAs: function (id) { var u = user(id); if (!u) fail('Пользователь не найден'); D.currentUserId = id; save(); return u; },
    logout: function () { D.currentUserId = null; save(); },
    updateAvatar: function (dataUrl) { var u = requireMe(); u.avatar = dataUrl; u.lastSync = now(); save(); },

    /* --- каталог --- */
    products: function (q) {
      q = q || {};
      var list = D.products.filter(function (p) {
        if (p.status !== 'active') return false;
        if (q.targetType && p.targetType !== q.targetType) return false;
        if (q.targetId && p.targetId !== q.targetId) return false;
        if (q.category && p.category !== q.category) return false;
        if (q.sellerId && p.sellerId !== q.sellerId) return false;
        var s = user(p.sellerId); if (isBanned(s)) return false;
        if (q.delivery && p.delivery !== q.delivery) return false;
        if (q.minPrice && p.price < Number(q.minPrice)) return false;
        if (q.maxPrice && p.price > Number(q.maxPrice)) return false;
        if (q.discountOnly && !(p.oldPrice > p.price)) return false;
        if (q.online && !isOnline(s)) return false;
        if (q.withReviews && !sellerStats(p.sellerId).count) return false;
        if (q.search) { var needle = q.search.toLowerCase(); if (p.title.toLowerCase().indexOf(needle) < 0) return false; }
        return true;
      });
      var sort = q.sort || 'popular';
      var cmp = {
        cheap: function (a, b) { return a.price - b.price; },
        expensive: function (a, b) { return b.price - a.price; },
        popular: function (a, b) { return b.sales - a.sales; },
        new: function (a, b) { return b.createdAt - a.createdAt; },
        discount: function (a, b) { return disc(b) - disc(a); },
        rating: function (a, b) { return sellerStats(b.sellerId).rating - sellerStats(a.sellerId).rating || sellerStats(b.sellerId).count - sellerStats(a.sellerId).count; }
      }[sort] || function () { return 0; };
      return list.sort(function (a, b) { return (b.premium - a.premium) || cmp(a, b); }); // Premium всегда выше
    },
    product: function (id) { return D.products.find(function (p) { return p.id === id; }) || null; },
    countFor: function (type, id, cat) { return D.products.filter(function (p) { return p.status === 'active' && p.targetType === type && p.targetId === id && (!cat || p.category === cat); }).length; },

    createProduct: function (f, premium) {
      return once('create', function () {
        var u = requireActive();
        if (!EVSA.findTarget(f.targetType, f.targetId)) fail('Выберите игру или сайт');
        if (!EVSA.CATEGORIES.some(function (c) { return c.id === f.category; })) fail('Выберите категорию');
        var title = String(f.title || '').trim(), desc = String(f.desc || '').trim();
        if (title.length < 4 || title.length > 80) fail('Название: от 4 до 80 символов');
        if (desc.length < 10 || desc.length > 2000) fail('Описание: от 10 до 2000 символов');
        var old = Number(f.oldPrice), sale = f.salePrice === '' || f.salePrice == null ? 0 : Number(f.salePrice);
        if (!isFinite(old) || old < 10 || old > 1000000) fail('Цена без скидки: от 10 до 1 000 000 ₽');
        if (sale && (!isFinite(sale) || sale < 1 || sale >= old)) fail('Цена со скидкой должна быть меньше обычной цены');
        if (!f.image || !/^data:image\/(jpeg|png|webp);base64,/.test(f.image)) fail('Загрузите фотографию товара');
        if (premium) {
          if (u.balance < EVSA.PREMIUM_PRICE) fail('Недостаточно средств для Premium (нужно ' + EVSA.PREMIUM_PRICE + ' ₽)');
          u.balance = money(u.balance - EVSA.PREMIUM_PRICE);
          tx(u.id, 'premium', -EVSA.PREMIUM_PRICE, 'Premium-размещение «' + title + '»');
        }
        var p = { id: uid('p'), sellerId: u.id, targetType: f.targetType, targetId: f.targetId, category: f.category, title: title, desc: desc,
          buyerMsg: String(f.buyerMsg || '').trim().slice(0, 1000), delivery: EVSA.DELIVERY.indexOf(f.delivery) >= 0 ? f.delivery : EVSA.DELIVERY_BY_CAT[f.category], price: sale || old, oldPrice: sale ? old : 0, image: f.image,
          premium: !!premium, status: 'active', sales: 0, createdAt: now() };
        D.products.push(p); save(); return p;
      });
    },
    deleteProduct: function (id) { var u = requireMe(); var p = this.product(id); if (!p || p.sellerId !== u.id) fail('Нет доступа'); p.status = 'removed'; save(); },

    /* --- покупки и безопасная сделка --- */
    buy: function (productId) {
      return once('buy:' + productId, function () {
        var u = requireActive(); var p = EVSA.db.product(productId);
        if (!p || p.status !== 'active') fail('Товар уже недоступен');
        if (p.sellerId === u.id) fail('Нельзя купить свой товар');
        var seller = user(p.sellerId); if (isBanned(seller)) fail('Продавец заблокирован');
        if (u.balance < p.price) fail('Недостаточно средств. Не хватает ' + money(p.price - u.balance) + ' ₽');
        u.balance = money(u.balance - p.price); u.reserved = money(u.reserved + p.price);
        var chat = getOrCreateChat(u.id, p.sellerId, p.id);
        var o = { id: uid('o'), productId: p.id, buyerId: u.id, sellerId: p.sellerId, price: p.price, title: p.title, status: 'reserved', chatId: chat.id, reviewed: false, createdAt: now() };
        D.orders.push(o); chat.orderId = o.id;
        tx(u.id, 'purchase', -p.price, 'Покупка «' + p.title + '» (в резерве)', o.id);
        p.sales++;
        if (p.category === 'accounts') p.status = 'sold';
        pushMsg(chat.id, 'system', 'Сделка открыта. ' + p.price + ' ₽ зарезервированы и перейдут продавцу только после подтверждения получения.', true);
        notify(p.sellerId, 'Новая покупка: «' + p.title + '» за ' + p.price + ' ₽', '#/chat/' + chat.id, 'deal');
        notify(u.id, 'Вы купили «' + p.title + '». Деньги в резерве до подтверждения.', '#/chat/' + chat.id, 'deal');
        save(); return o;
      });
    },
    order: function (id) { return D.orders.find(function (o) { return o.id === id; }) || null; },
    markDelivered: function (orderId) {
      var u = requireActive(); var o = this.order(orderId);
      if (!o || o.sellerId !== u.id) fail('Нет доступа к сделке');
      if (o.status !== 'reserved') fail('Сделка уже в другом статусе');
      o.status = 'delivered'; o.deliveredAt = now();
      pushMsg(o.chatId, 'system', 'Продавец отметил товар как переданный. Покупатель, проверьте товар.', true);
      notify(o.buyerId, 'Продавец передал товар «' + o.title + '»', '#/chat/' + o.chatId, 'deal'); save();
    },
    confirm: function (orderId) {
      return once('confirm:' + orderId, function () {
        var u = requireActive(); var o = EVSA.db.order(orderId);
        if (!o || o.buyerId !== u.id) fail('Подтвердить может только покупатель');
        if (o.status !== 'reserved' && o.status !== 'delivered') fail('Сделка уже ' + (o.status === 'completed' ? 'завершена' : 'в споре'));
        var s = user(o.sellerId);
        u.reserved = money(u.reserved - o.price); s.balance = money(s.balance + o.price);
        o.status = 'completed'; o.completedAt = now();
        tx(s.id, 'sale', o.price, 'Продажа «' + o.title + '»', o.id);
        pushMsg(o.chatId, 'system', 'Покупатель подтвердил получение. Сделка завершена, ' + o.price + ' ₽ переведены продавцу.', true);
        notify(s.id, 'Сделка завершена: +' + o.price + ' ₽ за «' + o.title + '»', '#/chat/' + o.chatId, 'deal');
        save(); return o;
      });
    },
    applyItem: function (orderId, gameId) {
      var u = requireActive(); var o = this.order(orderId);
      if (!o || o.buyerId !== u.id) fail('Нет доступа');
      if (o.status === 'completed' || o.status === 'refunded') fail('Сделка уже закрыта');
      var id = String(gameId || '').trim(); if (id.length < 2) fail('Укажите игровой ID / ник');
      pushMsg(o.chatId, u.id, '🎮 Прошу применить товар к аккаунту: ' + id.slice(0, 64));
      notify(o.sellerId, 'Покупатель запросил применение товара «' + o.title + '»', '#/chat/' + o.chatId, 'deal'); save();
    },
    dispute: function (orderId, text) {
      var u = requireActive(); var o = this.order(orderId);
      if (!o || (o.buyerId !== u.id && o.sellerId !== u.id)) fail('Нет доступа');
      if (o.status === 'completed' || o.status === 'refunded') fail('Сделка уже закрыта');
      if (o.status === 'dispute') fail('Спор уже открыт');
      o.status = 'dispute';
      EVSA.db.sendSupport('Проблема с покупкой', 'Спор по сделке #' + o.id.slice(-6) + ' «' + o.title + '»: ' + (text || 'без комментария'), o.id);
      pushMsg(o.chatId, 'system', 'Открыт спор. Деньги остаются в резерве до решения поддержки.', true);
      notify(o.sellerId, 'По сделке «' + o.title + '» открыт спор', '#/chat/' + o.chatId, 'deal'); save();
    },
    review: function (orderId, rating, text) {
      var u = requireActive(); var o = this.order(orderId);
      if (!o || o.buyerId !== u.id) fail('Отзыв может оставить только покупатель');
      if (o.status !== 'completed') fail('Отзыв доступен после завершения сделки');
      if (o.reviewed || D.reviews.some(function (r) { return r.orderId === o.id; })) fail('Отзыв за эту покупку уже оставлен');
      rating = Number(rating); if (!(rating >= 1 && rating <= 5)) fail('Поставьте оценку от 1 до 5');
      text = String(text || '').trim(); if (text.length < 3) fail('Напишите пару слов');
      D.reviews.push({ id: uid('rv'), orderId: o.id, productId: o.productId, sellerId: o.sellerId, buyerId: u.id, rating: rating, text: text.slice(0, 1000), createdAt: now() });
      o.reviewed = true; notify(o.sellerId, 'Новый отзыв ' + '★'.repeat(rating) + ' от ' + u.name, '#/u/' + o.sellerId, 'info'); save();
    },
    reviewsFor: function (sellerId) { return D.reviews.filter(function (r) { return r.sellerId === sellerId; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },
    ordersOf: function (uid_, role) { return D.orders.filter(function (o) { return role === 'sell' ? o.sellerId === uid_ : o.buyerId === uid_; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },
    txOf: function (uid_) { return D.transactions.filter(function (t) { return t.userId === uid_; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },

    /* --- корзина --- */
    cart: function () { var u = me(); return u ? (D.cart[u.id] || []).map(this.product).filter(function (p) { return p && p.status === 'active'; }) : []; },
    cartAdd: function (pid) { var u = requireMe(); var c = D.cart[u.id] = D.cart[u.id] || []; if (c.indexOf(pid) < 0) c.push(pid); save(); },
    cartRemove: function (pid) { var u = requireMe(); D.cart[u.id] = (D.cart[u.id] || []).filter(function (x) { return x !== pid; }); save(); },

    /* --- избранное и «Вы смотрели» --- */
    isFav: function (pid) { var u = me(); return !!(u && (D.favs[u.id] || []).indexOf(pid) >= 0); },
    toggleFav: function (pid) { var u = requireMe(); var f = D.favs[u.id] = D.favs[u.id] || []; var i = f.indexOf(pid); if (i >= 0) f.splice(i, 1); else f.push(pid); save(); return i < 0; },
    favs: function () { var u = me(); return u ? (D.favs[u.id] || []).map(this.product).filter(function (p) { return p && p.status !== 'removed'; }) : []; },
    addViewed: function (pid) { var k = D.currentUserId || 'guest'; var v = (D.viewed[k] || []).filter(function (x) { return x !== pid; }); v.unshift(pid); D.viewed[k] = v.slice(0, 12); try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (e) {} },
    viewed: function (exceptId) { var k = D.currentUserId || 'guest'; return (D.viewed[k] || []).filter(function (x) { return x !== exceptId; }).map(this.product).filter(function (p) { return p && p.status === 'active'; }); },
    clearViewed: function () { D.viewed[D.currentUserId || 'guest'] = []; save(); },

    /* --- чаты --- */
    chatsOf: function (uid_) { return D.chats.filter(function (c) { return c.a === uid_ || c.b === uid_; }).sort(function (a, b) { return b.lastAt - a.lastAt; }); },
    chat: function (id) { var u = me(); var c = D.chats.find(function (x) { return x.id === id; }); if (!c || !u || (c.a !== u.id && c.b !== u.id)) return null; return c; },
    messages: function (chatId) { return D.messages.filter(function (m) { return m.chatId === chatId; }); },
    openChat: function (productId) { var u = requireActive(); var p = this.product(productId); if (!p) fail('Товар не найден'); if (p.sellerId === u.id) fail('Это ваш товар'); var c = getOrCreateChat(u.id, p.sellerId, p.id); save(); return c; },
    sendMessage: function (chatId, text) {
      var u = requireActive(); var c = this.chat(chatId); if (!c) fail('Нет доступа к чату');
      text = String(text || '').trim(); if (!text) return; var other = c.a === u.id ? c.b : c.a;
      pushMsg(chatId, u.id, text);
      notify(other, 'Новое сообщение от ' + u.name, '#/chat/' + chatId, 'message');
      save();
    },
    markRead: function (chatId) { var u = me(); var c = this.chat(chatId); if (c && u && c.unread[u.id]) { c.unread[u.id] = 0; save(); } },
    unreadChats: function () { var u = me(); if (!u) return 0; var n = 0; D.chats.forEach(function (c) { n += c.unread[u.id] || 0; }); D.tickets.forEach(function (t) { if (t.userId === u.id) n += t.unreadUser || 0; }); return n; },

    /* --- поддержка --- */
    sendSupport: function (category, text, orderId) {
      var u = requireMe(); text = String(text || '').trim();
      if (text.length < 2) fail('Напишите сообщение');
      if (EVSA.TICKET_CATEGORIES.indexOf(category) < 0) category = 'Другое';
      var t = D.tickets.find(function (x) { return x.userId === u.id && x.category === category && x.status !== 'closed' && (!orderId || x.orderId === orderId); });
      if (!t) { t = { id: uid('tk'), userId: u.id, category: category, orderId: orderId || null, status: 'open', createdAt: now(), messages: [], unreadUser: 0, unreadAdmin: 0 }; D.tickets.push(t); }
      t.messages.push({ from: 'user', text: text.slice(0, 2000), at: now() }); t.status = 'open'; t.unreadAdmin++; t.updatedAt = now();
      save(); return t;
    },
    ticketsOf: function (uid_) { return D.tickets.filter(function (t) { return t.userId === uid_; }); },
    markSupportRead: function () { var u = me(); if (!u) return; var ch = false; D.tickets.forEach(function (t) { if (t.userId === u.id && t.unreadUser) { t.unreadUser = 0; ch = true; } }); if (ch) save(); },

    /* --- пополнение --- */
    starsQuote: function (rub) { rub = Number(rub); return { rub: rub, stars: EVSA.topupStars(rub) }; },
    /* ТОЛЬКО ДЕМО: тестовые рубли без оплаты (для проверки покупок) */
    demoTopup: function (rub) {
      var u = requireActive(); rub = Math.floor(Number(rub));
      if (!(rub >= 10 && rub <= 100000)) fail('Сумма пополнения: от 10 до 100 000 ₽');
      var d = { id: uid('d'), userId: u.id, method: 'demo', rub: rub, stars: 0, status: 'awaiting_payment', createdAt: now() };
      D.deposits.push(d); save(); return this.demoCreditDeposit(d.id);
    },
    createStarsDeposit: function (rub) {
      var u = requireActive(); rub = Math.floor(Number(rub));
      if (!(rub >= 10 && rub <= 100000)) fail('Сумма пополнения: от 10 до 100 000 ₽');
      var d = { id: uid('d'), userId: u.id, method: 'stars', rub: rub, stars: this.starsQuote(rub).stars, status: 'awaiting_payment', createdAt: now() };
      D.deposits.push(d); save(); return d;
    },
    /* ТОЛЬКО ДЕМО: зачисляет тестовые (ненастоящие) рубли. На сервере — только после successful_payment от Telegram. */
    demoCreditDeposit: function (depId) {
      return once('dep:' + depId, function () {
        var u = requireActive(); var d = D.deposits.find(function (x) { return x.id === depId; });
        if (!d || d.userId !== u.id) fail('Заявка не найдена');
        if (d.status !== 'awaiting_payment') fail('Эта заявка уже обработана');
        d.status = 'demo_credited'; d.paidAt = now(); u.balance = money(u.balance + d.rub);
        tx(u.id, 'deposit', d.rub, 'Тестовое пополнение (демо, не настоящие деньги)', d.id);
        notify(u.id, 'Баланс пополнен на ' + d.rub + ' ₽ (тестовые)', '#/profile', 'money'); save(); return d;
      });
    },
    createGiftDeposit: function (rub, giftNote) {
      var u = requireActive(); rub = Math.floor(Number(rub));
      if (!(rub >= 10 && rub <= 100000)) fail('Сумма: от 10 до 100 000 ₽');
      var d = { id: uid('d'), userId: u.id, method: 'gift', rub: rub, note: String(giftNote || '').slice(0, 200), status: 'pending', createdAt: now() };
      D.deposits.push(d); notify(u.id, 'Заявка на пополнение подарком создана. Ожидает проверки администратором.', '#/profile', 'money'); save(); return d;
    },
    depositsOf: function (uid_) { return D.deposits.filter(function (d) { return d.userId === uid_; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },

    /* --- вывод --- */
    withdraw: function (amount) {
      return once('wd', function () {
        var u = requireActive(); amount = Number(amount);
        if (!(amount >= EVSA.WITHDRAW_MIN)) fail('Минимальная сумма вывода — ' + EVSA.WITHDRAW_MIN + ' ₽');
        if (amount > u.balance) fail('Недостаточно средств');
        u.balance = money(u.balance - amount); u.reserved = money(u.reserved + amount);
        var w = { id: uid('w'), userId: u.id, amount: amount, status: 'pending', createdAt: now() };
        D.withdrawals.push(w); tx(u.id, 'withdraw', -amount, 'Заявка на вывод (в резерве)', w.id);
        notify(u.id, 'Заявка на вывод ' + amount + ' ₽ создана', '#/profile', 'money'); save(); return w;
      });
    },
    withdrawalsOf: function (uid_) { return D.withdrawals.filter(function (w) { return w.userId === uid_; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },

    /* --- уведомления --- */
    notifications: function () { var u = me(); return u ? D.notifications.filter(function (n) { return n.userId === u.id; }).sort(function (a, b) { return b.createdAt - a.createdAt; }) : []; },
    unreadNotifs: function () { return this.notifications().filter(function (n) { return !n.read; }).length; },
    readAllNotifs: function () { this.notifications().forEach(function (n) { n.read = true; }); save(); },

    /* =========== АДМИН =========== */
    admin: {
      users: function (q) { requireAdmin(); q = String(q || '').trim().replace(/^@/, '').toLowerCase(); return D.users.filter(function (u) { return !q || String(u.tgId).indexOf(q) >= 0 || u.name.toLowerCase().indexOf(q) >= 0 || (u.username || '').toLowerCase().indexOf(q) >= 0; }); },
      ban: function (userId, reason) {
        requireAdmin(); var u = user(userId); if (!u) fail('Пользователь не найден');
        reason = String(reason || '').trim(); if (reason.length < 3) fail('Укажите причину');
        D.warnings.push({ id: uid('wr'), userId: u.id, reason: reason, createdAt: now() }); u.warnings++;
        var perm = u.warnings >= 2;
        u.ban = { perm: perm, until: perm ? null : now() + DAY, reason: reason, at: now() };
        D.bans.push({ id: uid('b'), userId: u.id, perm: perm, until: u.ban.until, reason: reason, createdAt: now(), action: 'ban' });
        adminLog(perm ? 'Перманентная блокировка' : 'Блокировка на 24 часа', u.id, reason);
        notify(u.id, perm ? 'Ваш аккаунт заблокирован навсегда. Причина: ' + reason : 'Ваш аккаунт заблокирован на 24 часа. Причина: ' + reason, '#/support', 'bad'); save(); return u.ban;
      },
      unban: function (userId) { requireAdmin(); var u = user(userId); if (!u) fail('Не найден'); u.ban = null; D.bans.push({ id: uid('b'), userId: u.id, action: 'unban', createdAt: now() }); adminLog('Разблокировка', u.id, ''); notify(u.id, 'Ваш аккаунт разблокирован', '#/', 'info'); save(); },
      adjust: function (userId, delta, reason) {
        requireAdmin(); var u = user(userId); delta = Number(delta); reason = String(reason || '').trim();
        if (!u) fail('Не найден'); if (!delta || !isFinite(delta)) fail('Укажите сумму (например 100 или -50)');
        if (reason.length < 3) fail('Причина обязательна'); if (u.balance + delta < 0) fail('Баланс не может стать отрицательным');
        u.balance = money(u.balance + delta); tx(u.id, 'admin', delta, 'Корректировка администратором: ' + reason);
        adminLog('Корректировка баланса ' + (delta > 0 ? '+' : '') + delta + ' ₽', u.id, reason); save();
      },
      reply: function (ticketId, text) {
        requireAdmin(); var t = D.tickets.find(function (x) { return x.id === ticketId; }); text = String(text || '').trim();
        if (!t) fail('Обращение не найдено'); if (!text) fail('Введите ответ');
        t.messages.push({ from: 'support', text: text.slice(0, 2000), at: now() }); t.status = 'answered'; t.unreadUser++; t.unreadAdmin = 0; t.updatedAt = now();
        notify(t.userId, 'Поддержка ответила на ваше обращение', '#/support', 'message'); adminLog('Ответ в поддержке', t.userId, text.slice(0, 80)); save();
      },
      closeTicket: function (ticketId) { requireAdmin(); var t = D.tickets.find(function (x) { return x.id === ticketId; }); if (t) { t.status = 'closed'; t.unreadAdmin = 0; save(); } },
      resolveDispute: function (orderId, toBuyer) {
        requireAdmin(); var o = D.orders.find(function (x) { return x.id === orderId; }); if (!o || o.status !== 'dispute') fail('Спор не найден');
        var b = user(o.buyerId), s = user(o.sellerId); b.reserved = money(b.reserved - o.price);
        if (toBuyer) { b.balance = money(b.balance + o.price); o.status = 'refunded'; tx(b.id, 'refund', o.price, 'Возврат по спору «' + o.title + '»', o.id); }
        else { s.balance = money(s.balance + o.price); o.status = 'completed'; o.completedAt = now(); tx(s.id, 'sale', o.price, 'Продажа «' + o.title + '» (решение спора)', o.id); }
        pushMsg(o.chatId, 'system', toBuyer ? 'Спор решён в пользу покупателя. Деньги возвращены.' : 'Спор решён в пользу продавца. Деньги переведены продавцу.', true);
        notify(b.id, 'Спор по «' + o.title + '» решён', '#/chat/' + o.chatId, 'deal'); notify(s.id, 'Спор по «' + o.title + '» решён', '#/chat/' + o.chatId, 'deal');
        adminLog('Решение спора: ' + (toBuyer ? 'возврат покупателю' : 'выплата продавцу'), o.buyerId, o.id); save();
      },
      setWithdrawal: function (wId, status) {
        requireAdmin(); var w = D.withdrawals.find(function (x) { return x.id === wId; }); if (!w) fail('Заявка не найдена');
        var u = user(w.userId); var allowed = { pending: ['approved', 'rejected'], approved: ['done', 'rejected'] };
        if (!(allowed[w.status] || []).includes(status)) fail('Недопустимый переход статуса');
        w.status = status; w.updatedAt = now();
        if (status === 'done') { u.reserved = money(u.reserved - w.amount); }
        if (status === 'rejected') { u.reserved = money(u.reserved - w.amount); u.balance = money(u.balance + w.amount); tx(u.id, 'refund', w.amount, 'Вывод отклонён, средства возвращены', w.id); }
        var names = { approved: 'одобрена', done: 'выполнена', rejected: 'отклонена' };
        notify(u.id, 'Заявка на вывод ' + w.amount + ' ₽ ' + names[status], '#/profile', 'money'); adminLog('Вывод ' + names[status], u.id, w.amount + ' ₽'); save();
      },
      setDeposit: function (dId, ok) {
        requireAdmin(); var d = D.deposits.find(function (x) { return x.id === dId; }); if (!d || d.status !== 'pending') fail('Заявка уже обработана');
        var u = user(d.userId); d.status = ok ? 'confirmed' : 'rejected'; d.updatedAt = now();
        if (ok) { u.balance = money(u.balance + d.rub); tx(u.id, 'deposit', d.rub, 'Пополнение подарком (подтверждено администратором)', d.id); }
        notify(u.id, ok ? 'Пополнение подарком подтверждено: +' + d.rub + ' ₽' : 'Пополнение подарком отклонено', '#/profile', 'money');
        adminLog(ok ? 'Подтверждение подарка' : 'Отклонение подарка', u.id, d.rub + ' ₽'); save();
      }
    }
  };
})();
