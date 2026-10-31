/* EVSA SHOP — избранное, рефералы, Steam, гарантия */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc, P = EVSA.pages, I = EVSA.icons;

  /* ================= ИЗБРАННОЕ ================= */
  P.favorites = function (el) {
    if (!db.me()) return P.needLogin(el, 'Избранное');
    var list = db.favs();
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:16px">Избранное</h1>' +
      (list.length ? '<div class="pgrid">' + list.map(U.pcard).join('') + '</div>' : U.empty('Здесь пока пусто', 'Нажмите ♥ на карточке товара, чтобы сохранить его', '<button class="btn" data-href="#/">К покупкам</button>')) +
      P.viewedSection() + '</div>';
  };

  /* ================= РЕФЕРАЛЬНАЯ ПРОГРАММА ================= */
  P.referral = function (el) {
    var me = db.me();
    var code = me ? 'EVSA' + me.id.replace(/-/g, '').slice(0, 8).toUpperCase() : '';
    var link = location.origin + location.pathname + '#/?ref=' + code;
    el.innerHTML = '<div class="page" style="max-width:860px">' +
      '<section class="carousel"><div class="slide" style="background:linear-gradient(120deg,#be185d,#0b0508 75%)"><h1>Приглашай друзей</h1><p>Делитесь своей ссылкой: друзья получают удобный маркетплейс, а вы — бонусы с их сделок.</p></div></section>' +
      '<div class="card">' + (me ?
        '<h3 style="margin-bottom:8px">Ваша реферальная ссылка</h3><div class="row"><input class="input grow" id="refLink" readonly value="' + esc(link) + '"><button class="btn primary" id="copyRef">Копировать</button></div>' +
        '<div class="hero-stats" style="margin-top:18px"><div><b>0</b><span>приглашено</span></div><div><b>0 ₽</b><span>заработано</span></div><div><b>' + esc(code) + '</b><span>ваш код</span></div></div>' :
        '<div class="row between"><span class="muted">Войдите, чтобы получить свою ссылку</span><button class="btn primary sm" data-act="login">Войти</button></div>') + '</div>' +
      '<div class="card"><h3 style="margin-bottom:10px">Как это работает</h3><div class="guar"><i>' + I.check + '</i>Отправьте ссылку другу</div><div class="guar"><i>' + I.check + '</i>Друг входит на EVSA SHOP через Telegram по вашей ссылке</div><div class="guar"><i>' + I.check + '</i>Вы получаете бонус с его завершённых сделок</div>' +
      '<div class="note small" style="margin-top:12px">Скоро: бонусы начнут начисляться вместе с запуском оплаты на сайте.</div></div></div>';
    var c = U.$('#copyRef', el);
    if (c) c.onclick = function () {
      var i = U.$('#refLink', el); i.select();
      (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () { U.toast('Ссылка скопирована', 'ok'); }, function () { document.execCommand && document.execCommand('copy'); U.toast('Ссылка скопирована', 'ok'); });
    };
  };

  /* ================= ПОПОЛНЕНИЕ STEAM (только интерфейс) ================= */
  P.steam = function (el) {
    var amounts = [100, 300, 500, 1000, 2000, 5000];
    el.innerHTML = '<div class="page" style="max-width:760px">' +
      '<section class="carousel"><div class="slide" style="background:linear-gradient(120deg,#1e40af,#05070d 75%)"><h1>Пополнение Steam</h1><p>Пополнение кошелька Steam по логину аккаунта.</p></div></section>' +
      '<div class="note warn" style="margin-bottom:14px">Скоро! Пополнение Steam ещё не работает — деньги не списываются.</div>' +
      '<div class="card stack"><label class="field">Логин Steam<input class="input" id="stLogin" maxlength="64" placeholder="Логин, а не никнейм" autocomplete="off"></label>' +
      '<label class="field">Сумма пополнения, ₽<input class="input" id="stSum" type="number" inputmode="numeric" min="100" max="15000" value="500"></label>' +
      '<div class="amounts">' + amounts.map(function (a) { return '<button class="btn sm" data-sum="' + a + '">' + a + ' ₽</button>'; }).join('') + '</div>' +
      '<div class="row between"><span class="muted">К зачислению</span><b id="stOut">500 ₽</b></div>' +
      '<div class="err" id="stErr"></div><button class="btn primary block lg" id="stGo">Пополнить</button>' +
      '<div class="tiny muted">Где найти логин: Steam → Об аккаунте → «Аккаунт пользователя …». Логин нужен, чтобы деньги пришли именно вам.</div></div></div>';
    var sum = U.$('#stSum', el), out = U.$('#stOut', el);
    function upd() { out.textContent = U.rub(Math.max(0, Math.floor(Number(sum.value) || 0))); }
    sum.oninput = upd;
    U.$$('[data-sum]', el).forEach(function (b) { b.onclick = function () { sum.value = b.dataset.sum; upd(); }; });
    U.$('#stGo', el).onclick = function () {
      var login = U.$('#stLogin', el).value.trim(), v = Number(sum.value), e = U.$('#stErr', el);
      if (!/^[A-Za-z0-9_]{3,64}$/.test(login)) { e.textContent = 'Введите логин Steam (латиница, цифры, _)'; EVSA.sound.error(); return; }
      if (!(v >= 100 && v <= 15000)) { e.textContent = 'Сумма от 100 до 15 000 ₽'; EVSA.sound.error(); return; }
      e.textContent = '';
      U.modal('Скоро', '<div class="stack" style="text-align:center"><div style="font-size:40px">🚧</div><p>Пополнение Steam появится в рабочей версии EVSA SHOP.</p><p class="small muted">Сейчас ничего не списано и никуда не отправлено.</p><button class="btn primary block" data-close>Понятно</button></div>');
    };
  };

  /* ================= НАША ГАРАНТИЯ ================= */
  P.guarantee = function (el) {
    var steps = [
      ['Вы оплачиваете товар', 'Деньги списываются с баланса и попадают в резерв. Продавец их пока не получает.'],
      ['Продавец передаёт товар', 'Всё общение и передача — в чате сделки. Чат сохраняется.'],
      ['Вы проверяете и подтверждаете', 'Только после вашего подтверждения деньги переходят продавцу.'],
      ['Если что-то не так — спор', 'Нажмите «Открыть спор»: поддержка изучит чат и вернёт деньги, если товар не получен или не соответствует описанию.']
    ];
    el.innerHTML = '<div class="page" style="max-width:860px"><section class="carousel"><div class="slide" style="background:linear-gradient(120deg,#7c3aed,#0b0b12 75%)"><h1>Наша гарантия</h1><p>Безопасная сделка на каждый товар EVSA SHOP.</p></div></section>' +
      '<div class="note warn" style="margin-bottom:14px">Оплата скоро. Гарантия заработает вместе с оплатой на сайте — пока не отправляйте продавцам предоплату.</div>' +
      '<div class="card">' + steps.map(function (s, i) { return '<div class="list-row"><span class="ava" style="background:linear-gradient(135deg,#8b5cf6,#22d3ee)">' + (i + 1) + '</span><div class="grow"><b>' + s[0] + '</b><div class="small muted">' + s[1] + '</div></div></div>'; }).join('') + '</div>' +
      '<div class="card"><div class="guar"><i>' + I.check + '</i>Возврат средств, если вы не получили товар</div><div class="guar"><i>' + I.check + '</i>Возврат средств, если товар не соответствует описанию</div><div class="guar"><i>' + I.check + '</i>Продавцы с нарушениями блокируются</div>' +
      '<div class="row wrap" style="margin-top:14px"><button class="btn primary" data-href="#/">К покупкам</button><button class="btn" data-href="#/support">Написать в поддержку</button></div></div></div>';
  };
})();
