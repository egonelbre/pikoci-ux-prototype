// The small status vocabulary rendered: a reason chip that opens a popover
// (so rows keep their shape), and the per-job dot in its three states —
// a build, a decision record, or nothing at all.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc } = PK.fmt;
  const { st, reasonLabel } = PK.status;

  // ---------- reason chip (focusable, two families) -------------------------
  VIEWS.reasonChip = function (d, ctx) {
    const id = 'r-' + Math.random().toString(36).slice(2, 8);
    const key = 'rsn:' + [d.pipeline, d.job, d.ref, d.code, ctx || ''].join('|');
    const fam = PK.status.REASON[d.code] ? PK.status.REASON[d.code].family : 'waiting';
    return `<span class="reason-wrap"><button class="reason ${fam}" aria-expanded="false" aria-controls="${id}"
      aria-label="${esc(reasonLabel(d))}"
      data-toggle="${id}"
      title="${esc(reasonLabel(d))}">${fam === 'waiting' ? '…' : '∅'}</button>
      <span id="${id}" hidden data-fold="${esc(key)}" class="reason-detail"><b>${esc(reasonLabel(d))}</b> — ${esc(d.text)}${ctx ? ' · ' + esc(ctx) : ''}</span></span>`;
  };

  // per-job dot for a (pipeline, job, ref) cell
  VIEWS.jobDot = function (pl, job, ref) {
    const c = PK.model.jobCell(pl, job, ref);
    if (c.kind === 'build') {
      const s = c.status;
      return `<a class="dot ${s === 'started' ? 'pulse' : ''}" href="#/b/${c.build.id}"
        title="${esc(job)}: ${st(s).label}" style="background:${st(s).color}">${st(s).sym}</a>`;
    }
    if (c.kind === 'decision') return `<span class="dot none" title="${esc(job)}">${VIEWS.reasonChip(c.decision, job)}</span>`;
    return `<span class="dot none" title="${esc(job)}: no build">·</span>`;
  };
  VIEWS.dotStatic = function (status, job) {
    if (status === 'none') return `<span class="dot sm none" title="${esc(job)}">·</span>`;
    return `<span class="dot sm ${status === 'started' ? 'pulse' : ''}" title="${esc(job)}: ${st(status).label}" style="background:${st(status).color}">${st(status).sym}</span>`;
  };
})(window.PK);
