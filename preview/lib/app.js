// Session state, the router, and the re-render that has to survive it.
//
// Live pages tick every 2-5s and each tick rebuilds the page from strings, so
// refresh() carries the user's work across the rebuild: scroll positions,
// folded panes, open <details>, and the identity of the focused element.
// Everything here is DOM-only — no domain knowledge, which is why the model
// tier can depend on it.
(function (PK) {
  'use strict';
  const toast = PK.toast;

  // ---------- router / app --------------------------------------------------
  const App = {
    _render: null,
    session: { snoozed: new Set(), opsPinned: false, team: '' },
    route() { const h = location.hash.replace(/^#\/?/, ''); return h ? h.split('/').map(decodeURIComponent) : []; },
    refresh() {
      if (!App._render) return;
      // live ticks re-render the whole page — carry the user's UI state across:
      // scroll positions, folded/expanded panes, open <details>, filter focus.
      const saves = [];
      document.querySelectorAll('[data-keep-scroll]').forEach(el => { if (el.id) saves.push([el.id, el.scrollTop]); });
      // table scroll containers: keep horizontal position by index (stable within a view)
      const tblX = [...document.querySelectorAll('.tbl-scroll')].map(el => el.scrollLeft);
      const folds = {};
      document.querySelectorAll('[data-fold]').forEach(el => { folds[el.getAttribute('data-fold')] = el.hidden; });
      const dets = {};
      document.querySelectorAll('details[data-det]').forEach(el => { dets[el.getAttribute('data-det')] = el.open; });
      // focus identity survives the innerHTML rebuild: match by data-filter,
      // then data-act(+arg), then id, then href (a11y: live pages tick every 2–5s)
      const ae = document.activeElement;
      let aeSel = null, refocus = false;
      if (ae && ae !== document.body) {
        if (ae.hasAttribute && ae.hasAttribute('data-filter')) refocus = true;
        else if (ae.dataset && ae.dataset.act) aeSel = `[data-act="${ae.dataset.act}"]` + (ae.dataset.arg ? `[data-arg="${(window.CSS && CSS.escape ? CSS.escape(ae.dataset.arg) : ae.dataset.arg)}"]` : '');
        else if (ae.id) aeSel = '#' + (window.CSS && CSS.escape ? CSS.escape(ae.id) : ae.id);
        else if (ae.getAttribute && ae.getAttribute('href')) aeSel = `a[href="${ae.getAttribute('href')}"]`;
      }
      const wy = window.scrollY;
      App._render(App.route());
      if (aeSel) { try { const el = document.querySelector(aeSel); if (el) el.focus({ preventScroll: true }); } catch (e) { /* selector edge */ } }
      document.querySelectorAll('[data-fold]').forEach(el => {
        const k = el.getAttribute('data-fold');
        if (k in folds) {
          el.hidden = folds[k];
          const btn = el.previousElementSibling;
          if (btn && btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', String(!el.hidden));
        }
      });
      document.querySelectorAll('details[data-det]').forEach(el => {
        const k = el.getAttribute('data-det');
        if (k in dets) el.open = dets[k];
      });
      if (refocus) { const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
      for (const [id, t] of saves) { const el = document.getElementById(id); if (el) el.scrollTop = t; }
      [...document.querySelectorAll('.tbl-scroll')].forEach((el, i) => { if (tblX[i]) el.scrollLeft = tblX[i]; });
      window.scrollTo(0, wy);
      document.querySelectorAll('[data-follow]').forEach(el => { el.scrollTop = el.scrollHeight; });
    },
    start(render) {
      App._render = render;
      window.addEventListener('hashchange', () => {
        App.refresh();
        // announce navigation: title + move focus into the new view (SR users)
        const h = location.hash.replace(/^#\/?/, '');
        document.title = 'PikoCI — ' + (h ? h.split('/').slice(0, 2).join(' / ') : 'home');
        const m = document.getElementById('main');
        if (m) { m.tabIndex = -1; m.focus({ preventScroll: true }); }
      });
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.setAttribute('data-theme', 'dark');
      App.refresh();
      PK.live.start();
      setInterval(() => { if (document.querySelector('[data-live]')) App.refresh(); }, 5000);
    },
  };

  function setTeam(t) {
    App.session.team = t;
    toast(t ? 'Showing team ' + t + ' only' : 'Showing all teams', 'info');
    App.refresh();
  }

  PK.app = App;
  PK.app.setTeam = setTeam;
})(window.PK = window.PK || {});
