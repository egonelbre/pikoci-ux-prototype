// Teaching empty states for gated-off URLs. A deep link never 404s because
// of gating — it explains what would make the page appear.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc } = PK.fmt;

  // ---------- gated-off teaching empty states -------------------------------
  VIEWS.gated = function (id) {
    const g = PK.nav.gatedEmpty[id];
    if (!g) return '<div class="page">Not found</div>';
    return `<div class="page narrow"><div class="empty">
      <h1>${esc(g[0])}</h1><p class="mut">${esc(g[1])}</p>
      <p><a href="#/">← Home</a></p>
    </div></div>`;
  };
})(window.PK);
