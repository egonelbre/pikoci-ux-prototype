// Structured checks and measurements on the build page: new-vs-still-failing,
// per-test history dots, package roll-ups, and deltas against the last green.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur } = PK.fmt;

  // ---------- structured checks + measurements on the build page ------------
  // Tests as objects, not grepped log lines (G2): stable ids give per-test
  // history and the new-vs-known split; benchmarks are measurements with
  // generic deltas; a broken report degrades honestly to logs (G5).
  VIEWS.testSection = function (pl, b) {
    let out = '';
    if (b.testReportError) {
      out += `<div class="warnbox">⚠ <b>Test report not ingested</b> — ${esc(b.testReportError)}</div>`;
    }
    if (b.tests) {
      const stats = PK.model.testStats(b);
      const failed = b.tests.filter(t => t.s === 'fail');
      const skipped = b.tests.filter(t => t.s === 'skip');
      const histDot = h => h.s === null
        ? '<span class="th-dot none" title="no report in that run">·</span>'
        : `<a class="th-dot ${h.s}" href="#/b/${h.b.id}" title="#${h.b.n}: ${h.s}"></a>`;
      // ctx = a few lines of context under a failure: source excerpt when it
      // has a line number (lint), raw output when it doesn't (test failures)
      const ctxRow = t => !t.ctx ? '' : `<tr class="ctx-tr"><td></td><td colspan="4"><pre class="ctx-code">${t.ctx.code.map((l, i) => {
        const n = t.ctx.ln != null ? t.ctx.ln + i : null;
        return `<span class="ctx-l${n !== null && n === t.ctx.hl ? ' hl' : ''}">${n !== null ? `<span class="ctx-n">${n}</span>` : ''}${esc(l)}</span>`;
      }).join('')}</pre></td></tr>`;
      out += `<h3>Checks <span class="mut small">— ${stats.pass} passed${stats.fail ? ` · <b class="c-failed">${stats.fail} failed</b>` : ''}${stats.skip ? ` · ${stats.skip} skipped` : ''} · ${fmtDur(stats.dur)} test time</span></h3>`;
      if (failed.length) out += `<div class="tbl-scroll"><table class="tbl ctbl wtbl">
        ${failed.map(t => {
        const isNew = PK.model.isNewFailure(pl, b.job, b, t.id);
        const hist = PK.model.testHistory(pl, b.job, b, t.id);
        return `<tr>
          <td class="c-failed nowrap">✕</td>
          <td class="nowrap"><code>${esc(t.id)}</code>
            ${isNew ? '<span class="chip mine-chip" title="passed in every earlier run with a report">new</span>'
            : '<span class="chip" title="also failed in an earlier run">still failing</span>'}</td>
          <td class="mut small">${esc(t.msg || '')}</td>
          <td class="mut small r nowrap">${t.d ? t.d + 's' : ''}</td>
          <td class="r nowrap"><span class="th-hist" title="this test across the last runs with reports">${hist.map(histDot).join('')}</span></td>
        </tr>${ctxRow(t)}`;
      }).join('')}</table></div>`;
      if (skipped.length) out += skipped.map(t => `<div class="mut small pad-s">◇ <code>${esc(t.id)}</code> skipped${t.msg ? ` — ${esc(t.msg)}` : ''}</div>`).join('');
      // scale: suites run to 8000 tests across 100 packages. Failures stay a
      // flat list (the rare set); everything else rolls up per package,
      // slowest first, expanding one package at a time; the filter finds a
      // single test by name across the whole suite.
      const q = (window._tq || '').toLowerCase();
      out += `<div class="ctoolbar gap-s"><input aria-label="find a test" placeholder="find a test by name…" value="${esc(window._tq || '')}"
        oninput="window._tq=this.value;PK.app.refresh();const f=[...document.querySelectorAll('input[aria-label=&quot;find a test&quot;]')][0];if(f){f.focus();f.setSelectionRange(999,999)}">
        <span class="sp"></span><span class="mut small">${b.tests.length} tests</span></div>`;
      if (q) {
        const hits = b.tests.filter(t => t.id.toLowerCase().includes(q));
        out += hits.length ? `<div class="tbl-scroll"><table class="tbl ctbl fixed">
          <colgroup><col style="width:28px"><col style="width:340px"><col><col style="width:76px"></colgroup>
          ${hits.slice(0, 100).map(t => `<tr>
            <td class="c-${t.s === 'fail' ? 'failed' : t.s === 'skip' ? 'pending' : 'succeeded'} nowrap">${t.s === 'fail' ? '✕' : t.s === 'skip' ? '◇' : '✓'}</td>
            <td class="nowrap"><code>${esc(t.id)}</code></td>
            <td class="mut small">${esc(t.msg || '')}</td>
            <td class="mut small r nowrap">${t.d ? t.d + 's' : ''}</td></tr>`).join('')}</table></div>${hits.length > 100 ? `<div class="mut small pad-s">first 100 of ${hits.length} matches</div>` : ''}`
          : '<div class="mut pad-s small">no test matches</div>';
      } else {
        const pkgs = {};
        for (const t of b.tests.filter(t => t.s === 'pass')) {
          const p = t.id.split('/')[0];
          (pkgs[p] = pkgs[p] || { n: 0, dur: 0, tests: [] });
          pkgs[p].n++; pkgs[p].dur += t.d || 0; pkgs[p].tests.push(t);
        }
        out += Object.entries(pkgs).sort((a, c) => c[1].dur - a[1].dur).map(([p, g]) =>
          `<details class="b2-det inline-det pkg" data-det="tp:${b.id}:${esc(p)}"><summary><code>${esc(p)}</code>
            <span class="mut small">${g.n} ✓ · ${fmtDur(g.dur)}</span></summary>
          <div class="tbl-scroll"><table class="tbl ctbl fixed">
          <colgroup><col style="width:28px"><col><col style="width:76px"></colgroup>
          ${g.tests.sort((a, c) => (c.d || 0) - (a.d || 0)).map(t => `<tr>
            <td class="c-succeeded nowrap">✓</td><td class="nowrap"><code>${esc(t.id)}</code></td>
            <td class="mut small r nowrap">${t.d ? t.d + 's' : ''}</td></tr>`).join('')}</table></div></details>`).join('');
      }
    }
    if (b.measurements) {
      out += `<h3>Measurements <span class="mut small">— values, not verdicts; deltas are vs this job's last green run</span></h3>
      <div class="tbl-scroll"><table class="tbl ctbl wtbl">
      ${b.measurements.map(m => {
        const d = PK.model.measurementDelta(pl, b, m);
        const worse = d && (m.better === 'lower' ? d.pct > 0 : d.pct < 0);
        const sig = d && Math.abs(d.pct) >= 2;
        return `<tr>
          <td class="nowrap"><code>${esc(m.id)}</code></td>
          <td class="r nowrap"><b>${m.value}</b> <span class="mut small">${esc(m.unit)}</span></td>
          <td class="mut small nowrap">${d ? `was ${d.prev} ${esc(m.unit)}` : ''}</td>
          <td class="r nowrap ${sig ? (worse ? 'c-failed' : 'c-succeeded') : 'mut'}">${d ? `${d.pct >= 0 ? '+' : ''}${d.pct.toFixed(1)}%${sig ? (worse ? ' ▲' : ' ▼') : ''}` : '<span class="mut small">no baseline</span>'}</td>
        </tr>`;
      }).join('')}</table></div>`;
    }
    return out;
  };
})(window.PK);
