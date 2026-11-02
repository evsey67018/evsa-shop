/* EVSA SHOP — страницы */
'use strict';
(function () {
  var U = EVSA.ui, db = EVSA.db, esc = U.esc;
  var P = EVSA.pages = {};
  var I = {
    left: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><path d="M3 4h2l2.4 11h11L21 7H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    chat: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    tg: '<svg viewBox="0 0 24 24"><path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/></svg>'
  };
  EVSA.icons = I;

  function needLogin(el, text) {
    if (!db.ready() && db.maybeAuthed()) { el.innerHTML = '<div class="page">' + U.skelRows(3) + '</div>'; return; }
    el.innerHTML = '<div class="page"><div class="card" style="max-width:520px;margin:40px auto;text-align:center"><div class="success-burst tg-burst" style="background:radial-gradient(circle,rgba(139,92,246,.35),transparent 70%)">' + I.tg.replace('<svg', '<svg style="width:40px;height:40px;color:#a78bfa"') + '</div>' +
      '<h2>' + esc(text || 'Нужен вход') + '</h2><p class="muted">Войдите через Telegram, чтобы покупать, продавать и общаться.</p><button class="btn primary" data-act="login">' + I.tg + 'Войти через Telegram</button></div></div>';
  }
  P.needLogin = needLogin;
  /* Пустое состояние «нет товаров» с кнопкой «Продать» */
  function emptySell(sellHref, sub) {
    return '<div class="empty empty-sell"><div class="es-ico">' + I.plus + '</div><b>Пока нет товаров — стань первым продавцом</b><div class="small muted" style="margin-top:4px">' + esc(sub || 'Разместить объявление можно бесплатно, за пару минут') + '</div>' +
      '<button class="btn primary" style="margin-top:14px" data-href="' + (sellHref || '#/sell') + '">' + I.plus + 'Продать</button></div>';
  }
  P.emptySell = emptySell;

  I.heart = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
  I.check = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
  I.shield = '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>';
  I.flag = '<svg viewBox="0 0 24 24"><path d="M5 21V4h11l-1.5 4L16 12H5"/></svg>';

  function railTiles(list, type, more, square) {
    var wide = type === 'site' && !square;
    return list.map(function (t, i) {
      return '<div class="tile' + (wide ? ' site-tile' : '') + '" data-href="#/t/' + type + '/' + t.id + '" style="animation-delay:' + i * 40 + 'ms">' +
        U.cover(t, { rank: i + 1, tag: true, wide: wide }) + '<div class="tile-name">' + esc(t.name) + '</div><div class="tile-sub">' + EVSA.offersText(db.countFor(type, t.id)) + '</div></div>';
    }).join('') + (more ? '<div class="tile more-tile' + (wide ? ' site-tile' : '') + '" data-href="' + more + '">' + U.cover({ c1: 'var(--panel2)', c2: 'var(--panel3)', short: 'Ещё →', tag: '' }, { wide: wide }) + '<div class="tile-name">Ещё</div><div class="tile-sub">Смотреть все</div></div>' : '');
  }
  function arrowsHead(title, id, link) {
    return '<div class="section-head"><h2>' + title + '</h2><div class="arrows">' + (link ? '<a class="btn sm ghost" href="' + link + '">Все ' + I.right + '</a>' : '') + '<button class="icon-btn" data-scroll="' + id + '" data-dir="-1" aria-label="Влево">' + I.left + '</button><button class="icon-btn" data-scroll="' + id + '" data-dir="1" aria-label="Вправо">' + I.right + '</button></div></div>';
  }
  function bindScroll(el) {
    U.$$('[data-scroll]', el).forEach(function (b) {
      b.onclick = function () { var r = document.getElementById(b.dataset.scroll); r.scrollBy({ left: Number(b.dataset.dir) * r.clientWidth * 0.8, behavior: 'smooth' }); };
    });
  }
  function viewedSection(exceptId) {
    var v = db.viewed(exceptId);
    if (!v.length) return '';
    return '<section class="section"><div class="section-head"><h2>Вы смотрели</h2><button class="btn sm ghost" data-act="clearViewed">Сбросить</button></div><div class="pgrid">' + v.slice(0, 8).map(U.pcard).join('') + '</div></section>';
  }
  P.viewedSection = viewedSection;

  /* ================= ГЛАВНАЯ ================= */
  P.home = function (el) {
    var games = EVSA.GAMES.slice().sort(function (a, b) { return b.pop - a.pop; });
    var sites = EVSA.SITES.slice().sort(function (a, b) { return b.pop - a.pop; });
    var hot = db.products({ sort: 'popular' }).filter(function (p) { return !p.premium; }).slice(0, 10);
    var prem = db.products({ sort: 'popular' }).filter(function (p) { return p.premium; }).slice(0, 8);
    var total = db.raw().products.filter(function (p) { return p.status === 'active'; }).length;
    var B = EVSA.BANNERS;
    el.innerHTML = '<div class="page">' +
      '<section class="carousel" id="carousel"><div class="slides">' + B.map(function (b) {
        return '<div class="slide" style="background:linear-gradient(120deg,' + b.c1 + ',' + b.c2 + ' 75%)"><h1>' + esc(b.title) + '</h1><p>' + esc(b.text) + '</p><a class="btn primary" href="' + b.href + '">' + esc(b.cta) + '</a></div>';
      }).join('') + '</div><div class="dots">' + B.map(function (b, i) { return '<button aria-label="Слайд ' + (i + 1) + '" data-i="' + i + '"' + (i ? '' : ' class="on"') + '></button>'; }).join('') + '</div></section>' +
      '<section class="section">' + arrowsHead('Популярные игры', 'railGames', '#/games') + '<div class="rail" id="railGames">' + railTiles(games.slice(0, 12), 'game', '#/games') + '</div></section>' +
      '<section class="section">' + arrowsHead('Популярные сайты:', 'railSites', '#/games') + '<div class="rail" id="railSites">' + railTiles(sites, 'site', '#/games', true) + '</div></section>' +
      viewedSection() +
      (prem.length ? '<section class="section"><div class="section-head"><h2>Премиум товары</h2><span class="muted small">' + total + ' ' + EVSA.plural(total, 'объявление', 'объявления', 'объявлений') + ' на площадке</span></div><div class="pgrid">' + prem.map(U.pcard).join('') + '</div></section>' : '') +
      (!db.ready() ? '<section class="section"><div class="section-head"><h2>Хиты продаж</h2></div>' + U.skelCards(4) + '</section>' : hot.length ? '<section class="section"><div class="section-head"><h2>Хиты продаж</h2></div><div class="pgrid">' + hot.map(U.pcard).join('') + '</div></section>' : (total ? '' : '<section class="section">' + emptySell('#/sell', 'Магазин только открылся. Выставьте первый товар — его увидят все покупатели') + '</section>')) + '</div>';
    bindScroll(el);
    var car = U.$('#carousel', el), idx = 0, slides = U.$('.slides', car), dots = U.$$('.dots button', car);
    function go(i) { idx = (i + B.length) % B.length; slides.style.transform = 'translateX(' + (-100 * idx) + '%)'; dots.forEach(function (d, j) { d.classList.toggle('on', j === idx); }); }
    dots.forEach(function (d) { d.onclick = function (e) { e.stopPropagation(); go(Number(d.dataset.i)); }; });
    var sx = null;
    car.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    car.addEventListener('touchend', function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(idx + (dx < 0 ? 1 : -1)); sx = null; });
    clearInterval(P._carTimer);
    P._carTimer = setInterval(function () { if (!document.body.contains(car)) return clearInterval(P._carTimer); go(idx + 1); }, 5500);
  };

  /* ================= ВСЕ ИГРЫ И САЙТЫ ================= */
  P.allTargets = function (el) {
    function grid(list, type) {
      return '<div class="all-grid">' + list.slice().sort(function (a, b) { return b.pop - a.pop; }).map(function (t, i) {
        return '<div class="tile' + (type === 'site' ? ' site-tile' : '') + '" data-href="#/t/' + type + '/' + t.id + '" style="animation-delay:' + i * 25 + 'ms">' + U.cover(t, { tag: true, wide: type === 'site' }) + '<div class="tile-name">' + esc(t.name) + '</div><div class="tile-sub">' + EVSA.offersText(db.countFor(type, t.id)) + '</div></div>';
      }).join('') + '</div>';
    }
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:16px">Все игры</h1>' + grid(EVSA.GAMES, 'game') + '<h1 style="margin:28px 0 16px">Сайты и приложения</h1>' + grid(EVSA.SITES, 'site') + '</div>';
  };

  /* ================= СТРАНИЦА ИГРЫ / САЙТА ================= */
  /* категории этой игры / сайта; если открыта старая категория, которой нет в списке, — показываем её тоже */
  function catsOf(t, cat) { var l = EVSA.catsFor(t).slice(), x = cat && !l.some(function (c) { return c.id === cat; }) && EVSA.catFor(t, cat); if (x) l.splice(l.length - 1, 0, x); return l; }
  P.target = function (el, type, id, cat) {
    var t = EVSA.findTarget(type, id);
    if (!t) { el.innerHTML = '<div class="page">' + U.empty('Не найдено', 'Такой игры или сайта нет', '<br><button class="btn" data-href="#/">На главную</button>') + '</div>'; return; }
    var st = P._listState = P._listState && P._listState.key === type + id + cat ? P._listState : { key: type + id + cat, search: '', sort: 'popular', online: false, discountOnly: false, withReviews: false, delivery: '', minPrice: '', maxPrice: '' };
    var cats = catsOf(t, cat), curCat = cat && cats.filter(function (c) { return c.id === cat; })[0];
    var chips = '<div class="chips">' + '<button class="chip' + (!cat ? ' active' : '') + '" data-href="#/t/' + type + '/' + id + '">Все<span class="cnt">' + db.countFor(type, id) + '</span></button>' +
      cats.map(function (c) { return '<button class="chip' + (cat === c.id ? ' active' : '') + '" data-href="#/t/' + type + '/' + id + '/' + c.id + '">' + esc(c.name) + '<span class="cnt">' + db.countFor(type, id, c.id) + '</span></button>'; }).join('') + '</div>';
    var html = '<div class="page"><div class="ghead"><div class="bgglow" style="background:linear-gradient(90deg,' + t.c1 + ',' + t.c2 + ')"></div>' + U.cover(t) +
      '<div style="position:relative"><div class="muted small">' + (type === 'site' ? 'Сайт / приложение' : 'Игра') + ' · ' + esc(t.tag) + '</div><h1>' + esc(t.name) + '</h1><div class="muted small">' + (db.countFor(type, id) ? EVSA.offersText(db.countFor(type, id)) + ' от продавцов' : 'Пока нет товаров — стань первым продавцом') + '</div></div></div>' +
      '<div class="sticky-bar"><button class="icon-btn" data-act="back" aria-label="Назад">' + I.left + '</button>' + chips + '</div>';
    if (!cat) {
      html += '<div class="cat-grid" style="margin-top:6px">' + cats.map(function (c) {
        return '<div class="cat-card" data-href="#/t/' + type + '/' + id + '/' + c.id + '"><div class="ci">' + c.icon + '</div><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + ' · ' + db.countFor(type, id, c.id) + '</span></div>';
      }).join('') + '</div><h2 style="margin:4px 0 0">Все предложения</h2>';
    }
    html += '<div class="filters"><input class="input" id="catSearch" type="search" placeholder="Поиск по товарам' + (curCat ? ' в «' + esc(curCat.name) + '»' : '') + '" value="' + esc(st.search) + '">' +
      '<button class="fchip' + (st.online ? ' on' : '') + '" data-f="online"><span class="online-dot"></span>Продавец онлайн</button>' +
      '<label class="fchip">Способ получения <select id="fDelivery"><option value="">Любой</option>' + EVSA.DELIVERY.map(function (d) { return '<option>' + d + '</option>'; }).join('') + '</select></label>' +
      '<label class="fchip">Цена <input id="fMin" type="number" inputmode="numeric" min="0" placeholder="от" value="' + esc(st.minPrice) + '">–<input id="fMax" type="number" inputmode="numeric" min="0" placeholder="до" value="' + esc(st.maxPrice) + '"></label>' +
      '<label class="fchip">Сортировка <select id="catSort"><option value="popular">Популярные</option><option value="cheap">Сначала дешёвые</option><option value="expensive">Сначала дорогие</option><option value="new">Сначала новые</option><option value="rating">По рейтингу</option><option value="discount">По скидке</option></select></label>' +
      '<button class="fchip' + (st.discountOnly ? ' on' : '') + '" data-f="discountOnly">% По скидке</button>' +
      '<button class="fchip' + (st.withReviews ? ' on' : '') + '" data-f="withReviews">★ С отзывами</button></div><div id="plist"></div></div>';
    el.innerHTML = html;
    var sel = U.$('#catSort', el); sel.value = st.sort;
    var dl = U.$('#fDelivery', el); dl.value = st.delivery;
    function draw() {
      var list = db.products({ targetType: type, targetId: id, category: cat || null, search: st.search, sort: st.sort, online: st.online, discountOnly: st.discountOnly, withReviews: st.withReviews, delivery: st.delivery, minPrice: st.minPrice, maxPrice: st.maxPrice });
      var filtered = st.search || st.online || st.discountOnly || st.withReviews || st.delivery || st.minPrice || st.maxPrice;
      U.$('#plist', el).innerHTML = !db.ready() ? U.skelCards(4) : list.length ? '<div class="pgrid">' + list.map(U.pcard).join('') + '</div>' :
        (filtered ? U.empty('Ничего не найдено', 'Попробуйте изменить фильтры') : emptySell('#/sell?t=' + type + '&id=' + id + (cat ? '&c=' + cat : ''), 'Здесь пока пусто. Выставьте товар по «' + t.name + '» первым — покупатели увидят его сразу'));
    }
    U.$('#catSearch', el).oninput = function (e) { st.search = e.target.value; draw(); };
    sel.onchange = function () { st.sort = sel.value; draw(); };
    dl.onchange = function () { st.delivery = dl.value; draw(); };
    U.$('#fMin', el).oninput = function (e) { st.minPrice = e.target.value; draw(); };
    U.$('#fMax', el).oninput = function (e) { st.maxPrice = e.target.value; draw(); };
    U.$$('[data-f]', el).forEach(function (b) { b.onclick = function () { var k = b.dataset.f; st[k] = !st[k]; b.classList.toggle('on', st[k]); draw(); }; });
    draw();
  };

  /* ================= СТРАНИЦА ТОВАРА ================= */
  P.product = function (el, id) {
    var p = db.product(id);
    if (!p && !db.ready()) { el.innerHTML = '<div class="page"><div class="pp"><div class="pp-img skel" style="aspect-ratio:16/10"></div><div class="card"><div class="skel skel-line" style="height:26px;width:80%"></div><div class="skel skel-line" style="width:50%"></div><div class="skel skel-line" style="height:40px;margin-top:20px"></div></div></div></div>'; return; }
    if (!p || p.status === 'removed') { el.innerHTML = '<div class="page">' + U.empty('Товар не найден', 'Возможно, он снят с продажи', '<button class="btn" data-href="#/">На главную</button>') + '</div>'; return; }
    var s = db.user(p.sellerId), st = db.sellerStats(s.id), t = EVSA.findTarget(p.targetType, p.targetId), d = U.discount(p.oldPrice, p.price), me = db.me();
    var reviews = db.reviewsFor(s.id);
    var mine = me && me.id === s.id, fav = db.isFav(p.id);
    var other = db.products({ sellerId: s.id, sort: 'popular' }).filter(function (x) { return x.id !== p.id; }).slice(0, 4);
    var similar = db.products({ targetType: p.targetType, targetId: p.targetId, category: p.category, sort: 'popular' }).filter(function (x) { return x.id !== p.id && x.sellerId !== s.id; }).slice(0, 8);
    var guarantee = '<div class="guar"><i>' + I.check + '</i>С оплатой на сайте — возврат, если товар не получен</div><div class="guar"><i>' + I.check + '</i>…и если товар не соответствует описанию</div>';
    el.innerHTML = '<div class="page"><div class="row small muted" style="margin-bottom:14px;flex-wrap:wrap;gap:8px"><button class="icon-btn" data-act="back" aria-label="Назад">' + I.left + '</button>' + U.miniIcon(t) + '<a href="#/t/' + p.targetType + '/' + t.id + '">' + esc(t.name) + '</a><a class="pill" href="#/t/' + p.targetType + '/' + t.id + '/' + p.category + '">' + esc(EVSA.catName(p.category, t)) + '</a></div>' +
      '<div class="pp"><div><div class="pp-img">' + U.imgTag(p) + (p.premium ? '<span class="badge-prem">★ PREMIUM</span>' : '') +
      '<button class="fav-big' + (fav ? ' on' : '') + '" data-act="fav" data-id="' + p.id + '">' + I.heart + '<span>' + (fav ? 'В избранном' : 'В избранное') + '</span></button></div>' +
      '<div class="card" style="margin-top:14px"><h3 style="margin-bottom:8px">Описание</h3><div class="desc">' + esc(p.desc) + '</div>' +
      (mine ? '' : '<button class="link-btn" style="margin-top:12px" data-act="report" data-id="' + p.id + '">' + I.flag + 'Пожаловаться</button>') + '</div></div>' +
      '<div><div class="card"><h1 style="font-size:22px;margin-bottom:6px">' + esc(p.title) + '</h1>' +
      '<div class="small muted">' + (st.count ? '<span class="stars">' + st.rating.toFixed(1) + ' ★</span> ' + st.count + ' ' + EVSA.plural(st.count, 'отзыв', 'отзыва', 'отзывов') : 'Пока нет отзывов') + ' · продано ' + p.sales + '</div>' +
      '<h3 style="margin:16px 0 4px">Характеристики</h3><div class="chars"><div><span>Игра / сервис</span>' + esc(t.name) + '</div><div><span>Тип</span>' + esc(EVSA.catName(p.category, t)) + '</div><div><span>Способ получения</span>' + esc(p.delivery || EVSA.catDelivery(p.category, t)) + '</div>' + (p.qty > 1 ? '<div><span>В наличии</span>' + p.qty + ' шт.</div>' : '') + '</div>' +
      guarantee +
      '<div class="pp-price price" style="margin:16px 0 4px"><b' + (d ? ' class="red"' : '') + '>' + U.rub(p.price) + '</b>' + (d ? '<span class="disc-pill">−' + d + '%</span><s>' + U.rub(p.oldPrice) + '</s>' : '') + '</div>' +
      '<div class="tiny muted" style="margin-bottom:14px">Опубликовано ' + U.date(p.createdAt) + (p.status === 'sold' ? ' · <b style="color:#f87171">Продан</b>' : '') + '</div>' +
      (mine ? '<div class="note">Это ваше объявление.</div><div class="row" style="margin-top:10px"><button class="btn danger block" data-act="removeProduct" data-id="' + p.id + '">Снять с продажи</button></div>' :
        '<div class="stack"><button class="btn primary block lg" data-act="buy" data-id="' + p.id + '"' + (p.status !== 'active' ? ' disabled' : '') + '>' + (p.status === 'active' ? 'Купить за ' + U.rub(p.price) : 'Продан') + '</button>' +
        '<div class="tiny muted">Оплата с баланса сайта. Товар продавец передаёт в чате сделки.</div>' +
        '<div class="row"><button class="btn block lg" data-act="chatSeller" data-id="' + p.id + '"' + (p.status !== 'active' ? ' disabled' : '') + '>' + I.chat + 'Написать продавцу</button><button class="btn lg" data-act="cartAdd" data-id="' + p.id + '" aria-label="В корзину" title="В корзину"' + (p.status !== 'active' ? ' disabled' : '') + '>' + I.cart + '</button></div></div>') +
      '<div class="row between small" style="margin-top:12px"><a href="#/guarantee" class="row" style="gap:6px">' + I.shield + 'Как будет работать гарантия</a><a href="#/referral" class="muted">Пригласить друга</a></div></div>' +
      '<div class="card"><h3 style="margin-bottom:10px">Продавец</h3><div class="row" style="cursor:pointer" data-href="#/u/' + s.id + '"><span class="ava-wrap">' + U.avatar(s, 'l') + (db.isOnline(s) ? '<span class="online-dot"></span>' : '') + '</span><div class="grow"><h3>' + esc(s.name) + '</h3><div class="small">' + (st.count ? '<span class="stars">' + st.rating.toFixed(1) + ' ★</span> ' + st.count + ' отзывов · ' : '') + st.sales + ' сделок · ' + (db.isOnline(s) ? '<span style="color:#4ade80">онлайн</span>' : '<span class="muted">не в сети</span>') + '</div></div>' + I.right + '</div></div></div></div>' +
      '<section class="section" style="margin-top:28px"><div class="section-head"><h2>Отзывы продавца</h2>' + (reviews.length > 3 ? '<a class="btn sm ghost" href="#/u/' + s.id + '">Все отзывы (' + reviews.length + ') ' + I.right + '</a>' : '') + '</div>' +
      (reviews.length ? '<div class="big-rating"><b>' + st.rating.toFixed(1) + '</b><div>' + U.stars(st.rating) + '<div class="tiny muted">' + st.count + ' отзывов</div></div></div><div class="rv-grid">' + reviews.slice(0, 3).map(reviewCard).join('') + '</div><div class="tiny muted" style="margin-top:10px">' + I.check.replace('<svg', '<svg style="width:14px;height:14px;vertical-align:-2px"') + ' Отзывы оставлены после покупки</div>' : '<div class="card muted small">У продавца пока нет отзывов</div>') + '</section>' +
      (other.length ? '<section class="section"><div class="section-head"><h2>Другие товары продавца</h2><a class="btn sm ghost" href="#/u/' + s.id + '">Все товары ' + I.right + '</a></div><div class="pgrid">' + other.map(U.pcard).join('') + '</div></section>' : '') +
      (similar.length ? '<section class="section"><div class="section-head"><h2>Похожие товары</h2></div><div class="pgrid">' + similar.map(U.pcard).join('') + '</div></section>' : '') +
      viewedSection(p.id) + '</div>';
    db.addViewed(p.id);
  };
  function reviewCard(r) {
    var b = db.user(r.buyerId), pr = r.productId ? db.product(r.productId) : null;
    return '<div class="rv-card"><div class="row">' + U.avatar(b) + '<div class="grow"><b class="small">' + esc(b ? b.name : 'Покупатель') + '</b><div class="tiny muted">' + U.dt(r.createdAt) + '</div></div><span class="stars small">' + '★'.repeat(r.rating) + '</span></div><div class="small">' + esc(r.text) + '</div>' +
      (pr ? '<div class="rv-prod" data-href="#/p/' + pr.id + '"><img src="' + esc(U.pimg(pr)) + '" alt=""><div class="grow"><div class="tiny">' + esc(pr.title) + '</div><b class="small">' + U.rub(pr.price) + '</b></div></div>' : '') + '</div>';
  }
  function reviewHtml(r) {
    var b = db.user(r.buyerId);
    return '<div class="review">' + U.avatar(b) + '<div class="grow"><div class="row between"><b class="small">' + esc(b ? b.name : 'Покупатель') + '</b><span class="tiny muted">' + U.date(r.createdAt) + '</span></div><div class="stars small">' + '★'.repeat(r.rating) + '<span style="color:var(--panel3)">' + '★'.repeat(5 - r.rating) + '</span></div><div class="small">' + esc(r.text) + '</div></div></div>';
  }
  P.reviewHtml = reviewHtml;

  /* ================= ПРОФИЛЬ ПРОДАВЦА ================= */
  P.seller = function (el, id) {
    if (!db.ready() && !db.raw().users.some(function (u) { return u.id === id; })) { el.innerHTML = '<div class="page">' + U.skelRows(1) + U.skelCards(2) + '</div>'; return; }
    var s = db.user(id); if (!s || s.missing) { el.innerHTML = '<div class="page">' + U.empty('Пользователь не найден') + '</div>'; return; }
    var st = db.sellerStats(id), list = db.products({ sellerId: id }), rv = db.reviewsFor(id);
    el.innerHTML = '<div class="page"><div class="card"><div class="prof-top">' + U.avatar(s, 'xl') + '<div><h1>' + esc(s.name) + (db.isBanned(s) ? ' <span class="status banned">заблокирован</span>' : '') + '</h1>' +
      (s.username ? '<div class="muted">@' + esc(s.username) + '</div>' : '') + '<div style="margin-top:6px">' + U.stars(st.rating) + ' · ' + st.count + ' отзывов · ' + st.sales + ' сделок</div>' + U.regLine(s.createdAt) + '</div></div></div>' +
      '<h2 style="margin:22px 0 12px">Товары продавца (' + list.length + ')</h2>' + (list.length ? '<div class="pgrid">' + list.map(U.pcard).join('') + '</div>' : (db.me() && db.me().id === id ? emptySell('#/sell', 'У вас пока нет объявлений. Выставьте первый товар') : U.empty('Нет активных объявлений', 'У этого продавца пока нет товаров'))) +
      '<h2 style="margin:22px 0 12px">Отзывы покупателей</h2><div class="card">' + (rv.length ? rv.map(reviewHtml).join('') : '<div class="muted">Пока нет отзывов</div>') + '</div></div>';
  };

  /* ================= ПОИСК ================= */
  P.search = function (el, q) {
    q = (q || '').trim(); var ql = q.toLowerCase();
    var games = EVSA.GAMES.filter(function (g) { return g.name.toLowerCase().indexOf(ql) >= 0; });
    var sites = EVSA.SITES.filter(function (g) { return g.name.toLowerCase().indexOf(ql) >= 0; });
    var prods = q ? db.products({ search: q, sort: 'popular' }) : [];
    var tiles = games.map(function (g, i) { return '<div class="tile" data-href="#/t/game/' + g.id + '" style="animation-delay:' + i * 40 + 'ms">' + U.cover(g, { tag: true }) + '<div class="tile-name">' + esc(g.name) + '</div></div>'; })
      .concat(sites.map(function (g) { return '<div class="tile site-tile" data-href="#/t/site/' + g.id + '">' + U.cover(g, { wide: true, tag: true }) + '<div class="tile-name">' + esc(g.name) + '</div></div>'; }));
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:16px">Поиск: «' + esc(q) + '»</h1>' +
      (tiles.length ? '<div class="section"><h2 style="margin-bottom:10px">Игры и сайты</h2><div class="rail">' + tiles.join('') + '</div></div>' : '') +
      '<h2 style="margin-bottom:12px">Товары (' + prods.length + ')</h2>' + (prods.length ? '<div class="pgrid">' + prods.slice(0, 60).map(U.pcard).join('') + '</div>' : (db.raw().products.some(function (p) { return p.status === 'active'; }) ? U.empty('Ничего не найдено', 'Попробуйте другое название') : emptySell(tiles.length === 1 ? '#/sell?t=' + (games.length ? 'game&id=' + games[0].id : 'site&id=' + sites[0].id) : '#/sell', 'Каталог игр и сайтов уже готов — товаров пока нет'))) + '</div>';
  };

  /* ================= САМЫЕ ДЕШЁВЫЕ ТОВАРЫ ================= */
  P.cheap = function (el) {
    var list = db.products({ sort: 'cheap' });
    el.innerHTML = '<div class="page"><div class="row between" style="margin-bottom:16px;flex-wrap:wrap;gap:8px"><h1>Самые дешёвые товары</h1>' + (list.length ? '<span class="muted small">' + list.length + ' ' + EVSA.plural(list.length, 'товар', 'товара', 'товаров') + ' · сначала дешёвые</span>' : '') + '</div>' +
      (!db.ready() ? U.skelCards(6) : list.length ? '<div class="pgrid">' + list.slice(0, 120).map(U.pcard).join('') + '</div>' : emptySell('#/sell', 'Здесь появятся самые выгодные предложения площадки')) + '</div>';
  };

  /* ================= КОРЗИНА ================= */
  P.cart = function (el) {
    var me = db.me(); if (!me) return needLogin(el, 'Корзина доступна после входа');
    var items = db.cart(), total = items.reduce(function (s, p) { return s + p.price; }, 0);
    el.innerHTML = '<div class="page"><h1 style="margin-bottom:16px">Корзина</h1>' + (items.length ?
      '<div class="card">' + items.map(function (p) {
        return '<div class="list-row"><img loading="lazy" decoding="async" src="' + esc(U.pimg(p)) + '" alt="" style="width:72px;height:46px;object-fit:cover;border-radius:10px;cursor:pointer" data-href="#/p/' + p.id + '"><div class="grow"><b class="small" data-href="#/p/' + p.id + '" style="cursor:pointer">' + esc(p.title) + '</b><div class="tiny muted">' + esc(db.user(p.sellerId).name) + '</div></div><b>' + U.rub(p.price) + '</b>' + (p.status === 'active' && p.sellerId !== me.id ? '<button class="btn sm primary" data-act="buy" data-id="' + p.id + '">Купить</button>' : '') + '<button class="btn sm ghost" data-act="cartRemove" data-id="' + p.id + '" aria-label="Убрать">✕</button></div>';
      }).join('') + '</div><div class="card"><div class="row between" style="margin-bottom:14px"><span class="muted">Итого</span><b style="font-size:22px">' + U.rub(total) + '</b></div>' +
      '<div class="tiny muted">Оплата с баланса сайта — нажмите «Купить» у нужного товара. Баланс: ' + (db.unlimited() ? '∞' : U.rub(db.balance())) + '.</div></div>' :
      U.empty('Корзина пуста', 'Добавляйте товары кнопкой с тележкой на странице товара', '<button class="btn" data-href="#/">К покупкам</button>')) + '</div>';
  };

  /* ================= УВЕДОМЛЕНИЯ ================= */
  P.notifications = function (el) {
    if (!db.me()) return needLogin(el);
    var list = db.notifications();
    el.innerHTML = '<div class="page"><div class="row between" style="margin-bottom:16px"><h1>Уведомления</h1>' + (list.length ? '<button class="btn sm" data-act="readAll">Прочитать все</button>' : '') + '</div>' +
      (EVSA.settings.get().dnd ? '<div class="note warn" style="margin-bottom:12px">Включён режим «Не беспокоить» — всплывающие уведомления скрыты, но всё сохраняется здесь.</div>' : '') +
      (list.length ? '<div class="card">' + list.map(function (n) {
        return '<div class="list-row" style="cursor:pointer" data-href="' + esc(n.link || '#/') + '">' + (n.read ? '' : '<span class="toast-dot" style="width:8px;height:8px;border-radius:50%;background:var(--accent);box-shadow:0 0 8px var(--accent);flex:none"></span>') + '<div class="grow">' + esc(n.text) + '<div class="tiny muted">' + U.ago(n.createdAt) + '</div></div></div>';
      }).join('') + '</div>' : U.empty('Пока пусто', 'Здесь появятся сообщения о покупках, продажах и ответах поддержки')) + '</div>';
  };
})();
