/* EVSA SHOP — Хэллоуин 2026: декорации (летучие мыши, луна, призраки, паутина) и праздничный баннер.
   Чисто визуальный слой: pointer-events:none, никакой логики магазина не трогает.
   Откат: убрать подключение css/halloween.css и js/halloween.js из index.html. */
'use strict';
(function () {
  var d = document, root = d.documentElement;
  root.classList.add('hw');

  // шрифты для заголовков (не блокируют отрисовку)
  var f = d.createElement('link');
  f.rel = 'stylesheet';
  f.href = 'https://fonts.googleapis.com/css2?family=Creepster&family=Rubik+Wet+Paint&display=swap';
  d.head.appendChild(f);

  // праздничный слайд первым в карусели главной (без скидок и обещаний — только настроение)
  if (window.EVSA && EVSA.BANNERS && !EVSA.BANNERS.some(function (b) { return b.hw; })) {
    EVSA.BANNERS.unshift({
      hw: true,
      title: '🎃 Хэллоуин в EVSA SHOP',
      text: 'Жуткая ночь 31 октября! Аккаунты, донат и буст для любимых игр — с безопасной сделкой, как всегда.',
      cta: 'Открыть каталог', href: '#/games', c1: '#ff7a00', c2: '#1a0726'
    });
  }

  var P = 'assets/halloween/';
  function el(tag, cls, html) { var e = d.createElement(tag); e.className = cls; if (html) e.innerHTML = html; e.setAttribute('aria-hidden', 'true'); return e; }

  function mount() {
    if (d.getElementById('hwSky')) return;
    // небо: луна, звёзды, призраки, туман, конфеты
    var sky = el('div', 'hw-sky',
      '<i class="hw-stars"></i><i class="hw-moon"></i>' +
      '<img class="hw-ghost g1" src="' + P + 'ghost.svg" alt="">' +
      '<img class="hw-ghost g2" src="' + P + 'ghost.svg" alt="">' +
      '<img class="hw-candy c1" src="' + P + 'candy.svg" alt="">' +
      '<img class="hw-candy c2" src="' + P + 'candy.svg" alt="">' +
      '<i class="hw-fog"></i>' +
      '<img class="hw-pk-floor p1" src="' + P + 'pumpkin.svg" alt="">' +
      '<img class="hw-pk-floor p2" src="' + P + 'pumpkin.svg" alt="">');
    sky.id = 'hwSky';
    d.body.insertBefore(sky, d.body.firstChild);
    // летучие мыши поверх контента, но не перехватывают нажатия
    var bats = el('div', 'hw-bats', [1, 2, 3, 4, 5].map(function (i) { return '<span class="hw-bat b' + i + '"><img src="' + P + 'bat.svg" alt=""></span>'; }).join(''));
    d.body.appendChild(bats);
    // паутина в углах
    d.body.appendChild(el('img', 'hw-web wl'));
    d.body.appendChild(el('img', 'hw-web wr'));
    d.querySelectorAll('.hw-web').forEach(function (w) { w.src = P + 'web.svg'; w.alt = ''; });
  }
  if (d.body) mount(); else d.addEventListener('DOMContentLoaded', mount);
})();
