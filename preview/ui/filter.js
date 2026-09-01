// The filter bar: a text query, a row of chips, and a count. Four pages had
// this written out longhand with their own `window._xxxC('failing')` handlers;
// it is one shape, so it is one function.
//
//   filterBar({
//     filterKey: 'changes.filter', chipKey: 'changes.chip',
//     placeholder: 'filter #, title, author…',
//     chips: [['all', 'all'], ['failing', '✕ failing']],
//     extra: '<label>…</label>',           // anything else, before the count
//     count: '144 of 200 shown',
//   })
//
// data-filter stays on the input: it is what the `/` key focuses and what
// app.refresh() uses to put the caret back after a live re-render.
(function (PK) {
  'use strict';
  const { esc } = PK.fmt;

  function filterBar(o) {
    const q = o.filterKey ? PK.state.get(o.filterKey) || '' : '';
    const cur = o.chipKey ? PK.state.get(o.chipKey) : null;
    const chips = (o.chips || []).map(([k, label]) =>
      `<button class="chip-btn ${cur === k ? 'on' : ''}" data-state="${esc(o.chipKey)}" data-value="${esc(k)}">${label}</button>`).join('');
    return `<div class="ctoolbar${o.cls ? ' ' + o.cls : ''}">
      ${o.filterKey ? `<input data-filter data-state="${esc(o.filterKey)}" aria-label="${esc(o.label || o.placeholder || 'filter')}"
        placeholder="${esc(o.placeholder || '')}" value="${esc(q)}">` : ''}
      ${chips}
      ${o.extra || ''}
      <span class="sp"></span>
      ${o.count ? `<span class="mut small">${o.count}</span>` : ''}
    </div>`;
  }

  PK.ui = Object.assign(PK.ui || {}, { filterBar });
})(window.PK);
