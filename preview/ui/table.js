// The data table, and the column-sizing rules that used to live in a CSS
// comment and be re-derived by hand at 25 call sites.
//
// The rule is simple and every table obeys it: **every column hugs its content
// except exactly one, which absorbs all the leftover width**. Get that wrong
// and the surplus is shared out among columns that did not want it — which is
// how "waiting" ended up 159px wide to hold "25m ago". dataTable asserts the
// invariant instead of trusting each caller to remember it.
//
//   dataTable({
//     cols: [
//       { width: 'icon' },
//       { label: 'build',        width: 'content' },
//       { label: 'why it waits', width: 'fill', measure: '22ch' },
//       { label: 'waiting',      width: 'content', align: 'right' },
//       { width: 'action' },
//     ],
//     rows: builds.map(b => ({ nav: `#/b/${b.id}`, cells: [...] })),
//   })
//
// Column widths:
//   fill      the one column that takes the slack (width:100%). `measure`
//             adds a min-width to keep prose readable once space is tight —
//             attached to THIS column, never to a font-size class, which is
//             the bug `.ctbl td.small { min-width: 22ch }` was.
//   title     fill, but truncating: an ellipsis wrapper instead of wrapping.
//   content   hugs its content (nowrap + the width:1px floor).
//   action    hugs, right-aligned — buttons never wrap.
//   icon      the fixed status-glyph column.
//   <n>px     an explicit width; only meaningful with layout:'fixed'.
//
// Cells are HTML strings, or { h, cls, title, colspan, attrs } when a cell
// needs more than content. A row is { cells, nav?, cls? }, or { group, cls? }
// for a full-width subheading (a team, a pool, a repo), or { raw } for a row
// that is not a grid of cells at all.
(function (PK) {
  'use strict';
  const { esc } = PK.fmt;

  const ALIGN = { right: 'r', center: 'c' };

  function colClass(c) {
    const w = c.width || 'content';
    const parts = [];
    if (w === 'content' || w === 'action' || w === 'icon') parts.push('nowrap');
    if (w === 'action' || c.align === 'right') parts.push('r');
    else if (c.align && ALIGN[c.align]) parts.push(ALIGN[c.align]);
    if (c.cls) parts.push(c.cls);
    return parts.join(' ');
  }

  // The width hint goes on the <th> (or the <col> in a fixed table), so it is
  // stated once per column rather than repeated on every row's cell.
  function colStyle(c, fixed) {
    const w = c.width || 'content';
    if (fixed) return c.px ? `width:${c.px}` : '';
    if (w === 'fill' || w === 'title') return 'width:100%' + (c.measure ? `;min-width:${c.measure}` : '');
    return '';
  }

  function cellHTML(cell, col, fixed) {
    const o = (cell && typeof cell === 'object' && !Array.isArray(cell)) ? cell : { h: cell };
    const cls = [colClass(col), o.cls].filter(Boolean).join(' ');
    const attrs = [
      cls ? ` class="${cls}"` : '',
      o.colspan ? ` colspan="${o.colspan}"` : '',
      o.title ? ` title="${esc(o.title)}"` : '',
      o.attrs ? ' ' + o.attrs : '',
      // in a fixed table the colgroup owns the widths; anywhere else the fill
      // column needs its width:100% on the cell too, or auto-layout ignores it
      (!fixed && (col.width === 'fill' || col.width === 'title')) ? ' style="width:100%"' : '',
    ].join('');
    const body = o.h == null ? '' : o.h;
    return col.width === 'title'
      ? `<td${attrs}><div class="ctt"><span class="shrink">${body}</span></div></td>`
      : `<td${attrs}>${body}</td>`;
  }

  function dataTable(spec) {
    const cols = spec.cols || [];
    const fixed = spec.layout === 'fixed';
    const rows = spec.rows || [];

    // The invariant, checked rather than remembered. A table with none or two
    // fill columns is a console warning naming the table, not a mystery.
    const fills = cols.filter(c => c.width === 'fill' || c.width === 'title').length;
    if (fills !== 1 && cols.length > 1 && !spec.allowNoFill) {
      console.warn(`dataTable: ${fills} fill columns in [${cols.map(c => c.label || '·').join(', ')}] — want exactly 1`);
    }

    if (!rows.length && spec.empty) return spec.empty;

    const cls = ['tbl', spec.dense === false ? '' : 'ctbl', fixed ? 'fixed' : '', spec.className || '']
      .filter(Boolean).join(' ');

    const colgroup = fixed
      ? `<colgroup>${cols.map(c => `<col${colStyle(c, true) ? ` style="${colStyle(c, true)}"` : ''}>`).join('')}</colgroup>`
      : '';

    const hasHead = cols.some(c => c.label);
    const thead = hasHead
      ? `<thead><tr>${cols.map(c => {
        const k = colClass(c).replace('nowrap', '').trim();
        const s = colStyle(c, fixed);
        return `<th${k ? ` class="${k}"` : ''}${s ? ` style="${s}"` : ''}>${c.label || ''}</th>`;
      }).join('')}</tr></thead>`
      : '';

    const body = rows.map(r => {
      // escape hatch for a row that is not a grid of cells at all — the
      // source excerpt under a failed check spans the whole table
      if (r.raw != null) return r.raw;
      if (r.group != null) return `<tr class="tsub${r.cls ? ' ' + r.cls : ''}"><td colspan="${cols.length}">${r.group}</td></tr>`;
      const attrs = [
        r.cls ? ` class="${r.cls}"` : '',
        // navigation is declarative: lib/navigate.js ignores clicks that
        // started in a link, a button or an input, so a row and the buttons
        // inside it stop fighting over the same click
        r.nav ? ` data-nav="${esc(r.nav)}"` : '',
        r.attrs ? ' ' + r.attrs : '',
      ].join('');
      return `<tr${attrs}>${r.cells.map((c, i) => cellHTML(c, cols[i] || {}, fixed)).join('')}</tr>`;
    }).join('');

    const table = `<table class="${cls}">${colgroup}${thead}<tbody>${body}</tbody></table>`;
    return spec.scroll === false ? table : `<div class="tbl-scroll">${table}</div>`;
  }

  PK.ui = Object.assign(PK.ui || {}, { dataTable });
})(window.PK);
