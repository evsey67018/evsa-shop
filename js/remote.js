/* EVSA SHOP — доставка обращений в поддержку (ntfy.sh, без секретов в коде).
   Только ES5 + XMLHttpRequest: работает в старых WebView (в т.ч. встроенный браузер Telegram). */
(function () {
  var ENDPOINT = 'https://ntfy.sh/evsa-support-add6ef5ad50dc4359ba8c6f4';
  var COOLDOWN_MS = 30000, KEY = 'evsa_support_last_sent', TIMEOUT_MS = 15000;
  function cut(s, n) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '').slice(0, n); }
  function rid() { return 'ES-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  window.EVSA = window.EVSA || {};
  EVSA.remoteSupport = {
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
        var x = new XMLHttpRequest();
        x.open('POST', ENDPOINT, true);
        x.setRequestHeader('Content-Type', 'text/plain;charset=UTF-8');
        x.timeout = TIMEOUT_MS;
        x.onreadystatechange = function () {
          if (x.readyState !== 4) return;
          if (x.status >= 200 && x.status < 300) { lsSet(KEY, String(Date.now())); return finish(null, t); }
          if (x.status === 0) return finish({ userMessage: 'Не удалось связаться с сервером поддержки. Проверьте интернет и попробуйте снова.' });
          if (x.status === 429) return finish({ userMessage: 'Слишком много обращений. Попробуйте через минуту.' });
          finish({ userMessage: 'Сервер поддержки ответил ошибкой (' + x.status + '). Попробуйте позже.' });
        };
        x.ontimeout = function () { finish({ userMessage: 'Сервер поддержки не отвечает. Попробуйте ещё раз.' }); };
        x.onerror = function () { finish({ userMessage: 'Не удалось связаться с сервером поддержки. Проверьте интернет и попробуйте снова.' }); };
        x.send(JSON.stringify(t));
      } catch (e) {
        lsDel(KEY);
        finish({ userMessage: 'Не удалось отправить обращение: ' + (e && e.message ? e.message : 'ошибка браузера') });
      }
    }
  };
})();
