/* EVSA SHOP — доставка обращений в поддержку (ntfy.sh, без секретов в коде) */
(function () {
  var ENDPOINT = 'https://ntfy.sh/evsa-support-add6ef5ad50dc4359ba8c6f4';
  var COOLDOWN_MS = 30000, KEY = 'evsa_support_last_sent';
  function cut(s, n) { return String(s == null ? '' : s).trim().slice(0, n); }
  function rid() { return 'ES-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  EVSA.remoteSupport = {
    MAX_TEXT: 1500,
    cooldownLeft: function () { var t = +localStorage.getItem(KEY) || 0; return Math.max(0, COOLDOWN_MS - (Date.now() - t)); },
    send: function (data) {
      var left = this.cooldownLeft();
      if (left > 0) return Promise.reject({ userMessage: 'Подождите ' + Math.ceil(left / 1000) + ' с перед следующим обращением' });
      var t = { type: 'evsa_ticket', ticketId: rid(), category: cut(data.category, 60), text: cut(data.text, this.MAX_TEXT),
        name: cut(data.name, 40), username: cut(data.username, 33), localTicketId: cut(data.localTicketId, 40),
        sentAt: new Date().toISOString(), page: cut(location.href, 200), ua: cut(navigator.userAgent, 160) };
      if (t.text.length < 2) return Promise.reject({ userMessage: 'Напишите сообщение' });
      localStorage.setItem(KEY, String(Date.now()));
      return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(t) }).then(function (r) {
        if (!r.ok) throw { userMessage: 'Сервер поддержки ответил ошибкой (' + r.status + '). Попробуйте позже.' };
        return t;
      }, function () { localStorage.removeItem(KEY); throw { userMessage: 'Не удалось связаться с сервером поддержки. Проверьте интернет и попробуйте снова.' }; });
    }
  };
})();
