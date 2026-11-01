/* EVSA SHOP — профиль, продажа, чаты, поддержка, настройки */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc, P = EVSA.pages, I = EVSA.icons;
  var OST = { requested: 'Запрос', paid: 'Оплачен', completed: 'Завершена', cancelled: 'Отменена' };
  var WST = { pending: 'В ожидании', completed: 'Завершён', rejected: 'Отклонён' };
  var WD_ICO = '<svg viewBox="0 0 24 24"><path d="M12 19V6M6 11l6-6 6 6M5 21h14"/></svg>';
  EVSA.labels = { OST: OST, WST: WST };

  /* ================= ПРОФИЛЬ ================= */
  var PL_ICO = {
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>'
  };
  P.profile = function (el, tab) {
    var me = db.me();
    if (!me) return P.needLogin(el, 'Профиль');
    var pw = db.pendingWithdrawal();
    var tabs = [['items', 'Мои товары'], ['reviews', 'Отзывы'], ['buys', 'Покупки'], ['sells', 'Продажи'], ['topups', 'Пополнения'], ['withdrawals', 'История выводов']];
    if (!tabs.some(function (x) { return x[0] === tab; })) tab = 'items';
    var st = db.sellerStats(me.id), banned = db.isBanned(me);
    var body = '';
    if (tab === 'buys' || tab === 'sells') {
      var os = db.ordersOf(me.id, tab === 'sells' ? 'sell' : 'buy');
      body = os.length ? '<div class="card">' + os.map(function (o) { return '<div class="list-row" style="cursor:pointer" data-href="#/chat/' + o.chatId + '"><div class="grow"><b class="small">' + esc(o.title) + '</b><div class="tiny muted">#' + esc(o.id.slice(-6)) + ' · ' + U.dt(o.createdAt) + ' · ' + esc(db.user(tab === 'sells' ? o.buyerId : o.sellerId).name) + '</div></div><span class="status ' + o.status + '">' + (OST[o.status] || o.status) + '</span><b class="small nowrap">' + U.rub(o.price) + '</b>' +
        (tab === 'buys' && o.status === 'paid' ? '<button class="btn sm primary" data-act="confirmOrder" data-id="' + o.id + '">Товар получен</button>' : '') +
        (tab === 'buys' && o.status === 'completed' && !o.reviewed ? '<button class="btn sm primary" data-act="review" data-id="' + o.id + '">★ Отзыв</button>' : '') + '</div>'; }).join('') + '</div>' +
        '<div class="tiny muted" style="margin-top:8px">' + (tab === 'buys' ? 'Товар передаёт продавец в чате сделки (нажмите на заказ). ' : 'Передайте товар покупателю в чате сделки (нажмите на заказ). ') + 'Проблема с заказом — <a href="#/support">напишите в поддержку</a> и укажите номер.</div>' :
        U.empty(tab === 'buys' ? 'Покупок пока нет' : 'Продаж пока нет', tab === 'buys' ? 'Купленные с баланса товары появятся здесь' : 'Здесь появятся заказы на ваши товары');
    }
    if (tab === 'items') { var ps = db.products({ sellerId: me.id, sort: 'new' }); body = ps.length ? '<div class="pgrid">' + ps.map(U.pcard).join('') + '</div>' : P.emptySell('#/sell', 'У вас нет активных объявлений. Выставить товар можно бесплатно'); }
    if (tab === 'topups') {
      var tp = db.topups();
      body = tp.length ? '<div class="card">' + tp.map(function (t) { return '<div class="list-row"><div class="grow"><b class="small">Пополнение звёздами</b><div class="tiny muted">' + U.dt(t.paidAt || t.createdAt) + ' · ' + t.stars + ' ⭐</div></div><span class="status completed">Зачислено</span><b class="small nowrap">+' + U.rub(t.rub) + '</b></div>'; }).join('') + '</div>' :
        U.empty('Пополнений пока нет', 'Пополните баланс звёздами Telegram — кнопка «Пополнить» выше');
    }
    if (tab === 'withdrawals') {
      var wl = db.withdrawals();
      body = wl.length ? '<div class="card">' + wl.map(function (w) { return '<div class="list-row wd-row"><div class="grow"><b class="small">Вывод в Telegram</b><div class="tiny muted">' + U.dt(w.createdAt) + ' · ≈' + EVSA.topupStars(w.rub) + ' ⭐' + (w.processedAt ? ' · ' + (w.status === 'rejected' ? 'отклонён ' : 'завершён ') + U.dt(w.processedAt) : '') + '</div></div><span class="status ' + w.status + '">' + (WST[w.status] || w.status) + '</span><b class="small nowrap"' + (w.status === 'rejected' ? ' title="Возвращено на баланс">↩ ' : '>−') + U.rub(w.rub) + '</b></div>'; }).join('') + '</div>' +
        '<div class="tiny muted" style="margin-top:8px">Выводы обрабатываются вручную: подарок за звёзды приходит в Telegram на ваш аккаунт @' + esc(me.username || '…') + '. При отклонении сумма возвращается на баланс.</div>' :
        U.empty('Выводов пока нет', 'Нажмите «Вывести» рядом с балансом, чтобы получить подарок за звёзды в Telegram');
    }
    if (tab === 'reviews') { var rv = db.reviewsFor(me.id); body = rv.length ? '<div class="card">' + rv.map(P.reviewHtml).join('') + '</div>' : U.empty('Отзывов пока нет', 'Отзывы оставляют покупатели после завершённой сделки'); }
    el.innerHTML = '<div class="page" style="max-width:860px"><div class="card prof-card">' + (banned ? '<div class="note bad" style="margin-bottom:14px">Аккаунт заблокирован. Покупки, продажи и чаты недоступны. Вы можете написать в поддержку.</div>' : '') +
      '<div class="prof-top"><label class="ava-edit" title="Обновить аватарку">' + U.avatar(me, 'xl') + '<span class="ava-cam">' + I.plus + '</span><input type="file" accept="image/jpeg,image/png,image/webp" id="avaFile" hidden></label><div class="grow" style="min-width:0"><h1 class="clip">' + esc(me.name) + '</h1>' +
      '<div class="muted">' + (me.username ? '@' + esc(me.username) : 'username не указан') + '</div>' + (me.tgId ? '<div class="tiny muted">Telegram ID: ' + esc(me.tgId) + '</div>' : '') +
      '<div style="margin-top:6px">' + U.stars(st.rating) + ' · ' + st.count + ' ' + EVSA.plural(st.count, 'отзыв', 'отзыва', 'отзывов') + '</div></div></div>' +
      '<div class="balance-box"><div class="grow" style="min-width:0"><div class="muted small">Баланс</div><b>' + (db.unlimited() ? '<span title="Безлимитный баланс">∞</span>' : U.rub(db.balance())) + '</b></div>' +
      (banned ? '' : '<div class="bal-actions">' + (db.unlimited() ? '' : '<button class="btn wd-btn" data-act="withdraw">' + WD_ICO + 'Вывести</button>') + '<button class="btn primary" data-act="deposit">' + I.plus + 'Пополнить</button></div>') + '</div>' +
      (pw ? '<div class="note wd-pending" data-href="#/profile/withdrawals"><span class="status pending">В ожидании</span> Вывод ' + U.rub(pw.rub) + ' (≈' + EVSA.topupStars(pw.rub) + ' ⭐) обрабатывается — подарок придёт в Telegram</div>' : '') +
      '<div class="prof-actions"><button class="btn cyan" data-href="#/sell">' + I.plus + 'Продать</button><button class="btn" data-href="#/chats">' + PL_ICO.chat + 'Чаты</button><button class="btn" data-href="#/favorites">' + PL_ICO.heart + 'Избранное</button></div>' +
      '<div class="tabs">' + tabs.map(function (x) { return '<button class="tab' + (x[0] === tab ? ' active' : '') + '" data-href="#/profile/' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div class="tab-body">' + body + '</div>' +
      '<div class="row wrap prof-foot"><button class="btn sm" data-act="login">' + I.tg + 'Обновить данные из Telegram</button><button class="btn sm danger" data-act="logout">Выйти</button></div></div></div>';
    var tabAct = U.$('.tabs .tab.active', el); if (tabAct && tabAct.offsetLeft > tabAct.parentNode.clientWidth - tabAct.offsetWidth) tabAct.parentNode.scrollLeft = tabAct.offsetLeft - 16;
    var f = U.$('#avaFile', el);
    f.onchange = function () { U.readImage(f.files[0], 256, function (e, url) { if (e) return U.err(e); U.toast('Загружаем аватарку…'); U.try(function () { return db.updateAvatar(url).then(function () { U.toast('Аватарка обновлена', 'ok'); EVSA.sound.success(); }); }); }); };
  };

  /* ================= ПРОДАЖА (мастер) ================= */
  var S = null;
  P.sell = function (el, q) {
    var me = db.me(); if (!me) return P.needLogin(el, 'Продажа товаров');
    if (db.isBanned(me)) { el.innerHTML = '<div class="page"><div class="note bad">Заблокированные пользователи не могут продавать.</div></div>'; return; }
    if (!S || (q && q.t)) S = { step: q && q.t ? (q.c ? 3 : 2) : 1, type: (q && q.t) === 'site' ? 'site' : 'game', targetId: (q && q.id) || '', category: (q && q.c) || '', title: '', desc: '', buyerMsg: '', price: '', oldPrice: '', image: '', filter: '', delivery: '' };
    if (S.step >= 2 && !EVSA.findTarget(S.type, S.targetId)) S.step = 1;
    if (S.step >= 3 && !EVSA.CATEGORIES.some(function (c) { return c.id === S.category; })) S.step = 2;
    draw();
    function draw() {
      var names = ['Игра или сайт', 'Категория', 'Описание и цена'];
      var steps = '<div class="steps">' + [1, 2, 3].map(function (i) { return '<div class="step' + (S.step >= i ? ' on' : '') + (S.step === i ? ' cur' : '') + '"><i></i><span>' + names[i - 1] + '</span></div>'; }).join('') + '</div>';
      var html = '<div class="page sell-page"><h1 style="margin-bottom:4px">Новое объявление</h1><div class="muted small" style="margin-bottom:14px">Шаг ' + Math.min(S.step, 3) + ' из 3 · бесплатно</div>' + steps;
      if (S.step === 1) {
        var list = (S.type === 'site' ? EVSA.SITES : EVSA.GAMES).filter(function (t) { return t.name.toLowerCase().indexOf(S.filter.toLowerCase()) >= 0; });
        html += '<div class="card"><h2 style="margin-bottom:12px">Выберите игру или сайт</h2><div class="row wrap" style="margin-bottom:12px"><div class="seg" style="margin-left:0"><button data-type="game" class="' + (S.type === 'game' ? 'active' : '') + '">Игры</button><button data-type="site" class="' + (S.type === 'site' ? 'active' : '') + '">Сайты</button></div><input class="input grow" id="tFilter" type="search" placeholder="Найти…" value="' + esc(S.filter) + '"></div>' +
          (list.length ? '<div class="pick-grid">' + list.map(function (t) { return '<div class="pick' + (S.targetId === t.id ? ' active' : '') + '" data-pick="' + t.id + '" tabindex="0">' + U.cover(t) + '<div class="n">' + esc(t.name) + '</div></div>'; }).join('') + '</div>' : U.empty('Ничего не найдено', 'Попробуйте другое название')) + '</div>';
      } else if (S.step === 2) {
        var t = EVSA.findTarget(S.type, S.targetId);
        html += '<div class="card"><h2 style="margin-bottom:4px">Категория</h2><div class="muted small" style="margin-bottom:14px">' + esc(t.name) + '</div><div class="cat-grid">' + EVSA.CATEGORIES.map(function (c) {
          return '<div class="cat-card' + (S.category === c.id ? ' pick active' : '') + '" data-cat="' + c.id + '" tabindex="0"><div class="ci">' + c.icon + '</div><b>' + c.name + '</b><span>' + c.desc + '</span></div>'; }).join('') + '</div><button class="btn" data-step="1">' + I.back + 'Назад</button></div>';
      } else {
        var tt = EVSA.findTarget(S.type, S.targetId);
        html += '<div class="sell-layout"><div class="card stack sell-form"><div class="sell-target">' + U.miniIcon(tt) + '<span class="grow">' + esc(tt.name) + ' · ' + EVSA.catName(S.category) + '</span><button type="button" class="btn sm ghost" data-step="2">Изменить</button></div>' +
          '<label class="field">Название товара *<input class="input" id="fTitle" maxlength="80" value="' + esc(S.title) + '" placeholder="Например: Аккаунт с редкими скинами"><span class="hint"><span id="cTitle">' + S.title.length + '</span>/80</span></label>' +
          '<label class="field">Описание товара *<textarea class="input" id="fDesc" maxlength="2000" placeholder="Подробно опишите товар: что получит покупатель, как будет передан">' + esc(S.desc) + '</textarea><span class="hint">минимум 10 символов · <span id="cDesc">' + S.desc.length + '</span>/2000</span></label>' +
          '<label class="field">Сообщение покупателю после покупки <em>необязательно</em><textarea class="input" id="fMsg" maxlength="1000" style="min-height:70px" placeholder="Например: Спасибо! Напишите свой ID в чат">' + esc(S.buyerMsg) + '</textarea></label>' +
          '<label class="field">Способ получения<select class="select" id="fDel">' + EVSA.DELIVERY.map(function (d) { return '<option' + ((S.delivery || EVSA.DELIVERY_BY_CAT[S.category]) === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select></label>' +
          '<div class="price-row"><label class="field">Цена, ₽ *<input class="input" id="fPrice" type="number" inputmode="decimal" min="1" max="1000000" step="1" value="' + esc(S.price) + '" placeholder="Например, 500"></label><label class="field">Цена без скидки, ₽ <em>необязательно</em><input class="input" id="fOld" type="number" inputmode="decimal" min="0" max="1000000" step="1" value="' + esc(S.oldPrice) + '" placeholder="0"></label></div>' +
          '<div class="small hint" id="discInfo">Заполните «Цену без скидки», только если она больше цены — тогда покажем скидку.</div>' +
          '<div class="field">Фотография товара *<label class="upload' + (S.image ? ' has-img' : '') + '" id="upl" tabindex="0">' + (S.image ? '<img src="' + S.image + '" alt=""><span class="upl-change">Заменить фото</span>' : '<div class="upl-plus">＋</div>Нажмите, чтобы загрузить фото<br><span class="tiny">JPG, PNG, WEBP · до 8 МБ</span>') + '<input type="file" id="fImg" accept="image/jpeg,image/png,image/webp" hidden></label></div>' +
          '<div class="err" id="fErr" role="alert"></div><button class="btn primary block lg" id="publish">Выставить товар</button><div class="tiny muted" style="text-align:center">Размещение бесплатное. Оплата на сайте скоро — покупатели смогут написать вам в чат.</div></div>' +
          '<div class="preview-sticky"><div class="muted small" style="margin-bottom:8px">Предпросмотр</div><div id="pv"></div></div></div>';
      }
      el.innerHTML = html + '</div>';
      bind();
    }
    function num(v) { return v === '' || v == null ? NaN : Number(String(v).replace(',', '.')); }
    function draft() { var pr = num(S.price) || 0, old = num(S.oldPrice) || 0; return { id: 'preview', sellerId: me.id, targetType: S.type, targetId: S.targetId, category: S.category, title: S.title || 'Название товара', price: pr, oldPrice: old > pr ? old : 0, image: S.image || null, premium: false }; }
    function preview() {
      var pv = U.$('#pv', el); if (!pv) return;
      pv.innerHTML = U.pcard(draft(), 0);
      var pr = num(S.price), old = num(S.oldPrice), info = U.$('#discInfo', el);
      if (old > 0 && pr > 0) info.innerHTML = old > pr ? 'Скидка для покупателя: <b style="color:#4ade80">−' + U.discount(old, pr) + '%</b> (было ' + U.rub(old) + ')' : '<span style="color:#fbbf24">Цена без скидки не больше цены — скидка не будет показана</span>';
      else info.textContent = 'Заполните «Цену без скидки», только если она больше цены — тогда покажем скидку.';
      var ct = U.$('#cTitle', el); if (ct) ct.textContent = S.title.length; var cd = U.$('#cDesc', el); if (cd) cd.textContent = S.desc.length;
    }
    function bind() {
      U.$$('[data-type]', el).forEach(function (b) { b.onclick = function () { S.type = b.dataset.type; S.targetId = ''; draw(); }; });
      var tf = U.$('#tFilter', el); if (tf) tf.oninput = function () { S.filter = tf.value; var pos = tf.selectionStart; draw(); var n = U.$('#tFilter', el); n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} };
      U.$$('[data-pick]', el).forEach(function (b) { b.onclick = function () { S.targetId = b.dataset.pick; S.step = 2; draw(); window.scrollTo(0, 0); }; });
      U.$$('[data-cat]', el).forEach(function (b) { b.onclick = function () { S.category = b.dataset.cat; S.delivery = ''; S.step = 3; draw(); window.scrollTo(0, 0); }; });
      U.$$('[data-pick],[data-cat],#upl', el).forEach(function (b) { b.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); b.click(); } }; });
      U.$$('[data-step]', el).forEach(function (b) { b.onclick = function () { S.step = Number(b.dataset.step); draw(); }; });
      var map = { fTitle: 'title', fDesc: 'desc', fMsg: 'buyerMsg', fPrice: 'price', fOld: 'oldPrice' };
      var fd = U.$('#fDel', el); if (fd) fd.onchange = function () { S.delivery = fd.value; };
      Object.keys(map).forEach(function (k) { var i = U.$('#' + k, el); if (i) i.oninput = function () { S[map[k]] = i.value; i.classList.remove('bad'); preview(); }; });
      var fi = U.$('#fImg', el);
      if (fi) fi.onchange = function () { U.readImage(fi.files[0], 1000, function (e, url) { if (e) return U.err(e); S.image = url; var up = U.$('#upl', el); up.classList.add('has-img'); up.innerHTML = '<img src="' + url + '" alt=""><span class="upl-change">Заменить фото</span><input type="file" id="fImg" accept="image/jpeg,image/png,image/webp" hidden>'; bind(); }); };
      var pb = U.$('#publish', el); if (pb) pb.onclick = function () {
        var errBox = U.$('#fErr', el);
        var v = validate(); if (v) { errBox.textContent = v[1]; var f = v[0] && U.$('#' + v[0], el); if (f) { f.classList.add('bad'); f.focus(); } EVSA.sound.error(); return; } errBox.textContent = '';
        var data = { targetType: S.type, targetId: S.targetId, category: S.category, title: S.title, desc: S.desc, buyerMsg: S.buyerMsg, price: num(S.price), oldPrice: num(S.oldPrice) > num(S.price) ? num(S.oldPrice) : 0, image: S.image, delivery: S.delivery || EVSA.DELIVERY_BY_CAT[S.category] };
        pb.textContent = 'Публикуем…';
        U.busy(pb, db.createProduct(data)).then(function (p) { S = null; EVSA.sound.success(); U.toast('Товар выставлен! Его уже видят покупатели', 'ok'); location.hash = '#/p/' + p.id; })
          .catch(function (e) { pb.textContent = 'Выставить товар'; errBox.textContent = e.userMessage || 'Не удалось выставить товар'; EVSA.sound.error(); });
      };
      preview();
    }
    function validate() {
      var t = String(S.title).trim(), d = String(S.desc).trim(), pr = num(S.price), old = num(S.oldPrice);
      if (t.length < 4) return ['fTitle', 'Название: минимум 4 символа'];
      if (d.length < 10) return ['fDesc', 'Описание: минимум 10 символов'];
      if (!(pr >= 1)) return ['fPrice', 'Укажите цену — от 1 ₽'];
      if (pr > 1000000) return ['fPrice', 'Цена: не больше 1 000 000 ₽'];
      if (String(S.oldPrice).trim() !== '' && !(old >= 0)) return ['fOld', 'Цена без скидки указана неверно'];
      if (old > 1000000) return ['fOld', 'Цена без скидки: не больше 1 000 000 ₽'];
      if (!S.image) return ['upl', 'Загрузите фотографию товара — это обязательно'];
      return null;
    }
  };

  /* ================= СООБЩЕНИЯ ================= */
  function supHist() { try { var me = db.me(), a = JSON.parse(localStorage.getItem(GKEY + (me ? '_' + me.id : '')) || '[]'); return a && a.length !== undefined ? a : []; } catch (e) { return []; } }
  function chatListHtml(activeId) {
    var me = db.me(); var chats = db.chatsOf(me.id), h = supHist(), lastS = h[h.length - 1];
    var html = '<div class="chat-item' + (activeId === 'support' ? ' active' : '') + '" data-href="#/support"><span class="ava" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div class="grow" style="min-width:0"><b>Поддержка</b> ' + U.verified + '<div class="last">' + (lastS ? esc(lastS.text) : 'Официальная поддержка EVSA SHOP') + '</div></div></div>';
    chats.forEach(function (c) {
      var o = db.user(c.a === me.id ? c.b : c.a), p = db.product(c.productId), ms = db.messages(c.id), last = ms[ms.length - 1], un = c.unread[me.id] || 0;
      html += '<div class="chat-item' + (activeId === c.id ? ' active' : '') + (un ? ' has-unread' : '') + '" data-href="#/chat/' + c.id + '">' + U.avatar(o) + '<div class="grow" style="min-width:0"><div class="row between" style="gap:8px"><b class="small clip">' + esc(o.name) + '</b><span class="tiny muted nowrap">' + (last ? (Date.now() - last.createdAt < 86400000 ? U.time(last.createdAt) : U.date(last.createdAt)) : '') + '</span></div><div class="last">' + esc(p ? p.title : 'Товар снят') + (last ? ' · ' + esc(last.text) : '') + '</div></div>' + (un ? '<span class="unread">' + un + '</span>' : '') + '</div>';
    });
    if (!chats.length) html += db.ready() ? '<div class="chat-empty muted small">Чатов с продавцами пока нет. Откройте товар и нажмите «Написать продавцу».</div>' : U.skelRows(2).replace('class="card"', 'class="skel-wrap"');
    return html;
  }
  P.chats = function (el) {
    if (!db.me()) return P.needLogin(el, 'Сообщения');
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:14px">Сообщения</h1><div class="chat-layout"><div class="chat-list">' + chatListHtml() + '</div><div class="chat-win chat-placeholder"><div class="muted">' + I.chat + '<div>Выберите чат</div></div></div></div></div>';
  };

  P.chat = function (el, id, live) {
    var me = db.me(); if (!me) return P.needLogin(el, 'Сообщения');
    var c = db.chat(id);
    if (!c) { el.innerHTML = '<div class="page">' + (db.ready() ? U.empty('Чат не найден', 'Или у вас нет к нему доступа', '<button class="btn" data-href="#/chats">К чатам</button>') : U.skelRows(4)) + '</div>'; return; }
    db.markRead(id);
    var other = db.user(c.a === me.id ? c.b : c.a), p = db.product(c.productId), o = c.orderId ? db.order(c.orderId) : null;
    var isBuyer = o && o.buyerId === me.id;
    var list = db.messages(id), prevDay = '';
    var msgs = list.map(function (m) {
      var day = U.date(m.createdAt), sep = day !== prevDay ? '<div class="day-sep"><span>' + day + '</span></div>' : ''; prevDay = day;
      var mine = m.from === me.id, u = db.user(m.from);
      return sep + '<div class="msg ' + (mine ? 'me' : 'them') + (m.pending ? ' pending' : '') + '">' + (mine ? '' : '<span data-href="#/u/' + u.id + '" style="cursor:pointer">' + U.avatar(u, 's') + '</span>') + '<div><div class="bubble">' + esc(m.text) + '</div><div class="time"' + (mine ? ' style="text-align:right"' : '') + '>' + U.time(m.createdAt) + (mine ? (m.pending ? ' · ⏳' : ' · ✓') : '') + '</div></div></div>';
    }).join('') || '<div class="msg sys"><div class="bubble">Напишите продавцу: уточните детали товара. Не переходите в сторонние мессенджеры и не платите продавцу напрямую — покупайте кнопкой «Купить» с баланса сайта.</div></div>';
    var deal = p ? '<div class="chat-deal"><img loading="lazy" decoding="async" src="' + esc(U.pimg(p)) + '" alt="" data-href="#/p/' + p.id + '" style="cursor:pointer"><div class="grow" style="min-width:0"><b class="small clip" style="display:block">' + esc(p.title) + '</b><span class="tiny muted">' + U.rub(o ? o.price : p.price) + (o ? ' · сделка #' + o.id.slice(-6) : '') + '</span></div>' + (o ? '<span class="status ' + o.status + '">' + (OST[o.status] || o.status) + '</span>' : (p.status === 'active' && p.sellerId !== me.id ? '<button class="btn sm primary" data-act="buy" data-id="' + p.id + '">Купить</button>' : '')) + '</div>' : '';
    var acts = o && isBuyer && o.status === 'paid' ? '<div class="deal-actions"><button class="btn sm primary" data-act="confirmOrder" data-id="' + o.id + '">Товар получен</button><button class="btn sm" data-href="#/support">Проблема с заказом</button></div>' :
      o && isBuyer && o.status === 'completed' && !o.reviewed ? '<div class="deal-actions"><button class="btn sm primary" data-act="review" data-id="' + o.id + '">★ Оставить отзыв продавцу</button></div>' : '';
    var win = '<div class="chat-head"><button class="icon-btn mobile-back" data-href="#/chats" aria-label="Назад">' + I.back + '</button><span data-href="#/u/' + other.id + '" style="cursor:pointer;min-width:0" class="row">' + U.avatar(other) + '<span style="min-width:0"><b class="clip" style="display:block">' + esc(other.name) + '</b><div class="tiny muted">' + (other.username ? '@' + esc(other.username) : 'профиль') + '</div></span></span></div>' + deal +
      '<div class="msgs" id="msgs">' + msgs + '</div>' + acts;
    var box0 = U.$('#msgs', el), atBottom = !box0 || box0.scrollHeight - box0.scrollTop - box0.clientHeight < 80;
    if (live && U.$('#chatWin', el)) {
      U.$('#chatInner', el).innerHTML = win; U.$('.chat-list', el).innerHTML = chatListHtml(id);
    } else {
      el.innerHTML = '<div class="page"><div class="chat-layout has-chat"><div class="chat-list">' + chatListHtml(id) + '</div><div class="chat-win" id="chatWin"><div id="chatInner" style="display:flex;flex-direction:column;flex:1;min-height:0">' + win + '</div>' +
        '<form class="composer" id="composer"><input class="input" id="msgInput" placeholder="Сообщение…" autocomplete="off" maxlength="2000" enterkeyhint="send"><button class="btn primary" aria-label="Отправить">' + I.send + '</button></form></div></div></div>';
      U.$('#composer', el).onsubmit = function (e) { e.preventDefault(); var i = U.$('#msgInput', el); var v = i.value; if (!v.trim()) return; i.value = ''; EVSA.sound.click(); db.sendMessage(id, v).catch(function (x) { if (!i.value) i.value = v; U.err(x); }); i.focus(); };
      atBottom = true;
    }
    var box = U.$('#msgs', el); if (atBottom) box.scrollTop = box.scrollHeight;
  };

  /* ================= ПОДДЕРЖКА ================= */
  var GKEY = 'evsa_guest_support';
  /* история обращений хранится в этом браузере (сами обращения уходят команде и не читаются обратно) */
  function guestHist() { return supHist(); }
  function guestPush(x) { try { var me = db.me(), a = supHist(); a.push(x); localStorage.setItem(GKEY + (me ? '_' + me.id : ''), JSON.stringify(a.slice(-50))); } catch (e) {} }
  /* переписка с поддержкой из базы (свои сообщения + ответы поддержки; RLS: только свои) */
  var srvSup = null;
  function loadSrvSup(el) {
    var me = db.me(), sb = EVSA.sb; if (!me || !sb) return;
    try {
      sb.from('support_tickets').select('id,category,text,kind,created_at').order('created_at', { ascending: false }).limit(100).then(function (r) {
        if (r.error || !r.data || !db.me() || db.me().id !== me.id) return;
        srvSup = { uid: me.id, rows: r.data.slice().reverse() };
        if (/^#\/support/.test(location.hash) && U.$('#supInner', el)) { P.support(el, true); var b = U.$('#msgs', el); if (b) b.scrollTop = b.scrollHeight; }
      }, function () {});
    } catch (e) {}
  }
  function srvMsgs(me) {
    if (!me || !srvSup || srvSup.uid !== me.id || !srvSup.rows.length) return null;
    return srvSup.rows.map(function (m) {
      var at = new Date(m.created_at).getTime();
      if (m.kind === 'reply') return '<div class="msg them"><span class="ava s" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div><div class="tiny muted" style="margin-bottom:3px">Поддержка EVSA SHOP</div><div class="bubble">' + esc(m.text) + '</div><div class="time">' + U.date(at) + ' · ' + U.time(at) + '</div></div></div>';
      return '<div class="msg me"><div><div class="tiny muted" style="text-align:right;margin-bottom:3px">' + esc(me.name) + ' · <span class="status open" style="font-size:10px;padding:1px 6px">' + esc(m.category) + '</span></div><div class="bubble">' + esc(m.text) + '</div><div class="time" style="text-align:right">' + U.date(at) + ' · ' + U.time(at) + ' · отправлено ✓</div></div></div>';
    }).join('');
  }
  function supportMsgs(me) {
    var sys = '<div class="msg sys"><div class="bubble">Здравствуйте! Это официальная поддержка EVSA SHOP. Выберите категорию и опишите проблему' + (me ? ' — ответим вам в Telegram.' : '. Войти не обязательно: оставьте контакт (Telegram или e-mail), чтобы мы могли ответить.') + '</div></div>';
    var srv = srvMsgs(me); if (srv !== null) return sys + srv;
    return sys + guestHist().map(function (g) {
      return '<div class="msg me"><div><div class="tiny muted" style="text-align:right;margin-bottom:3px">' + (me ? esc(me.name) : 'Гость') + ' · <span class="status open" style="font-size:10px;padding:1px 6px">' + esc(g.cat) + '</span> · № ' + esc(g.ticketId) + '</div><div class="bubble">' + esc(g.text) + '</div><div class="time" style="text-align:right">' + U.date(g.at) + ' · ' + U.time(g.at) + ' · отправлено ✓</div></div></div>';
    }).join('');
  }
  P.support = function (el, live) {
    var me = db.me();
    var head = '<div class="chat-head"><button type="button" class="icon-btn mobile-back" data-href="' + (me ? '#/chats' : '#/') + '" aria-label="Назад">' + I.back + '</button><span class="ava" style="background:linear-gradient(135deg,#22d3ee,#3b82f6)">ES</span><div><b>Поддержка</b> ' + U.verified + '<div class="tiny muted">Официальная поддержка EVSA SHOP</div></div></div>';
    var inner = head + '<div class="msgs" id="msgs">' + supportMsgs(me) + '</div>';
    if (live && U.$('#supInner', el)) {
      U.$('#supInner', el).innerHTML = inner;
      var cl = U.$('.chat-list', el); if (cl && me) cl.innerHTML = chatListHtml('support');
    } else {
      var form = '<form class="composer" id="supForm" style="flex-wrap:wrap" novalidate><select class="select" id="supCat" style="flex:1 1 100%">' + EVSA.TICKET_CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>' +
        (me ? '' : '<input class="input" id="supContact" style="flex:1 1 100%" maxlength="80" autocomplete="off" placeholder="@username или e-mail — необязательно">') +
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
              guestPush({ cat: cat, text: text, at: Date.now(), ticketId: t.ticketId });
              if (srvSup && cur && srvSup.uid === cur.id) srvSup.rows.push({ id: '', category: cat, text: text, kind: 'user', created_at: new Date().toISOString() });
              P.support(el, true); loadSrvSup(el);
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
      loadSrvSup(el);
    }
    var box = U.$('#msgs', el); box.scrollTop = box.scrollHeight;
  };

  /* ================= НАСТРОЙКИ ================= */
  P.settings = function (el) {
    var s = EVSA.settings.get(), me = db.me();
    function sw(key, title, sub, on) { return '<div class="set-row"><div class="grow"><b>' + title + '</b><div class="small muted">' + sub + '</div></div><label class="switch"><input type="checkbox" data-set="' + key + '"' + (on ? ' checked' : '') + '><span></span></label></div>'; }
    el.innerHTML = '<div class="page" style="max-width:760px"><h1 style="margin-bottom:16px">Настройки</h1><div class="card">' +
      sw('sound', 'Звуковые эффекты', 'Тихие звуки нажатий, успешных действий и новых сообщений', s.sound) +
      '<div class="set-row"><div class="grow"><b>Тема</b><div class="small muted">Сохраняется после перезагрузки</div></div><div class="seg"><button data-theme-set="dark" class="' + (s.theme === 'dark' ? 'active' : '') + '">Тёмная</button><button data-theme-set="light" class="' + (s.theme === 'light' ? 'active' : '') + '">Светлая</button></div></div>' +
      (me ? '<div class="set-row"><div class="grow"><b>Уведомления в Telegram</b><div class="small muted">Бот @' + esc(EVSA.TOPUP.BOT) + ' напишет, когда вам придёт сообщение в чате</div></div><label class="switch"><input type="checkbox" id="setNotify"' + (db.notifyOn() ? ' checked' : '') + '><span></span></label></div>' : '') + '</div>' +
      '<h2 style="margin:22px 0 12px">Аккаунт</h2><div class="card">' + (me ? '<div class="row">' + U.avatar(me, 'l') + '<div class="grow" style="min-width:0"><b class="clip" style="display:block">' + esc(me.name) + '</b><div class="small muted">' + (me.username ? '@' + esc(me.username) : 'username не указан') + (me.tgId ? ' · Telegram ID ' + esc(me.tgId) : '') + '</div><div class="tiny muted">Аккаунт создан ' + U.date(me.createdAt) + '</div></div></div><div class="row wrap" style="margin-top:14px"><button class="btn sm" data-href="#/profile">Открыть профиль</button><button class="btn sm danger" data-act="logout">Выйти</button></div>' : '<div class="row between wrap"><span class="muted">Вы не вошли</span><button class="btn primary sm" data-act="login">' + I.tg + 'Войти через Telegram</button></div>') + '</div>' +
      '<div class="note small" style="margin-top:18px">Покупатели оплачивают товары с баланса сайта. О новом заказе придёт уведомление в Telegram-бот — передайте товар покупателю в чате сделки.</div></div>';
    U.$$('[data-set]', el).forEach(function (i) { i.onchange = function () { var p = {}; p[i.dataset.set] = i.checked; EVSA.settings.set(p); EVSA.app.applySettings(); if (i.checked) EVSA.sound.success(); }; });
    var nt = U.$('#setNotify', el);
    if (nt) nt.onchange = function () { var on = nt.checked; nt.disabled = true; db.setNotify(on).then(function () { U.toast(on ? 'Уведомления в Telegram включены' : 'Уведомления в Telegram выключены', 'ok'); }).catch(function (e) { nt.checked = !on; U.err(e); }).then(function () { nt.disabled = false; }); };
    U.$$('[data-theme-set]', el).forEach(function (b) { b.onclick = function (e) { EVSA.app.setTheme(b.dataset.themeSet, e); U.$$('[data-theme-set]', el).forEach(function (x) { x.classList.toggle('active', x === b); }); }; });
  };
})();
