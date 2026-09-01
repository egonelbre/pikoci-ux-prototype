// The keyboard layer: Cmd/Ctrl-K palette, / to focus a filter, f to step
// through errors, Escape to dismiss a reason popover.
(function (PK) {
  'use strict';
  const { esc } = PK.fmt;
  const { st } = PK.status;
  const { pipelines, primaryStatus } = PK.model;
  const ACT = PK.act;
  const D = () => window.DATA;

  function paletteItems() {
    const items = [];
    for (const b of D().builds.filter(b => b.status === 'waiting_for_approval'))
      items.push({ label: `⧖ Approve ${b.pipeline}/${b.job} #${b.n}`, kind: 'action', run: () => ACT.approve(b.id) });
    for (const b of D().builds.filter(b => b.heldReason))
      items.push({ label: `▶ Release held PR build (${b.pipeline} #${b.n})`, kind: 'action', run: () => ACT.release(b.id) });
    for (const pl of pipelines()) items.push({ label: `${st(primaryStatus(pl)).sym} ${pl.team}/${pl.name}`, kind: 'pipeline', run: () => location.hash = '#/p/' + pl.name + '/graph' });
    for (const l of D().lineages) items.push({ label: `PR #${l.n} ${l.title}`, kind: 'change', run: () => location.hash = '#/changes/pr/' + l.n });
    items.push({ label: '🌍 Environments', kind: 'page', run: () => location.hash = '#/environments' });
    items.push({ label: '⏳ Queue', kind: 'page', run: () => location.hash = '#/queue' });
    items.push({ label: '⚙ Workers', kind: 'page', run: () => location.hash = '#/workers' });
    items.push({ label: '☰ Audit', kind: 'page', run: () => location.hash = '#/audit' });
    return items;
  }
  const Pal = { open: false, q: '', sel: 0 };
  function renderPalette() {
    let el = document.getElementById('palette');
    if (!el) { el = document.createElement('div'); el.id = 'palette'; document.body.appendChild(el); }
    const app = ['hdr', 'main'].map(id => document.getElementById(id));
    if (!Pal.open) {
      el.innerHTML = '';
      app.forEach(x => x && x.removeAttribute('inert'));
      // hand focus back to where ⌘K makes sense to return
      const back = document.querySelector('[data-palette-btn]');
      if (Pal._hadFocus && back) back.focus({ preventScroll: true });
      Pal._hadFocus = false;
      return;
    }
    Pal._hadFocus = true;
    app.forEach(x => x && x.setAttribute('inert', '')); // contain focus in the dialog
    const q = Pal.q.toLowerCase();
    const items = paletteItems().filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 9);
    if (Pal.sel >= items.length) Pal.sel = Math.max(0, items.length - 1);
    el.innerHTML = `<div class="pal-back"><div class="pal-box" role="dialog" aria-modal="true" aria-label="command palette">
      <input id="palin" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant="pal-${Pal.sel}"
        placeholder="Jump to pipeline / change, or run an action…" value="${esc(Pal.q)}" aria-label="search commands">
      <div id="pal-list" role="listbox" aria-label="results">
      ${items.map((it, i) => `<div class="pal-row ${i === Pal.sel ? 'sel' : ''}" id="pal-${i}" role="option" aria-selected="${i === Pal.sel}" data-pal="${i}">${esc(it.label)}<span class="pal-k">${it.kind}</span></div>`).join('')}
      ${!items.length ? '<div class="pal-row mut">no matches</div>' : ''}
      </div>
    </div></div>`;
    el.querySelector('.pal-back').onclick = ev => { if (ev.target.classList.contains('pal-back')) { Pal.open = false; renderPalette(); } };
    el.querySelectorAll('[data-pal]').forEach(r => r.onclick = () => { const it = items[+r.getAttribute('data-pal')]; Pal.open = false; renderPalette(); it && it.run(); });
    const inp = el.querySelector('#palin');
    inp.oninput = () => { Pal.q = inp.value; Pal.sel = 0; renderPalette(); };
    inp.onkeydown = ev => {
      if (ev.key === 'ArrowDown') { Pal.sel++; renderPalette(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { Pal.sel = Math.max(0, Pal.sel - 1); renderPalette(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { const it = items[Pal.sel]; Pal.open = false; renderPalette(); it && it.run(); }
      else if (ev.key === 'Escape') { Pal.open = false; renderPalette(); }
    };
    inp.focus(); inp.setSelectionRange(999, 999);
  }
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { Pal.open = !Pal.open; Pal.q = ''; renderPalette(); e.preventDefault(); return; }
    if (Pal.open || ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === 'Escape') { // dismiss open reason popovers
      document.querySelectorAll('.reason-detail:not([hidden])').forEach(p => {
        p.hidden = true;
        const btn = p.previousElementSibling;
        if (btn && btn.setAttribute) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
    }
    if (e.key === '/') { const f = document.querySelector('[data-filter]'); if (f) { f.focus(); e.preventDefault(); } }
    if (e.key === 'f') {
      const errs = [...document.querySelectorAll('.l-err')];
      if (!errs.length) return;
      window.__fi = ((window.__fi ?? -1) + 1) % errs.length;
      errs[window.__fi].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  Pal.render = renderPalette;
  PK.pal = Pal;
})(window.PK = window.PK || {});
