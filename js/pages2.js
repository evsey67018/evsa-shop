/* EVSA SHOP — профиль, продажа, чаты, поддержка, настройки */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc, P = EVSA.pages, I = EVSA.icons;
  var TXN = { deposit: 'Пополнение', purchase: 'Покупка', sale: 'Продажа', withdraw: 'Вывод', refund: 'Возврат', premium: 'Premium', admin: 'Корректировка' };
  var OST = { reserved: 'Деньги в резерве', delivered: 'Товар передан', completed: 'Завершена', dispute: 'Спор', refunded: 'Возврат' };
  var WST = { pending: 'Ожидает обработки', approved: 'Одобрена', done: 'Выполнена', rejected: 'Отклонена' };
  var DST = { awaiting_payment: 'Ожидает оплаты', demo_credited: 'Тестовое зачисление', pending: 'Ожидает проверки', confirmed: 'Подтверждено', rejected: 'Отклонено' };
  EVSA.labels = { OST: OST, WST: WST, DST: DST, TXN: TXN };

  /* ================= ПРОФИЛЬ ================= */
  var PL_ICO = {
    bell: '<svg viewBox="0 0 24 24"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20h4"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    ref: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M17 8v6M14 11h6"/></svg>',
    steam: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M8 11l4-4 4 4"/></svg>',
    admin: '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>'
  };
  P.profile = function (el, tab) {
    var me = db.me(); if (!me) return P.needLogin(el, 'Профиль');
    tab = tab || 'ops';
    var st = db.sellerStats(me.id), banned = db.isBanned(me);
    var tabs = [['ops', 'Операции'], ['buys', 'Покупки'], ['sells', 'Продажи'], ['items', 'Мои товары'], ['reviews', 'Отзывы'], ['requests', 'Заявки']];
    var body = '';
    if (tab === 'ops') { var t = db.txOf(me.id); body = t.length ? t.map(function (x) { return '<div class="list-row"><div class="grow"><b class="small">' + (TXN[x.type] || x.type) + '</b><div class="tiny muted">' + esc(x.note) + ' · ' + U.dt(x.createdAt) + '</div></div><span class="' + (x.amount > 0 ? 'plus' : 'minus') + '">' + (x.amount > 0 ? '+' : '') + U.rub(x.amount) + '</span></div>'; }).join('') : '<div class="muted small">Операций пока нет</div>'; }
    if (tab === 'buys' || tab === 'sells') {
      var os = db.ordersOf(me.id, tab === 'sells' ? 'sell' : 'buy');
      body = os.length ? os.map(function (o) { return '<div class="list-row" style="cursor:pointer" data-href="#/chat/' + o.chatId + '"><div class="grow"><b class="small">' + esc(o.title) + '</b><div class="tiny muted">' + U.dt(o.createdAt) + ' · ' + esc(db.user(tab === 'sells' ? o.buyerId : o.sellerId).name) + '</div></div><span class="status ' + o.status + '">' + OST[o.status] + '</span><b class="small">' + U.rub(o.price) + '</b></div>'; }).join('') : '<div class="muted small">Пока пусто</div>';
    }
    if (tab === 'items') { var ps = db.products({ sellerId: me.id, sort: 'new' }); body = ps.length ? '<div class="pgrid">' + ps.map(U.pcard).join('') + '</div>' : '<div class="muted small">У вас нет активных объявлений. <a href="#/sell" style="color:#a78bfa">Продать</a></div>'; }
    if (tab === 'reviews') { var rv = db.reviewsFor(me.id); body = rv.length ? rv.map(P.reviewHtml).join('') : '<div class="muted small">Отзывов пока нет</div>'; }
    if (tab === 'requests') {
      var ws = db.withdrawalsOf(me.id), ds = db.depositsOf(me.id);
      body = '<h3 style="margin:6px 0">Заявки на вывод</h3>' + (ws.length ? ws.map(function (w) { return '<div class="list-row"><div class="grow small">Вывод · ' + U.dt(w.createdAt) + '</div><span class="status ' + w.status + '">' + WST[w.status] + '</span><b class="small">' + U.rub(w.amount) + '</b></div>'; }).join('') : '<div class="muted small">Нет заявок</div>') +
        '<h3 style="margin:16px 0 6px">Пополнения</h3>' + (ds.length ? ds.map(function (d) { return '<div class="list-row"><div class="grow small">' + (d.method === 'gift' ? 'Подарок' : d.method === 'demo' ? 'Тестовое пополнение (демо)' : 'Telegram Stars (' + d.stars + ' ⭐)') + ' · ' + U.dt(d.createdAt) + '</div><span class="status ' + (d.status === 'confirmed' || d.status === 'demo_credited' ? 'done' : d.status === 'rejected' ? 'rejected' : 'pending') + '">' + DST[d.status] + '</span><b class="small">' + U.rub(d.rub) + '</b></div>'; }).join('') : '<div class="muted small">Нет пополнений</div>');
    }
    el.innerHTML = '<div class="page" style="max-width:860px"><div class="card">' + (banned ? '<div class="note bad" style="margin-bottom:14px">Аккаунт заблокирован' + (me.ban.perm ? ' навсегда' : ' до ' + U.dt(me.ban.until)) + '. Причина: ' + esc(me.ban.reason) + '. Покупки, продажи и чаты недоступны. Вы можете написать в поддержку.</div>' : '') +
      '<div class="prof-top"><label style="cursor:pointer;position:relative" title="Обновить аватарку">' + U.avatar(me, 'xl') + '<input type="file" accept="image/jpeg,image/png,image/webp" id="avaFile" hidden></label><div class="grow"><h1>' + esc(me.name) + '</h1>' +
      '<div class="muted">' + (me.username ? '@' + esc(me.username) : 'username не указан') + '</div><div class="tiny muted">Telegram ID: ' + me.tgId + ' <span class="status" style="font-size:10px;padding:2px 6px">демо</span></div>' +
      '<div style="margin-top:6px">' + U.stars(st.rating) + ' · ' + st.count + ' отзывов</div></div></div>' +
      '<div class="balance-box"><div><div class="muted small">Баланс</div><b>' + U.rub(me.balance) + '</b>' + (me.reserved ? '<div class="tiny muted">в резерве: ' + U.rub(me.reserved) + '</div>' : '') + '</div><button class="plus-btn" data-act="deposit" aria-label="Пополнить">' + I.plus + '</button></div>' +
      '<div class="prof-actions"><button class="btn primary" data-act="deposit">Пополнить</button><button class="btn" data-act="withdraw">Вывести</button><button class="btn cyan" data-href="#/sell">Продать</button></div>' +
      '<div class="prof-links">' + [['#/notifications', 'Уведомления', 'bell', db.unreadNotifs()], ['#/favorites', 'Избранное', 'heart', 0], ['#/cart', 'Корзина', 'cart', db.cart().length], ['#/referral', 'Рефералы', 'ref', 0], ['#/steam', 'Пополнение Steam', 'steam', 0]].concat(EVSA.settings.get().adminDemo ? [['#/admin', 'Админ-панель', 'admin', 0]] : []).map(function (x) { return '<a class="prof-link" href="' + x[0] + '">' + (PL_ICO[x[2]] || '') + '<span>' + x[1] + '</span>' + (x[3] ? '<em class="nav-badge on">' + (x[3] > 99 ? '99+' : x[3]) + '</em>' : '') + '</a>'; }).join('') + '</div>' +
      '<div class="tabs">' + tabs.map(function (x) { return '<button class="tab' + (x[0] === tab ? ' active' : '') + '" data-href="#/profile/' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div>' + body + '</div>' +
      '<div class="row wrap" style="margin-top:20px;border-top:1px solid var(--line);padding-top:14px"><button class="btn sm" data-act="login">Синхронизировать с Telegram</button><button class="btn sm" data-act="switchAcc">Сменить аккаунт (демо)</button><button class="btn sm danger" data-act="logout">Выйти</button></div></div></div>';
    var f = U.$('#avaFile', el);
    f.onchange = function () { U.readImage(f.files[0], 256, function (e, url) { if (e) return U.err(e); db.updateAvatar(url); U.toast('Аватарка обновлена', 'ok'); EVSA.sound.success(); }); };
  };

  /* ================= ПРОДАЖА (мастер) ================= */
  var S = null;
  P.sell = function (el, q) {
    var me = db.me(); if (!me) return P.needLogin(el, 'Продажа товаров');
    if (db.isBanned(me)) { el.innerHTML = '<div class="page"><div class="note bad">Заблокированные пользователи не могут продавать.</div></div>'; return; }
    if (!S || (q && q.t)) S = { step: q && q.t ? (q.c ? 3 : 2) : 1, type: (q && q.t) || 'game', targetId: (q && q.id) || '', category: (q && q.c) || '', title: '', desc: '', buyerMsg: '', oldPrice: '', salePrice: '', image: '', filter: '' };
    draw();
    function draw() {
      var steps = '<div class="steps">' + [1, 2, 3].map(function (i) { return '<i class="' + (S.step >= i ? 'on' : '') + '"></i>'; }).join('') + '</div>';
      var html = '<div class="page"><h1 style="margin-bottom:6px">Новое объявление</h1><div class="muted small" style="margin-bottom:16px">Шаг ' + Math.min(S.step, 3) + ' из 3</div>' + steps;
      if (S.step === 1) {
        var list = (S.type === 'site' ? EVSA.SITES : EVSA.GAMES).filter(function (t) { return t.name.toLowerCase().indexOf(S.filter.toLowerCase()) >= 0; });
        html += '<div class="card"><h2 style="margin-bottom:12px">Шаг 1. Выберите игру или сайт</h2><div class="row wrap" style="margin-bottom:12px"><div class="seg" style="margin-left:0"><button data-type="game" class="' + (S.type === 'game' ? 'active' : '') + '">Игры</button><button data-type="site" class="' + (S.type === 'site' ? 'active' : '') + '">Сайты</button></div><input class="input grow" id="tFilter" placeholder="Найти…" value="' + esc(S.filter) + '"></div>' +
          '<div class="pick-grid">' + list.map(function (t) { return '<div class="pick' + (S.targetId === t.id ? ' active' : '') + '" data-pick="' + t.id + '">' + U.cover(t) + '<div class="n">' + esc(t.name) + '</div></div>'; }).join('') + '</div></div>';
      } else if (S.step === 2) {
        var t = EVSA.findTarget(S.type, S.targetId);
        html += '<div class="card"><h2 style="margin-bottom:4px">Шаг 2. Категория</h2><div class="muted small" style="margin-bottom:14px">' + esc(t.name) + '</div><div class="cat-grid">' + EVSA.CATEGORIES.map(function (c) {
          return '<div class="cat-card' + (S.category === c.id ? ' pick active' : '') + '" data-cat="' + c.id + '"><div class="ci">' + c.icon + '</div><b>' + c.name + '</b><span>' + c.desc + '</span></div>'; }).join('') + '</div><button class="btn" data-step="1">' + I.back + 'Назад</button></div>';
      } else {
        var tt = EVSA.findTarget(S.type, S.targetId);
        html += '<div class="sell-layout"><div class="card stack"><div class="muted small">' + esc(tt.name) + ' · ' + EVSA.catName(S.category) + ' <a href="javascript:void 0" data-step="2" style="color:#a78bfa">изменить</a></div>' +
          '<label class="field">Шаг 3. Название товара *<input class="input" id="fTitle" maxlength="80" value="' + esc(S.title) + '" placeholder="Например: Аккаунт с редкими скинами"></label>' +
          '<label class="field">Шаг 4. Описание товара *<textarea class="input" id="fDesc" maxlength="2000" placeholder="Подробно опишите товар, что получит покупатель">' + esc(S.desc) + '</textarea></label>' +
          '<label class="field">Шаг 5. Сообщение покупателю после покупки (необязательно)<textarea class="input" id="fMsg" maxlength="1000" style="min-height:70px" placeholder="Например: Спасибо! Напишите свой ID в чат">' + esc(S.buyerMsg) + '</textarea></label>' +
          '<label class="field">Способ получения<select class="select" id="fDel">' + EVSA.DELIVERY.map(function (d) { return '<option' + ((S.delivery || EVSA.DELIVERY_BY_CAT[S.category]) === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
          '<div class="row" style="align-items:flex-start"><label class="field grow">Шаг 6. Цена без скидки, ₽ *<input class="input" id="fOld" type="number" inputmode="decimal" min="10" value="' + esc(S.oldPrice) + '" placeholder="900"></label><label class="field grow">Шаг 7. Цена со скидкой, ₽<input class="input" id="fSale" type="number" inputmode="decimal" min="1" value="' + esc(S.salePrice) + '" placeholder="необязательно"></label></div>' +
          '<div class="small" id="discInfo"></div>' +
          '<div class="field" style="font-size:13px;color:var(--muted);font-weight:600">Шаг 8. Фотография товара *<label class="upload" id="upl">' + (S.image ? '<img src="' + S.image + '" alt="">' : '<div style="font-size:30px">＋</div>Нажмите, чтобы загрузить фото<br><span class="tiny">JPG, PNG, WEBP · до 8 МБ</span>') + '<input type="file" id="fImg" accept="image/jpeg,image/png,image/webp" hidden></label></div>' +
          '<div class="err" id="fErr"></div><button class="btn primary block" id="publish">Выставить</button></div>' +
          '<div class="preview-sticky"><div class="muted small" style="margin-bottom:8px">Предпросмотр</div><div id="pv"></div></div></div>';
      }
      el.innerHTML = html + '</div>';
      bind();
    }
    function draft() { return { id: 'preview', sellerId: me.id, targetType: S.type, targetId: S.targetId, category: S.category, title: S.title || 'Название товара', price: Number(S.salePrice) || Number(S.oldPrice) || 0, oldPrice: Number(S.salePrice) && Number(S.salePrice) < Number(S.oldPrice) ? Number(S.oldPrice) : 0, image: S.image || null, premium: false }; }
    function preview() {
      var pv = U.$('#pv', el); if (!pv) return;
      pv.innerHTML = U.pcard(draft(), 0);
      var o = Number(S.oldPrice), s = Number(S.salePrice), info = U.$('#discInfo', el);
      if (S.salePrice !== '' && o && s) { info.innerHTML = s < o ? 'Скидка: <b style="color:#4ade80">' + U.discount(o, s) + '%</b> = (' + o + ' − ' + s + ') / ' + o + ' × 100' : '<span style="color:#f87171">Цена со скидкой должна быть меньше обычной</span>'; }
      else info.innerHTML = '';
    }
    function bind() {
      U.$$('[data-type]', el).forEach(function (b) { b.onclick = function () { S.type = b.dataset.type; S.targetId = ''; draw(); }; });
      var tf = U.$('#tFilter', el); if (tf) tf.oninput = function () { S.filter = tf.value; var pos = tf.selectionStart; draw(); var n = U.$('#tFilter', el); n.focus(); n.setSelectionRange(pos, pos); };
      U.$$('[data-pick]', el).forEach(function (b) { b.onclick = function () { S.targetId = b.dataset.pick; S.step = 2; draw(); }; });
      U.$$('[data-cat]', el).forEach(function (b) { b.onclick = function () { S.category = b.dataset.cat; S.step = 3; draw(); }; });
      U.$$('[data-step]', el).forEach(function (b) { b.onclick = function () { S.step = Number(b.dataset.step); draw(); }; });
      var map = { fTitle: 'title', fDesc: 'desc', fMsg: 'buyerMsg', fOld: 'oldPrice', fSale: 'salePrice' };
      var fd = U.$('#fDel', el); if (fd) fd.onchange = function () { S.delivery = fd.value; };
      Object.keys(map).forEach(function (k) { var i = U.$('#' + k, el); if (i) i.oninput = function () { S[map[k]] = i.value; preview(); }; });
      var fi = U.$('#fImg', el);
      if (fi) fi.onchange = function () { U.readImage(fi.files[0], 900, function (e, url) { if (e) return U.err(e); S.image = url; U.$('#upl', el).firstChild && (U.$('#upl', el).innerHTML = '<img src="' + url + '" alt=""><input type="file" id="fImg" accept="image/jpeg,image/png,image/webp" hidden>'); bind(); preview(); }); };
      var pb = U.$('#publish', el); if (pb) pb.onclick = function () {
        var errBox = U.$('#fErr', el);
        var data = { targetType: S.type, targetId: S.targetId, category: S.category, title: S.title, desc: S.desc, buyerMsg: S.buyerMsg, oldPrice: S.oldPrice, salePrice: S.salePrice, image: S.image, delivery: S.delivery || EVSA.DELIVERY_BY_CAT[S.category] };
        var e = validate(data); if (e) { errBox.textContent = e; EVSA.sound.error(); return; } errBox.textContent = '';
        publishModal(data);
      };
      preview();
    }
    function validate(d) {
      if (String(d.title).trim().length < 4) return 'Название: минимум 4 символа';
      if (String(d.desc).trim().length < 10) return 'Описание: минимум 10 символов';
      var o = Number(d.oldPrice); if (!o || o < 10) return 'Укажите цену без скидки (от 10 ₽)';
      if (d.salePrice !== '' && !(Number(d.salePrice) >= 1 && Number(d.salePrice) < o)) return 'Цена со скидкой должна быть от 1 ₽ и меньше обычной';
      if (!d.image) return 'Загрузите фотографию товара — это обязательно';
      return '';
    }
    function publishModal(data) {
      var st = db.sellerStats(me.id), choice = 'free';
      var base = draft();
      var body = U.modal('Как разместить?', '<div class="stack"><div class="plan gold" data-plan="premium"><div class="row between"><b>★ Premium</b><b>' + EVSA.PREMIUM_PRICE + ' ₽</b></div><div class="small muted" style="margin:6px 0 10px">Выше обычных объявлений · первым в категории · особое оформление · отметка Premium</div>' + U.pcard(Object.assign({}, base, { premium: true }), 0) + '</div>' +
        '<div class="plan active" data-plan="free"><div class="row between"><b>Обычное размещение</b><b>Бесплатно</b></div><div class="small muted" style="margin:6px 0 10px">В общей очереди вместе с остальными товарами</div>' + U.pcard(base, 0) + '</div>' +
        '<div class="small muted">Рейтинг продавца: ' + U.stars(st.rating, st.count) + ' · Ваш баланс: ' + U.rub(me.balance) + '</div><button class="btn primary block" id="confirmPub">Подтвердить размещение</button></div>', { wide: true });
      U.$$('.pcard', body).forEach(function (c) { c.style.opacity = 1; c.style.animation = 'none'; c.style.cursor = 'default'; c.removeAttribute('data-href'); });
      U.$$('[data-plan]', body).forEach(function (p) { p.onclick = function () { choice = p.dataset.plan; U.$$('[data-plan]', body).forEach(function (x) { x.classList.toggle('active', x === p); }); U.$('#confirmPub', body).textContent = choice === 'premium' ? 'Оплатить ' + EVSA.PREMIUM_PRICE + ' ₽ с баланса и выставить' : 'Подтвердить размещение'; }; });
      U.$('#confirmPub', body).onclick = function () {
        U.try(function () { var p = db.createProduct(data, choice === 'premium'); S = null; U.closeModal(); EVSA.sound.success(); U.toast(choice === 'premium' ? 'Товар выставлен с Premium!' : 'Товар выставлен!', 'ok'); location.hash = '#/p/' + p.id; });
      };
    }
  };

  /* ================= СООБЩЕНИЯ ================= */
  function chatListHtml(activeId) {
    var me = db.me(); var chats = db.chatsOf(me.id);
    var tk = db.ticketsOf(me.id), unreadS = tk.reduce(function (s, t) { return s + (t.unreadUser || 0); }, 0);
    var lastS = tk.reduce(function (m, t) { var l = t.messages[t.messages.length - 1]; return l && (!m || l.at > m.at) ? l : m; }, null);
    var html = '<div class="chat-item' + (activeId === 'support' ? ' active' : '') + '" data-href="#/support"><span class="ava" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div class="grow"><b>Поддержка</b> ' + U.verified + '<div class="last">' + (lastS ? esc(lastS.text) : 'Официальная поддержка EVSA SHOP') + '</div></div>' + (unreadS ? '<span class="unread">' + unreadS + '</span>' : '') + '</div>';
    chats.forEach(function (c) {
      var o = db.user(c.a === me.id ? c.b : c.a), p = db.product(c.productId), ms = db.messages(c.id), last = ms[ms.length - 1], un = c.unread[me.id] || 0;
      html += '<div class="chat-item' + (activeId === c.id ? ' active' : '') + '" data-href="#/chat/' + c.id + '">' + U.avatar(o) + '<div class="grow" style="min-width:0"><div class="row between"><b class="small">' + esc(o.name) + '</b><span class="tiny muted">' + (last ? U.time(last.createdAt) : '') + '</span></div><div class="last">' + esc(p ? p.title : '') + (last ? ' · ' + esc(last.text) : '') + '</div></div>' + (un ? '<span class="unread">' + un + '</span>' : '') + '</div>';
    });
    if (!chats.length) html += '<div class="muted small" style="padding:14px">Чатов с продавцами пока нет. Откройте товар и нажмите «Написать продавцу».</div>';
    return html;
  }
  P.chats = function (el) {
    if (!db.me()) return P.needLogin(el, 'Сообщения');
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:14px">Сообщения</h1><div class="chat-layout"><div class="chat-list">' + chatListHtml() + '</div><div class="chat-win" style="align-items:center;justify-content:center"><div class="muted">Выберите чат</div></div></div></div>';
  };

  P.chat = function (el, id, live) {
    var me = db.me(); if (!me) return P.needLogin(el, 'Сообщения');
    var c = db.chat(id); if (!c) { el.innerHTML = '<div class="page">' + U.empty('Чат не найден', 'Или у вас нет к нему доступа') + '</div>'; return; }
    db.markRead(id);
    var other = db.user(c.a === me.id ? c.b : c.a), p = db.product(c.productId), o = c.orderId ? db.order(c.orderId) : null;
    var isBuyer = o && o.buyerId === me.id, isSeller = o && o.sellerId === me.id;
    var msgs = db.messages(id).map(function (m) {
      if (m.system) return '<div class="msg sys"><div><div class="bubble">' + esc(m.text) + '</div><div class="time" style="text-align:center">' + U.dt(m.createdAt) + '</div></div></div>';
      var mine = m.from === me.id, u = db.user(m.from);
      return '<div class="msg ' + (mine ? 'me' : 'them') + '">' + (mine ? '' : '<span data-href="#/u/' + u.id + '" style="cursor:pointer">' + U.avatar(u, 's') + '</span>') + '<div><div class="bubble">' + esc(m.text) + '</div><div class="time"' + (mine ? ' style="text-align:right"' : '') + '>' + U.time(m.createdAt) + '</div></div></div>';
    }).join('');
    var deal = p ? '<div class="chat-deal"><img src="' + esc(U.pimg(p)) + '" alt="" data-href="#/p/' + p.id + '" style="cursor:pointer"><div class="grow" style="min-width:0"><b class="small" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(p.title) + '</b><span class="tiny muted">' + U.rub(o ? o.price : p.price) + (o ? ' · сделка #' + o.id.slice(-6) : ' · до покупки') + '</span></div>' + (o ? '<span class="status ' + o.status + '">' + OST[o.status] + '</span>' : (p.status === 'active' && p.sellerId !== me.id ? '<button class="btn sm primary" data-act="buy" data-id="' + p.id + '">Купить</button>' : '')) + '</div>' : '';
    var acts = '';
    if (o && isBuyer && (o.status === 'reserved' || o.status === 'delivered')) acts = '<div class="deal-actions"><button class="btn ok sm" data-act="confirm" data-id="' + o.id + '">Подтвердить получение</button><button class="btn sm cyan" data-act="apply" data-id="' + o.id + '">Применить</button><button class="btn sm danger" data-act="dispute" data-id="' + o.id + '">Открыть спор</button></div>';
    if (o && isSeller && o.status === 'reserved') acts = '<div class="deal-actions"><button class="btn sm cyan" data-act="delivered" data-id="' + o.id + '">Отметить «Товар передан»</button><button class="btn sm danger" data-act="dispute" data-id="' + o.id + '">Открыть спор</button></div>';
    if (o && isBuyer && o.status === 'completed' && !o.reviewed) acts = '<div class="deal-actions"><button class="btn sm primary" data-act="review" data-id="' + o.id + '">★ Оставить отзыв продавцу</button></div>';
    var win = '<div class="chat-head"><button class="icon-btn mobile-back" data-href="#/chats" aria-label="Назад" style="width:36px;height:36px">' + I.back + '</button><span data-href="#/u/' + other.id + '" style="cursor:pointer" class="row">' + U.avatar(other) + '<span><b>' + esc(other.name) + '</b><div class="tiny muted">' + (other.username ? '@' + esc(other.username) : 'профиль') + '</div></span></span></div>' + deal +
      '<div class="msgs" id="msgs">' + msgs + '</div>' + acts;
    if (live && U.$('#chatWin', el)) {
      U.$('#chatInner', el).innerHTML = win; U.$('.chat-list', el).innerHTML = chatListHtml(id);
    } else {
      el.innerHTML = '<div class="page"><div class="chat-layout has-chat"><div class="chat-list">' + chatListHtml(id) + '</div><div class="chat-win" id="chatWin"><div id="chatInner" style="display:flex;flex-direction:column;flex:1;min-height:0">' + win + '</div>' +
        '<form class="composer" id="composer"><input class="input" id="msgInput" placeholder="Сообщение…" autocomplete="off" maxlength="2000"><button class="btn primary" aria-label="Отправить">' + I.send + '</button></form></div></div></div>';
      U.$('#composer', el).onsubmit = function (e) { e.preventDefault(); var i = U.$('#msgInput', el); var v = i.value; if (!v.trim()) return; U.try(function () { db.sendMessage(id, v); i.value = ''; EVSA.sound.click(); }); i.focus(); };
    }
    var box = U.$('#msgs', el); box.scrollTop = box.scrollHeight;
  };

  /* ================= ПОДДЕРЖКА ================= */
  var GKEY = 'evsa_guest_support';
  function guestHist() { try { var a = JSON.parse(localStorage.getItem(GKEY) || '[]'); return a && a.length !== undefined ? a : []; } catch (e) { return []; } }
  function guestPush(x) { try { var a = guestHist(); a.push(x); localStorage.setItem(GKEY, JSON.stringify(a.slice(-50))); } catch (e) {} }
  function supportMsgs(me) {
    var sys = '<div class="msg sys"><div class="bubble">Здравствуйте! Это официальная поддержка EVSA SHOP. Выберите категорию и опишите проблему' + (me ? ' — мы ответим здесь.' : '. Войти не обязательно: оставьте контакт (Telegram или e-mail), чтобы мы могли ответить.') + '</div></div>';
    if (!me) return sys + guestHist().map(function (g) {
      return '<div class="msg me"><div><div class="tiny muted" style="text-align:right;margin-bottom:3px">Гость · <span class="status open" style="font-size:10px;padding:1px 6px">' + esc(g.cat) + '</span> · № ' + esc(g.ticketId) + '</div><div class="bubble">' + esc(g.text) + '</div><div class="time" style="text-align:right">' + U.date(g.at) + ' · ' + U.time(g.at) + ' · отправлено ✓</div></div></div>';
    }).join('');
    var all = []; db.ticketsOf(me.id).forEach(function (t) { t.messages.forEach(function (m) { all.push({ t: t, m: m }); }); });
    all.sort(function (a, b) { return a.m.at - b.m.at; });
    return sys + all.map(function (x) {
      if (x.m.from === 'support') return '<div class="msg them support"><span class="ava s" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div><div class="tiny" style="margin-bottom:3px"><b>Поддержка</b> ' + U.verified + '</div><div class="bubble">' + esc(x.m.text) + '</div><div class="time">' + U.dt(x.m.at) + '</div></div></div>';
      return '<div class="msg me"><div><div class="tiny muted" style="text-align:right;margin-bottom:3px">' + esc(me.name) + ' · ID ' + me.tgId + ' · <span class="status open" style="font-size:10px;padding:1px 6px">' + esc(x.t.category) + '</span></div><div class="bubble">' + esc(x.m.text) + '</div><div class="time" style="text-align:right">' + U.date(x.m.at) + ' · ' + U.time(x.m.at) + '</div></div></div>';
    }).join('');
  }
  P.support = function (el, live) {
    var me = db.me();
    if (me) db.markSupportRead();
    var head = '<div class="chat-head"><button type="button" class="icon-btn mobile-back" data-href="' + (me ? '#/chats' : '#/') + '" aria-label="Назад" style="width:36px;height:36px">' + I.back + '</button><span class="ava" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div><b>Поддержка</b> ' + U.verified + '<div class="tiny muted">Официальная поддержка EVSA SHOP</div></div></div>';
    var inner = head + '<div class="msgs" id="msgs">' + supportMsgs(me) + '</div>';
    if (live && U.$('#supInner', el)) {
      U.$('#supInner', el).innerHTML = inner;
      var cl = U.$('.chat-list', el); if (cl && me) cl.innerHTML = chatListHtml('support');
    } else {
      var form = '<form class="composer" id="supForm" style="flex-wrap:wrap" novalidate><select class="select" id="supCat" style="flex:1 1 100%">' + EVSA.TICKET_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
        (me ? '' : '<input class="input" id="supContact" style="flex:1 1 100%" maxlength="80" autocomplete="off" placeholder="Ваш Telegram @username или e-mail (необязательно)">') +
        '<input class="input" id="supText" placeholder="Опишите проблему…" maxlength="' + EVSA.remoteSupport.MAX_TEXT + '" autocomplete="off"><button type="button" class="btn primary" id="supBtn" aria-label="Отправить">' + I.send + '</button>' +
        '<div class="sup-status" id="supStatus" role="status" aria-live="polite"></div>' +
        '<div class="tiny muted" style="flex:1 1 100%">' + (me ? '' : 'Можно писать без входа. ') + 'Сообщения отправляются команде EVSA SHOP. Не пишите пароли и коды из SMS.</div></form>';
      el.innerHTML = '<div class="page"><div class="chat-layout has-chat' + (me ? '' : ' guest-support') + '">' + (me ? '<div class="chat-list">' + chatListHtml('support') + '</div>' : '') + '<div class="chat-win"><div id="supInner" style="display:flex;flex-direction:column;flex:1;min-height:0">' + inner + '</div>' + form + '</div></div></div>';
      var sending = false;
      function status(text, type) {
        var s = U.$('#supStatus', el); if (s) { s.className = 'sup-status ' + (type || 'info'); s.textContent = text; }
        if (type !== 'info') U.toast(text, type);
      }
      function onSend(e) {
        if (e && e.preventDefault) e.preventDefault();
        try {
          if (sending) { status('Отправляем… подождите', 'info'); return false; }
          var i = U.$('#supText', el), btn = U.$('#supBtn', el), cat = U.$('#supCat', el).value, text = String(i.value || '').replace(/^\s+|\s+$/g, '');
          var ce = U.$('#supContact', el), contact = ce ? String(ce.value || '').replace(/^\s+|\s+$/g, '') : '';
          var cur = db.me();
          if (text.length < 2) { status('Напишите сообщение (минимум 2 символа)', 'bad'); EVSA.sound.error(); i.focus(); return false; }
          var left = EVSA.remoteSupport.cooldownLeft();
          if (left > 0) { status('Подождите ' + Math.ceil(left / 1000) + ' с перед следующим обращением', 'bad'); EVSA.sound.error(); return false; }
          sending = true; btn.disabled = true; status('Отправляем обращение…', 'info');
          EVSA.remoteSupport.send({ category: cat, text: text, guest: !cur, contact: contact, name: cur ? cur.name : 'Гость', username: cur && cur.username ? '@' + cur.username : '' }, function (err, t) {
            sending = false; btn.disabled = false;
            try {
              if (err) { status((err && err.userMessage) || 'Не удалось отправить обращение. Попробуйте позже.', 'bad'); EVSA.sound.error(); return; }
              i.value = ''; try { i.blur(); } catch (x) {}
              if (cur) { try { db.sendSupport(cat, text); } catch (x) {} } else { guestPush({ cat: cat, text: text, at: Date.now(), ticketId: t.ticketId }); P.support(el, true); }
              var box2 = U.$('#msgs', el); if (box2) box2.scrollTop = box2.scrollHeight;
              status('✓ Обращение отправлено в поддержку (№ ' + t.ticketId + ')' + (!cur && !contact ? '. Оставьте контакт, если нужен ответ.' : ''), 'ok'); EVSA.sound.success();
            } catch (x) { status('Обращение отправлено, но страница не обновилась. Обновите её.', 'ok'); }
          });
        } catch (ex) {
          sending = false; var b2 = U.$('#supBtn', el); if (b2) b2.disabled = false;
          if (window.console) console.error(ex);
          status('Ошибка при отправке: ' + (ex && (ex.userMessage || ex.message) || 'неизвестная ошибка') + '. Попробуйте ещё раз.', 'bad');
        }
        return false;
      }
      U.$('#supForm', el).onsubmit = onSend;
      U.$('#supBtn', el).onclick = onSend;
    }
    var box = U.$('#msgs', el); box.scrollTop = box.scrollHeight;
  };

  /* ================= НАСТРОЙКИ ================= */
  P.settings = function (el) {
    var s = EVSA.settings.get(), me = db.me();
    function sw(key, title, sub) { return '<div class="set-row"><div class="grow"><b>' + title + '</b><div class="small muted">' + sub + '</div></div><label class="switch"><input type="checkbox" data-set="' + key + '"' + (s[key] ? ' checked' : '') + '><span></span></label></div>'; }
    el.innerHTML = '<div class="page" style="max-width:760px"><h1 style="margin-bottom:16px">Настройки</h1><div class="card">' +
      sw('sound', 'Звуковые эффекты', 'Тихие звуки нажатий, успешных действий и новых сообщений') +
      sw('notify', 'Уведомления', 'Всплывающие уведомления о сообщениях, покупках и продажах') +
      sw('dnd', 'Режим «Не беспокоить»', 'Уведомления не показываются, но сообщения сохраняются') +
      '<div class="set-row"><div class="grow"><b>Тема</b><div class="small muted">Сохраняется после перезагрузки</div></div><div class="seg"><button data-theme-set="dark" class="' + (s.theme === 'dark' ? 'active' : '') + '">Тёмная</button><button data-theme-set="light" class="' + (s.theme === 'light' ? 'active' : '') + '">Светлая</button></div></div></div>' +
      '<h2 style="margin:22px 0 12px">Аккаунт</h2><div class="card">' + (me ? '<div class="row">' + U.avatar(me, 'l') + '<div class="grow"><b>' + esc(me.name) + '</b><div class="small muted">' + (me.username ? '@' + esc(me.username) : '') + ' · Telegram ID ' + me.tgId + '</div><div class="tiny muted">Аккаунт создан ' + U.date(me.createdAt) + (me.lastSync ? ' · синхронизирован ' + U.ago(me.lastSync) : '') + '</div></div></div><div class="row wrap" style="margin-top:14px"><button class="btn sm" data-href="#/profile">Открыть профиль</button><button class="btn sm danger" data-act="logout">Выйти</button></div>' : '<div class="row between"><span class="muted">Вы не вошли</span><button class="btn primary sm" data-act="login">Войти через Telegram</button></div>') + '</div>' +
      '<h2 style="margin:22px 0 12px">Демо-режим</h2><div class="card">' + sw('adminDemo', 'Демо-доступ к админ-панели', 'Только для тестирования. В рабочей версии админ-панель доступна лишь администратору (проверка Telegram ID на сервере).') +
      (s.adminDemo ? '<div class="set-row"><div class="grow"><b>Админ-панель</b><div class="small muted">Управление товарами, пользователями и заявками (демо)</div></div><a class="btn sm" href="#/admin">Открыть</a></div>' : '') +
      '<div class="set-row"><div class="grow"><b>Сбросить демо-данные</b><div class="small muted">Удалит аккаунты, товары, чаты и балансы в этом браузере</div></div><button class="btn sm danger" data-act="resetDemo">Сбросить</button></div></div>' +
      '<div class="note small" style="margin-top:18px">EVSA SHOP — демо-версия. Настоящие платежи, вывод денег и вход через Telegram заработают после подключения сервера (папка <code>server</code> в репозитории).</div></div>';
    U.$$('[data-set]', el).forEach(function (i) { i.onchange = function () { var p = {}; p[i.dataset.set] = i.checked; EVSA.settings.set(p); EVSA.app.applySettings(); if (i.checked) EVSA.sound.success(); if (i.dataset.set === 'adminDemo') { P.settings(el); return; } if (i.dataset.set === 'dnd' && !i.checked) { var n = db.unreadNotifs(); if (n) U.toast('Пропущено уведомлений: ' + n, 'info', '#/notifications'); } }; });
    U.$$('[data-theme-set]', el).forEach(function (b) { b.onclick = function (e) { EVSA.app.setTheme(b.dataset.themeSet, e); U.$$('[data-theme-set]', el).forEach(function (x) { x.classList.toggle('active', x === b); }); }; });
  };
})();
