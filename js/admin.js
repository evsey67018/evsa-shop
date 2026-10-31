/* EVSA SHOP — админ-панель (демо). В рабочей версии доступ проверяется на сервере по Telegram ID администратора. */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc, P = EVSA.pages, L = EVSA.labels;
  var A = EVSA.admin = {};

  function uname(id) { var u = db.user(id); return u ? esc(u.name) + ' <span class="tiny muted">ID ' + u.tgId + '</span>' : '—'; }

  P.admin = function (el, tab) {
    if (!EVSA.settings.get().adminDemo) {
      el.innerHTML = '<div class="page">' + U.empty('Доступ закрыт', 'Админ-панель доступна только администратору. Для теста включите демо-доступ в настройках.', '<br><button class="btn" data-href="#/settings">Настройки</button>') + '</div>';
      return;
    }
    tab = tab || 'overview';
    var D = db.raw();
    var openT = D.tickets.filter(function (t) { return t.status !== 'closed'; }).length;
    var disputes = D.orders.filter(function (o) { return o.status === 'dispute'; });
    var pendW = D.withdrawals.filter(function (w) { return w.status === 'pending' || w.status === 'approved'; }).length;
    var pendD = D.deposits.filter(function (d) { return d.status === 'pending'; }).length;
    var tabs = [['overview', 'Обзор'], ['users', 'Пользователи'], ['tickets', 'Обращения' + (openT ? ' (' + openT + ')' : '')], ['disputes', 'Споры' + (disputes.length ? ' (' + disputes.length + ')' : '')], ['withdrawals', 'Выводы' + (pendW ? ' (' + pendW + ')' : '')], ['deposits', 'Пополнения' + (pendD ? ' (' + pendD + ')' : '')], ['tx', 'Транзакции'], ['logs', 'Журнал']];
    var body = '';
    if (tab === 'overview') {
      var turnover = D.orders.filter(function (o) { return o.status === 'completed'; }).reduce(function (s, o) { return s + o.price; }, 0);
      body = '<div class="admin-grid">' + [['Пользователи', D.users.length], ['Товары', D.products.filter(function (p) { return p.status === 'active'; }).length], ['Сделки', D.orders.length], ['Оборот', U.rub(turnover)], ['Открытые обращения', openT], ['Споры', disputes.length], ['Заявки на вывод', pendW], ['Подарки на проверке', pendD]].map(function (s) { return '<div class="stat"><span>' + s[0] + '</span><b>' + s[1] + '</b></div>'; }).join('') + '</div>';
    }
    if (tab === 'users') {
      body = '<input class="input" id="uq" type="search" placeholder="Поиск по Telegram ID, имени или @username" value="' + esc(A.q || '') + '"><div id="ulist" style="margin-top:12px"></div>';
    }
    if (tab === 'tickets') {
      var ts = D.tickets.slice().sort(function (a, b) { return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt); });
      body = ts.length ? ts.map(function (t) {
        var u = db.user(t.userId);
        return '<div class="card"><div class="row between wrap"><div class="row">' + U.avatar(u) + '<div><b>' + esc(u ? u.name : '—') + '</b> <span class="tiny muted">' + (u && u.username ? '@' + esc(u.username) + ' · ' : '') + 'ID ' + (u ? u.tgId : '') + '</span><div class="tiny muted">' + esc(t.category) + ' · ' + U.dt(t.createdAt) + '</div></div></div><span class="status ' + (t.status === 'closed' ? 'done' : t.status === 'answered' ? 'approved' : 'pending') + '">' + ({ open: 'Открыто', answered: 'Отвечено', closed: 'Закрыто' }[t.status]) + '</span></div>' +
          '<div class="stack" style="margin:10px 0">' + t.messages.map(function (m) { return '<div class="small"><b>' + (m.from === 'support' ? 'Поддержка' : 'Пользователь') + '</b> <span class="tiny muted">' + U.dt(m.at) + '</span><div>' + esc(m.text) + '</div></div>'; }).join('') + '</div>' +
          (t.status !== 'closed' ? '<div class="row"><input class="input grow" data-reply-input="' + t.id + '" placeholder="Ответ пользователю…" maxlength="2000"><button class="btn primary sm" data-a="reply" data-id="' + t.id + '">Ответить</button><button class="btn sm" data-a="close" data-id="' + t.id + '">Закрыть</button></div>' : '') + '</div>';
      }).join('') : U.empty('Обращений нет');
    }
    if (tab === 'disputes') {
      body = disputes.length ? disputes.map(function (o) {
        return '<div class="card"><b>' + esc(o.title) + '</b> · ' + U.rub(o.price) + '<div class="small muted">Покупатель: ' + uname(o.buyerId) + ' · Продавец: ' + uname(o.sellerId) + ' · ' + U.dt(o.createdAt) + '</div>' +
          '<div class="row wrap" style="margin-top:10px"><button class="btn sm" data-href="#/chat/' + o.chatId + '" data-a="peek" data-id="' + o.chatId + '">Открыть чат сделки</button><button class="btn sm ok" data-a="toBuyer" data-id="' + o.id + '">Вернуть покупателю</button><button class="btn sm cyan" data-a="toSeller" data-id="' + o.id + '">Выплатить продавцу</button></div></div>';
      }).join('') : U.empty('Споров нет');
    }
    if (tab === 'withdrawals') {
      var ws = D.withdrawals.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
      body = ws.length ? '<div class="tbl-wrap"><table class="tbl"><tr><th>Пользователь</th><th>Сумма</th><th>Дата</th><th>Статус</th><th></th></tr>' + ws.map(function (w) {
        var btn = w.status === 'pending' ? '<button class="btn sm ok" data-a="wApprove" data-id="' + w.id + '">Одобрить</button> <button class="btn sm danger" data-a="wReject" data-id="' + w.id + '">Отклонить</button>' : w.status === 'approved' ? '<button class="btn sm cyan" data-a="wDone" data-id="' + w.id + '">Выполнено</button> <button class="btn sm danger" data-a="wReject" data-id="' + w.id + '">Отклонить</button>' : '';
        return '<tr><td>' + uname(w.userId) + '</td><td>' + U.rub(w.amount) + '</td><td>' + U.dt(w.createdAt) + '</td><td><span class="status ' + w.status + '">' + L.WST[w.status] + '</span></td><td>' + btn + '</td></tr>';
      }).join('') + '</table></div>' : U.empty('Заявок на вывод нет');
    }
    if (tab === 'deposits') {
      var ds = D.deposits.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
      body = ds.length ? '<div class="tbl-wrap"><table class="tbl"><tr><th>Пользователь</th><th>Способ</th><th>Сумма</th><th>Дата</th><th>Статус</th><th></th></tr>' + ds.map(function (d) {
        return '<tr><td>' + uname(d.userId) + '</td><td>' + (d.method === 'gift' ? 'Подарок' + (d.note ? ': ' + esc(d.note) : '') : 'Stars ' + d.stars + ' ⭐') + '</td><td>' + U.rub(d.rub) + '</td><td>' + U.dt(d.createdAt) + '</td><td>' + L.DST[d.status] + '</td><td>' + (d.status === 'pending' ? '<button class="btn sm ok" data-a="dOk" data-id="' + d.id + '">Подтвердить</button> <button class="btn sm danger" data-a="dNo" data-id="' + d.id + '">Отклонить</button>' : '') + '</td></tr>';
      }).join('') + '</table></div>' : U.empty('Пополнений нет');
    }
    if (tab === 'tx') {
      var tx = D.transactions.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).slice(0, 200);
      body = tx.length ? '<div class="tbl-wrap"><table class="tbl"><tr><th>Дата</th><th>Пользователь</th><th>Тип</th><th>Сумма</th><th>Описание</th></tr>' + tx.map(function (t) { return '<tr><td>' + U.dt(t.createdAt) + '</td><td>' + uname(t.userId) + '</td><td>' + (L.TXN[t.type] || t.type) + '</td><td class="' + (t.amount > 0 ? 'plus' : 'minus') + '">' + U.rub(t.amount) + '</td><td class="small">' + esc(t.note) + '</td></tr>'; }).join('') + '</table></div>' : U.empty('Транзакций пока нет');
    }
    if (tab === 'logs') {
      var lg = D.adminLogs.slice().reverse();
      body = lg.length ? '<div class="card">' + lg.map(function (l) { return '<div class="list-row"><div class="grow"><b class="small">' + esc(l.action) + '</b><div class="tiny muted">' + U.dt(l.createdAt) + ' · ' + uname(l.targetId) + (l.details ? ' · ' + esc(l.details) : '') + '</div></div></div>'; }).join('') + '</div>' : U.empty('Журнал пуст');
    }
    el.innerHTML = '<div class="page"><div class="row between wrap" style="margin-bottom:14px"><h1>Админ-панель</h1><span class="status pending">демо-режим</span></div><div class="tabs">' + tabs.map(function (x) { return '<button class="tab' + (x[0] === tab ? ' active' : '') + '" data-href="#/admin/' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><div id="adminBody">' + body + '</div></div>';

    var uq = U.$('#uq', el);
    if (uq) { var drawU = function () { A.q = uq.value; var list = db.admin.users(uq.value); U.$('#ulist', el).innerHTML = '<div class="card">' + (list.length ? list.slice(0, 100).map(function (u) { return '<div class="list-row" style="cursor:pointer" data-a="user" data-id="' + u.id + '">' + U.avatar(u) + '<div class="grow"><b class="small">' + esc(u.name) + '</b> ' + (db.isBanned(u) ? '<span class="status banned">бан</span>' : '') + '<div class="tiny muted">' + (u.username ? '@' + esc(u.username) + ' · ' : '') + 'ID ' + u.tgId + (u.isSeed ? ' · демо-продавец' : '') + '</div></div><b class="small">' + U.rub(u.balance) + '</b></div>'; }).join('') : '<div class="muted small">Никого не найдено</div>') + '</div>'; }; uq.oninput = drawU; drawU(); }

    el.onclick = function (e) {
      var b = e.target.closest('[data-a]'); if (!b) return;
      var id = b.dataset.id, a = b.dataset.a;
      if (a === 'peek') return;
      U.try(function () {
        if (a === 'reply') { db.admin.reply(id, U.$('[data-reply-input="' + id + '"]', el).value); U.toast('Ответ отправлен', 'ok'); }
        if (a === 'close') db.admin.closeTicket(id);
        if (a === 'toBuyer') db.admin.resolveDispute(id, true);
        if (a === 'toSeller') db.admin.resolveDispute(id, false);
        if (a === 'wApprove') db.admin.setWithdrawal(id, 'approved');
        if (a === 'wDone') db.admin.setWithdrawal(id, 'done');
        if (a === 'wReject') db.admin.setWithdrawal(id, 'rejected');
        if (a === 'dOk') db.admin.setDeposit(id, true);
        if (a === 'dNo') db.admin.setDeposit(id, false);
        if (a === 'user') return userModal(id);
        P.admin(el, tab);
      });
    };
  };

  function userModal(id) {
    var u = db.user(id), D = db.raw(), st = db.sellerStats(id);
    var buys = db.ordersOf(id, 'buy'), sells = db.ordersOf(id, 'sell'), bans = D.bans.filter(function (b) { return b.userId === id; });
    function orders(list) { return list.length ? list.slice(0, 10).map(function (o) { return '<div class="small">' + esc(o.title) + ' · ' + U.rub(o.price) + ' · ' + L.OST[o.status] + ' · ' + U.dt(o.createdAt) + '</div>'; }).join('') : '<div class="small muted">Нет</div>'; }
    var body = U.modal(esc(u.name), '<div class="stack"><div class="row">' + U.avatar(u, 'l') + '<div><div class="small">' + (u.username ? '@' + esc(u.username) + ' · ' : '') + 'Telegram ID ' + u.tgId + '</div><div class="small muted">Создан ' + U.dt(u.createdAt) + ' · баланс ' + U.rub(u.balance) + (u.reserved ? ' · резерв ' + U.rub(u.reserved) : '') + '</div><div class="small">' + U.stars(st.rating) + ' · ' + st.count + ' отзывов · предупреждений: ' + (u.warnings || 0) + '</div>' + (db.isBanned(u) ? '<div class="status banned">Заблокирован' + (u.ban.perm ? ' навсегда' : ' до ' + U.dt(u.ban.until)) + ': ' + esc(u.ban.reason) + '</div>' : '') + '</div></div>' +
      '<h3>Покупки</h3>' + orders(buys) + '<h3>Продажи</h3>' + orders(sells) + '<h3>Блокировки</h3>' + (bans.length ? bans.map(function (b) { return '<div class="small">' + (b.action === 'unban' ? 'Разблокировка' : b.perm ? 'Навсегда' : '24 часа') + ' · ' + U.dt(b.createdAt) + (b.reason ? ' · ' + esc(b.reason) : '') + '</div>'; }).join('') : '<div class="small muted">Нет</div>') +
      '<h3>Действия</h3><input class="input" id="admReason" placeholder="Причина (обязательно)" maxlength="200"><div class="row"><input class="input grow" id="admSum" type="number" placeholder="Сумма, напр. 100 или -50"><button class="btn sm" id="admAdj">Изменить баланс</button></div>' +
      '<div class="row wrap">' + (db.isBanned(u) ? '<button class="btn sm ok" id="admUnban">Разблокировать</button>' : '<button class="btn sm danger" id="admBan">' + ((u.warnings || 0) >= 1 ? 'Заблокировать навсегда' : 'Заблокировать на 24 часа') + '</button>') + '</div><div class="tiny muted">1-е нарушение — бан на 24 часа, 2-е — навсегда.</div></div>', { wide: true });
    var r = function () { return U.$('#admReason', body).value; };
    var after = function (msg) { U.toast(msg, 'ok'); U.closeModal(); EVSA.app.refresh(); };
    var bb = U.$('#admBan', body); if (bb) bb.onclick = function () { U.try(function () { db.admin.ban(id, r()); after('Пользователь заблокирован'); }); };
    var ub = U.$('#admUnban', body); if (ub) ub.onclick = function () { U.try(function () { db.admin.unban(id); after('Разблокирован'); }); };
    U.$('#admAdj', body).onclick = function () { U.try(function () { db.admin.adjust(id, U.$('#admSum', body).value, r()); after('Баланс изменён'); }); };
  }
})();
