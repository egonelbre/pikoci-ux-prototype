// Teams and their members.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc } = PK.fmt;
  const D = () => window.DATA;

  VIEWS.teams = function () {
    return `<div class="page narrow"><h1>Teams</h1>
      ${D().teams.map(t => `<section class="panel"><div class="panel-head"><b>${esc(t.name)}</b><span class="mut small">${esc(t.desc)}</span></div>
        <div class="tbl-scroll"><table class="tbl">${t.members.map(m => `<tr><td><b>${esc(m.user)}</b></td><td><span class="chip">${m.role}</span></td>
          <td class="r"><button class="btn sm" data-act="noop">change role</button></td></tr>`).join('')}</table></div></section>`).join('')}
      <p class="mut small">Denied actions elsewhere follow "why + who can help" — e.g. a write-role user sees "release needs maintain — ask egon or maria."</p></div>`;
  };
})(window.PK);
