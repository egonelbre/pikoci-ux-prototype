// All pipelines as a dense table: weather over the last ten runs and a
// duration sparkline, so a slow drift is visible without opening anything.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago } = PK.fmt;
  const { st } = PK.status;
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
      return `<tr onclick="location.hash='#/p/${pl.name}/graph'">
        <td class="c-${s} ${s === 'started' ? 'pulse' : ''}">${pr ? '⇅' : st(s).sym}</td>
        <td class="ct-title" title="${esc(pl.desc)}"><div class="ctt"><b>${esc(pl.team)}/${esc(pl.name)}</b>
          ${pl.public ? '<span class="chip">public</span>' : ''}<span class="mut small shrink">— ${esc(pl.desc)}</span></div></td>
        <td class="mut small nowrap">${pl.paused ? '❚❚ paused' : pr
          ? `${counts.total} open PR${counts.total === 1 ? '' : 's'}${counts.failing ? ` · <b class="c-failed">${counts.failing} ✕</b>` : ''}${counts.held ? ` · ${counts.held} ⛔` : ''}`
          : esc(pl.primaryContext.label)}</td>
        <td class="nowrap">${VIEWS.weather(hist)}</td>
        <td class="nowrap spark-cell">${VIEWS.sparkDur(hist)}</td>
        <td class="mut small r nowrap">${lastAt ? ago(lastAt) : '—'}</td>
        <td class="r"><a class="btn sm" href="#/p/${pl.name}/config" onclick="event.stopPropagation()">Config</a></td>
      </tr>`;
    };
    const head = `<thead><tr><th></th><th>pipeline</th><th>context</th><th>weather · last ${10}</th><th>duration trend</th><th class="r">activity</th><th></th></tr></thead>`;
    const grouped = !PK.model.team() && pls.length > 9;
    const rows = grouped
      ? D().teams.map(t => {
        const g = sorted(pls.filter(p => p.team === t.name));
        return g.length ? `<tr class="tsub"><td colspan="7">${esc(t.name)} <span class="mut">· ${g.length}</span></td></tr>${g.map(row).join('')}` : '';
      }).join('')
      : sorted(pls).map(row).join('');
    const chip = (k, lbl) => `<button class="chip-btn ${pipChip === k ? 'on' : ''}" onclick="_pipC('${k}')">${lbl}</button>`;
    return `<div class="page"><h1>Pipelines</h1>
      <div class="ctoolbar">
        <input data-filter aria-label="filter pipelines" placeholder="filter team, name, description…  ( / )" value="${esc(pipFilter)}" oninput="_pipF(this.value)">
        ${chip('all', 'all')}${chip('failing', '✕ failing')}${chip('running', '● started')}${chip('paused', '❚❚ paused')}${chip('pr', '⇅ PR checks')}
        <span class="sp"></span>
        <span class="mut small">${pls.length} of ${total}${PK.model.team() ? ' · team ' + esc(PK.model.team()) : ''}</span>
      </div>
      <div class="tbl-scroll"><table class="tbl ctbl ptbl fixed">
      <colgroup><col style="width:30px"><col><col style="width:124px"><col style="width:128px"><col style="width:148px"><col style="width:70px"><col style="width:74px"></colgroup>
      ${head}<tbody>${rows}</tbody></table></div>
      <p class="mut small">Weather = last 10 completed runs (glyph is the pass rate); duration bars are the same runs oldest→newest — ↑/↓ marks the last run drifting beyond ±25%/−20% of the median. Real installs derive both from the builds table; deep history lands with Insights (Phase 4).</p>
    </div>`;
  };
})(window.PK);
