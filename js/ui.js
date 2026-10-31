/* EVSA SHOP — общие UI-хелперы */
'use strict';
(function () {
  var U = EVSA.ui = {};
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  /* Экранирование — вся пользовательская информация выводится только через esc() (защита от XSS) */
  U.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  U.rub = function (n) { return Number(n || 0).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽'; };
  U.date = function (t) { return new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' }); };
  U.time = function (t) { return new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); };
  U.dt = function (t) { return U.date(t) + ', ' + U.time(t); };
  U.ago = function (t) { var s = (Date.now() - t) / 1000; if (s < 60) return 'только что'; if (s < 3600) return Math.floor(s / 60) + ' мин назад'; if (s < 86400) return Math.floor(s / 3600) + ' ч назад'; return U.date(t); };
  U.discount = function (oldP, newP) { return oldP > 0 && newP < oldP ? Math.round((oldP - newP) / oldP * 100) : 0; };
  U.check = '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17 19 7"/></svg>';
  U.verified = '<span class="verified" title="Официальная поддержка EVSA SHOP">' + U.check + '</span>';

  U.avatar = function (u, cls) {
    cls = 'ava ' + (cls || '');
    if (!u) return '<span class="' + cls + '" style="background:#333">?</span>';
    if (u.avatar) return '<span class="' + cls + '" style="background:linear-gradient(135deg,' + (u.color || '#555') + ',#111)"><img src="' + U.esc(u.avatar) + '" alt="" onerror="this.remove()"></span>';
    var initials = (u.name || '?').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    return '<span class="' + cls + '" style="background:linear-gradient(135deg,' + u.color + ',#111)">' + U.esc(initials) + '</span>';
  };
  U.stars = function (r, count) { return '<span class="stars">★ ' + (r ? r.toFixed(1) : '—') + '</span>' + (count != null ? ' <span class="muted">(' + count + ')</span>' : ''); };

  /* Если картинка не загрузилась — убираем её, остаётся буквенная плашка */
  var ICO_ERR = 'onerror="EVSA.ui.icoFail(this)"';
  U.icoFail = function (img) {
    try { var box = img.parentNode; if (box) { box.classList.remove('has-ico'); U.$$('img.ico-img,img.ico-bg', box).forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); }); } } catch (e) {}
  };
  U.cover = function (t, opts) {
    opts = opts || {};
    var ico = EVSA.iconFor(t);
    return '<div class="cover' + (opts.wide ? ' wide' : '') + (ico ? ' has-ico' : '') + '" style="background:linear-gradient(145deg,' + t.c1 + ' 0%,' + t.c2 + ' 100%)">' +
      (ico ? '<img class="ico-bg" src="' + ico + '" alt="" aria-hidden="true" loading="lazy" ' + ICO_ERR + '>' : '') +
      (opts.rank ? '<span class="rank">#' + opts.rank + '</span>' : '') +
      '<span class="mono">' + U.esc(t.short) + '</span>' +
      (ico ? '<img class="ico-img" src="' + ico + '" alt="' + U.esc(t.name || '') + '" loading="lazy" ' + ICO_ERR + '>' : '') +
      (opts.tag ? '<span class="ctag">' + U.esc(t.tag) + '</span>' : '') + '</div>';
  };

  /* Обложка товара: загруженное фото или аккуратная сгенерированная заглушка */
  U.productArt = function (p) {
    var t = EVSA.findTarget(p.targetType, p.targetId) || { c1: '#444', c2: '#111', short: '?' };
    var cat = EVSA.catName(p.category);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + t.c1 + '"/><stop offset="1" stop-color="' + t.c2 + '"/></linearGradient>' +
      '<radialGradient id="r" cx=".8" cy=".1" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="320" height="200" fill="url(#g)"/><rect width="320" height="200" fill="url(#r)"/>' +
      '<text x="24" y="120" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="64" fill="#fff" fill-opacity=".9">' + U.esc(t.short) + '</text>' +
      '<rect x="24" y="148" rx="10" width="' + (cat.length * 9 + 24) + '" height="26" fill="#000" fill-opacity=".45"/>' +
      '<text x="36" y="166" font-family="Arial,sans-serif" font-weight="700" font-size="14" fill="#fff">' + U.esc(cat) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  U.pimg = function (p) {
    if (p.image) return p.image;
    var ico = EVSA.iconFor(EVSA.findTarget(p.targetType, p.targetId));
    return ico ? ico + '#' + (p.targetType === 'site' ? 'site' : 'game') + ':' + encodeURIComponent(p.category || '') : U.productArt(p);
  };
  /* Миниатюры товаров с иконкой: если файл не загрузился — подставляем сгенерированную плашку */
  document.addEventListener('error', function (e) {
    try {
      var img = e.target; if (!img || img.tagName !== 'IMG' || img.hasAttribute('onerror')) return;
      var m = /assets\/icons\/([a-z0-9]+)\.webp[^#]*#(game|site):(.*)$/.exec(img.getAttribute('src') || ''); if (!m) return;
      img.src = U.productArt({ targetType: m[2], targetId: m[1], category: decodeURIComponent(m[3]) });
    } catch (x) {}
  }, true);
  U.imgTag = function (p, alt) {
    var fallback = U.productArt(p);
    if (!p.image) {
      /* Нет фото от продавца — иконка игры/сервиса в тёмном неоновом стиле (не скриншот) */
      var t = EVSA.findTarget(p.targetType, p.targetId) || { c1: '#444', c2: '#111', short: '?' };
      var ico = EVSA.iconFor(t);
      if (ico) return '<div class="part has-ico" style="--c1:' + t.c1 + ';--c2:' + t.c2 + '"><img class="part-fb" src="' + fallback + '" alt="' + U.esc(alt || p.title) + '">' +
        '<img class="ico-bg" src="' + ico + '" alt="" aria-hidden="true" loading="lazy" ' + ICO_ERR + '><img class="ico-img" src="' + ico + '" alt="" loading="lazy" ' + ICO_ERR + '>' +
        '</div>';
    }
    return '<img loading="lazy" src="' + U.esc(U.pimg(p)) + '" alt="' + U.esc(alt || p.title) + '" onerror="this.onerror=null;this.src=\'' + fallback + '\'">';
  };

  U.miniIcon = function (t) {
    var ico = EVSA.iconFor(t);
    return '<span class="mini-ico' + (ico ? ' has-ico' : '') + '" style="background:linear-gradient(145deg,' + t.c1 + ',' + t.c2 + ')">' + U.esc(t.short.slice(0, 3)) +
      (ico ? '<img class="ico-img" src="' + ico + '" alt="" loading="lazy" ' + ICO_ERR + '>' : '') + '</span>';
  };
  U.pcard = function (p, i) {
    var s = EVSA.db.user(p.sellerId), st = EVSA.db.sellerStats(p.sellerId), d = U.discount(p.oldPrice, p.price);
    var t = EVSA.findTarget(p.targetType, p.targetId) || { c1: '#444', c2: '#111', short: '?', name: '' };
    var fav = p.id !== 'preview' && EVSA.db.isFav(p.id);
    return '<article class="pcard' + (p.premium ? ' premium' : '') + '" data-href="#/p/' + p.id + '" style="animation-delay:' + Math.min(i || 0, 12) * 35 + 'ms">' +
      '<div class="pimg">' + U.imgTag(p) + (p.premium ? '<span class="badge-prem">★ PREMIUM</span>' : '') +
      (p.id !== 'preview' ? '<button class="fav-btn' + (fav ? ' on' : '') + '" data-act="fav" data-id="' + p.id + '" aria-label="В избранное">♥</button>' : '') + '</div>' +
      '<div class="pbody"><div class="pmeta">' + U.miniIcon(t) + '<span class="pgame">' + U.esc(t.name) + '</span><span class="pill">' + U.esc(EVSA.catName(p.category)) + '</span></div>' +
      '<div class="ptitle">' + U.esc(p.title) + '</div>' +
      '<div class="prate">' + (st.count ? '<span class="stars">' + st.rating.toFixed(1) + ' ★</span> ' + st.count + ' отзывов' : 'Новый продавец') + '</div>' +
      '<div class="price"><b' + (d ? ' class="red"' : '') + '>' + U.rub(p.price) + '</b>' + (d ? '<span class="disc-pill">−' + d + '%</span><s>' + U.rub(p.oldPrice) + '</s>' : '') + '</div>' +
      '<div class="seller-mini">' + U.avatar(s, 's') + '<span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.esc(s ? s.name : '') + '</span>' + (EVSA.db.isOnline(s) ? '<span class="online-dot" title="Онлайн"></span>' : '') + '</div></div></article>';
  };

  U.empty = function (title, sub, btn) { return '<div class="empty"><div class="big">EVSA</div><b>' + U.esc(title) + '</b><div class="small" style="margin-top:4px">' + U.esc(sub || '') + '</div>' + (btn || '') + '</div>'; };

  /* toast */
  U.toast = function (text, type, link) {
    var box = U.$('#toasts'); var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info'); el.innerHTML = '<span class="dot"></span><div>' + U.esc(text) + '</div>';
    el.onclick = function () { if (link) location.hash = link.replace(/^#/, ''); kill(); };
    box.appendChild(el); while (box.children.length > 4) box.removeChild(box.firstChild);
    U.placeToasts();
    function kill() { el.classList.add('out'); setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 300); }
    setTimeout(kill, type === 'bad' ? 6000 : 4500);
  };
  /* На телефоне при открытой клавиатуре фиксированный верх может уехать за экран — держим тосты в видимой области */
  U.placeToasts = function () {
    try {
      var box = U.$('#toasts'), vv = window.visualViewport; if (!box) return;
      if (vv && window.innerWidth <= 900 && vv.offsetTop > 0) box.style.top = (vv.offsetTop + 12) + 'px'; else box.style.top = '';
    } catch (e) {}
  };
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', U.placeToasts); window.visualViewport.addEventListener('scroll', U.placeToasts); }
  U.err = function (e) { console.warn(e); U.toast(e && e.userMessage ? e.userMessage : 'Что-то пошло не так', 'bad'); EVSA.sound.error(); };
  U.try = function (fn) { try { return fn(); } catch (e) { if (e && e.userMessage) U.err(e); else { console.error(e); U.err(e); } return undefined; } };

  /* modal */
  U.modal = function (title, html, opts) {
    opts = opts || {}; U.closeModal(true);
    var bg = document.createElement('div'); bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true"><div class="modal-head"><h2>' + title + '</h2><button class="modal-x" data-close aria-label="Закрыть"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="modal-body">' + html + '</div></div>';
    bg.addEventListener('click', function (e) { if (e.target === bg || e.target.closest('[data-close]')) U.closeModal(); });
    U.$('#modalRoot').appendChild(bg); document.body.style.overflow = 'hidden';
    return bg.querySelector('.modal-body');
  };
  U.closeModal = function (instant) {
    var bg = U.$('#modalRoot .modal-bg'); if (!bg) return; document.body.style.overflow = '';
    if (instant) { bg.remove(); return; } bg.classList.add('closing'); setTimeout(function () { bg.remove(); }, 220);
  };

  /* Загрузка фото: проверка типа и размера, сжатие на клиенте */
  U.readImage = function (file, maxSide, cb) {
    if (!file) return cb(new Error('Файл не выбран'));
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return cb({ userMessage: 'Поддерживаются только JPG, PNG и WEBP' });
    if (file.size > 8 * 1024 * 1024) return cb({ userMessage: 'Фото больше 8 МБ' });
    var fr = new FileReader();
    fr.onload = function () {
      var img = new Image();
      img.onload = function () {
        if (img.width < 64 || img.height < 64) return cb({ userMessage: 'Фото слишком маленькое (минимум 64×64)' });
        var k = Math.min(1, maxSide / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        cb(null, c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = function () { cb({ userMessage: 'Файл повреждён или это не изображение' }); };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  };

  /* ripple на кнопках */
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest('.btn,.chip,.plus-btn'); if (!b) return;
    var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height);
    var sp = document.createElement('span'); sp.className = 'ripple';
    sp.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden'; b.appendChild(sp); setTimeout(function () { sp.remove(); }, 600);
    EVSA.sound.click();
  });
})();
