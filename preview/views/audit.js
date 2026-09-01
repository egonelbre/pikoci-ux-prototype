// The audit log, team-scoped like the backend endpoint it stands in for.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const D = () => window.DATA;

  VIEWS.audit = function () {
    // audit is team-scoped in the backend too (per-team audit log endpoint)
    const rows = D().audit.filter(a => !PK.model.team() || a.target.startsWith(PK.model.team() + '/'));
    return `<div class="page"><h1>Audit${PK.model.team() ? ` <span class="mut small">· team ${esc(PK.model.team())}</span>` : ''}</h1>
      ${rows.length ? '' : `<div class="mut pad">No recorded actions for team ${esc(PK.model.team())} in the demo window.</div>`}
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>when</th><th>who</th><th>action</th><th>target</th><th>detail</th></tr></thead>
      ${rows.map(a => `<tr><td class="mut small nowrap">${ago(a.at)}</td><td class="nowrap"><b>${esc(a.user)}</b></td>
        <td class="nowrap"><code>${esc(a.action)}</code></td><td class="nowrap">${esc(a.target)}</td><td class="mut small">${esc(a.detail)}</td></tr>`).join('')}</table></div>
      <p class="mut small">Every action in the preview writes here — approvals record what they were bound to; holds, releases, supersessions, pins and pauses carry actor + reason.</p></div>`;
  };
})(window.PK);
