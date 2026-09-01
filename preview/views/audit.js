// The audit log, team-scoped like the backend endpoint it stands in for.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { dataTable } = PK.ui;
  const D = () => window.DATA;

  VIEWS.audit = function () {
    // audit is team-scoped in the backend too (per-team audit log endpoint)
    const rows = D().audit.filter(a => !PK.model.team() || a.target.startsWith(PK.model.team() + '/'));
    return `<div class="page"><h1>Audit${PK.model.team() ? ` <span class="mut small">· team ${esc(PK.model.team())}</span>` : ''}</h1>
      ${rows.length ? '' : `<div class="mut pad">No recorded actions for team ${esc(PK.model.team())} in the demo window.</div>`}
      ${dataTable({
      dense: false,
      cols: [
        { label: 'when', width: 'content', cls: 'mut small' },
        { label: 'who', width: 'content' },
        { label: 'action', width: 'content' },
        { label: 'target', width: 'content' },
        { label: 'detail', width: 'fill', cls: 'mut small' },
      ],
      rows: rows.map(a => ({ cells: [
        ago(a.at), `<b>${esc(a.user)}</b>`, `<code>${esc(a.action)}</code>`, esc(a.target), esc(a.detail),
      ] })),
    })}
      <p class="mut small">Every action in the preview writes here — approvals record what they were bound to; holds, releases, supersessions, pins and pauses carry actor + reason.</p></div>`;
  };
})(window.PK);
