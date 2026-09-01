// The per-commit mini graph and the run timeline: checks table, waterfall
// and DAG in one view.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, bDur } = PK.fmt;
  const { st, reasonLabel } = PK.status;

  // ---------- mini run graph (per-commit): label + timing only --------------
  VIEWS.runGraph = function (pl, ref) {
    // jobs only, layered by passed-constraints; no build numbers, no resources
    const depth = {};
    const jd = name => {
      if (depth[name] != null) return depth[name];
      depth[name] = 0;
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of j.inputs || []) for (const p of inp.passed || []) d = Math.max(d, jd(p) + 1);
      return (depth[name] = d);
    };
    const jobs = pl.jobs.filter(PK.model.isRunJob);
    jobs.forEach(j => jd(j.name));
    const nodeW = 122, nodeH = 36, gapX = 56, gapY = 12, pad = 10;
    const maxD = Math.max(0, ...jobs.map(j => depth[j.name]));
    const pos = {}; let maxH = 0;
    for (let d = 0; d <= maxD; d++) {
      const col = jobs.filter(j => depth[j.name] === d);
      let y = pad;
      col.forEach(j => { pos[j.name] = { x: pad + d * (nodeW + gapX), y }; y += nodeH + gapY; });
      maxH = Math.max(maxH, y);
    }
    for (let d = 0; d <= maxD; d++) { // center columns
      const col = jobs.filter(j => depth[j.name] === d).map(j => pos[j.name]);
      if (!col.length) continue;
      const used = col[col.length - 1].y + nodeH - pad;
      const off = (maxH - pad - used) / 2;
      col.forEach(p => p.y += off);
    }
    const W = pad * 2 + (maxD + 1) * nodeW + maxD * gapX, H = maxH + pad;
    let edges = '';
    for (const j of jobs) for (const inp of j.inputs || []) for (const p of inp.passed || []) {
      const a = pos[p], b = pos[j.name];
      if (!a || !b) continue;
      const x1 = a.x + nodeW, y1 = a.y + nodeH / 2, x2 = b.x, y2 = b.y + nodeH / 2, mx = (x1 + x2) / 2;
      edges += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="var(--edge)" stroke-width="1.6"/>`;
    }
    let nodes = '';
    for (const j of jobs) {
      const p = pos[j.name];
      const c = PK.model.jobCell(pl, j.name, ref);
      let timing, fill, click = '';
      if (c.kind === 'build') {
        const s = c.status;
        timing = c.build.end ? fmtDur(bDur(c.build)) : (s === 'held' ? 'held' : c.build.status === 'pending' ? 'queued' : 'started');
        fill = st(s).color;
        click = `data-nav="#/b/${c.build.id}"`;
      } else if (c.kind === 'decision') {
        timing = PK.status.REASON[c.decision.code] && PK.status.REASON[c.decision.code].family === 'wont_run' ? "won't run" : 'waiting';
        fill = 'var(--mut3)';
      } else { timing = '—'; fill = 'var(--mut3)'; }
      const pulse = c.kind === 'build' && c.build.status === 'started' ? 'pulse' : '';
      const g = `<g class="gnode ${pulse}">
        <rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="5" fill="${fill}"/>
        <text x="${p.x + 8}" y="${p.y + 15}" class="t-job" style="font-size:11px">${esc(j.name)}</text>
        <text x="${p.x + 8}" y="${p.y + 28}" class="t-sub">${esc(timing)}</text></g>`;
      // real SVG link: focusable, Enter works, exposed to AT (not a mute onclick <g>)
      nodes += c.kind === 'build' ? `<a href="#/b/${c.build.id}" aria-label="${esc(j.name)}: ${esc(timing)}">${g}</a>` : g;
    }
    return `<div class="run-graph" data-live><svg width="${W}" height="${H}" aria-label="run graph">${edges}${nodes}</svg></div>`;
  };

  // ---------- run timeline: checks table + waterfall + DAG in ONE view ------
  // Rows in stage order carry status, name, build link and duration; bars sit
  // between them on a shared time scale; dependency connectors encode the DAG.
  VIEWS.runTimeline = function (pl, ref) {
    const depth = {};
    const jd = name => {
      if (depth[name] != null) return depth[name];
      depth[name] = 0;
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of j.inputs || []) for (const p of inp.passed || []) d = Math.max(d, jd(p) + 1);
      return (depth[name] = d);
    };
    const jobs = pl.jobs.filter(PK.model.isRunJob);
    jobs.forEach(j => jd(j.name));
    jobs.sort((a, b) => depth[a.name] - depth[b.name] || a.name.localeCompare(b.name));
    const cells = jobs.map(j => ({ j, c: PK.model.jobCell(pl, j.name, ref) }));
    const timed = cells.filter(x => x.c.kind === 'build' && x.c.build.start && (x.c.build.end || x.c.build.status === 'started'));
    if (!cells.some(x => x.c.kind !== 'none')) return '<div class="mut pad">No runs recorded for this commit in the demo dataset.</div>';
    const t0 = timed.length ? Math.min(...timed.map(x => x.c.build.start)) : 0;
    const t1 = timed.length ? Math.max(...timed.map(x => x.c.build.end || Date.now())) : 1;
    const span = Math.max(t1 - t0, 1000);
    const wall = span / 1000;
    const busy = timed.reduce((a, x) => a + ((x.c.build.end || Date.now()) - x.c.build.start) / 1000, 0);
    const ladder = [60, 300, 600, 900, 1800, 3600, 7200]; // 1m 5m 10m 15m 30m 1h 2h
    const step = ladder.find(s => wall / s <= 8) || 7200;
    const ticks = [];
    for (let t = step; t < wall; t += step) ticks.push(t);
    const gridLines = ticks.map(t => `<i class="wf-grid" style="left:${t / wall * 100}%"></i>`).join('');
    const leftOf = b => (b.start - t0) / span * 100;
    const endOf = b => ((b.end || Date.now()) - t0) / span * 100;
    // dependency connectors: vertical line at downstream start, from upstream row to downstream row
    const rowIdx = {}; cells.forEach((x, i) => rowIdx[x.j.name] = i);
    const axisH = 18, rowH = 28;
    let deps = '';
    for (const x of cells) {
      for (const inp of x.j.inputs || []) for (const up of inp.passed || []) {
        const upC = cells[rowIdx[up]];
        if (!upC || upC.c.kind !== 'build' || !upC.c.build.end) continue;
        const xPct = x.c.kind === 'build' && x.c.build.start ? leftOf(x.c.build) : endOf(upC.c.build);
        const y1 = axisH + rowIdx[up] * rowH + rowH / 2;
        const y2 = axisH + rowIdx[x.j.name] * rowH + rowH / 2;
        deps += `<i class="wf-dep" style="left:${xPct}%;top:${Math.min(y1, y2)}px;height:${Math.abs(y2 - y1)}px" title="${esc(x.j.name)} needs ${esc(up)}"></i>`;
      }
    }
    return `<div class="wf" data-live>
      <div class="wf-row wf-axis"><div class="wf-lbl"></div>
        <div class="wf-lane">${ticks.map(t => `<span class="wf-tick" style="left:${t / wall * 100}%">${fmtDur(t)}</span>`).join('')}</div></div>
      <div class="wf-body">
      <div class="wf-deps">${deps}</div>
      ${cells.map(x => {
      const { j, c } = x;
      const name = `<span class="wf-name" ${j.group ? `title="matrix group: ${esc(j.group)}"` : ''}>${esc(j.name)}</span>`;
      if (c.kind === 'build') {
        const b = c.build, s = c.status;
        const hasBar = b.start && (b.end || b.status === 'started');
        const tail = b.end ? fmtDur(bDur(b)) : (s === 'held' ? 'held' : b.status === 'pending' ? 'queued' : fmtDur(bDur(b)) + '…');
        return `<div class="wf-row">
          <div class="wf-lbl click" data-nav="#/b/${b.id}" title="open ${esc(j.name)} #${b.n}"><span class="c-${s} ${b.status === 'started' ? 'pulse' : ''}">${st(s).sym}</span>${name}
            <a class="wf-n small" href="#/b/${b.id}">#${b.n}</a>
            <span class="wf-d mut small">${esc(tail)}</span></div>
          <div class="wf-lane">${gridLines}${hasBar ? `<div class="wf-bar ${b.status === 'started' ? 'pulse' : ''}"
            style="left:${leftOf(b)}%;width:${Math.max(endOf(b) - leftOf(b), 1)}%;background:${st(s).color}"
            data-nav="#/b/${b.id}" title="${esc(j.name)} #${b.n}: ${st(s).label}"></div>`
          : `<span class="wf-ghost" style="left:2%">${s === 'held' ? '⛔ held — awaiting maintainer' : b.queue ? (b.queue.matching === 0 ? `queued — no worker with tag "${esc(b.queue.tag)}"` : `queued — ${b.queue.matching} matching worker, busy`) : 'queued'}</span>`}</div>
        </div>`;
      }
      const ghostX = (j.inputs || []).flatMap(i => i.passed || []).map(up => cells[rowIdx[up]])
        .filter(u => u && u.c.kind === 'build' && u.c.build.end).map(u => endOf(u.c.build));
      return `<div class="wf-row">
        <div class="wf-lbl"><span class="mut">·</span>${name}</div>
        <div class="wf-lane">${gridLines}<span class="wf-ghost" style="left:${ghostX.length ? Math.min(Math.max(...ghostX), 78).toFixed(1) : 2}%">
          ${c.kind === 'decision' ? `${PK.status.REASON[c.decision.code] && PK.status.REASON[c.decision.code].family === 'wont_run' ? '∅' : '…'} ${esc(reasonLabel(c.decision))}` : 'no build'}</span></div>
      </div>`;
    }).join('')}
      </div>
      ${timed.length ? `<div class="mut small wf-note">wall clock <b>${fmtDur(wall)}</b> · job time <b>${fmtDur(busy)}</b> · vertical lines mark dependencies</div>` : ''}
    </div>`;
  };
})(window.PK);
