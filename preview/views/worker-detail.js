// One worker's week: cpu and disk overlaid, with runs as bands — so "what
// filled the disk" is answered by pointing at it.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago } = PK.fmt;
  const D = () => window.DATA;

  // ---------- Worker detail: cpu/disk overlaid, runs as bands ---------------
  let wkRange = 168; // hours shown: 168 / 24 / 6
  window._wkR = h => { wkRange = h; PK.app.refresh(); };
  window._wkHi = (i, on) => { // hover a run row → light its band on the chart
    const el = document.querySelector(`[data-run="${i}"]`);
    if (el) { el.style.opacity = on ? 0.6 : ''; el.style.stroke = on ? 'var(--fg)' : ''; el.style.strokeWidth = on ? 1.5 : ''; }
  };

  function weekChart(wk, rangeH, runs, samples) {
    const W = 1090, padL = 42, padR = 10, plotH = 120, padT = 12, axH = 22;
    const H = padT + plotH + axH;
    const span = W - padL - padR;
    const x = k => padL + (rangeH - k) / rangeH * span;
    const y = v => padT + (1 - v) * plotH; // one shared 0–100% scale: overlaid lines
    const bands = runs.map((r, i) => {
      const bw = Math.max(2.5, r.durM / 60 / rangeH * span);
      const big = Math.abs(r.dDisk) >= 0.02;
      return `<rect data-run="${i}" x="${x(r.agoH).toFixed(1)}" y="${padT}" width="${bw.toFixed(1)}" height="${plotH}"
        ${r.bid ? `onclick="location.hash='#/b/${r.bid}'" style="cursor:pointer"` : ''}
        fill="${r.dDisk < 0 ? 'var(--ok, #2a2)' : 'var(--accent)'}" opacity="${r.dDisk < 0 ? 0.28 : big ? 0.32 : 0.10}">
        <title>${esc(r.pipeline)}/${esc(r.job)}${r.n ? ' #' + r.n : ''} · ${r.durM}m · disk ${r.dDisk >= 0 ? '+' : ''}${(r.dDisk * 100).toFixed(1)}%${r.bid ? ' — click to open' : ''}</title></rect>`;
    }).join('');
    const steps = runs.filter(r => Math.abs(r.dDisk) >= 0.02).map(r => {
      const s = samples.find(s => s.agoH === r.agoH - 1) || samples[samples.length - 1];
      return `<text x="${(x(r.agoH) + 3).toFixed(1)}" y="${(y(s.disk) - 5).toFixed(1)}" class="wk-step" fill="${r.dDisk < 0 ? 'var(--ok, #2a2)' : 'var(--warn, #d33)'}">${r.dDisk >= 0 ? '+' : ''}${Math.round(r.dDisk * 100)}%</text>`;
    }).join('');
    const cpuPts = samples.map(s => `${x(s.agoH).toFixed(1)},${y(s.cpu).toFixed(1)}`).join(' ');
    const diskPts = samples.map(s => `${x(s.agoH).toFixed(1)},${y(s.disk).toFixed(1)}`).join(' ');
    const first = samples[0], last = samples[samples.length - 1];
    let ticks = '';
    const stepH = rangeH >= 72 ? 24 : rangeH >= 24 ? 6 : 1;
    for (let k = 0; k <= rangeH; k += stepH) {
      const d = new Date(Date.now() - k * 3600e3);
      const lbl = k === 0 ? 'now' : (stepH === 24 ? d.toLocaleDateString(undefined, { weekday: 'short' }) : d.getHours() + ':00');
      ticks += `<line x1="${x(k)}" y1="${padT}" x2="${x(k)}" y2="${padT + plotH}" stroke="var(--line2)" stroke-dasharray="3 4"/>
        <text x="${x(k)}" y="${H - 6}" class="wk-tick" text-anchor="middle">${lbl}</text>`;
    }
    return `<div class="graph-scroll"><svg width="${W}" height="${H}" role="img" aria-label="cpu and disk with runs overlaid">
      ${ticks}${bands}
      <g pointer-events="none">
      <path d="M${x(first.agoH)},${y(0)} L${cpuPts.replace(/ /g, ' L')} L${x(last.agoH)},${y(0)} Z" fill="var(--accent)" opacity="0.15"/>
      <polyline points="${cpuPts}" fill="none" stroke="var(--accent)" stroke-width="1.5"/>
      <polyline points="${diskPts}" fill="none" stroke="var(--warn, #d33)" stroke-width="2"/>
      ${steps}</g>
      <text x="${padL - 6}" y="${y(1) + 8}" class="wk-tick" text-anchor="end">100%</text>
      <text x="${padL - 6}" y="${y(0)}" class="wk-tick" text-anchor="end">0</text>
      <text x="${W - padR}" y="${y(1) - 2}" class="wk-lab" text-anchor="end"><tspan fill="var(--accent)">— cpu</tspan>  <tspan fill="var(--warn, #d33)">— disk</tspan></text>
    </svg></div>`;
  }

  VIEWS.workerDetail = function (name) {
    const w = D().workers.find(x => x.name === name);
    if (!w) return '<div class="page">Worker not found — <a href="#/workers">workers</a></div>';
    const pool = w.pool && D().pools.find(p => p.name === w.pool);
    const wk = w.week;
    const rangeH = wk ? Math.min(wkRange, wk.hours) : 0;
    const runsF = wk ? wk.runs.filter(r => r.agoH <= rangeH) : [];
    const samplesF = wk ? wk.samples.filter(s => s.agoH <= rangeH) : [];
    // "what fills the disk": aggregate the visible range's runs by job
    const agg = {};
    for (const r of runsF) {
      const k = r.pipeline + '/' + r.job;
      (agg[k] = agg[k] || { key: k, runs: 0, mins: 0, dDisk: 0 });
      agg[k].runs++; agg[k].mins += r.durM; agg[k].dDisk += r.dDisk;
    }
    const rows = Object.values(agg).sort((a, b) => b.dDisk - a.dDisk);
    const maxAbs = Math.max(0.001, ...rows.map(r => Math.abs(r.dDisk)));
    const rtab = (h, lbl) => `<button class="chip-btn ${wkRange === h ? 'on' : ''}" onclick="_wkR(${h})">${lbl}</button>`;
    return `<div class="page">
      <div class="crumbs"><a href="#/workers">workers</a> / <b>${esc(w.name)}</b>
        ${w.status === 'provisioning' ? '<span class="c-pending pulse">◌ provisioning</span>'
        : `<span class="c-${w.status === 'online' ? 'succeeded' : 'failed'}">● ${w.status === 'online' ? 'healthy' : w.status}</span>`}
        ${w.lastSeen ? `<span class="mut small">last heartbeat ${ago(w.lastSeen)}</span>` : ''}
        ${pool ? `<span class="chip" title="${esc(pool.provider)}">pool: ${esc(pool.name)}</span>` : ''}
        ${w.ephemeral && w.up ? `<span class="mut small">up ${fmtDur(w.up / 1000)}</span>` : ''}
        <span class="mut small">${w.team || 'Global'} · ${w.tags.map(t => `<code>${esc(t)}</code>`).join(' ')} · ${esc(w.version)} · --concurrency ${w.concurrency || 1}: ${w.running || 0} of ${w.concurrency || 1} registered busy</span>
        <span class="sp"></span>
        <button class="btn" data-act="drain" data-arg="${esc(w.name)}" title="drain is worker-side today (SIGQUIT); click for details">drain</button></div>
      ${w.status === 'stale' ? `<div class="warnbox">⚠ No heartbeat for ${ago(w.lastSeen)} — telemetry below ends there; nothing is fabricated past the last report.</div>` : ''}
      ${wk ? `
      <h2>${w.ephemeral && wk.hours < wkRange ? 'This instance’s lifetime' : 'Usage'}
        <span class="tabs-inline">${rtab(168, '7 days')}${rtab(24, '1 day')}${rtab(6, '6 hours')}</span>
        <span class="mut small">— cpu &amp; disk overlaid with the runs that produced them (hover a band or a run row; green = cleanup)</span></h2>
      ${weekChart(wk, rangeH, runsF, samplesF)}
      <div class="pr-cols">
        <div style="flex:1.2 1 460px;min-width:300px">
          <h2>What moved the disk <span class="mut small">— runs in view, aggregated by job</span></h2>
          <div class="tbl-scroll"><table class="tbl ctbl wtbl">
            <thead><tr><th>job</th><th class="r">runs</th><th class="r">time</th><th class="r">disk Δ</th><th width="130"></th></tr></thead>
            ${rows.map(r => `<tr>
              <td class="nowrap">${esc(r.key)}</td>
              <td class="r">${r.runs}</td>
              <td class="mut small r nowrap">${fmtDur(r.mins * 60)}</td>
              <td class="r nowrap ${r.dDisk >= 0.02 ? 'c-failed' : r.dDisk < 0 ? 'c-succeeded' : 'mut'}">${r.dDisk >= 0 ? '+' : ''}${(r.dDisk * 100).toFixed(1)}%</td>
              <td><span class="disk-bar" style="width:110px"><span style="width:${Math.round(Math.abs(r.dDisk) / maxAbs * 100)}%;background:${r.dDisk < 0 ? 'var(--ok, #2a2)' : r.dDisk >= 0.02 ? 'var(--warn, #d33)' : 'var(--spark)'}"></span></span></td>
            </tr>`).join('')}
          </table></div>
          <p class="mut small">This is the disk-leak answer: a job whose Δ dominates the week is the thing to cache-cap or prune. Deltas come from before/after sampling around each run — cheap, no per-file accounting.</p>
        </div>
        <div style="flex:1 1 380px;min-width:300px">
          <h2>Runs in view</h2>
          <div class="tbl-scroll"><table class="tbl ctbl wtbl">
            ${runsF.map((r, i) => ({ r, i })).sort((a, b) => a.r.agoH - b.r.agoH).slice(0, 14).map(({ r, i }) => `<tr onmouseenter="_wkHi(${i},1)" onmouseleave="_wkHi(${i},0)" ${r.bid ? `onclick="location.hash='#/b/${r.bid}'"` : 'style="cursor:default"'}>
              <td class="mut small nowrap">${r.agoH}h ago</td>
              <td class="nowrap">${esc(r.pipeline)}/${esc(r.job)}${r.n ? ` <span class="mut small">#${r.n}</span>` : ''}</td>
              <td class="mut small r nowrap">${r.durM}m</td>
              <td class="mut small r nowrap">${r.dDisk >= 0 ? '+' : ''}${(r.dDisk * 100).toFixed(1)}%</td>
            </tr>`).join('')}
          </table></div>
        </div>
      </div>` : '<div class="mut pad">No telemetry yet — this instance has not reported a full sample window.</div>'}
    </div>`;
  };
})(window.PK);
