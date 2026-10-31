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
    search: function (a) { P.search(view, a[0] || ''); return 'search'; },
    cart: function () { P.cart(view); return 'cart'; },
    notifications: function () { P.notifications(view); return 'notifications'; },
    profile: function (a) { P.profile(view, a[0]); return 'profile'; },
    sell: function (a, q) { P.sell(view, q); return 'sell'; },
    chats: function () { P.chats(view); return 'chats'; },
    chat: function (a) { P.chat(view, a[0]); return 'chats'; },
    support: function () { P.support(view); return 'support'; },
    settings: function () { P.settings(view); return 'settings'; },
    admin: function (a) { P.admin(view, a[0]); return 'admin'; },
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
    U.$$('.sidebar a').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === nav || (nav === 'home' && a.dataset.nav === 'home')); });
    U.$$('.bottom-tabs a').forEach(function (a) { a.classList.toggle('active', a.dataset.tab === nav); });
    document.body.classList.remove('nav-open');
    if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
    updateChrome();
  }

  /* ---------- шапка, бейджи, кнопка профиля ---------- */
  function setBadge(sel, n) { U.$$(sel).forEach(function (b) { b.textContent = n > 99 ? '99+' : n; b.classList.toggle('on', n > 0); }); }
  function updateChrome() {
    var me = db.me();
    var chats = me ? db.unreadChats() : 0, notif = me ? db.unreadNotifs() : 0, cart = me ? db.cart().length : 0;
    setBadge('#badgeChats,[data-badge="chats"]', chats);
    setBadge('#badgeNotif,[data-badge="notif"]', notif);
    setBadge('#badgeCart,[data-badge="cart"]', cart);
    var fb = document.getElementById('fabBadge'); fb.textContent = notif + chats; fb.classList.toggle('on', notif + chats > 0);
    document.getElementById('fabInner').innerHTML = me ? U.avatar(me, 'fab') : '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
    var tl = document.getElementById('topLoginText'); if (tl) tl.textContent = me ? 'Профиль' : 'Войти';
    var na = document.getElementById('navAdmin'); if (na) na.hidden = !EVSA.settings.get().adminDemo;
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
      if (['chats', 'notifications', 'profile', 'cart', 'admin', 'favorites', 'p'].indexOf(k) >= 0) render(true);
    }, 60);
  });

  /* ---------- уведомления ---------- */
  EVSA.onNotify = function (n) {
    var s = EVSA.settings.get();
    if (!s.notify || s.dnd) return;
    U.toast(n.text, n.kind === 'bad' ? 'bad' : n.kind === 'money' || n.kind === 'deal' ? 'ok' : 'info', n.link);
    if (n.kind === 'message') EVSA.sound.message(); else EVSA.sound.success();
  };

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
      case 'login': case 'switchAcc': return loginModal();
      case 'logout': return confirmModal('Выйти из аккаунта?', 'Данные аккаунта сохранятся в этом браузере.', 'Выйти', function () { db.logout(); U.toast('Вы вышли из аккаунта'); go('#/'); });
      case 'resetDemo': return confirmModal('Сбросить демо-данные?', 'Все тестовые аккаунты, товары, чаты и балансы в этом браузере будут удалены.', 'Сбросить', function () { db.reset(); U.toast('Демо-данные сброшены', 'ok'); go('#/'); });
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
      case 'buyCart': return buyCart();
      case 'cartAdd': if (!need()) return; return U.try(function () { db.cartAdd(id); EVSA.sound.success(); U.toast('Добавлено в корзину', 'ok', '#/cart'); });
      case 'cartRemove': return U.try(function () { db.cartRemove(id); render(true); });
      case 'chatSeller': if (!need()) return; return U.try(function () { var c = db.openChat(id); location.hash = '#/chat/' + c.id; });
      case 'removeProduct': return confirmModal('Снять товар с продажи?', 'Объявление исчезнет из каталога.', 'Снять', function () { db.deleteProduct(id); U.toast('Товар снят с продажи', 'ok'); location.hash = '#/profile/items'; });
      case 'readAll': db.readAllNotifs(); return render(true);
      case 'confirm': return confirmModal('Подтвердить получение?', 'Подтверждайте только если товар получен и всё в порядке. Деньги сразу перейдут продавцу — отменить будет нельзя.', 'Да, товар получен', function () { db.confirm(id); EVSA.sound.success(); successModal('Сделка завершена', 'Спасибо! Оцените продавца — это помогает другим покупателям.', 'Оставить отзыв', function () { reviewModal(id); }); }, 'ok');
      case 'apply': return applyModal(id);
      case 'dispute': return disputeModal(id);
      case 'delivered': return U.try(function () { db.markDelivered(id); EVSA.sound.success(); U.toast('Покупатель получил уведомление', 'ok'); });
      case 'review': return reviewModal(id);
      case 'deposit': if (!need()) return; return depositModal();
      case 'withdraw': if (!need()) return; return withdrawModal();
    }
  }

  function confirmModal(title, text, btn, fn, kind) {
    var b = U.modal(esc(title), '<p class="muted" style="margin-top:0">' + esc(text) + '</p><div class="row"><button class="btn block" data-close>Отмена</button><button class="btn block ' + (kind || 'primary') + '" id="cOk">' + esc(btn) + '</button></div>');
    U.$('#cOk', b).onclick = function () { U.closeModal(); U.try(fn); };
  }
  function successModal(title, text, btn, fn) {
    var b = U.modal('', '<div style="text-align:center"><div class="success-burst"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div><h2>' + esc(title) + '</h2><p class="muted">' + esc(text) + '</p><div class="stack"><button class="btn primary block" id="sOk">' + esc(btn) + '</button><button class="btn block ghost" data-close>Закрыть</button></div></div>');
    U.$('#sOk', b).onclick = function () { U.closeModal(); fn(); };
  }

  /* ---- вход (демо Telegram) ---- */
  function loginModal() {
    var me = db.me();
    var others = db.raw().users.filter(function (u) { return !u.isSeed && (!me || u.id !== me.id); });
    var sellers = db.raw().users.filter(function (u) { return u.isSeed && u.id.indexOf('u_buyer') !== 0; });
    var b = U.modal('Вход через Telegram', '<div class="stack">' +
      '<div class="note small">Демо-версия: настоящий вход через Telegram заработает после подключения сервера. Сейчас введите имя и username — аккаунт создастся только в этом браузере. Один Telegram = один аккаунт.</div>' +
      '<label class="field">Имя<input class="input" id="lgName" maxlength="40" placeholder="Как вас зовут" value="' + (me ? esc(me.name) : '') + '"></label>' +
      '<label class="field">Username в Telegram (необязательно)<input class="input" id="lgUser" maxlength="33" placeholder="@username" value="' + (me && me.username ? '@' + esc(me.username) : '') + '"></label>' +
      '<label class="field">Аватарка (необязательно)<input class="input" id="lgAva" type="file" accept="image/jpeg,image/png,image/webp"></label>' +
      '<div class="err" id="lgErr"></div><button class="btn primary block lg" id="lgGo">' + I.tg + 'Войти</button>' +
      (others.length ? '<div class="muted small">Аккаунты в этом браузере</div>' + others.map(function (u) { return '<button class="btn block" data-as="' + u.id + '" style="justify-content:flex-start">' + U.avatar(u, 's') + esc(u.name) + (u.username ? ' <span class="muted small">@' + esc(u.username) + '</span>' : '') + '</button>'; }).join('') : '') +
      '<details><summary class="small muted" style="cursor:pointer">Войти как демо-продавец (для теста продаж)</summary><div class="stack" style="margin-top:8px">' + sellers.map(function (u) { return '<button class="btn block sm" data-as="' + u.id + '" style="justify-content:flex-start">' + U.avatar(u, 's') + esc(u.name) + '</button>'; }).join('') + '</div></details></div>');
    var ava = null;
    U.$('#lgAva', b).onchange = function (e) { U.readImage(e.target.files[0], 256, function (err, url) { if (err) return U.err(err); ava = url; }); };
    U.$('#lgGo', b).onclick = function () {
      try { var u = db.login({ name: U.$('#lgName', b).value, username: U.$('#lgUser', b).value, avatar: ava }); U.closeModal(); EVSA.sound.success(); U.toast('Вы вошли как ' + u.name, 'ok'); render(true); }
      catch (e) { U.$('#lgErr', b).textContent = e.userMessage || 'Ошибка'; EVSA.sound.error(); }
    };
    U.$$('[data-as]', b).forEach(function (x) { x.onclick = function () { U.try(function () { var u = db.loginAs(x.dataset.as); U.closeModal(); U.toast('Вы вошли как ' + u.name, 'ok'); render(true); }); }; });
  }

  /* ---- покупка ---- */
  function buyModal(pid) {
    var p = db.product(pid), me = db.me(); if (!p) return;
    var enough = me.balance >= p.price;
    var b = U.modal('Покупка', '<div class="stack"><div class="row"><img src="' + esc(U.pimg(p)) + '" alt="" style="width:84px;height:54px;object-fit:cover;border-radius:10px"><div class="grow"><b class="small">' + esc(p.title) + '</b><div class="tiny muted">Продавец: ' + esc(db.user(p.sellerId).name) + '</div></div></div>' +
      '<div class="row between"><span class="muted">Цена</span><b style="font-size:20px">' + U.rub(p.price) + '</b></div><div class="row between small"><span class="muted">Ваш баланс</span><span>' + U.rub(me.balance) + '</span></div>' +
      '<div class="note small">🔒 Деньги будут зарезервированы. Продавец получит их только после того, как вы подтвердите получение товара.</div>' +
      (enough ? '<button class="btn primary block lg" id="bGo">Оплатить ' + U.rub(p.price) + '</button>' : '<div class="note warn small">Не хватает ' + U.rub(p.price - me.balance) + '. Пополните баланс.</div><button class="btn primary block lg" id="bDep">Пополнить баланс</button>') + '</div>');
    var g = U.$('#bGo', b);
    if (g) g.onclick = function () {
      g.disabled = true;
      U.try(function () { var o = db.buy(pid); db.cartRemove(pid); EVSA.sound.success(); successModal('Покупка оформлена!', 'Деньги в резерве. Продавец получил уведомление — товар придёт в чат сделки.', 'Открыть чат сделки', function () { location.hash = '#/chat/' + o.chatId; }); });
      g.disabled = false;
    };
    var d = U.$('#bDep', b); if (d) d.onclick = function () { U.closeModal(); depositModal(p.price - me.balance); };
  }
  function buyCart() {
    var items = db.cart(), me = db.me(); if (!items.length) return;
    var total = items.reduce(function (s, p) { return s + p.price; }, 0);
    if (me.balance < total) { U.toast('Не хватает ' + U.rub(total - me.balance) + '. Пополните баланс.', 'bad'); return depositModal(total - me.balance); }
    confirmModal('Купить ' + items.length + ' товар(ов)?', 'С баланса будет зарезервировано ' + total + ' ₽. По каждому товару откроется отдельная безопасная сделка.', 'Купить всё', function () {
      var ok = 0; items.forEach(function (p) { try { db.buy(p.id); db.cartRemove(p.id); ok++; } catch (e) { U.err(e); } });
      if (ok) { EVSA.sound.success(); U.toast('Оформлено покупок: ' + ok, 'ok'); location.hash = '#/profile/buys'; }
    });
  }

  /* ---- сделки ---- */
  function reviewModal(oid) {
    var rating = 5;
    var b = U.modal('Отзыв продавцу', '<div class="stack"><div class="rating-pick">' + [1, 2, 3, 4, 5].map(function (i) { return '<button data-r="' + i + '" class="on" aria-label="' + i + '">★</button>'; }).join('') + '</div><textarea class="input" id="rvText" maxlength="1000" placeholder="Расскажите, как прошла сделка"></textarea><div class="err" id="rvErr"></div><button class="btn primary block" id="rvGo">Отправить отзыв</button></div>');
    U.$$('[data-r]', b).forEach(function (x) { x.onclick = function () { rating = Number(x.dataset.r); U.$$('[data-r]', b).forEach(function (y) { y.classList.toggle('on', Number(y.dataset.r) <= rating); }); EVSA.sound.click(); }; });
    U.$('#rvGo', b).onclick = function () { try { db.review(oid, rating, U.$('#rvText', b).value); U.closeModal(); EVSA.sound.success(); U.toast('Спасибо за отзыв!', 'ok'); } catch (e) { U.$('#rvErr', b).textContent = e.userMessage || 'Ошибка'; } };
  }
  function applyModal(oid) {
    var b = U.modal('Применить товар', '<div class="stack"><p class="muted small" style="margin:0">Укажите игровой ID или ник — продавец применит товар к вашему аккаунту.</p><input class="input" id="apId" maxlength="64" placeholder="Например: 12345678"><button class="btn primary block" id="apGo">Отправить продавцу</button></div>');
    U.$('#apGo', b).onclick = function () { U.try(function () { db.applyItem(oid, U.$('#apId', b).value); U.closeModal(); U.toast('Запрос отправлен продавцу', 'ok'); }); };
  }
  function disputeModal(oid) {
    var b = U.modal('Открыть спор', '<div class="stack"><p class="muted small" style="margin:0">Деньги останутся в резерве, а поддержка изучит чат сделки и примет решение.</p><textarea class="input" id="dpText" maxlength="1000" placeholder="Опишите проблему"></textarea><button class="btn danger block" id="dpGo">Открыть спор</button></div>');
    U.$('#dpGo', b).onclick = function () { U.try(function () { db.dispute(oid, U.$('#dpText', b).value.trim()); U.closeModal(); U.toast('Спор открыт. Поддержка свяжется с вами.', 'ok'); }); };
  }
  function reportModal(pid) {
    var p = db.product(pid); if (!p) return;
    var reasons = ['Мошенничество', 'Товар не соответствует описанию', 'Запрещённый товар', 'Оскорбления', 'Другое'];
    var b = U.modal('Пожаловаться', '<div class="stack"><select class="select" id="rpR">' + reasons.map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select><textarea class="input" id="rpT" maxlength="1000" placeholder="Подробности (необязательно)"></textarea><button class="btn danger block" id="rpGo">Отправить жалобу</button></div>');
    U.$('#rpGo', b).onclick = function () { U.try(function () { db.sendSupport('Жалоба на продавца', 'Жалоба на товар «' + p.title + '» (продавец ' + db.user(p.sellerId).name + '): ' + U.$('#rpR', b).value + '. ' + U.$('#rpT', b).value); U.closeModal(); EVSA.sound.success(); U.toast('Жалоба отправлена в поддержку', 'ok', '#/support'); }); };
  }

  /* ---- пополнение: через Telegram-бота (ссылка t.me/<бот>?start=topup_<сумма>) ---- */
  function depositModal(need) {
    var T = EVSA.TOPUP;
    var start = need ? Math.min(T.MAX, Math.max(T.MIN, Math.ceil(need))) : 100;
    var b = U.modal('Пополнение баланса', '<div class="stack">' +
      '<label class="field">Сумма пополнения, ₽<input class="input" id="dSum" type="number" inputmode="numeric" min="' + T.MIN + '" max="' + T.MAX + '" step="1" value="' + start + '"></label>' +
      '<div class="amounts" style="grid-template-columns:repeat(4,1fr)">' + [100, 200, 500, 1000].map(function (x) { return '<button type="button" class="btn sm" data-s="' + x + '">' + x + ' ₽</button>'; }).join('') + '</div>' +
      '<div class="topup-quote"><span class="muted small">К оплате звёздами<br><span class="tiny">скидка ' + Math.round(T.DISCOUNT * 100) + '%</span></span><b id="dStars"></b></div>' +
      '<div class="err" id="dErr"></div>' +
      '<a class="btn primary block tg-pay" id="dGo" href="#" target="_blank" rel="noopener">' + I.tg + 'Пополнить через Telegram</a>' +
      '<div class="tiny muted">Откроется бот @' + esc(T.BOT) + ' — он покажет сумму в звёздах и кнопку оплаты. Оплата звёздами скоро появится, сейчас это демо.</div>' +
      '<button type="button" class="demo-link" id="dDemo">демо: добавить тестовые рубли</button></div>');
    var s = U.$('#dSum', b), go = U.$('#dGo', b), errBox = U.$('#dErr', b);
    function amount() { var v = Number(String(s.value).replace(',', '.')); return v; }
    function check() {
      var v = amount();
      if (!isFinite(v) || String(s.value).trim() === '') return 'Введите сумму в рублях';
      if (Math.floor(v) !== v) return 'Сумма — целое число рублей';
      if (v < T.MIN || v > T.MAX) return 'Сумма пополнения: от ' + T.MIN + ' до ' + T.MAX.toLocaleString('ru-RU') + ' ₽';
      return '';
    }
    function q() {
      var e = check();
      U.$('#dStars', b).textContent = e ? '—' : db.starsQuote(amount()).stars + ' ⭐';
      go.href = e ? '#' : EVSA.topupLink(amount());
      if (!e) errBox.textContent = '';
    }
    s.oninput = q; q();
    U.$$('[data-s]', b).forEach(function (x) { x.onclick = function () { s.value = x.dataset.s; q(); }; });
    go.onclick = function (ev) {
      try {
        var e = check();
        if (e) { ev.preventDefault(); errBox.textContent = e; EVSA.sound.error(); U.toast(e, 'bad'); return false; }
        var url = EVSA.topupLink(amount());
        var tg = window.Telegram && window.Telegram.WebApp;
        if (tg && tg.openTelegramLink && tg.initData) { ev.preventDefault(); tg.openTelegramLink(url); }
        U.toast('Открываем бота @' + T.BOT + '… Если не открылся — нажмите ещё раз', 'info');
      } catch (x) { ev.preventDefault(); U.err({ userMessage: 'Не удалось открыть Telegram: ' + (x && x.message || 'ошибка') }); }
      return true;
    };
    U.$('#dDemo', b).onclick = function () {
      var e = check(); if (e) { errBox.textContent = e; EVSA.sound.error(); U.toast(e, 'bad'); return; }
      U.try(function () { db.demoTopup(amount()); U.closeModal(); EVSA.sound.success(); U.toast('Зачислено ' + U.rub(amount()) + ' тестовых (демо, не настоящие деньги)', 'ok'); render(true); });
    };
  }
  function withdrawModal() {
    var me = db.me(), amounts = [15, 25, 50, 75, 100, 125, 150, 175, 200, 300, 500, 1000];
    var b = U.modal('Вывод средств', '<div class="stack"><div class="row between"><span class="muted">Доступно</span><b>' + U.rub(me.balance) + '</b></div><div class="amounts">' + amounts.map(function (x) { return '<button class="btn sm" data-w="' + x + '"' + (x > me.balance ? ' disabled' : '') + '>' + x + ' ₽</button>'; }).join('') + '</div>' +
      '<label class="field">Или своя сумма (от ' + EVSA.WITHDRAW_MIN + ' ₽)<input class="input" id="wSum" type="number" inputmode="numeric" min="' + EVSA.WITHDRAW_MIN + '"></label><div class="note small">Демо: заявка обрабатывается администратором вручную. Настоящие выплаты пока не производятся.</div><button class="btn primary block" id="wGo">Создать заявку</button></div>');
    U.$$('[data-w]', b).forEach(function (x) { x.onclick = function () { U.$('#wSum', b).value = x.dataset.w; }; });
    U.$('#wGo', b).onclick = function () { U.try(function () { db.withdraw(U.$('#wSum', b).value); U.closeModal(); EVSA.sound.success(); U.toast('Заявка на вывод создана', 'ok', '#/profile/requests'); render(true); }); };
  }

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
  db.init();
  render(false);
  setTimeout(function () { var s = document.getElementById('splash'); s.classList.add('done'); setTimeout(function () { s.remove(); }, 600); }, 650);
})();
