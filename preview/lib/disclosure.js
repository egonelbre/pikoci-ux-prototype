// Show/hide and hover-linking, declaratively.
//
//   data-open-step="<id>"     expands that step if it is folded (runs before
//                             data-scroll on the same element)
//   data-toggle="<id>"        flips that element's `hidden` and keeps
//                             aria-expanded on the button in step
//   data-toggle-next          flips the button's next sibling (used where the
//                             thing being revealed has no stable id)
//   data-reveal="<id>"        shows it (never hides) — "add a reason"
//   data-scroll="<id>"        smooth-scrolls it into view
//   data-hilite="<selector>"  while hovered, lights those elements
//
// These were five different inline onclick expressions, each re-implementing
// the same three lines. The `hidden` state itself is preserved across a live
// re-render by data-fold / data-det, which app.refresh() already handles.
(function (PK) {
  'use strict';

  const byId = id => document.getElementById(id);

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-toggle], [data-toggle-next], [data-reveal], [data-scroll], [data-open-step]');
    if (!t) return;

    // expand a collapsed step before jumping to it, or the jump lands on a
    // closed row and looks like it did nothing
    const open = t.getAttribute('data-open-step');
    if (open) {
      const step = byId(open);
      const pane = step && step.querySelector('.step-head + div');
      if (pane && pane.hidden) {
        pane.hidden = false;
        const head = step.querySelector('.step-head');
        if (head) head.setAttribute('aria-expanded', 'true');
      }
    }

    const scrollTo = t.getAttribute('data-scroll');
    if (scrollTo) {
      const el = byId(scrollTo);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const reveal = t.getAttribute('data-reveal');
    if (reveal) {
      const el = byId(reveal);
      if (el) { el.hidden = false; const i = el.querySelector('input'); if (i) i.focus(); }
      return;
    }

    const target = t.hasAttribute('data-toggle-next') ? t.nextElementSibling : byId(t.getAttribute('data-toggle'));
    if (!target) return;
    target.hidden = !target.hidden;
    if (t.hasAttribute('aria-expanded')) t.setAttribute('aria-expanded', String(!target.hidden));
  });

  // Hover linking: a table row lighting its band on the chart above it. The
  // two live in different subtrees, so CSS alone cannot express it.
  const hilite = (el, on) => {
    const sel = el.getAttribute('data-hilite');
    document.querySelectorAll(sel).forEach(x => {
      x.style.opacity = on ? 0.6 : '';
      x.style.stroke = on ? 'var(--fg)' : '';
      x.style.strokeWidth = on ? 1.5 : '';
    });
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-hilite]');
    if (el && !el.contains(e.relatedTarget)) hilite(el, true);
  });
  document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-hilite]');
    if (el && !el.contains(e.relatedTarget)) hilite(el, false);
  });
})(window.PK);
