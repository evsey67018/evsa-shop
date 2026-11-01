/* EVSA SHOP — каталог игр, сайтов и категорий.
   Список расширяемый: просто добавьте объект в массив GAMES или SITES.
   pop — популярность (чем больше, тем выше в ленте). */
'use strict';
window.EVSA = window.EVSA || {};

EVSA.GAMES = [
  { id:'minecraft',  name:'Minecraft',         short:'MC',  pop:100, c1:'#4caf50', c2:'#1b3d12', tag:'Песочница',  cur:'Майнкоины' },
  { id:'roblox',     name:'Roblox',            short:'RBX', pop:98,  c1:'#e53935', c2:'#2b0b0b', tag:'Платформа',  cur:'Robux' },
  { id:'brawlstars', name:'Brawl Stars',       short:'BS',  pop:96,  c1:'#ffca28', c2:'#7b2ff7', tag:'Экшен',      cur:'Гемы' },
  { id:'standoff2',  name:'Standoff 2',        short:'SO2', pop:95,  c1:'#ff7043', c2:'#1d1d1d', tag:'Шутер',      cur:'Голда' },
  { id:'pubgm',      name:'PUBG Mobile',       short:'PUBG',pop:93,  c1:'#f9a825', c2:'#3e2a05', tag:'Королевская битва', cur:'UC' },
  { id:'fortnite',   name:'Fortnite',          short:'FN',  pop:91,  c1:'#7c4dff', c2:'#0d1b52', tag:'Королевская битва', cur:'V-Bucks' },
  { id:'cs2',        name:'Counter-Strike 2',  short:'CS2', pop:90,  c1:'#ffa000', c2:'#14213d', tag:'Шутер',      cur:'скины' },
  { id:'dota2',      name:'Dota 2',            short:'D2',  pop:88,  c1:'#d32f2f', c2:'#1a0505', tag:'MOBA',       cur:'Battle Pass' },
  { id:'genshin',    name:'Genshin Impact',    short:'GI',  pop:86,  c1:'#4fc3f7', c2:'#2a2350', tag:'RPG',        cur:'Кристаллы' },
  { id:'freefire',   name:'Free Fire',         short:'FF',  pop:84,  c1:'#ff5722', c2:'#3b0d00', tag:'Королевская битва', cur:'Алмазы' },
  { id:'clashroyale',name:'Clash Royale',      short:'CR',  pop:82,  c1:'#2979ff', c2:'#0b1a4a', tag:'Стратегия',  cur:'Гемы' },
  { id:'clashofclans',name:'Clash of Clans',   short:'CoC', pop:80,  c1:'#fdd835', c2:'#4e342e', tag:'Стратегия',  cur:'Гемы' },
  { id:'gta5',       name:'GTA V',             short:'GTA', pop:79,  c1:'#66bb6a', c2:'#102a10', tag:'Экшен',      cur:'Shark Cards' },
  { id:'valorant',   name:'Valorant',          short:'VAL', pop:77,  c1:'#ff4655', c2:'#0f1923', tag:'Шутер',      cur:'VP' },
  { id:'codm',       name:'Call of Duty Mobile',short:'COD',pop:74,  c1:'#9e9e9e', c2:'#111111', tag:'Шутер',      cur:'CP' },
  { id:'mlbb',       name:'Mobile Legends',    short:'MLBB',pop:72,  c1:'#29b6f6', c2:'#0d2440', tag:'MOBA',       cur:'Алмазы' },
  { id:'hsr',        name:'Honkai: Star Rail', short:'HSR', pop:70,  c1:'#ba68c8', c2:'#1a1035', tag:'RPG',        cur:'Кристаллы' },
  { id:'rust',       name:'Rust',              short:'RUST',pop:66,  c1:'#cd5c2c', c2:'#22140c', tag:'Выживание',  cur:'скины' },
  { id:'apex',       name:'Apex Legends',      short:'APX', pop:64,  c1:'#e53935', c2:'#2a2a2a', tag:'Королевская битва', cur:'Apex Coins' },
  { id:'wot',        name:'Мир танков',        short:'WoT', pop:62,  c1:'#a1887f', c2:'#1e1a14', tag:'Экшен',      cur:'Золото' },
  { id:'amongus',    name:'Among Us',          short:'AU',  pop:58,  c1:'#ef5350', c2:'#121a2e', tag:'Пати',       cur:'Звёзды' },
  { id:'stumble',    name:'Stumble Guys',      short:'SG',  pop:56,  c1:'#ffb300', c2:'#4a148c', tag:'Пати',       cur:'Гемы' }
];

EVSA.SITES = [
  { id:'telegram',  name:'Telegram Premium', short:'TG',  pop:100, c1:'#29b6f6', c2:'#0b3d5c', tag:'Мессенджер' },
  { id:'steam',     name:'Steam',            short:'ST',  pop:97,  c1:'#1e88e5', c2:'#0b1626', tag:'Игровой магазин' },
  { id:'discord',   name:'Discord Nitro',    short:'DC',  pop:94,  c1:'#5865f2', c2:'#1e2152', tag:'Сообщества' },
  { id:'youtube',   name:'YouTube Premium',  short:'YT',  pop:90,  c1:'#ff1744', c2:'#2b0007', tag:'Видео' },
  { id:'spotify',   name:'Spotify',          short:'SP',  pop:87,  c1:'#1db954', c2:'#0b2915', tag:'Музыка' },
  { id:'psstore',   name:'PlayStation Store',short:'PS',  pop:85,  c1:'#2962ff', c2:'#0a1440', tag:'Консоли' },
  { id:'xbox',      name:'Xbox Game Pass',   short:'XB',  pop:83,  c1:'#43a047', c2:'#0c2410', tag:'Подписка' },
  { id:'epic',      name:'Epic Games',       short:'EG',  pop:80,  c1:'#bdbdbd', c2:'#1a1a1a', tag:'Игровой магазин' },
  { id:'chatgpt',   name:'ChatGPT Plus',     short:'AI',  pop:78,  c1:'#10a37f', c2:'#08261d', tag:'Нейросети' },
  { id:'twitch',    name:'Twitch',           short:'TW',  pop:74,  c1:'#9146ff', c2:'#1d0b3d', tag:'Стримы' },
  { id:'netflix',   name:'Netflix',          short:'N',   pop:70,  c1:'#e50914', c2:'#1a0002', tag:'Кино' },
  { id:'nintendo',  name:'Nintendo eShop',   short:'NS',  pop:66,  c1:'#e60012', c2:'#2a0004', tag:'Консоли' },
  { id:'vk',        name:'VK Музыка',        short:'VK',  pop:62,  c1:'#0077ff', c2:'#001a3d', tag:'Музыка' },
  { id:'faceit',    name:'FACEIT',           short:'FC',  pop:58,  c1:'#ff5500', c2:'#2a0e00', tag:'Киберспорт' }
];

EVSA.CATEGORIES = [
  { id:'accounts', name:'Аккаунты',    desc:'Готовые прокачанные аккаунты', icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>' },
  { id:'boost',    name:'Буст',        desc:'Прокачка рейтинга и уровня',   icon:'<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>' },
  { id:'donate',   name:'Донат',       desc:'Валюта и пополнения',          icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3-1.6M12 6v2M12 18v-2"/></svg>' },
  { id:'promo',    name:'Промоакции',  desc:'Промокоды и подарочные коды',  icon:'<svg viewBox="0 0 24 24"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/></svg>' },
  { id:'design',   name:'Дизайн',      desc:'Аватарки, баннеры, превью',    icon:'<svg viewBox="0 0 24 24"><path d="M12 19l7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18zM2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/></svg>' },
  { id:'other',    name:'Другое',      desc:'Всё, что не подошло выше',     icon:'<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>' }
];

EVSA.TICKET_CATEGORIES = ['Жалоба на продавца','Жалоба на покупателя','Проблема с покупкой','Проблема с пополнением','Проблема с выводом','Другое'];

/* Примерный курс Telegram Stars → ₽. В рабочей версии курс отдаёт сервер. */
EVSA.STAR_RATE_RUB = 1.79;
EVSA.PREMIUM_PRICE = 19;
EVSA.WITHDRAW_MIN = 15;
EVSA.SUPPORT_TG = '@evssssa';

EVSA.findTarget = function (type, id) {
  return (type === 'site' ? EVSA.SITES : EVSA.GAMES).find(function (x) { return x.id === id; }) || null;
};
/* Настоящие иконки игр и сервисов лежат локально в assets/icons/<id>.webp (без хотлинка) */
EVSA.ICON_V = '20261031g';
/* Склонение: 1 предложение, 2 предложения, 5 предложений */
EVSA.plural = function (n, one, few, many) { var a = Math.abs(n) % 100, b = a % 10; if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many; };
EVSA.offersText = function (n) { return n ? n + ' ' + EVSA.plural(n, 'предложение', 'предложения', 'предложений') : 'Пока нет предложений'; };
EVSA.iconFor = function (t) {
  if (!t || !t.id) return '';
  if (!EVSA.findTarget('game', t.id) && !EVSA.findTarget('site', t.id)) return '';
  return 'assets/icons/' + t.id + '.webp?v=' + EVSA.ICON_V;
};
EVSA.catName = function (id) { var c = EVSA.CATEGORIES.find(function (x) { return x.id === id; }); return c ? c.name : id; };

/* Способы получения товара */
EVSA.DELIVERY = ['Вход в аккаунт', 'По ID игрока', 'Передача аккаунта', 'Код / ключ', 'Файл', 'Услуга через чат'];
EVSA.DELIVERY_BY_CAT = { accounts: 'Передача аккаунта', boost: 'Вход в аккаунт', donate: 'По ID игрока', promo: 'Код / ключ', design: 'Файл', other: 'Услуга через чат' };

/* Промо-баннеры для карусели на главной */
EVSA.BANNERS = [
  { title: 'Безопасные сделки', text: 'Деньги продавцу — только после того, как вы подтвердите получение товара.', cta: 'Как это работает', href: '#/guarantee', c1: '#7c3aed', c2: '#0b0b12' },
  { title: 'Продавайте на EVSA SHOP', text: 'Выставьте товар бесплатно — его сразу увидят все покупатели. Premium-размещение скоро.', cta: 'Продать товар', href: '#/sell', c1: '#0891b2', c2: '#06070a' },
  { title: 'Самые дешёвые товары в EVSA SHOP', text: 'Все предложения площадки от самых недорогих — выбирайте выгодно.', cta: 'Смотреть дешёвые', href: '#/cheap', c1: '#16a34a', c2: '#04100a' },
  { title: 'Все игры и сервисы в одном месте', text: EVSA.GAMES.length + ' игр и ' + EVSA.SITES.length + ' сайтов и приложений: аккаунты, донат, буст, промокоды и не только.', cta: 'Открыть каталог', href: '#/games', c1: '#7c3aed', c2: '#0a0614' }
];

/* Пополнение звёздами Telegram: рубли → звёзды со скидкой 20% (как на сервере: round(rub*0.8), минимум 1).
   MIN/MAX должны совпадать с миграцией stars_topup, Edge Function create-stars-invoice и bot.py. */
EVSA.TOPUP = { BOT: 'EVSA_SHOP_bot', MIN: 10, MAX: 12500, DISCOUNT: 0.2 };
/* вывод: вручную, подарком за звёзды в Telegram; курс тот же, что у пополнения */
EVSA.WITHDRAW = { MIN: 50, MAX: 1000000 };
EVSA.topupStars = function (rub) { return Math.max(1, Math.round(Number(rub) * (1 - EVSA.TOPUP.DISCOUNT))); };
EVSA.topupLink = function (rub) { return 'https://t.me/' + EVSA.TOPUP.BOT + '?start=topup_' + Math.floor(Number(rub)); };
