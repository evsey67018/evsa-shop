/* EVSA SHOP — роутер, обработчики действий, модальные окна */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc, P = EVSA.pages, I = EVSA.icons;
  var view = document.getElementById('view');
  var current = { name: '', args: [] };

  /* ---------- маршруты ---------- */
  function parse() {
    var h = location.hash.replace(/^#\/?/, '');
    var qs = '', qi = h.indexOf('?');
    if (qi >= 0) { qs = h.slice(qi + 1); h = h.slice(0, qi); }
    var q = {}; qs.split('&').forEach(function (kv) { if (!kv) return; var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var parts = h.split('/').filter(Boolean).map(function (x) { try { return decodeURIComponent(x); } catch (e) { return x; } });
    return { parts: parts, q: q };
  }
  var routes = {
    '': function () { P.home(view); return 'home'; },
    games: function () { P.allTargets(view); return 'games'; },
    t: function (a) { P.target(view, a[0], a[1], a[2] || null); return 'target'; },
    p: function (a) { P.product(view, a[0]); return 'product'; },
    u: function (a) { P.seller(view, a[0]); return 'seller'; },
    cheap: function () { P.cheap(view); return 'cheap'; },
    search: function (a) { P.search(view, a[0] || ''); return 'search'; },
    cart: function () { P.cart(view); return 'cart'; },
    notifications: function () { location.replace('#/'); return 'home'; },
    profile: function (a) { P.profile(view, a[0]); return 'profile'; },
    sell: function (a, q) { P.sell(view, q); return 'sell'; },
    chats: function () { P.chats(view); return 'chats'; },
    chat: function (a) { P.chat(view, a[0]); return 'chats'; },
    support: function () { P.support(view); return 'support'; },
    settings: function () { P.settings(view); return 'settings'; },
    admin: function () { location.replace('#/'); return 'home'; },
    favorites: function () { P.favorites(view); return 'favorites'; },
    referral: function () { P.referral(view); return 'referral'; },
    steam: function () { P.steam(view); return 'steam'; },
    guarantee: function () { P.guarantee(view); return 'guarantee'; }
  };

  function render(keepScroll) {
    var r = parse(), key = r.parts[0] || '', fn = routes[key];
    if (key === '' && r.q.ref) { try { sessionStorage.setItem('evsa_ref', r.q.ref.slice(0, 20)); } catch (e) {} }
    var y = window.scrollY;
    var nav;
    try { nav = fn ? fn(r.parts.slice(1), r.q) : (view.innerHTML = '<div class="page">' + U.empty('Страница не найдена', '', '<br><button class="btn" data-href="#/">На главную</button>') + '</div>', ''); }
    catch (e) { console.error(e); view.innerHTML = '<div class="page">' + U.empty('Ошибка', 'Не удалось открыть страницу', '<br><button class="btn" data-href="#/">На главную</button>') + '</div>'; }
    current = { name: nav, key: location.hash };
    setTitle(key, r.parts);
    U.$$('.sidebar a').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === nav || (nav === 'home' && a.dataset.nav === 'home')); });
    U.$$('.bottom-tabs a').forEach(function (a) { a.classList.toggle('active', a.dataset.tab === nav); });
    document.body.classList.remove('nav-open');
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    updateChrome();
  }

  /* ---------- заголовок вкладки по странице ---------- */
  var BASE_TITLE = 'EVSA SHOP — донат и игровые товары';
  var TITLES = { games: 'Все игры', cheap: 'Самые дешёвые товары', search: 'Поиск', cart: 'Корзина', profile: 'Профиль', sell: 'Продать товар',
    chats: 'Сообщения', chat: 'Чат', support: 'Поддержка', settings: 'Настройки', favorites: 'Избранное', referral: 'Приглашай друзей',
    steam: 'Пополнение Steam', guarantee: 'Наша гарантия', p: 'Товар', u: 'Продавец' };
  function setTitle(key, parts) {
    var t = TITLES[key] || '';
    try { if (key === 't') { var tg = EVSA.findTarget(parts[1], parts[2]); if (tg) t = tg.name; } } catch (e) {}
    document.title = t ? t + ' — EVSA SHOP' : BASE_TITLE;
  }

  /* ---------- шапка, бейджи, кнопка профиля ---------- */
  function setBadge(sel, n) { U.$$(sel).forEach(function (b) { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('on', n > 0); }); }
  function updateChrome() {
    var me = db.me();
    var chats = me ? db.unreadChats() : 0, notif = 0, cart = me ? db.cart().length : 0;
    document.body.classList.toggle('loading-data', !db.ready());
    setBadge('#badgeChats,[data-badge="chats"]', chats);
    setBadge('#badgeNotif,[data-badge="notif"]', notif);
    setBadge('#badgeCart,[data-badge="cart"]', cart);
    var fb = document.getElementById('fabBadge'); fb.textContent = notif + chats; fb.classList.toggle('on', notif + chats > 0);
    document.getElementById('fabInner').innerHTML = me ? U.avatar(me, 'fab') : '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
    var tl = document.getElementById('topLoginText'); if (tl) tl.textContent = me ? 'Профиль' : 'Войти';
  }

  /* перерисовка «живых» страниц при изменении данных (новые сообщения, статусы) */
  var liveTimer = null;
  db.onChange(function () {
    updateChrome();
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      var a = document.activeElement, typing = a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT');
      var r = parse(), k = r.parts[0] || '';
      if (k === 'chat') return P.chat(view, r.parts[1], true);
      if (k === 'support') return P.support(view, true);
      if (typing || document.getElementById('modalRoot').children.length) return;
      if (k === '' || k === 'sell') { if (U.$('[aria-busy]', view)) render(true); return; } // главную не дёргаем (карусель), только после загрузки
      if (['chats', 'profile', 'cart', 'favorites', 'p', 't', 'u', 'cheap', 'search', 'settings'].indexOf(k) >= 0) render(true);
    }, 60);
  });

  /* ---------- уведомления ---------- */
  /* уведомления убраны с сайта: всплывающие окна и колокольчик отключены */
  EVSA.onNotify = function () {};

  /* ---------- навигация по клику ---------- */
  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act && !act.disabled) { e.preventDefault(); e.stopPropagation(); return handle(act.dataset.act, act.dataset.id, act); }
    var h = e.target.closest('[data-href]');
    if (h && !e.target.closest('a[href]') && !e.target.closest('button:not([data-href])')) {
      var href = h.dataset.href;
      if (/^#\//.test(href)) { if (location.hash === href) render(true); else location.hash = href; }
    }
  });
  window.addEventListener('hashchange', function () { U.closeModal(); render(false); });

  document.getElementById('burger').onclick = function () { document.body.classList.toggle('nav-open'); };
  document.getElementById('scrim').onclick = function () { document.body.classList.remove('nav-open'); };
  /* На узком экране длинная подсказка в поиске обрезается — показываем короткую */
  (function () { var gs = document.getElementById('globalSearch'); function ph() { if (gs) gs.placeholder = window.innerWidth <= 480 ? 'Поиск' : 'Поиск игр и приложений'; } ph(); window.addEventListener('resize', ph); })();
  document.getElementById('profileFab').onclick = function () { EVSA.sound.click(); if (db.me()) location.hash = '#/profile'; else loginModal(); };
  var gs = document.getElementById('globalSearch');
  gs.addEventListener('keydown', function (e) { if (e.key === 'Enter' && gs.value.trim()) { location.hash = '#/search/' + encodeURIComponent(gs.value.trim()); gs.blur(); } });
  var gsT; gs.addEventListener('input', function () { clearTimeout(gsT); gsT = setTimeout(function () { var v = gs.value.trim(); if (v.length >= 2) location.hash = '#/search/' + encodeURIComponent(v); }, 450); });

  /* ---------- действия ---------- */
  function need() { if (db.me()) return true; loginModal(); return false; }
  function go(h) { if (location.hash === h) render(true); else location.hash = h; }

  function handle(a, id, el) {
    switch (a) {
      case 'back': if (history.length > 1) history.back(); else location.hash = '#/'; return;
      case 'login': return loginModal();
      case 'logout': return confirmModal('Выйти из аккаунта?', 'Ваши товары, чаты и избранное останутся на сервере — войти снова можно через Telegram.', 'Выйти', function () { return db.logout().then(function () { U.toast('Вы вышли из аккаунта'); go('#/'); }); });
      case 'fav':
        if (!need()) return;
        return U.try(function () {
          var on = db.toggleFav(id); EVSA.sound.click();
          U.$$('[data-act="fav"][data-id="' + id + '"]').forEach(function (b) { b.classList.toggle('on', on); var s = b.querySelector('span'); if (s) s.textContent = on ? 'В избранном' : 'В избранное'; });
          U.toast(on ? 'Добавлено в избранное' : 'Удалено из избранного', on ? 'ok' : 'info', on ? '#/favorites' : null);
        });
      case 'clearViewed': db.clearViewed(); return render(true);
      case 'report': if (!need()) return; return reportModal(id);
      case 'buy': if (!need()) return; return buyModal(id);
      case 'buyCart': return U.toast('Оплачивайте товары по одному — кнопка «Купить» у каждого товара');
      case 'confirmOrder': return confirmModal('Подтвердить получение?', 'Подтверждайте, только если продавец передал товар и всё работает. После подтверждения сделка завершится и можно оставить отзыв.', 'Товар получен', function () { return db.confirmOrder(id).then(function () { EVSA.sound.success(); U.toast('Сделка завершена — оставьте отзыв продавцу', 'ok'); }); });
      case 'cartAdd': if (!need()) return; return U.try(function () { db.cartAdd(id); EVSA.sound.success(); U.toast('Добавлено в корзину', 'ok', '#/cart'); });
      case 'cartRemove': return U.try(function () { db.cartRemove(id); render(true); });
      case 'chatSeller': if (!need()) return; return U.try(function () { return U.busy(el, db.openChat(id)).then(function (c) { if (c) location.hash = '#/chat/' + c.id; }); });
      case 'removeProduct': return confirmModal('Снять товар с продажи?', 'Объявление исчезнет из каталога.', 'Снять', function () { return db.deleteProduct(id).then(function () { U.toast('Товар снят с продажи', 'ok'); location.hash = '#/profile/items'; }); });
      case 'review': return reviewModal(id);
      case 'deposit': if (!need()) return; return depositModal();
      case 'withdraw': if (!need()) return; return withdrawModal();
    }
  }

  function confirmModal(title, text, btn, fn, kind) {
    var b = U.modal(esc(title), '<p class="muted" style="margin-top:0">' + esc(text) + '</p><div class="row"><button class="btn block" data-close>Отмена</button><button class="btn block ' + (kind || 'primary') + '" id="cOk">' + esc(btn) + '</button></div>');
    var ok = U.$('#cOk', b);
    ok.onclick = function () { U.try(function () { var r = fn(); return r && r.then ? U.busy(ok, r).then(function () { U.closeModal(); }) : U.closeModal(); }); };
  }

  /* ---- вход через Telegram-бота: одноразовая ссылка t.me/<бот>?start=login_<код> (5 минут) ---- */
  var loginTimer = null;
  function stopLoginPoll() { clearTimeout(loginTimer); loginTimer = null; }
  function loginModal() {
    var me = db.me();
    var b = U.modal('Вход через Telegram', '<div class="stack login-box">' +
      '<div class="login-hero">' + I.tg + '</div>' +
      '<p class="muted small" style="margin:0;text-align:center">' + (me ? 'Обновим имя и аватарку из Telegram.' : 'Аккаунт создаётся по вашему Telegram — без паролей и почты. Один Telegram = один аккаунт.') + '</p>' +
      '<ol class="login-steps small"><li>Нажмите кнопку — откроется бот @' + esc(EVSA.TOPUP.BOT) + '</li><li>Нажмите в боте «Запустить» / Start</li><li>Вернитесь на сайт — вход выполнится сам</li></ol>' +
      '<div class="err" id="lgErr" role="alert"></div><a class="btn primary block lg tg-pay" id="lgGo" href="#" target="_blank" rel="noopener">' + I.tg + 'Войти через Telegram</a>' +
      '<div class="login-wait tiny muted" id="lgWait" hidden><span class="spin"></span>Ждём подтверждения в Telegram…</div></div>');
    var go = U.$('#lgGo', b), wait = U.$('#lgWait', b), errBox = U.$('#lgErr', b), win = null;
    go.onclick = function (ev) {
      ev.preventDefault(); errBox.textContent = '';
      var tg = window.Telegram && window.Telegram.WebApp;
      if (!(tg && tg.initData)) { try { win = window.open('about:blank', '_blank'); } catch (e) { win = null; } }
      U.busy(go, db.loginStart()).then(function (r) {
        if (tg && tg.openTelegramLink && tg.initData) tg.openTelegramLink(r.url);
        else if (win && !win.closed) win.location.href = r.url;
        else location.href = r.url;
        go.href = r.url; go.lastChild.textContent = 'Открыть бота ещё раз';
        go.onclick = null;
        wait.hidden = false; pollLogin(r.nonce, b);
      }).catch(function (e) { if (win) try { win.close(); } catch (x) {} errBox.textContent = e.userMessage || 'Не удалось начать вход'; EVSA.sound.error(); });
    };
  }
  function pollLogin(nonce, box, tries) {
    stopLoginPoll(); tries = tries || 0;
    if (tries > 150) return; // ~5 минут
    loginTimer = setTimeout(function () {
      db.loginPoll(nonce).then(function (st) {
        if (st === 'pending') return pollLogin(nonce, box, tries + 1);
        stopLoginPoll();
        if (st === 'ok') { U.closeModal(); EVSA.sound.success(); var me = db.me(); U.toast('Вы вошли' + (me ? ' как ' + me.name : ''), 'ok'); render(true); return; }
        var msg = st === 'banned' ? 'Аккаунт заблокирован' : st === 'expired' ? 'Ссылка устарела — нажмите «Войти через Telegram» ещё раз' : st === 'used' ? 'Ссылка уже использована — начните вход заново' : 'Не удалось войти, попробуйте ещё раз';
        if (box && box.isConnected) { var e = U.$('#lgErr', box); if (e) e.textContent = msg; var w = U.$('#lgWait', box); if (w) w.hidden = true; } else U.toast(msg, 'bad');
      }).catch(function () { pollLogin(nonce, box, tries + 1); });
    }, tries < 10 ? 1500 : 2500);
  }
  /* вернулись из Telegram — проверяем начатый вход сразу */
  function resumeLogin() { var n = db.pendingLogin(); if (n && !db.me() && !loginTimer) pollLogin(n, U.$('#modalRoot .login-box'), 0); }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resumeLogin(); });
  window.addEventListener('focus', resumeLogin);

  /* ---- покупка с баланса: подтверждение → RPC buy_listing (атомарно на сервере) ---- */
  function buyModal(pid) {
    var p = db.product(pid), me = db.me();
    if (!p) return U.toast('Товар не найден', 'bad');
    if (me && me.id === p.sellerId) return U.toast('Это ваш товар', 'bad');
    if (p.status !== 'active') return U.toast('Товар уже недоступен', 'bad');
    var reqId = db.newRequestId(); // один id на это окно: двойной клик не спишет дважды
    var unl = db.unlimited(), bal = db.balance(), enough = unl || bal >= p.price;
    var b = U.modal('Покупка', '<div class="stack">' +
      '<div class="row"><img src="' + esc(U.pimg(p)) + '" alt="" style="width:84px;height:54px;object-fit:cover;border-radius:10px"><div class="grow" style="min-width:0"><b class="small">' + esc(p.title) + '</b><div class="tiny muted">Продавец: ' + esc(db.user(p.sellerId).name) + '</div></div></div>' +
      '<div class="card" style="margin:0"><div class="row between"><span class="muted">Цена</span><b>' + U.rub(p.price) + '</b></div>' +
      '<div class="row between" style="margin-top:6px"><span class="muted">Ваш баланс</span><b>' + (unl ? '∞' : U.rub(bal)) + '</b></div>' +
      (unl ? '' : '<div class="row between" style="margin-top:6px"><span class="muted">После покупки</span><b' + (enough ? '' : ' style="color:#f87171"') + '>' + (enough ? U.rub(bal - p.price) : 'не хватает ' + U.rub(p.price - bal)) + '</b></div>') + '</div>' +
      '<div class="note small">Деньги спишутся с баланса сайта. Продавец передаст товар в чате сделки — после получения нажмите «Товар получен». Проблема с заказом — напишите в поддержку.</div>' +
      '<div class="err" id="byErr" role="alert"></div>' +
      (enough ? '<button class="btn primary block lg" id="byGo">Оплатить ' + U.rub(p.price) + '</button>' :
        '<button class="btn primary block lg" id="byTop">' + I.plus + 'Недостаточно средств — пополнить</button>') +
      '<button class="btn block ghost" data-close>Отмена</button></div>');
    var top = U.$('#byTop', b); if (top) top.onclick = function () { depositModal(p.price - bal); };
    var go = U.$('#byGo', b); if (!go) return;
    go.onclick = function () {
      var errBox = U.$('#byErr', b); errBox.textContent = '';
      U.busy(go, db.buy(p.id, reqId)).then(function (d) {
        EVSA.sound.success();
        U.modal('Оплачено ✅', '<div class="stack"><p style="margin:0">Заказ <b>#' + esc(String(d.order_id).slice(-6)) + '</b> «' + esc(p.title) + '» оплачен: ' + U.rub(d.price) + '.</p>' +
          '<div class="note small">Продавец получил уведомление и передаст товар в чате сделки. Если что-то пошло не так — напишите в поддержку.</div>' +
          (d.unlimited ? '' : '<div class="small muted">Баланс: ' + U.rub(d.balance) + '</div>') +
          (d.chat_id ? '<button class="btn primary block" data-href="#/chat/' + esc(d.chat_id) + '" data-close>' + I.chat + 'Открыть чат сделки</button>' : '') +
          '<button class="btn block" data-href="#/profile/buys" data-close>Мои покупки</button></div>');
      }).catch(function (e) {
        EVSA.sound.error();
        if (e && e.code === 'insufficient') {
          errBox.innerHTML = 'Недостаточно средств. <a href="#" id="byTop2">Пополнить</a>';
          U.$('#byTop2', b).onclick = function (ev) { ev.preventDefault(); depositModal(e.need > 0 ? e.need : p.price); };
          return;
        }
        errBox.textContent = (e && e.userMessage) || 'Не удалось оплатить. Попробуйте ещё раз';
      });
    };
  }

  /* ---- отзывы ---- */
  function reviewModal(oid) {
    var rating = 5;
    var b = U.modal('Отзыв продавцу', '<div class="stack"><div class="rating-pick">' + [1, 2, 3, 4, 5].map(function (i) { return '<button data-r="' + i + '" class="on" aria-label="' + i + '">★</button>'; }).join('') + '</div><textarea class="input" id="rvText" maxlength="1000" placeholder="Расскажите, как прошла сделка"></textarea><div class="err" id="rvErr" role="alert"></div><button class="btn primary block" id="rvGo">Отправить отзыв</button></div>');
    U.$$('[data-r]', b).forEach(function (x) { x.onclick = function () { rating = Number(x.dataset.r); U.$$('[data-r]', b).forEach(function (y) { y.classList.toggle('on', Number(y.dataset.r) <= rating); }); EVSA.sound.click(); }; });
    var go = U.$('#rvGo', b);
    go.onclick = function () { U.busy(go, db.review(oid, rating, U.$('#rvText', b).value)).then(function () { U.closeModal(); EVSA.sound.success(); U.toast('Спасибо за отзыв!', 'ok'); }).catch(function (e) { U.$('#rvErr', b).textContent = e.userMessage || 'Ошибка'; EVSA.sound.error(); }); };
  }
  function reportModal(pid) {
    var p = db.product(pid); if (!p) return;
    var reasons = ['Мошенничество', 'Товар не соответствует описанию', 'Запрещённый товар', 'Оскорбления', 'Другое'];
    var b = U.modal('Пожаловаться', '<div class="stack"><select class="select" id="rpR">' + reasons.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select><textarea class="input" id="rpT" maxlength="1000" placeholder="Подробности (необязательно)"></textarea><button class="btn danger block" id="rpGo">Отправить жалобу</button></div>');
    var go = U.$('#rpGo', b);
    go.onclick = function () { U.try(function () { return U.busy(go, db.sendSupport('Жалоба на продавца', 'Жалоба на товар «' + p.title + '» (#' + p.id.slice(0, 8) + ', продавец ' + db.user(p.sellerId).name + '): ' + U.$('#rpR', b).value + '. ' + U.$('#rpT', b).value)).then(function () { U.closeModal(); EVSA.sound.success(); U.toast('Жалоба отправлена в поддержку', 'ok'); }); }); };
  }

  /* ---- пополнение баланса звёздами Telegram ----
     Сервер (create-stars-invoice) выставляет счёт на round(сумма * 0.8) ⭐ и присылает его в бота.
     Баланс зачисляет бот после оплаты; сайт только ждёт обновления баланса. */
  var payTimer = null;
  function stopPayPoll() { clearTimeout(payTimer); payTimer = null; }
  /* вывод: заявка уходит владельцу в Telegram-бота, он вручную дарит подарок за звёзды */
  function withdrawModal() {
    var W = EVSA.WITHDRAW, me = db.me(), bal = db.balance(), pw = db.pendingWithdrawal();
    if (db.unlimited()) { U.toast('С безлимитного баланса вывод недоступен', 'err'); return; }
    var hist = '<button type="button" class="btn block" data-href="#/profile/withdrawals">История выводов</button>';
    if (pw) {
      U.modal('Вывод средств', '<div class="stack"><div class="note small"><span class="status pending">В ожидании</span> Вывод <b>' + U.rub(pw.rub) + '</b> (≈' + EVSA.topupStars(pw.rub) + ' ⭐) уже обрабатывается. Новый вывод можно запросить после его завершения.</div>' + hist + '</div>');
      return;
    }
    var noTg = !me.tgId, noUser = !me.username;
    if (noTg || noUser) {
      U.modal('Вывод средств', '<div class="stack"><div class="note bad small">' + (noTg ? 'Вывод возможен только для аккаунта, привязанного к Telegram. Войдите через Telegram.' :
        'У вашего Telegram нет username — без него мы не сможем отправить подарок. Укажите username в настройках Telegram, затем нажмите «Обновить данные из Telegram».') + '</div>' +
        '<button type="button" class="btn primary block" data-act="login">' + I.tg + 'Обновить данные из Telegram</button></div>');
      return;
    }
    var max = Math.min(W.MAX, Math.floor(bal));
    if (max < W.MIN) {
      U.modal('Вывод средств', '<div class="stack"><div class="note small">Минимальная сумма вывода — <b>' + U.rub(W.MIN) + '</b>. Сейчас на балансе ' + U.rub(bal) + '.</div>' + hist + '</div>');
      return;
    }
    var reqId = EVSA.db.newRequestId(), quick = [100, 500, 1000].filter(function (x) { return x <= max; });
    var b = U.modal('Вывод средств', '<div class="stack">' +
      '<div class="note small wd-note">🎁 <b>Вывод приходит подарком за звёзды в Telegram</b> на ваш аккаунт <b>@' + esc(me.username) + '</b>. Заявка обрабатывается вручную, статус — в «Истории выводов».</div>' +
      '<label class="field">Сумма вывода, ₽<input class="input" id="wSum" type="number" inputmode="numeric" min="' + W.MIN + '" max="' + max + '" step="1" value="' + W.MIN + '"></label>' +
      '<div class="amounts" style="grid-template-columns:repeat(' + (quick.length + 1) + ',1fr)">' + quick.map(function (x) { return '<button type="button" class="btn sm" data-s="' + x + '">' + x + '\u00a0₽</button>'; }).join('') +
      '<button type="button" class="btn sm" data-s="' + max + '">Всё</button></div>' +
      '<div class="topup-quote"><span class="muted small">Подарок примерно на<br><span class="tiny">курс как у пополнения: 100 ₽ ≈ ' + EVSA.topupStars(100) + ' ⭐</span></span><b id="wStars"></b></div>' +
      '<div class="err" id="wErr" role="alert"></div>' +
      '<button type="button" class="btn primary block" id="wGo">Подтвердить вывод</button>' +
      '<div class="tiny muted">Доступно: ' + U.rub(bal) + '. От ' + W.MIN + ' ₽. Сумма спишется с баланса сразу; если вывод отклонят — вернётся.</div></div>');
    var s = U.$('#wSum', b), btn = U.$('#wGo', b), errBox = U.$('#wErr', b);
    function amount() { return Number(String(s.value).replace(',', '.')); }
    function check() {
      var v = amount();
      if (!isFinite(v) || String(s.value).trim() === '') return 'Введите сумму в рублях';
      if (Math.floor(v) !== v) return 'Сумма — целое число рублей';
      if (v < W.MIN) return 'Минимальная сумма вывода — ' + W.MIN + ' ₽';
      if (v > db.balance()) return 'Недостаточно средств: на балансе ' + U.rub(db.balance());
      if (v > W.MAX) return 'Максимальная сумма вывода — ' + W.MAX.toLocaleString('ru-RU') + ' ₽';
      return '';
    }
    function q() { var e = check(); U.$('#wStars', b).textContent = e ? '—' : '≈' + EVSA.topupStars(amount()) + ' ⭐'; if (!e) errBox.textContent = ''; }
    s.oninput = function () { reqId = EVSA.db.newRequestId(); q(); }; q();
    U.$$('[data-s]', b).forEach(function (x) { x.onclick = function () { s.value = x.dataset.s; reqId = EVSA.db.newRequestId(); q(); }; });
    btn.onclick = function () {
      var e = check();
      if (e) { errBox.textContent = e; EVSA.sound.error(); return; }
      var v = amount();
      U.busy(btn, db.requestWithdrawal(v, reqId)).then(function () {
        EVSA.sound.success(); U.closeModal();
        U.toast('Заявка на вывод ' + U.rub(v) + ' отправлена. Статус: «В ожидании»', 'ok', '#/profile/withdrawals');
        go('#/profile/withdrawals');
      }).catch(function (x) { errBox.textContent = x.userMessage || 'Не удалось создать заявку'; EVSA.sound.error(); });
    };
  }
  function depositModal(need) {
    var T = EVSA.TOPUP;
    var start = need ? Math.min(T.MAX, Math.max(T.MIN, Math.ceil(need))) : 100;
    stopPayPoll();
    var b = U.modal('Пополнение баланса', '<div class="stack">' +
      (db.unlimited() ? '<div class="note small">Ваш баланс: <b>∞</b> (безлимитный). Пополнять не нужно, но пополнение работает как обычно.</div>' : '') +
      '<div class="note small">Оплата звёздами Telegram. Звёзд нужно на ' + Math.round(T.DISCOUNT * 100) + '% меньше, чем рублей: 100 ₽ = ' + EVSA.topupStars(100) + ' ⭐. На баланс придёт вся сумма в рублях.</div>' +
      '<label class="field">Сумма пополнения, ₽<input class="input" id="dSum" type="number" inputmode="numeric" min="' + T.MIN + '" max="' + T.MAX + '" step="1" value="' + start + '"></label>' +
      '<div class="amounts" style="grid-template-columns:repeat(4,1fr)">' + [100, 200, 500, 1000].map(function (x) { return '<button type="button" class="btn sm" data-s="' + x + '">' + x + '\u00a0₽</button>'; }).join('') + '</div>' +
      '<div class="topup-quote"><span class="muted small">К оплате звёздами<br><span class="tiny">скидка ' + Math.round(T.DISCOUNT * 100) + '%</span></span><b id="dStars"></b></div>' +
      '<div class="err" id="dErr" role="alert"></div>' +
      '<a class="btn primary block tg-pay" id="dGo" href="#" target="_blank" rel="noopener">' + I.tg + '<span>Пополнить</span></a>' +
      '<div class="login-wait tiny muted" id="dWait" hidden><span class="spin"></span>Ждём оплату в Telegram… Баланс обновится сам.</div>' +
      '<div class="tiny muted">Счёт откроется в Telegram и придёт в бота @' + esc(T.BOT) + '. От ' + T.MIN + ' до ' + T.MAX.toLocaleString('ru-RU') + ' ₽.</div></div>');
    var s = U.$('#dSum', b), go = U.$('#dGo', b), errBox = U.$('#dErr', b), wait = U.$('#dWait', b), invoice = null;
    function amount() { return Number(String(s.value).replace(',', '.')); }
    function check() {
      var v = amount();
      if (!isFinite(v) || String(s.value).trim() === '') return 'Введите сумму в рублях';
      if (Math.floor(v) !== v) return 'Сумма — целое число рублей';
      if (v < T.MIN || v > T.MAX) return 'Сумма пополнения: от ' + T.MIN + ' до ' + T.MAX.toLocaleString('ru-RU') + ' ₽';
      return '';
    }
    function q() {
      var e = check(); U.$('#dStars', b).textContent = e ? '—' : db.starsQuote(amount()).stars + ' ⭐';
      if (!e) errBox.textContent = '';
      if (invoice && invoice.amount !== amount()) { invoice = null; go.href = '#'; go.lastChild.textContent = 'Пополнить'; }
    }
    s.oninput = q; q();
    U.$$('[data-s]', b).forEach(function (x) { x.onclick = function () { s.value = x.dataset.s; q(); }; });
    function openInvoice(url, win) {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (tg && tg.initData && tg.openInvoice) { tg.openInvoice(url, function (st) { if (st === 'paid') db.refreshWallet(); }); return; }
      if (tg && tg.initData && tg.openTelegramLink) return tg.openTelegramLink(url);
      if (win && !win.closed) win.location.href = url; else location.href = url;
    }
    go.onclick = function (ev) {
      ev.preventDefault();
      var e = check();
      if (e) { errBox.textContent = e; EVSA.sound.error(); return false; }
      if (invoice) { openInvoice(invoice.url, null); return false; } // тот же счёт ещё раз
      var tg = window.Telegram && window.Telegram.WebApp, win = null;
      if (!(tg && tg.initData)) { try { win = window.open('about:blank', '_blank'); } catch (x) { win = null; } }
      var bal0 = db.balance();
      U.busy(go, db.createStarsInvoice(amount())).then(function (r) {
        invoice = { url: r.url, amount: r.amount };
        openInvoice(r.url, win);
        go.href = r.url; go.lastChild.textContent = 'Открыть счёт ещё раз (' + r.stars + ' ⭐)';
        wait.hidden = false; pollPay(bal0, b, 0);
      }).catch(function (x) { if (win) try { win.close(); } catch (y) {} errBox.textContent = x.userMessage || 'Не удалось создать счёт'; EVSA.sound.error(); });
      return false;
    };
  }
  /* ждём зачисления (~10 минут); realtime обычно обновляет баланс раньше */
  function pollPay(bal0, box, tries) {
    stopPayPoll();
    if (tries > 200) return;
    payTimer = setTimeout(function () {
      db.refreshWallet().then(function () {
        var got = db.balance() - bal0;
        if (got > 0) {
          stopPayPoll(); EVSA.sound.success();
          U.toast('Баланс пополнен на ' + U.rub(got), 'ok', '#/profile');
          if (box && box.isConnected) U.closeModal();
          render(true); return;
        }
        if (box && box.isConnected) pollPay(bal0, box, tries + 1); else if (tries < 100) pollPay(bal0, null, tries + 1);
      }).catch(function () { pollPay(bal0, box, tries + 1); });
    }, 3000);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && db.me()) db.refreshWallet().catch(function () {}); });

  /* ---------- настройки и тема ---------- */
  EVSA.app = {
    refresh: function () { render(true); },
    applySettings: function () { updateChrome(); },
    setTheme: function (theme, e) {
      EVSA.settings.set({ theme: theme }); EVSA.sound.theme();
      var apply = function () { document.documentElement.setAttribute('data-theme', theme); U.$$('[data-theme-set]').forEach(function (b) { b.classList.toggle('active', b.dataset.themeSet === theme); }); };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var x = e && e.clientX || innerWidth / 2, y = e && e.clientY || innerHeight / 2;
        document.documentElement.style.setProperty('--vt-x', x + 'px'); document.documentElement.style.setProperty('--vt-y', y + 'px');
        document.startViewTransition(apply);
      } else { document.body.classList.add('theme-anim'); apply(); setTimeout(function () { document.body.classList.remove('theme-anim'); }, 600); }
    }
  };

  /* ---------- старт ---------- */
  function hideSplash() { var s = document.getElementById('splash'); if (!s) return; s.classList.add('done'); setTimeout(function () { s.remove(); }, 600); }
  render(false);
  setTimeout(hideSplash, 650);
  db.init().then(function () {
    if (db.loadFailed) U.toast('Не удалось загрузить данные с сервера. Проверьте интернет и обновите страницу', 'bad');
    render(true); resumeLogin();
  });
})();
