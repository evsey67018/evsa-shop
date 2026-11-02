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

/* ---------- Категории ----------
   CAT_DEFS — справочник всех видов товаров (id хранится в products.category, БД принимает ^[a-z0-9_-]{1,30}$).
   У каждой игры / сайта свой набор: EVSA.CATS[id] — список 'id' или ['id', 'Название', 'Описание', 'Способ получения'].
   «Дизайн» (если его нет в списке) и «Другое» добавляются в конец автоматически. Старые id (accounts, boost, donate, promo, design, other) сохранены. */
EVSA._svg = function (b) { return '<svg viewBox="0 0 24 24">' + b + '</svg>'; };
EVSA.CAT_DEFS = {
  donate:    { name:'Донат',             desc:'Валюта и пополнения',            del:'По ID игрока',        icon:EVSA._svg('<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 3 6 1.6 6 4.6 0 1.3-1.3 2.2-3 2.2-1.4 0-2.6-.6-3-1.6M12 6v2M12 18v-2"/>') },
  pass:      { name:'Боевой пропуск',    desc:'Пропуски и сезонные награды',    del:'По ID игрока',        icon:EVSA._svg('<path d="M3 8a2 2 0 0 0 0 4v4a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-4a2 2 0 0 1 0-4V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" transform="translate(0 1)"/><path d="M14 5v2M14 11v2M14 17v1"/>') },
  accounts:  { name:'Аккаунты',          desc:'Готовые прокачанные аккаунты',   del:'Передача аккаунта',   icon:EVSA._svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>') },
  boost:     { name:'Буст',              desc:'Прокачка рейтинга и уровня',     del:'Вход в аккаунт',      icon:EVSA._svg('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>') },
  skins:     { name:'Скины',             desc:'Скины, образы и косметика',      del:'Трейд / передача в игре', icon:EVSA._svg('<path d="M20.4 6.6 16 4a4 4 0 0 1-8 0L3.6 6.6a1 1 0 0 0-.5 1.2l1.2 3.4a1 1 0 0 0 1.1.6L7 11.5V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-8.5l1.6.3a1 1 0 0 0 1.1-.6l1.2-3.4a1 1 0 0 0-.5-1.2z"/>') },
  items:     { name:'Игровые предметы',  desc:'Предметы, ресурсы и питомцы',    del:'Трейд / передача в игре', icon:EVSA._svg('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>') },
  limiteds:  { name:'Лимитки и UGC',     desc:'Лимитированные вещи каталога',   del:'Трейд / передача в игре', icon:EVSA._svg('<path d="m12 2 3 6.5 7 .8-5.2 4.7 1.5 7L12 17.4 5.7 21l1.5-7L2 9.3l7-.8z"/>') },
  premium:   { name:'Premium',           desc:'Премиум-статус и привилегии',    del:'Вход в аккаунт',      icon:EVSA._svg('<path d="M3 7l4 4 5-7 5 7 4-4-2 12H5z"/>') },
  subs:      { name:'Подписки',          desc:'Оформление и продление подписки',del:'Вход в аккаунт',      icon:EVSA._svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4"/>') },
  keys:      { name:'Ключи и коды',      desc:'Ключи активации и цифровые коды',del:'Код / ключ',          icon:EVSA._svg('<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.3-9.3M16 7l3 3M18 5l2 2"/>') },
  topup:     { name:'Пополнение',        desc:'Пополнение баланса и карты оплаты', del:'Код / ключ',       icon:EVSA._svg('<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2M12 2v5M9.5 4.5 12 2l2.5 2.5"/>') },
  gifts:     { name:'Гифты',             desc:'Подарки другу или на аккаунт',   del:'Подарком',            icon:EVSA._svg('<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>') },
  stars:     { name:'Звёзды',            desc:'Telegram Stars на ваш аккаунт',  del:'По юзернейму',        icon:EVSA._svg('<path d="m12 2 3 6.5 7 .8-5.2 4.7 1.5 7L12 17.4 5.7 21l1.5-7L2 9.3l7-.8z"/>') },
  usernames: { name:'Юзернеймы',         desc:'Красивые @username и номера',    del:'Услуга через чат',    icon:EVSA._svg('<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>') },
  channels:  { name:'Каналы и группы',   desc:'Готовые каналы, группы, боты',   del:'Передача аккаунта',   icon:EVSA._svg('<path d="M3 11l18-8-8 18-2-8z"/>') },
  privileges:{ name:'Привилегии на серверах', desc:'Донат и ранги на серверах', del:'По ID игрока',        icon:EVSA._svg('<rect x="3" y="3" width="18" height="7" rx="1.5"/><rect x="3" y="14" width="18" height="7" rx="1.5"/><path d="M7 6.5h.01M7 17.5h.01"/>') },
  promo:     { name:'Промоакции',        desc:'Промокоды и подарочные коды',    del:'Код / ключ',          icon:EVSA._svg('<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>') },
  design:    { name:'Дизайн',            desc:'Аватарки, баннеры, превью',      del:'Файл',                icon:EVSA._svg('<path d="M12 19l7-7 3 3-7 7zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18zM2 2l7.6 7.6"/><circle cx="11" cy="11" r="2"/>') },
  services:  { name:'Услуги',            desc:'Помощь, настройка, обучение',    del:'Услуга через чат',    icon:EVSA._svg('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 13h5"/>') },
  other:     { name:'Другое',            desc:'Всё, что не подошло выше',       del:'Услуга через чат',    icon:EVSA._svg('<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>') }
};

EVSA.CATS = {
  /* ---- игры ---- */
  minecraft:   [['donate','Майнкоины','Minecoins для Marketplace'], ['accounts','Аккаунты','Лицензия Java / Bedrock'], ['keys','Ключи и лицензии','Коды активации Minecraft'],
                ['privileges','Донат на серверах','Привилегии, ранги, валюта серверов'], ['design','Скины, моды, карты','Скины, ресурспаки и сборки'], ['services','Постройки и услуги','Строительство, настройка серверов']],
  roblox:      [['donate','Робуксы','Robux на ваш аккаунт','Вход в аккаунт'], ['limiteds','Лимитки и предметы','Лимитки и UGC из каталога'], ['items','Предметы в режимах','Adopt Me, Blox Fruits, MM2, Pet Sim и др.'],
                'accounts', ['premium','Roblox Premium','Подписка Premium','Вход в аккаунт'], ['boost','Прокачка в режимах','Уровни, фарм, прохождение'], ['keys','Подарочные карты','Коды Roblox Gift Card']],
  brawlstars:  [['donate','Гемы','Гемы по Supercell ID','Вход в аккаунт'], ['pass','Brawl Pass','Brawl Pass и Brawl Pass Plus','Вход в аккаунт'], 'accounts',
                ['boost','Буст кубков','Апнуть кубки и ранги'], ['skins','Скины и акции','Скины, наборы, акции магазина','Вход в аккаунт']],
  standoff2:   [['donate','Голда','Голда на ваш аккаунт'], ['skins','Скины и ножи','Скины, ножи, перчатки'], 'accounts', ['boost','Буст ранга','Калибровка и поднятие ранга']],
  pubgm:       [['donate','UC','Unknown Cash по ID'], ['pass','Royale Pass','Royale Pass и Elite Pass'], 'accounts', ['boost','Буст ранга','Завоеватель, ранги, достижения'], ['skins','Скины и наборы','Костюмы, скины оружия','Вход в аккаунт']],
  fortnite:    [['donate','V-Bucks','В-баксы на аккаунт','Вход в аккаунт'], ['pass','Боевой пропуск','Battle Pass и Fortnite Crew','Вход в аккаунт'], ['skins','Скины и наборы','Скины, эмоции, наборы','Подарком'],
                'accounts', ['keys','Коды и наборы','Коды V-Bucks и наборов'], ['boost','Прокачка уровня','Уровни и испытания']],
  cs2:         [['skins','Скины','Оружие, ножи, перчатки'], ['items','Кейсы и стикеры','Кейсы, капсулы, стикеры, агенты'], ['accounts','Аккаунты','Prime-аккаунты, аккаунты с рангом'],
                ['premium','Prime-статус','Prime Status Upgrade','Подарком'], ['boost','Буст рейтинга','Premier, звания, калибровка'], ['services','Обучение','Тренировки и разбор демок']],
  dota2:       [['items','Предметы','Сеты, арканы, курьеры'], 'accounts', ['boost','Буст MMR','Поднятие MMR и калибровка'], ['premium','Dota Plus','Подписка Dota Plus','Подарком'], ['services','Обучение','Тренировки и разбор игр']],
  genshin:     [['donate','Кристаллы','Кристаллы Сотворения','Вход в аккаунт'], ['premium','Благословение луны','Благословение полой луны','Вход в аккаунт'], ['pass','Боевой пропуск','Гнозис / боевой пропуск','Вход в аккаунт'],
                'accounts', ['boost','Прокачка и фарм','Фарм, исследование, бездна']],
  freefire:    [['donate','Алмазы','Алмазы по ID игрока'], ['pass','Booyah Pass','Пропуск сезона'], 'accounts', ['boost','Буст ранга','Поднятие ранга']],
  clashroyale: [['donate','Гемы','Гемы по Supercell ID','Вход в аккаунт'], ['pass','Pass Royale','Pass Royale и Diamond Pass','Вход в аккаунт'], 'accounts', ['boost','Буст кубков','Кубки, лиги, испытания']],
  clashofclans:[['donate','Гемы','Гемы по Supercell ID','Вход в аккаунт'], ['pass','Золотой пропуск','Gold Pass','Вход в аккаунт'], 'accounts', ['boost','Прокачка деревни','Фарм, стройки, лига кубков']],
  gta5:        [['donate','Деньги GTA Online','Shark Cards и пополнение','Вход в аккаунт'], ['privileges','Валюта RP-серверов','Вирты и донат на RP-серверах (GTA5RP, Majestic и др.)'], 'accounts',
                ['keys','Ключи игры','GTA V для ПК и консолей'], ['boost','Прокачка','Уровень, RP, ограбления']],
  valorant:    [['donate','Valorant Points','VP на аккаунт','Вход в аккаунт'], 'accounts', ['boost','Буст ранга','Поднятие ранга и калибровка'], ['services','Обучение','Тренировки с опытным игроком']],
  codm:        [['donate','CP','COD Points на аккаунт','Вход в аккаунт'], ['pass','Боевой пропуск','Battle Pass сезона','Вход в аккаунт'], 'accounts', ['boost','Буст ранга','Легенда, ранги, камуфляжи']],
  mlbb:        [['donate','Алмазы','Алмазы по ID и серверу'], ['pass','Алмазный пропуск','Weekly Diamond Pass и Starlight'], 'accounts', ['boost','Буст ранга','Мифик и выше']],
  hsr:         [['donate','Кристаллы','Сверхсущий нефрит / осколки','Вход в аккаунт'], ['premium','Пропуск снабжения','Пропуск снабжения экспресса','Вход в аккаунт'], ['pass','Боевой пропуск','Безымянная слава','Вход в аккаунт'],
                'accounts', ['boost','Прокачка и фарм','Фарм, Виртуальная вселенная']],
  rust:        [['skins','Скины','Скины предметов Steam','Трейд / передача в игре'], 'accounts', ['keys','Ключи игры','Rust для Steam'], ['privileges','Привилегии на серверах','VIP и наборы на серверах'], ['services','Услуги','Помощь в рейдах и застройке']],
  apex:        [['donate','Apex Coins','Монеты на аккаунт','Вход в аккаунт'], ['pass','Боевой пропуск','Battle Pass сезона','Вход в аккаунт'], 'accounts', ['boost','Буст ранга','Ранги, значки, 4k/20 бомб']],
  wot:         [['donate','Золото','Золото на аккаунт','Вход в аккаунт'], ['premium','Премиум-аккаунт','Премиум на дни','Вход в аккаунт'], 'accounts',
                ['promo','Бонус-коды и инвайты','Коды с танками и золотом'], ['boost','Прокачка','Отметки, статистика, ЛБЗ']],
  amongus:     [['donate','Звёзды','Звёзды и бобы','Вход в аккаунт'], ['skins','Косметика','Шляпы, питомцы, наборы','Вход в аккаунт'], 'accounts', ['keys','Ключи игры','Among Us для ПК']],
  stumble:     [['donate','Гемы','Гемы на аккаунт','Вход в аккаунт'], ['pass','Stumble Pass','Пропуск сезона','Вход в аккаунт'], ['skins','Скины и эмоции','Скины, эмоции, анимации','Вход в аккаунт'], 'accounts'],
  /* ---- сайты и сервисы ---- */
  telegram:    [['stars','Звёзды','Telegram Stars по юзернейму'], ['premium','Telegram Premium','Подписка Premium на 3–12 мес.','Подарком'], ['gifts','Подарки и NFT','Подарки и коллекционные NFT','Подарком'],
                ['usernames','Юзернеймы и номера','@username и анонимные номера'], ['channels','Каналы и группы','Готовые каналы, чаты и боты'], 'accounts'],
  steam:       [['topup','Пополнение','Пополнение кошелька Steam','По юзернейму'], ['keys','Ключи игр','Ключи активации игр'], 'accounts', ['gifts','Гифты','Игры подарком на аккаунт'], ['items','Предметы и карточки','Карточки, фоны, предметы инвентаря']],
  discord:     [['subs','Nitro','Discord Nitro и Nitro Basic','Подарком'], ['boost','Буст сервера','Бусты сервера Discord','Услуга через чат'], 'accounts', ['design','Оформление','Аватарки, баннеры, эмодзи'], ['services','Боты и настройка','Настройка серверов и ботов']],
  youtube:     [['subs','YouTube Premium','Подписка Premium / Music'], ['accounts','Каналы','Готовые каналы и аккаунты'], ['design','Оформление','Превью, шапки, аватарки']],
  spotify:     [['subs','Spotify Premium','Индивидуальная, Duo, Family'], 'accounts', ['keys','Подарочные карты','Коды Spotify Premium']],
  psstore:     [['topup','Пополнение и карты','Карты пополнения PSN'], ['subs','PS Plus','Essential, Extra, Deluxe'], ['keys','Игры','Игры и DLC на аккаунт','Вход в аккаунт'], 'accounts'],
  xbox:        [['subs','Game Pass','Game Pass Ultimate / PC / Core'], ['keys','Игры и ключи','Ключи игр Xbox / PC'], ['topup','Карты пополнения','Подарочные карты Xbox'], 'accounts'],
  epic:        [['keys','Ключи игр','Игры и DLC'], ['accounts','Аккаунты','Аккаунты с играми'], ['topup','Пополнение','Подарочные карты Epic Games']],
  chatgpt:     [['subs','ChatGPT Plus / Pro','Подписка на ваш аккаунт'], ['accounts','Аккаунты','Готовые аккаунты с подпиской'], ['keys','Доступ к API','API-ключи и баланс'], ['services','Помощь и промпты','Настройка, промпты, GPTs']],
  twitch:      [['subs','Подписки и Turbo','Подписки на каналы, Twitch Turbo','Подарком'], ['donate','Bits','Bits на аккаунт','Вход в аккаунт'], ['accounts','Каналы','Каналы и аккаунты'], ['design','Оформление','Оверлеи, панели, эмоуты']],
  netflix:     [['subs','Подписка','Подписка Netflix'], ['accounts','Аккаунты и профили','Аккаунты и места в профиле'], ['keys','Подарочные карты','Gift Card Netflix']],
  nintendo:    [['topup','Карты пополнения','Пополнение eShop'], ['subs','Nintendo Switch Online','Подписка NSO и Expansion Pack'], ['keys','Игры и ключи','Коды игр и DLC'], 'accounts'],
  vk:          [['subs','Подписка','VK Музыка / VK Combo'], 'accounts', ['promo','Промокоды','Коды на подписку']],
  faceit:      [['subs','FACEIT Premium','Подписка Premium'], 'accounts', ['boost','Буст ELO','Поднятие уровня и ELO'], ['services','Обучение','Тренировки и разбор демок']]
};

/* Совместимость: общий список видов (для старого кода и подписи категорий без игры) */
EVSA.CATEGORIES = Object.keys(EVSA.CAT_DEFS).map(function (id) { var d = EVSA.CAT_DEFS[id]; return { id: id, name: d.name, desc: d.desc, icon: d.icon, del: d.del }; });

EVSA.TICKET_CATEGORIES = ['Жалоба на продавца','Жалоба на покупателя','Проблема с покупкой','Проблема с пополнением','Проблема с выводом','Другое'];

/* Примерный курс Telegram Stars → ₽. В рабочей версии курс отдаёт сервер. */
EVSA.STAR_RATE_RUB = 1.79;
EVSA.PREMIUM_PRICE = 19;
EVSA.WITHDRAW_MIN = 50;
/* Комиссия площадки. Настоящая ставка хранится в БД (platform_settings.commission_rate) и подгружается в db.js. */
EVSA.COMMISSION = 0.10;
EVSA.commissionPct = function () { return Math.round(EVSA.COMMISSION * 10000) / 100; };
/* Сколько получит продавец: цена − комиссия, округление вниз до копеек (как в order_confirm). */
EVSA.sellerPayout = function (price) { return Math.floor(Math.round(Number(price || 0) * (1 - EVSA.COMMISSION) * 1e6) / 1e4) / 100; };
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
/* Категории конкретной игры / сайта: [{id,name,desc,icon,del}], «Другое» — последним */
EVSA.catsFor = function (t) {
  if (!t) return [];
  if (t._cats) return t._cats;
  var seen = {}, list = (EVSA.CATS[t.id] || ['accounts']).map(function (e) {
    var a = typeof e === 'string' ? [e] : e, d = EVSA.CAT_DEFS[a[0]];
    if (!d || seen[a[0]]) return null; seen[a[0]] = 1;
    return { id: a[0], name: a[1] || d.name, desc: a[2] || d.desc, icon: d.icon, del: a[3] || d.del };
  }).filter(Boolean).filter(function (c) { return c.id !== 'other'; });
  /* «Дизайн» (аватарки, баннеры, превью) есть у каждой игры и сайта — перед «Другое» */
  if (!seen.design) { var dz = EVSA.CAT_DEFS.design; list.push({ id: 'design', name: dz.name, desc: dz.desc, icon: dz.icon, del: dz.del }); }
  list.push({ id: 'other', name: 'Другое', desc: 'Всё остальное по «' + t.name + '»', icon: EVSA.CAT_DEFS.other.icon, del: EVSA.CAT_DEFS.other.del });
  return (t._cats = list);
};
/* Категория в контексте игры (с её названием); если у игры такой нет — общий вид из справочника */
EVSA.catFor = function (t, id, strict) {
  var c = EVSA.catsFor(t).find(function (x) { return x.id === id; });
  if (c || strict) return c || null;
  var d = EVSA.CAT_DEFS[id];
  return d ? { id: id, name: d.name, desc: d.desc, icon: d.icon, del: d.del } : null;
};
EVSA.catName = function (id, t) {
  if (t && typeof t === 'object') { var c = EVSA.catFor(t, id); if (c) return c.name; }
  var d = EVSA.CAT_DEFS[id]; return d ? d.name : (id || '');
};
EVSA.catDelivery = function (id, t) { var c = t ? EVSA.catFor(t, id) : EVSA.CAT_DEFS[id]; return (c && c.del) || 'Услуга через чат'; };

/* Способы получения товара */
EVSA.DELIVERY = ['Вход в аккаунт', 'По ID игрока', 'По юзернейму', 'Передача аккаунта', 'Трейд / передача в игре', 'Подарком', 'Код / ключ', 'Файл', 'Услуга через чат'];
EVSA.DELIVERY_BY_CAT = {}; Object.keys(EVSA.CAT_DEFS).forEach(function (k) { EVSA.DELIVERY_BY_CAT[k] = EVSA.CAT_DEFS[k].del; });

/* Промо-баннеры для карусели на главной */
EVSA.BANNERS = [
  { title: 'Безопасные сделки', text: 'Деньги продавцу — только после того, как вы подтвердите получение товара.', cta: 'Как это работает', href: '#/guarantee', c1: '#7c3aed', c2: '#0b0b12' },
  { title: 'Продавайте на EVSA SHOP', text: 'Выставьте товар бесплатно — его сразу увидят все покупатели. Premium-размещение скоро.', cta: 'Продать товар', href: '#/sell', c1: '#0891b2', c2: '#06070a' },
  { title: 'Самые дешёвые товары в EVSA SHOP', text: 'Все предложения площадки от самых недорогих — выбирайте выгодно.', cta: 'Смотреть дешёвые', href: '#/cheap', c1: '#16a34a', c2: '#04100a' },
  { title: 'Все игры и сервисы в одном месте', text: EVSA.GAMES.length + ' игр и ' + EVSA.SITES.length + ' сайтов и приложений: валюта, аккаунты, подписки, ключи и не только.', cta: 'Открыть каталог', href: '#/games', c1: '#7c3aed', c2: '#0a0614' }
];

/* Пополнение звёздами Telegram: рубли → звёзды со скидкой 20% (как на сервере: round(rub*0.8), минимум 1).
   MIN/MAX должны совпадать с миграцией stars_topup, Edge Function create-stars-invoice и bot.py. */
EVSA.TOPUP = { BOT: 'EVSA_SHOP_bot', MIN: 10, MAX: 12500, DISCOUNT: 0.2 };
/* вывод: вручную, подарком за звёзды в Telegram; курс тот же, что у пополнения */
EVSA.WITHDRAW = { MIN: 50, MAX: 1000000 };
EVSA.topupStars = function (rub) { return Math.max(1, Math.round(Number(rub) * (1 - EVSA.TOPUP.DISCOUNT))); };
EVSA.topupLink = function (rub) { return 'https://t.me/' + EVSA.TOPUP.BOT + '?start=topup_' + Math.floor(Number(rub)); };
