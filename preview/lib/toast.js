// Transient status line. role="status" so screen readers announce it without
// stealing focus — actions report their outcome here, never in an alert().
(function (PK) {
  'use strict';

  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 5000);
  }

  PK.toast = toast;
})(window.PK = window.PK || {});
