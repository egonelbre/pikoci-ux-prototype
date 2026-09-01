// The page shell: logo, team scope, capability-gated nav, attention badge.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc } = PK.fmt;
  const D = () => window.DATA;

  // ---------- shell ---------------------------------------------------------
  window.VIEWS = window.VIEWS || {};
  VIEWS.shell = function (route) {
    const sec = route[0] || 'home';
    const items = PK.nav.navItems();
    const attn = PK.attention();
    const active = id => (sec === id || (id === 'home' && !route[0]) || (id === 'pipelines' && ['p', 'b'].includes(sec))) ? 'on' : '';
    const tsel = PK.model.team();
    return `<header>
      <a class="logo" href="#/"><img src="../logo/pikoci-logo.svg" alt="" style="height:1.15em;vertical-align:-0.2em"> PikoCI <span class="preview-tag">preview</span></a>
      <select class="team-sel" aria-label="team scope" title="team scope — filters every page (maps to the backend's team scoping)"
        onchange="PK.app.setTeam(this.value)">
        <option value="">all teams</option>
        ${D().teams.map(t => `<option value="${esc(t.name)}" ${tsel === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
      <nav aria-label="primary">
        ${items.map(i => `<a class="${active(i.id)}" href="${i.href}">${i.label}</a>`).join('')}
      </nav>
      ${attn.items.length ? `<a href="#/" class="attn-badge" title="items needing you">${attn.items.length}</a>` : ''}
      <span class="sp"></span>
      <button class="ghost" data-act="theme" title="toggle theme">◐</button>
      <button class="ghost" data-palette-btn aria-label="open command palette" onclick="document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true}))">⌘K</button>
      <a class="${sec === 'settings' ? 'on' : ''}" href="#/settings">egon ⚙</a>
    </header>`;
  };
})(window.PK);
