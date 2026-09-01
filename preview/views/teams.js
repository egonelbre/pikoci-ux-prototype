// Teams and their members.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc } = PK.fmt;
  const { dataTable } = PK.ui;
  const D = () => window.DATA;

  VIEWS.teams = function () {
    return `<div class="page narrow"><h1>Teams</h1>
      ${D().teams.map(t => `<section class="panel"><div class="panel-head"><b>${esc(t.name)}</b><span class="mut small">${esc(t.desc)}</span></div>
        ${dataTable({
      dense: false,
      cols: [{ width: 'content' }, { width: 'fill' }, { width: 'action' }],
      rows: t.members.map(m => ({ cells: [
        `<b>${esc(m.user)}</b>`, `<span class="chip">${m.role}</span>`,
        '<button class="btn sm" data-act="noop">change role</button>',
      ] })),
    })}</section>`).join('')}
      <p class="mut small">Denied actions elsewhere follow "why + who can help" — e.g. a write-role user sees "release needs maintain — ask egon or maria."</p></div>`;
  };
})(window.PK);
