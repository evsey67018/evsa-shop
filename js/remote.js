/* EVSA SHOP — доставка обращений в поддержку.
   Основной путь: таблица support_tickets в Supabase + мгновенное уведомление владельцу в Telegram (функция notify-ticket).
   Если Supabase недоступен — просим написать в Telegram (публичный ntfy.sh убран). Секретов в коде нет. */
(function () {
  var COOLDOWN_MS = 30000, KEY = 'evsa_support_last_sent', TIMEOUT_MS = 15000;
  function cut(s, n) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '').slice(0, n); }
  function rid() { return 'ES-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16)); b[6] = b[6] & 15 | 64; b[8] = b[8] & 63 | 128;
    var h = ''; for (var i = 0; i < 16; i++) h += (b[i] + 256).toString(16).slice(1);
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }
  window.EVSA = window.EVSA || {};
  EVSA.remoteSupport = {
    /* Supabase недоступен: публичный ntfy.sh больше не используем (его мог читать кто угодно) — просим написать в Telegram. */
    _ntfy: function (t, finish) {
      finish({ userMessage: 'Поддержка временно недоступна. Попробуйте позже или напишите в Telegram ' + ((window.EVSA && EVSA.SUPPORT_TG) || '@evssssa') + '.' });
    },
    MAX_TEXT: 1500,
    cooldownLeft: function () { var t = +lsGet(KEY) || 0; var left = COOLDOWN_MS - (Date.now() - t); return left > 0 && left <= COOLDOWN_MS ? left : 0; },
    /* send(data, done): done(errorOrNull, ticket). Колбэк вызывается РОВНО один раз при любом исходе. */
    send: function (data, done) {
      var called = false;
      function finish(err, t) { if (called) return; called = true; try { done(err, t); } catch (e) { if (window.console) console.error(e); } }
      try {
        var left = this.cooldownLeft();
        if (left > 0) return finish({ userMessage: 'Подождите ' + Math.ceil(left / 1000) + ' с перед следующим обращением' });
        var t = { type: 'evsa_ticket', ticketId: rid(), category: cut(data.category, 60), text: cut(data.text, this.MAX_TEXT),
          name: cut(data.name, 40), username: cut(data.username, 33), contact: cut(data.contact, 80), guest: data.guest ? 'yes' : 'no',
          localTicketId: cut(data.localTicketId, 40), sentAt: new Date().toISOString(), page: cut(location.href, 200), ua: cut(navigator.userAgent, 160) };
        if (t.text.length < 2) return finish({ userMessage: 'Напишите сообщение (минимум 2 символа)' });
        if (typeof XMLHttpRequest === 'undefined') return finish({ userMessage: 'Браузер не поддерживает отправку. Откройте сайт в Chrome или Safari.' });
        var self = this;
        var sb = window.EVSA && EVSA.sb, me = EVSA.db && EVSA.db.me && EVSA.db.me();
        if (!sb) return self._ntfy(t, finish);
        var id = uuid(); t.ticketId = 'ES-' + id.slice(0, 8).toUpperCase();
        var row = { id: id, user_id: me ? me.id : null, category: t.category || 'Другое', text: t.text, name: t.name || null, username: t.username.replace(/^@/, '') || null, contact: t.contact || null, page: t.page, ua: t.ua };
        var timer = setTimeout(function () { self._ntfy(t, finish); }, TIMEOUT_MS);
        sb.from('support_tickets').insert(row).then(function (r) {
          clearTimeout(timer); if (called) return;
          if (r.error) { if (/rate|too many|P0001/i.test((r.error.message || '') + r.error.code)) return finish({ userMessage: 'Слишком много обращений. Попробуйте через несколько минут.' }); return self._ntfy(t, finish); }
          lsSet(KEY, String(Date.now())); finish(null, t);
          sb.functions.invoke('notify-ticket', { body: { ticket_id: id } }).catch(function () {});
        }, function () { clearTimeout(timer); self._ntfy(t, finish); });
      } catch (e) {
        lsDel(KEY);
        finish({ userMessage: 'Не удалось отправить обращение: ' + (e && e.message ? e.message : 'ошибка браузера') });
      }
    }
  };
})();
