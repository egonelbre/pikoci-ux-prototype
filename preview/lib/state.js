// View state: one registry instead of a dozen loose globals.
//
// Before this, every filter and chip row was a module-scoped `let` plus a
// hand-written `window._chgF = v => { chgFilter = v; refresh(); }` — twelve of
// them, invisible to each other, with no way to list what the UI was holding
// or to reset it.
//
//   const filter = PK.state.use('changes.filter', '');
//   filter.get();  filter.set('flaky');   // set() re-renders
//
// Views bind to it declaratively and never write a handler:
//
//   <input data-state="changes.filter" value="…">
//   <button data-state="changes.chip" data-value="failing">
//   <input type="checkbox" data-state="changes.bots">
//
// define() is for state that already lives somewhere else and has its own
// setter — the team scope, which toasts and is read from app.session.
(function (PK) {
  'use strict';

  const store = new Map();
  const custom = new Map();

  function use(key, initial) {
    if (!store.has(key) && !custom.has(key)) store.set(key, initial);
    return {
      get: () => get(key),
      set: v => set(key, v),
      toggle: () => set(key, !get(key)),
    };
  }

  // state that is owned elsewhere: give the registry a way to read and write it
  function define(key, o) { custom.set(key, o); return use(key); }

  const get = key => custom.has(key) ? custom.get(key).get() : store.get(key);
  function set(key, v) {
    if (custom.has(key)) return custom.get(key).set(v);
    if (store.get(key) === v) return;
    store.set(key, v);
    PK.app.refresh();
  }

  const valueOf = el =>
    el.type === 'checkbox' ? el.checked
      : el.hasAttribute('data-value') ? el.getAttribute('data-value')
        : el.value;

  // Text inputs fire on every keystroke; everything else on change or click.
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-state]');
    if (!el || el.tagName !== 'INPUT' || el.type === 'checkbox') return;
    set(el.getAttribute('data-state'), valueOf(el));
  });

  document.addEventListener('change', e => {
    const el = e.target.closest('[data-state]');
    if (!el || !['SELECT', 'INPUT'].includes(el.tagName)) return;
    if (el.tagName === 'INPUT' && el.type !== 'checkbox') return; // handled above
    set(el.getAttribute('data-state'), valueOf(el));
  });

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-state]');
    if (!el || ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
    set(el.getAttribute('data-state'), valueOf(el));
  });

  // everything the UI is currently holding, for the console
  const dump = () => {
    const o = {};
    for (const k of store.keys()) o[k] = store.get(k);
    for (const k of custom.keys()) o[k] = custom.get(k).get();
    return o;
  };

  PK.state = { use, define, get, set, dump };
})(window.PK);
