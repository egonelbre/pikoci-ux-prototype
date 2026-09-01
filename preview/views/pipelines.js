// All pipelines as a dense table: weather over the last ten runs and a
// duration sparkline, so a slow drift is visible without opening anything.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago } = PK.fmt;
  const { st } = PK.status;
  const { dataTable } = PK.ui;
  const D = () => window.DATA;

  // ---------- Pipelines: dense data table (weather + duration trend) --------
  let pipFilter = '', pipChip = 'all';
  window._pipF = v => { pipFilter = v; PK.app.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._pipC = c => { pipChip = c; PK.app.refresh(); };

  // weather: last-10 outcomes as ticks + a summary glyph from the pass rate
  VIEWS.weather = function (hist) {
    if (!hist.length) return '<span class="mut small">no runs yet</span>';
    const ok = hist.filter(h => h.status === 'succeeded').length / hist.length;
    const glyph = ok >= 0.9 ? '☀' : ok >= 0.7 ? '🌤' : ok >= 0.5 ? '⛅' : ok >= 0.3 ? '🌧' : '⛈';
    const ticks = hist.map(h => {
      const t = `<span class="wx-t" style="background:${st(h.status).color}" title="${st(h.status).label} · ${fmtDur(h.dur)}"></span>`;
      return h.id ? `<a href="#/b/${h.id}" onclick="event.stopPropagation()">${t}</a>` : t;
    }).join('');
    return `<span class="wx" title="${Math.round(ok * 100)}% of last ${hist.length} succeeded"><span class="wx-g">${glyph}</span>${ticks}</span>`;
  };

  // duration trend: mini bars (oldest→newest) + drift arrow vs median
  VIEWS.sparkDur = function (hist) {
    if (hist.length < 2) return '<span class="mut small">—</span>';
    const max = Math.max(...hist.map(h => h.dur));
    const bars = hist.map(h =>
      `<span class="sb" style="height:${Math.max(2, Math.round(h.dur / max * 18))}px;background:${h.status === 'failed' ? st('failed').color : 'var(--spark)'}" title="${fmtDur(h.dur)}"></span>`).join('');
    const med = hist.map(h => h.dur).sort((a, b) => a - b)[hist.length >> 1];
    const last = hist[hist.length - 1].dur;
    const drift = last > med * 1.25 ? `<b class="c-failed" title="last run ${fmtDur(last)} vs median ${fmtDur(med)}">↑</b>`
      : last < med * 0.8 ? `<b class="c-succeeded" title="last run ${fmtDur(last)} vs median ${fmtDur(med)}">↓</b>` : '';
    return `<span class="spark">${bars}</span><span class="small nowrap"> ${fmtDur(last)}${drift}</span>`;
  };

  VIEWS.pipelines = function () {
    let pls = PK.model.pipelines();
    const total = pls.length;
    const isPR = pl => pl.primaryContext.kind === 'lineages';
    if (pipChip === 'failing') pls = pls.filter(pl => PK.model.primaryStatus(pl) === 'failed' || (isPR(pl) && PK.model.secondaryCounts(pl).failing));
    else if (pipChip === 'running') pls = pls.filter(pl => ['started', 'pending'].includes(PK.model.primaryStatus(pl)) || (isPR(pl) && PK.model.secondaryCounts(pl).running));
    else if (pipChip === 'paused') pls = pls.filter(pl => pl.paused);
    else if (pipChip === 'pr') pls = pls.filter(isPR);
    if (pipFilter) {
      const q = pipFilter.toLowerCase();
      pls = pls.filter(pl => (pl.team + '/' + pl.name + ' ' + pl.desc).toLowerCase().includes(q));
    }
    const order = s => s === 'failed' ? 0 : s === 'started' ? 1 : 2;
    const sorted = g => g.slice().sort((a, b) => order(PK.model.primaryStatus(a)) - order(PK.model.primaryStatus(b)) || a.name.localeCompare(b.name));
    const row = pl => {
      const s = PK.model.primaryStatus(pl);
      const pr = isPR(pl);
      const counts = pr ? PK.model.secondaryCounts(pl) : null;
      const hist = PK.model.plHistory(pl);
      const lastB = D().builds.filter(b => b.pipeline === pl.name).sort((a, b) => b.start - a.start)[0];
      const lastLin = pr ? D().lineages.filter(l => (l.pl || 'pikoci-pr') === pl.name).sort((a, b) => b.updated - a.updated)[0] : null;
      const lastAt = lastB ? lastB.start : (lastLin ? lastLin.updated : (pl.resources[0].versions[0] || { meta: {} }).meta.at);
      return {
        nav: `#/p/${pl.name}/graph`,
        cells: [
          { h: pr ? '⇅' : st(s).sym, cls: `c-${s} ${s === 'started' ? 'pulse' : ''}` },
          { h: `<b>${esc(pl.team)}/${esc(pl.name)}</b> ${pl.public ? '<span class="chip">public</span>' : ''}<span class="mut small shrink">— ${esc(pl.desc)}</span>`, title: pl.desc },
          pl.paused ? '❚❚ paused' : pr
            ? `${counts.total} open PR${counts.total === 1 ? '' : 's'}${counts.failing ? ` · <b class="c-failed">${counts.failing} ✕</b>` : ''}${counts.held ? ` · ${counts.held} ⛔` : ''}`
            : esc(pl.primaryContext.label),
          VIEWS.weather(hist),
          { h: VIEWS.sparkDur(hist), cls: 'spark-cell' },
          lastAt ? ago(lastAt) : '—',
          `<a class="btn sm" href="#/p/${pl.name}/config">Config</a>`,
        ],
      };
    };
    const grouped = !PK.model.team() && pls.length > 9;
    const rows = [];
    if (grouped) {
      for (const t of D().teams) {
        const g = sorted(pls.filter(p => p.team === t.name));
        if (!g.length) continue;
        rows.push({ group: `${esc(t.name)} <span class="mut">· ${g.length}</span>` });
        g.forEach(pl => rows.push(row(pl)));
      }
    } else sorted(pls).forEach(pl => rows.push(row(pl)));
    const chip = (k, lbl) => `<button class="chip-btn ${pipChip === k ? 'on' : ''}" onclick="_pipC('${k}')">${lbl}</button>`;
    return `<div class="page"><h1>Pipelines</h1>
      <div class="ctoolbar">
        <input data-filter aria-label="filter pipelines" placeholder="filter team, name, description…  ( / )" value="${esc(pipFilter)}" oninput="_pipF(this.value)">
        ${chip('all', 'all')}${chip('failing', '✕ failing')}${chip('running', '● started')}${chip('paused', '❚❚ paused')}${chip('pr', '⇅ PR checks')}
        <span class="sp"></span>
        <span class="mut small">${pls.length} of ${total}${PK.model.team() ? ' · team ' + esc(PK.model.team()) : ''}</span>
      </div>
      ${dataTable({
      className: 'ptbl',
      layout: 'fixed',
      cols: [
        { width: 'icon', px: '30px' },
        { label: 'pipeline', width: 'title' },
        { label: 'context', width: 'content', px: '124px', cls: 'mut small' },
        { label: 'weather · last 10', width: 'content', px: '128px' },
        { label: 'duration trend', width: 'content', px: '148px' },
        { label: 'activity', width: 'content', px: '70px', align: 'right', cls: 'mut small' },
        { width: 'action', px: '74px' },
      ],
      rows,
    })}
      <p class="mut small">Weather = last 10 completed runs (glyph is the pass rate); duration bars are the same runs oldest→newest — ↑/↓ marks the last run drifting beyond ±25%/−20% of the median. Real installs derive both from the builds table; deep history lands with Insights (Phase 4).</p>
    </div>`;
  };
})(window.PK);
