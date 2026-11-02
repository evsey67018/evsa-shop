/* EVSA SHOP — данные в Supabase (общая база для всех пользователей).
   Здесь только публичный anon-ключ: все права проверяются на сервере политиками RLS.
   Баланс пополняется звёздами Telegram (Edge Function create-stars-invoice + бот). Сайт баланс только читает.
   Покупка с баланса — только через RPC buy_listing (сервер проверяет цену, баланс, повтор запроса и списывает атомарно). */
'use strict';
(function () {
  var SB_URL = 'https://duotcuunusvnxsektzkj.supabase.co';
  var SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1b3RjdXVudXN2bnhzZWt0emtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NTgyODYsImV4cCI6MjEwOTAzNDI4Nn0.9VaLE7EowJDpAbzByZ2ik8ql2xsRhkCLTqg97Vp48YM';
  var BUCKET = 'product-images';
  var SKEY = 'evsa_settings', LKEY = 'evsa_local_v2';
  var PROFILE_COLS = 'id,username,name,avatar_url,banned,created_at';
  EVSA.SB_URL = SB_URL;

  /* ---------- настройки интерфейса (тема, звук) — локально ---------- */
  var defSettings = { theme: 'dark', sound: true };
  EVSA.settings = {
    get: function () { try { return Object.assign({}, defSettings, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) { return Object.assign({}, defSettings); } },
    set: function (patch) { var s = Object.assign(this.get(), patch); try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {} return s; }
  };
  /* корзина и «Вы смотрели» — личные списки этого браузера */
  function local() { try { return JSON.parse(localStorage.getItem(LKEY) || '{}') || {}; } catch (e) { return {}; } }
  function saveLocal(L) { try { localStorage.setItem(LKEY, JSON.stringify(L)); } catch (e) {} }
  try { localStorage.removeItem('evsa_db_v1'); } catch (e) {} // старая демо-база больше не используется

  var sb = window.supabase.createClient(SB_URL, SB_ANON, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'evsa_auth_v1' } });
  EVSA.sb = sb;

  /* ---------- кэш ---------- */
  var C = { users: [], products: [], reviews: [], favs: [], chats: [], messages: [], orders: [], settings: null, tgId: null, balance: 0, unlimited: false, topups: [], withdrawals: [] };
  var uidMe = null, ready = false, listeners = [], sig = '';
  function emit(force) {
    var s = [C.products.length, C.users.length, C.reviews.length, C.favs.length, C.chats.length, C.messages.length, C.orders.length, uidMe,
      C.chats.reduce(function (a, c) { return a + c.lastAt + (c.unread[uidMe] || 0); }, 0), C.products.reduce(function (a, p) { return a + p.status.length + p.price; }, 0), C.balance, C.unlimited, C.topups.length,
      C.withdrawals.map(function (w) { return w.id.slice(0, 4) + w.status[0]; }).join('')].join('|');
    if (!force && s === sig) return; sig = s;
    listeners.forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }
  function err(msg) { var e = new Error(msg); e.userMessage = msg; return e; }
  function fail(msg) { throw err(msg); }
  function dbErr(e, fallback) {
    if (e && e.userMessage) return e;
    var m = (e && (e.message || '')) + '';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return err('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз');
    if (e && (e.code === '42501' || /row-level security|permission/i.test(m))) return err('Нет доступа к этому действию');
    if (e && e.code === '23505') return err('Это уже сделано');
    if (e && e.code === '23514') return err('Проверьте заполнение полей');
    console.warn(e); return err(fallback || 'Что-то пошло не так. Попробуйте ещё раз');
  }
  function q(res, fb) { if (res.error) throw dbErr(res.error, fb); return res.data; }
  function ts(x) { return x ? Date.parse(x) : 0; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  function randNonce() { var a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', b = crypto.getRandomValues(new Uint8Array(32)), s = ''; for (var i = 0; i < 32; i++) s += a[b[i] % 62]; return s; }
  var PALETTE = ['#8b5cf6', '#22d3ee', '#ec4899', '#f59e0b', '#22c55e'];
  function color(id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return PALETTE[h % 5]; }
  function upsert(list, item) { for (var i = 0; i < list.length; i++) if (list[i].id === item.id) { list[i] = item; return item; } list.push(item); return item; }

  function mapUser(r) {
    return { id: r.id, name: r.name, username: r.username || '', avatar: r.avatar_url || null, color: color(r.id), createdAt: ts(r.created_at),
      ban: r.banned ? { perm: true, reason: 'решение администрации' } : null, tgId: r.id === uidMe ? C.tgId : null };
  }
  function mapProduct(r) {
    var imgs = r.images || [];
    return { id: r.id, sellerId: r.seller_id, targetType: r.target_type, targetId: r.target_id, category: r.category, title: r.title, desc: r.description,
      buyerMsg: r.buyer_msg || '', delivery: r.delivery, price: Number(r.price), oldPrice: Number(r.old_price) || 0, images: imgs, image: imgs[0] || null,
      premium: false, status: r.status, sales: r.sales || 0, qty: r.stock == null ? null : Number(r.stock), createdAt: ts(r.created_at) };
  }
  function mapChat(r) {
    var read = {}; read[r.buyer_id] = ts(r.buyer_read_at); read[r.seller_id] = ts(r.seller_read_at);
    return { id: r.id, a: r.buyer_id, b: r.seller_id, buyerId: r.buyer_id, sellerId: r.seller_id, productId: r.product_id, orderId: null, lastAt: ts(r.last_message_at), readAt: read, unread: {} };
  }
  function mapMsg(r) { return { id: r.id, chatId: r.chat_id, from: r.sender_id, text: r.text, system: false, createdAt: ts(r.created_at) }; }
  function mapOrder(r) { return { id: r.id, productId: r.product_id, buyerId: r.buyer_id, sellerId: r.seller_id, chatId: r.chat_id, title: r.title, price: Number(r.price), status: r.status, createdAt: ts(r.created_at), paidAt: ts(r.paid_at), completedAt: ts(r.completed_at), sellerAmount: r.seller_amount == null ? null : Number(r.seller_amount), commissionAmount: r.commission_amount == null ? null : Number(r.commission_amount) }; }
  function mapReview(r) { return { id: r.id, orderId: r.order_id, productId: r.product_id, sellerId: r.seller_id, buyerId: r.buyer_id, rating: r.rating, text: r.text, createdAt: ts(r.created_at) }; }

  function computeUnread() {
    C.chats.forEach(function (c) {
      c.unread = {};
      if (!uidMe) return;
      var since = c.readAt[uidMe] || 0;
      c.unread[uidMe] = C.messages.filter(function (m) { return m.chatId === c.id && m.from !== uidMe && m.createdAt > since; }).length;
      var o = C.orders.find(function (x) { return x.chatId === c.id; }); c.orderId = o ? o.id : null;
    });
  }

  /* ---------- загрузка ---------- */
  function loadPublic() {
    return Promise.all([
      sb.from('products').select('*').order('created_at', { ascending: false }).limit(2000),
      sb.from('profiles').select(PROFILE_COLS).limit(5000),
      sb.from('reviews').select('*').order('created_at', { ascending: false }).limit(5000)
    ]).then(function (rs) {
      var ps = q(rs[0]), us = q(rs[1]), rv = q(rs[2]);
      C.products = ps.map(mapProduct); C.users = us.map(mapUser); C.reviews = rv.map(mapReview);
    });
  }
  function clearPrivate() { C.favs = []; C.chats = []; C.messages = []; C.orders = []; C.settings = null; C.tgId = null; C.balance = 0; C.unlimited = false; C.topups = []; C.withdrawals = []; }
  function mapTopup(r) { return { id: r.id, rub: Number(r.amount_rub), stars: r.stars, status: r.status, createdAt: ts(r.created_at), paidAt: ts(r.paid_at) }; }
  function mapWithdrawal(r) { return { id: r.id, rub: Number(r.amount_rub), status: r.status, createdAt: ts(r.created_at), processedAt: ts(r.processed_at) }; }
  /* баланс, пополнения и выводы: только чтение (RLS — свои строки). Ошибка не ломает остальную загрузку. */
  function loadWallet() {
    if (!uidMe) return Promise.resolve();
    var me = uidMe;
    return Promise.all([
      sb.from('wallets').select('balance,unlimited').maybeSingle(),
      sb.from('star_payments').select('id,amount_rub,stars,status,created_at,paid_at').eq('status', 'paid').order('paid_at', { ascending: false }).limit(50),
      sb.from('withdrawals').select('id,amount_rub,status,created_at,processed_at').eq('user_id', me).order('created_at', { ascending: false }).limit(50)
    ]).then(function (rs) {
      if (me !== uidMe) return;
      if (!rs[0].error) { C.balance = rs[0].data ? Number(rs[0].data.balance) || 0 : 0; C.unlimited = !!(rs[0].data && rs[0].data.unlimited); }
      if (!rs[1].error) C.topups = (rs[1].data || []).map(mapTopup);
      if (!rs[2].error) C.withdrawals = (rs[2].data || []).map(mapWithdrawal);
    }).catch(function (e) { console.warn(e); });
  }
  function loadPrivate() {
    if (!uidMe) { clearPrivate(); return Promise.resolve(); }
    var me = uidMe;
    return Promise.all([
      sb.from('favorites').select('product_id'),
      sb.from('chats').select('*').order('last_message_at', { ascending: false }).limit(500),
      sb.from('messages').select('*').order('created_at', { ascending: true }).limit(5000),
      sb.from('orders').select('*').order('created_at', { ascending: false }).limit(500),
      sb.from('user_settings').select('*').maybeSingle(),
      sb.rpc('my_telegram_id'),
      sb.rpc('commission_rate')
    ]).then(function (rs) {
      if (rs[6] && !rs[6].error && rs[6].data != null && isFinite(Number(rs[6].data))) EVSA.COMMISSION = Number(rs[6].data);
      if (me !== uidMe) return;
      C.favs = q(rs[0]).map(function (r) { return r.product_id; });
      C.chats = q(rs[1]).map(mapChat); C.messages = q(rs[2]).map(mapMsg); C.orders = q(rs[3]).map(mapOrder);
      C.settings = rs[4].data || null; C.tgId = rs[5].data || null;
      C.users.forEach(function (u) { if (u.id === uidMe) u.tgId = C.tgId; });
      computeUnread();
    }).then(loadWallet);
  }
  /* лёгкое обновление чатов (на случай, если realtime недоступен) */
  function refreshChats() {
    if (!uidMe) return Promise.resolve();
    return Promise.all([sb.from('chats').select('*').limit(500), sb.from('messages').select('*').order('created_at', { ascending: true }).limit(5000)]).then(function (rs) {
      if (rs[0].error || rs[1].error) return;
      C.chats = rs[0].data.map(mapChat); C.messages = rs[1].data.map(mapMsg); computeUnread(); emit();
    });
  }
  function ensureUsers(ids) {
    var miss = ids.filter(function (id) { return id && !C.users.some(function (u) { return u.id === id; }); });
    if (!miss.length) return Promise.resolve();
    return sb.from('profiles').select(PROFILE_COLS).in('id', miss).then(function (r) { (r.data || []).forEach(function (x) { upsert(C.users, mapUser(x)); }); });
  }

  /* ---------- realtime ---------- */
  var chan = null;
  function subscribe() {
    if (chan) { try { sb.removeChannel(chan); } catch (e) {} chan = null; }
    if (!uidMe) return;
    chan = sb.channel('evsa-' + uidMe)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, function (p) {
        var m = mapMsg(p.new); upsert(C.messages, m);
        if (!C.chats.some(function (c) { return c.id === m.chatId; })) return refreshChats();
        var c = C.chats.find(function (x) { return x.id === m.chatId; }); if (c) c.lastAt = Math.max(c.lastAt, m.createdAt);
        computeUnread(); ensureUsers([m.from]).then(function () { emit(); });
        if (m.from !== uidMe && EVSA.sound && EVSA.sound.message) try { EVSA.sound.message(); } catch (e) {}
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: 'user_id=eq.' + uidMe }, function (p) {
        if (!p.new || p.new.user_id !== uidMe) return;
        C.balance = Number(p.new.balance) || 0; C.unlimited = !!p.new.unlimited; loadWallet().then(function () { emit(true); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals', filter: 'user_id=eq.' + uidMe }, function (p) {
        if (!p.new || p.new.user_id !== uidMe) return;
        upsert(C.withdrawals, mapWithdrawal(p.new)); C.withdrawals.sort(function (a, b) { return b.createdAt - a.createdAt; });
        loadWallet().then(function () { emit(true); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, function (p) {
        if (!p.new || !p.new.id) return; upsert(C.orders, mapOrder(p.new)); computeUnread();
        ensureUsers([p.new.buyer_id, p.new.seller_id]).then(function () { emit(true); });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chats' }, function (p) {
        if (!p.new || !p.new.id) return; upsert(C.chats, mapChat(p.new)); computeUnread();
        ensureUsers([p.new.buyer_id, p.new.seller_id]).then(function () { emit(); });
      })
      .subscribe();
  }

  function setUser(id) {
    if (id === uidMe) return Promise.resolve();
    uidMe = id; clearPrivate();
    return ensureUsers(id ? [id] : []).then(loadPrivate).then(function () { subscribe(); emit(true); });
  }
  sb.auth.onAuthStateChange(function (ev, session) {
    var id = session && session.user ? session.user.id : null;
    if (ready) setTimeout(function () { setUser(id); }, 0);
  });

  /* ---------- проверки ---------- */
  function user(id) { if (!id) return null; return C.users.find(function (u) { return u.id === id; }) || { id: id, name: 'Пользователь', username: '', avatar: null, color: color(id), createdAt: 0, ban: null, missing: true }; }
  function me() { if (!uidMe) return null; var u = C.users.find(function (x) { return x.id === uidMe; }); return u || null; }
  function isBanned(u) { return !!(u && u.ban); }
  function requireMe() { var u = me(); if (!u) fail('Сначала войдите через Telegram'); return u; }
  function requireActive() { var u = requireMe(); if (isBanned(u)) fail('Ваш аккаунт заблокирован'); return u; }
  function disc(p) { return p.oldPrice > p.price ? (p.oldPrice - p.price) / p.oldPrice : 0; }
  function isOnline(u) { return !!(u && u.id === uidMe); }
  function sellerStats(id) {
    var rv = C.reviews.filter(function (r) { return r.sellerId === id; });
    var avg = rv.length ? rv.reduce(function (s, r) { return s + r.rating; }, 0) / rv.length : 0;
    var sales = C.products.filter(function (p) { return p.sellerId === id; }).reduce(function (s, p) { return s + (p.sales || 0); }, 0);
    return { rating: Math.round(avg * 10) / 10, count: rv.length, sales: sales };
  }
  function product(id) { return C.products.find(function (p) { return p.id === id; }) || null; }
  function chat(id) { var c = C.chats.find(function (x) { return x.id === id; }); if (!c || !uidMe || (c.a !== uidMe && c.b !== uidMe)) return null; return c; }
  function P(fn) { return new Promise(function (res) { res(fn()); }); }
  var inflight = {};
  function once(key, fn) { if (inflight[key]) return Promise.reject(err('Операция уже выполняется, подождите…')); inflight[key] = 1; return P(fn).finally(function () { delete inflight[key]; }); }

  function dataUrlToBlob(u) { return fetch(u).then(function (r) { return r.blob(); }); }
  function uploadImage(dataUrl, prefix) {
    var path = uidMe + '/' + (prefix || '') + uuid() + '.jpg';
    return dataUrlToBlob(dataUrl).then(function (blob) {
      if (blob.size > 2 * 1024 * 1024) throw err('Фото слишком большое после сжатия (макс. 2 МБ)');
      return sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
    }).then(function (r) { if (r.error) throw dbErr(r.error, 'Не удалось загрузить фото'); return SB_URL + '/storage/v1/object/public/' + BUCKET + '/' + path; });
  }

  /* ошибка Edge Function: берём понятный текст из ответа сервера ({message}) */
  function fnErr(e, fallback) {
    var ctx = e && e.context;
    if (ctx && typeof ctx.json === 'function') return ctx.json().then(function (b) { return err(b && b.message ? String(b.message) : fallback); }, function () { return dbErr(e, fallback); });
    return Promise.resolve(dbErr(e, fallback));
  }

  /* ---------- вход через Telegram-бота ---------- */
  var NKEY = 'evsa_login_nonce';
  function invoke(name, body) {
    return sb.functions.invoke(name, { body: body }).then(function (r) {
      if (r.error) throw dbErr(r.error, 'Сервер не ответил. Попробуйте ещё раз');
      return r.data || {};
    });
  }

  /* =========================================================
     ПУБЛИЧНОЕ API
     ========================================================= */
  EVSA.db = {
    init: function () {
      return sb.auth.getSession().then(function (r) {
        uidMe = r.data && r.data.session ? r.data.session.user.id : null;
        return loadPublic().then(loadPrivate);
      }).catch(function (e) { console.error(e); EVSA.db.loadFailed = true; })
        .then(function () {
          ready = true; subscribe(); emit(true);
          setInterval(function () { if (!document.hidden) refreshChats(); }, 15000);
          setInterval(function () { if (!document.hidden) loadPublic().then(function () { if (uidMe) C.users.forEach(function (u) { if (u.id === uidMe) u.tgId = C.tgId; }); emit(); }).catch(function () {}); }, 60000);
        });
    },
    ready: function () { return ready; },
    /* есть сохранённая сессия — пока данные грузятся, показываем скелетон, а не «Войдите» */
    maybeAuthed: function () { try { return !!localStorage.getItem('evsa_auth_v1'); } catch (e) { return false; } },
    reload: function () { return loadPublic().then(loadPrivate).then(function () { emit(true); }); },
    onChange: function (f) { listeners.push(f); },
    raw: function () { return C; },
    me: me, user: user, isBanned: isBanned, sellerStats: sellerStats, isOnline: isOnline,

    /* --- вход: сайт регистрирует nonce, пользователь жмёт Start в боте, сайт забирает сессию --- */
    loginStart: function () {
      var n = randNonce();
      return invoke('tg-login', { action: 'start', nonce: n }).then(function () {
        try { sessionStorage.setItem(NKEY, JSON.stringify({ n: n, at: Date.now() })); } catch (e) {}
        return { nonce: n, url: 'https://t.me/' + EVSA.TOPUP.BOT + '?start=login_' + n };
      });
    },
    pendingLogin: function () { try { var x = JSON.parse(sessionStorage.getItem(NKEY) || 'null'); return x && Date.now() - x.at < 5 * 60000 ? x.n : null; } catch (e) { return null; } },
    loginPoll: function (n) {
      return invoke('tg-login', { action: 'poll', nonce: n }).then(function (d) {
        if (d.status !== 'ok') { if (d.status !== 'pending') try { sessionStorage.removeItem(NKEY); } catch (e) {} return d.status || 'error'; }
        try { sessionStorage.removeItem(NKEY); } catch (e) {}
        return sb.auth.setSession({ access_token: d.session.access_token, refresh_token: d.session.refresh_token }).then(function (r) {
          if (r.error || !r.data.session) throw dbErr(r.error, 'Не удалось войти');
          return loadPublic().then(function () { return setUser(r.data.session.user.id); }).then(function () { return 'ok'; });
        });
      });
    },
    logout: function () { return sb.auth.signOut().catch(function () {}).then(function () { return setUser(null); }); },
    updateAvatar: function (dataUrl) {
      return once('ava', function () {
        requireActive();
        return uploadImage(dataUrl, 'avatar-').then(function (url) { return sb.from('profiles').update({ avatar_url: url }).eq('id', uidMe).select(PROFILE_COLS).single(); })
          .then(function (r) { upsert(C.users, mapUser(q(r))); emit(true); });
      });
    },
    notifyOn: function () { return C.settings ? C.settings.notify_messages !== false : true; },
    setNotify: function (on) {
      requireMe();
      var prev = C.settings; C.settings = Object.assign({}, C.settings || {}, { notify_messages: !!on });
      return sb.from('user_settings').update({ notify_messages: !!on, updated_at: new Date().toISOString() }).eq('user_id', uidMe).select().then(function (r) {
        if (r.error) throw r.error;
        if (!r.data.length) return sb.from('user_settings').insert({ user_id: uidMe, notify_messages: !!on }).then(function (x) { if (x.error) throw x.error; });
      }).catch(function (e) { C.settings = prev; throw dbErr(e, 'Не удалось сохранить настройку'); });
    },

    /* --- каталог --- */
    products: function (f) {
      f = f || {};
      var list = C.products.filter(function (p) {
        if (p.status !== 'active') return false;
        if (f.targetType && p.targetType !== f.targetType) return false;
        if (f.targetId && p.targetId !== f.targetId) return false;
        if (f.category && p.category !== f.category) return false;
        if (f.sellerId && p.sellerId !== f.sellerId) return false;
        if (isBanned(user(p.sellerId))) return false;
        if (f.delivery && p.delivery !== f.delivery) return false;
        if (f.minPrice && p.price < Number(f.minPrice)) return false;
        if (f.maxPrice && p.price > Number(f.maxPrice)) return false;
        if (f.discountOnly && !(p.oldPrice > p.price)) return false;
        if (f.online && !isOnline(user(p.sellerId))) return false;
        if (f.withReviews && !sellerStats(p.sellerId).count) return false;
        if (f.search) { var n = f.search.toLowerCase(); if (p.title.toLowerCase().indexOf(n) < 0 && (p.desc || '').toLowerCase().indexOf(n) < 0) return false; }
        return true;
      });
      var cmp = {
        cheap: function (a, b) { return a.price - b.price; },
        expensive: function (a, b) { return b.price - a.price; },
        popular: function (a, b) { return (b.sales - a.sales) || (b.createdAt - a.createdAt); },
        new: function (a, b) { return b.createdAt - a.createdAt; },
        discount: function (a, b) { return disc(b) - disc(a); },
        rating: function (a, b) { return sellerStats(b.sellerId).rating - sellerStats(a.sellerId).rating || sellerStats(b.sellerId).count - sellerStats(a.sellerId).count; }
      }[f.sort || 'popular'] || function () { return 0; };
      return list.sort(cmp);
    },
    product: product,
    countFor: function (type, id, cat) { return C.products.filter(function (p) { return p.status === 'active' && p.targetType === type && p.targetId === id && (!cat || p.category === cat) && !isBanned(user(p.sellerId)); }).length; },

    /* f: {targetType,targetId,category,title,desc,buyerMsg,price,oldPrice,image,delivery} */
    createProduct: function (f) {
      return once('create', function () {
        requireActive();
        if (!EVSA.findTarget(f.targetType, f.targetId)) fail('Выберите игру или сайт');
        if (!EVSA.CATEGORIES.some(function (c) { return c.id === f.category; })) fail('Выберите категорию');
        var title = String(f.title || '').trim(), desc = String(f.desc || '').trim();
        if (title.length < 4 || title.length > 80) fail('Название: от 4 до 80 символов');
        if (desc.length < 10 || desc.length > 2000) fail('Описание: от 10 до 2000 символов');
        var price = Math.round(Number(f.price) * 100) / 100, old = f.oldPrice === '' || f.oldPrice == null ? 0 : Math.round(Number(f.oldPrice) * 100) / 100;
        if (!isFinite(price) || price < 1 || price > 1000000) fail('Цена: от 1 до 1 000 000 ₽');
        if (!isFinite(old) || old < 0) fail('Цена без скидки указана неверно');
        if (old && old <= price) old = 0; // скидка только если старая цена больше
        if (old > 1000000) fail('Цена без скидки: до 1 000 000 ₽');
        if (!f.image || !/^data:image\/(jpeg|png|webp);base64,/.test(f.image)) fail('Загрузите фотографию товара');
        var id = uuid();
        return uploadImage(f.image).then(function (url) {
          return sb.from('products').insert({ id: id, seller_id: uidMe, target_type: f.targetType, target_id: f.targetId, category: f.category, title: title, description: desc,
            buyer_msg: String(f.buyerMsg || '').trim().slice(0, 1000), price: price, old_price: old, images: [url],
            delivery: EVSA.DELIVERY.indexOf(f.delivery) >= 0 ? f.delivery : EVSA.DELIVERY_BY_CAT[f.category] }).select().single();
        }).then(function (r) { var p = upsert(C.products, mapProduct(q(r, 'Не удалось выставить товар'))); emit(true); return p; });
      });
    },
    deleteProduct: function (id) {
      var p = product(id); if (!p || p.sellerId !== uidMe) return Promise.reject(err('Нет доступа'));
      return sb.from('products').update({ status: 'removed' }).eq('id', id).select().single().then(function (r) { upsert(C.products, mapProduct(q(r))); emit(true); });
    },

    /* --- покупки: оплата пока отключена --- */
    PAYMENTS: true,
    newRequestId: function () { return uuid(); },
    /* reqId — один на открытое окно подтверждения: повторный клик не спишет деньги второй раз */
    buy: function (pid, reqId) {
      return once('buy', function () {
        var u = requireActive(), p = product(pid);
        if (!p) fail('Товар не найден');
        if (p.sellerId === u.id) fail('Это ваш товар');
        if (p.status !== 'active') fail('Товар уже недоступен');
        return sb.rpc('buy_listing', { p_product_id: p.id, p_expected_price: p.price, p_request_id: reqId }).then(function (r) {
          if (r.error) {
            var m = String(r.error.message || ''), map = { not_signed_in: 'Войдите, чтобы купить', banned: 'Ваш аккаунт заблокирован', not_found: 'Товар не найден',
              not_active: 'Товар уже продан или снят с продажи', own_listing: 'Это ваш товар', seller_banned: 'Продавец заблокирован — покупка недоступна',
              price_changed: 'Цена товара изменилась — проверьте новую цену', out_of_stock: 'Товар закончился', bad_request: 'Ошибка запроса, обновите страницу' };
            var k = Object.keys(map).find(function (x) { return m.indexOf(x) >= 0; });
            if (k === 'price_changed' || k === 'not_active' || k === 'out_of_stock') loadPublic().then(function () { emit(true); });
            throw k ? err(map[k]) : dbErr(r.error, 'Не удалось оплатить. Деньги не списаны — попробуйте ещё раз');
          }
          var d = r.data || {};
          if (d.status === 'insufficient') { var e = err('Недостаточно средств'); e.code = 'insufficient'; e.need = Number(d.price) - Number(d.balance || 0); return Promise.reject(e); }
          if (d.status !== 'ok' && d.status !== 'duplicate') fail('Не удалось оплатить');
          return Promise.all([loadPrivate(), loadPublic()]).then(function () { emit(true); return d; });
        });
      });
    },
    confirmOrder: function (id) {
      return once('confirm', function () {
        requireActive();
        return sb.rpc('order_confirm', { p_order_id: id }).then(function (r) {
          if (r.error) throw dbErr(r.error, 'Не удалось подтвердить получение');
          return loadPrivate().then(function () { emit(true); });
        });
      });
    },
    order: function (id) { return C.orders.find(function (o) { return o.id === id; }) || null; },
    ordersOf: function (u, role) { return C.orders.filter(function (o) { return role === 'sell' ? o.sellerId === u : o.buyerId === u; }).sort(function (a, b) { return b.createdAt - a.createdAt; }).map(function (o) { o.reviewed = C.reviews.some(function (r) { return r.orderId === o.id; }); return o; }); },
    review: function (orderId, rating, text) {
      return once('review', function () {
        var u = requireActive(), o = EVSA.db.order(orderId);
        if (!o || o.buyerId !== u.id) fail('Отзыв может оставить только покупатель');
        if (o.status !== 'completed') fail('Отзыв доступен после завершения сделки');
        if (C.reviews.some(function (r) { return r.orderId === o.id; })) fail('Отзыв за эту покупку уже оставлен');
        rating = Number(rating); if (!(rating >= 1 && rating <= 5)) fail('Поставьте оценку от 1 до 5');
        text = String(text || '').trim(); if (text.length < 3) fail('Напишите пару слов (минимум 3 символа)');
        return sb.from('reviews').insert({ order_id: o.id, product_id: o.productId, seller_id: o.sellerId, buyer_id: u.id, rating: rating, text: text.slice(0, 1000) }).select().single()
          .then(function (r) { upsert(C.reviews, mapReview(q(r, 'Не удалось сохранить отзыв'))); emit(true); });
      });
    },
    reviewsFor: function (sellerId) { return C.reviews.filter(function (r) { return r.sellerId === sellerId; }).sort(function (a, b) { return b.createdAt - a.createdAt; }); },

    /* --- корзина (в этом браузере) --- */
    cart: function () { var L = local(), k = uidMe || 'guest'; return ((L.cart || {})[k] || []).map(product).filter(function (p) { return p && p.status === 'active'; }); },
    cartAdd: function (pid) { requireMe(); var L = local(); L.cart = L.cart || {}; var c = L.cart[uidMe] = L.cart[uidMe] || []; if (c.indexOf(pid) < 0) c.push(pid); saveLocal(L); emit(true); },
    cartRemove: function (pid) { var L = local(); L.cart = L.cart || {}; L.cart[uidMe || 'guest'] = (L.cart[uidMe || 'guest'] || []).filter(function (x) { return x !== pid; }); saveLocal(L); emit(true); },

    /* --- избранное (в базе) и «Вы смотрели» (в браузере) --- */
    isFav: function (pid) { return C.favs.indexOf(pid) >= 0; },
    toggleFav: function (pid) {
      requireMe();
      var i = C.favs.indexOf(pid), on = i < 0;
      if (on) C.favs.push(pid); else C.favs.splice(i, 1);
      var req = on ? sb.from('favorites').insert({ user_id: uidMe, product_id: pid }) : sb.from('favorites').delete().eq('user_id', uidMe).eq('product_id', pid);
      req.then(function (r) {
        if (r.error && r.error.code !== '23505') { var j = C.favs.indexOf(pid); if (on && j >= 0) C.favs.splice(j, 1); if (!on && j < 0) C.favs.push(pid); EVSA.ui.err(dbErr(r.error, 'Не удалось обновить избранное')); emit(true); }
      });
      return on;
    },
    favs: function () { return C.favs.map(product).filter(function (p) { return p && p.status !== 'removed'; }); },
    addViewed: function (pid) { var L = local(), k = uidMe || 'guest'; L.viewed = L.viewed || {}; var v = (L.viewed[k] || []).filter(function (x) { return x !== pid; }); v.unshift(pid); L.viewed[k] = v.slice(0, 12); saveLocal(L); },
    viewed: function (exceptId) { var L = local(), k = uidMe || 'guest'; return ((L.viewed || {})[k] || []).filter(function (x) { return x !== exceptId; }).map(product).filter(function (p) { return p && p.status === 'active'; }); },
    clearViewed: function () { var L = local(); L.viewed = L.viewed || {}; L.viewed[uidMe || 'guest'] = []; saveLocal(L); },

    /* --- чаты --- */
    chatsOf: function (u) { return C.chats.filter(function (c) { return c.a === u || c.b === u; }).sort(function (a, b) { return b.lastAt - a.lastAt; }); },
    chat: chat,
    messages: function (chatId) { return C.messages.filter(function (m) { return m.chatId === chatId; }).sort(function (a, b) { return a.createdAt - b.createdAt; }); },
    openChat: function (productId) {
      return once('chat', function () {
        var u = requireActive(), p = product(productId);
        if (!p) fail('Товар не найден'); if (p.sellerId === u.id) fail('Это ваш товар');
        var c = C.chats.find(function (x) { return x.productId === p.id && x.a === u.id; });
        if (c) return c;
        return sb.from('chats').insert({ id: uuid(), product_id: p.id, buyer_id: u.id, seller_id: p.sellerId }).select().single().then(function (r) {
          if (r.error && r.error.code === '23505') return refreshChats().then(function () { return C.chats.find(function (x) { return x.productId === p.id && x.a === u.id; }); });
          var c2 = upsert(C.chats, mapChat(q(r, 'Не удалось открыть чат'))); computeUnread(); emit(true); return c2;
        });
      });
    },
    sendMessage: function (chatId, text) {
      return P(function () {
        var u = requireActive(), c = chat(chatId); if (!c) fail('Нет доступа к чату');
        text = String(text || '').trim(); if (!text) fail('Напишите сообщение'); if (text.length > 2000) fail('Сообщение слишком длинное (до 2000 символов)');
        var id = uuid(), m = { id: id, chatId: chatId, from: u.id, text: text, system: false, createdAt: Date.now(), pending: true };
        C.messages.push(m); c.lastAt = m.createdAt; emit(true);
        return sb.from('messages').insert({ id: id, chat_id: chatId, sender_id: u.id, text: text }).then(function (r) {
          if (r.error) { C.messages = C.messages.filter(function (x) { return x.id !== id; }); emit(true); throw dbErr(r.error, 'Сообщение не отправлено'); }
          m.pending = false;
          sb.functions.invoke('notify-message', { body: { message_id: id } }).catch(function () {});
          return m;
        });
      });
    },
    markRead: function (chatId) {
      var c = chat(chatId); if (!c || !uidMe || !c.unread[uidMe]) return;
      var last = EVSA.db.messages(chatId).reduce(function (a, m) { return Math.max(a, m.createdAt); }, 0);
      var at = new Date(Math.max(Date.now(), last + 1)).toISOString();
      c.readAt[uidMe] = Date.parse(at); computeUnread();
      var patch = {}; patch[c.a === uidMe ? 'buyer_read_at' : 'seller_read_at'] = at;
      sb.from('chats').update(patch).eq('id', chatId).then(function () {});
      setTimeout(function () { emit(); }, 0);
    },
    unreadChats: function () { if (!uidMe) return 0; return C.chats.reduce(function (n, c) { return n + (c.unread[uidMe] || 0); }, 0); },

    /* --- поддержка: см. remote.js --- */
    sendSupport: function (category, text) {
      var cur = me();
      return new Promise(function (res, rej) {
        EVSA.remoteSupport.send({ category: category, text: text, guest: !cur, contact: '', name: cur ? cur.name : 'Гость', username: cur && cur.username ? '@' + cur.username : '' }, function (e, t) { if (e) rej(e); else res(t); });
      });
    },
    ticketsOf: function () { return []; },
    markSupportRead: function () {},

    /* --- баланс и пополнение звёздами Telegram ---
       Сайт только просит сервер выставить счёт. Зачисляет деньги бот после оплаты (service role). */
    starsQuote: function (rub) { rub = Number(rub); return { rub: rub, stars: EVSA.topupStars(rub) }; },
    balance: function () { return C.balance; },
    /* безлимитный баланс (∞): флаг ставится только на сервере, расходы его не уменьшают */
    unlimited: function () { return C.unlimited; },
    topups: function () { return C.topups; },
    refreshWallet: function () { var b = C.balance; return loadWallet().then(function () { emit(); return { balance: C.balance, delta: C.balance - b }; }); },
    /* --- вывод: заявка → владелец вручную дарит подарок за звёзды в Telegram ---
       Сумма списывается сразу (на сервере, атомарно); при отклонении возвращается. */
    withdrawals: function () { return C.withdrawals; },
    pendingWithdrawal: function () { return C.withdrawals.find(function (w) { return w.status === 'pending'; }) || null; },
    requestWithdrawal: function (rub, reqId) {
      return once('withdraw', function () {
        requireActive();
        var W = EVSA.WITHDRAW; rub = Number(rub);
        if (C.unlimited) fail('С безлимитного баланса вывод недоступен');
        if (!isFinite(rub) || Math.floor(rub) !== rub) fail('Введите целую сумму в рублях');
        if (rub < W.MIN) fail('Минимальная сумма вывода — ' + W.MIN + ' ₽');
        if (rub > W.MAX) fail('Максимальная сумма вывода — ' + W.MAX.toLocaleString('ru-RU') + ' ₽');
        if (rub > C.balance) fail('Недостаточно средств на балансе');
        return sb.rpc('request_withdrawal', { p_amount: rub, p_request_id: reqId }).then(function (r) {
          if (r.error) {
            var m = String(r.error.message || ''), map = { not_signed_in: 'Войдите, чтобы вывести деньги', banned: 'Ваш аккаунт заблокирован',
              owner_unlimited: 'С безлимитного баланса вывод недоступен', below_min: 'Минимальная сумма вывода — ' + W.MIN + ' ₽',
              no_telegram: 'Вывод возможен только для аккаунта, привязанного к Telegram. Войдите через Telegram',
              no_username: 'Не удалось определить ваш аккаунт Telegram. Нажмите «Обновить данные из Telegram» в профиле и попробуйте снова',
              pending_exists: 'У вас уже есть вывод в ожидании — дождитесь его завершения', bad_request: 'Проверьте сумму вывода' };
            var k = Object.keys(map).find(function (x) { return m.indexOf(x) >= 0; });
            throw k ? err(map[k]) : dbErr(r.error, 'Не удалось создать заявку. Деньги не списаны — попробуйте ещё раз');
          }
          var d = r.data || {};
          if (d.status === 'insufficient') fail('Недостаточно средств на балансе');
          if (d.status !== 'ok' && d.status !== 'duplicate') fail('Не удалось создать заявку');
          if (d.balance != null) C.balance = Number(d.balance) || 0;
          return loadWallet().then(function () { emit(true); return d; });
        });
      });
    },
    /* → {url, amount, stars}: ссылка на счёт в Telegram Stars */
    createStarsInvoice: function (rub) {
      return once('stars', function () {
        requireActive();
        var T = EVSA.TOPUP; rub = Number(rub);
        if (!isFinite(rub) || Math.floor(rub) !== rub || rub < T.MIN || rub > T.MAX) fail('Сумма пополнения: от ' + T.MIN + ' до ' + T.MAX.toLocaleString('ru-RU') + ' ₽');
        return sb.functions.invoke('create-stars-invoice', { body: { amount: rub } }).then(function (r) {
          if (r.error) return fnErr(r.error, 'Не удалось создать счёт. Попробуйте ещё раз').then(function (e) { throw e; });
          var d = r.data || {};
          if (!d.url || !/^https:\/\/t\.me\//.test(d.url)) fail('Не удалось создать счёт. Попробуйте ещё раз');
          return d;
        });
      });
    },
    notifications: function () { return []; }, unreadNotifs: function () { return 0; }, readAllNotifs: function () {}
  };
})();
