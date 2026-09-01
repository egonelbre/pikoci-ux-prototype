// Declarative navigation: `data-nav="#/somewhere"` on any element.
//
// This replaces onclick="location.hash='…'" on table rows. That pattern needs
// every link and button inside the row to call event.stopPropagation(), or the
// row swallows the click — and the one time a stopPropagation() was added to
// the wrong place, queue Cancel and worker drain both went dead. So the rule
// lives here instead of at every call site: a click that STARTED inside
// something interactive is that thing's click, not the row's.
(function (PK) {
  'use strict';

  const INTERACTIVE = 'a, button, input, select, textarea, label, [data-act], [data-state], [contenteditable]';

  document.addEventListener('click', e => {
    const nav = e.target.closest('[data-nav]');
    if (!nav) return;
    // did the click begin in something that handles its own clicks, within
    // this row? if so, leave it alone
    const inner = e.target.closest(INTERACTIVE);
    if (inner && nav.contains(inner) && inner !== nav) return;
    const to = nav.getAttribute('data-nav');
    if (to) location.hash = to;
  });

  // Keyboard parity: a row is not focusable, but every row that navigates also
  // carries a real <a> to the same place (see the views), which is the
  // keyboard path. This listener only handles the pointer.

  // Nothing is exported: PK.nav already means the nav-bar items (see
  // model/capability.js). This file installs a listener and gets out of the way.
  void PK; void INTERACTIVE;
})(window.PK);
