/* Ненавязчивые звуки через Web Audio API (без файлов). */
'use strict';
(function () {
  var ctx = null;
  function ac() {
    if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type, vol, delay) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (delay || 0);
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  EVSA.sound = {
    enabled: function () { return EVSA.settings && EVSA.settings.get().sound; },
    click: function () { if (this.enabled()) tone(620, 0.06, 'sine', 0.03); },
    success: function () { if (this.enabled()) { tone(660, 0.12, 'sine', 0.045); tone(990, 0.18, 'sine', 0.04, 0.09); } },
    error: function () { if (this.enabled()) { tone(240, 0.14, 'triangle', 0.04); } },
    message: function () { if (this.enabled()) { tone(880, 0.09, 'sine', 0.035); tone(1175, 0.12, 'sine', 0.03, 0.08); } },
    theme: function () { if (this.enabled()) tone(440, 0.2, 'sine', 0.03); }
  };
})();
