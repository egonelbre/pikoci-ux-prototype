// Formatting. No domain knowledge: give it a number or a timestamp, get a
// string. The one place HTML escaping happens.
(function (PK) {
  'use strict';

  // ---------- misc ----------------------------------------------------------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDur = sec => {
    if (sec == null) return '–';
    sec = Math.round(sec);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    return m < 60 ? m + 'm ' + (sec % 60 ? sec % 60 + 's' : '') : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  };
  const ago = ts => {
    if (!ts) return '–';
    let d = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (d < 60) return d + 's ago';
    d = Math.round(d / 60); if (d < 60) return d + 'm ago';
    d = Math.round(d / 60); if (d < 24) return d + 'h ago';
    return Math.round(d / 24) + 'd ago';
  };
  const bDur = b => b.end ? Math.max(0, b.end - b.start) / 1000 : (b.status === 'started' ? (Date.now() - b.start) / 1000 : null);
  const lastOutputAge = b => {
    if (b.status !== 'started' || !b._lastOutput) return null; // unknown ≠ stalled
    return Math.round((Date.now() - b._lastOutput) / 1000);
  };

  PK.fmt = { esc, fmtDur, ago, bDur, lastOutputAge };
})(window.PK = window.PK || {});
