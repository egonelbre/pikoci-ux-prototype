// Views B: Pipeline (graph with context selector / versions / config),
// Build page v2, Ops, Audit, Teams, Settings.
(function () {
  'use strict';
  const { esc, st, ago, fmtDur, bDur, reasonLabel } = P;
  const D = () => window.DATA;

  // ---------- DAG layout ----------------------------------------------------
  function layers(pl) {
    const depth = {};
    const jd = name => {
      if (depth[name] != null) return depth[name];
      depth[name] = 0;
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of j.inputs || []) for (const p of inp.passed || []) d = Math.max(d, jd(p) + 1);
      return (depth[name] = d);
    };
    pl.jobs.forEach(j => jd(j.name));
    const out = [pl.resources.map(r => ({ kind: 'res', name: r.name }))];
    const maxD = Math.max(0, ...Object.values(depth));
    for (let d = 0; d <= maxD; d++) out.push(pl.jobs.filter(j => depth[j.name] === d).map(j => ({ kind: 'job', name: j.name })));
    return { out, depth };
  }
  function graphSVG(pl, ctxRef) {
    const L = layers(pl).out;
    const nodeW = 158, nodeH = 44, resW = 130, resH = 30, gapX = 84, gapY = 36, pad = 20;
    // a long sequential chain wraps like text: layers flow left→right and
    // continue on the next row instead of scrolling off into the void
    const MAXW = 1160, rowGap = 52, wrapGutter = 42; // right space reserved for the ↴ hooks
    const rowOf = [], layerX = [];
    let x = pad, row = 0, maxRowW = 0;
    L.forEach((layer, li) => {
      const w = li === 0 ? resW : nodeW;
      if (x + w + pad + wrapGutter > MAXW && x > pad) { row++; x = pad; }
      rowOf[li] = row; layerX[li] = x; x += w + gapX;
      maxRowW = Math.max(maxRowW, x - gapX + pad);
    });
    const nRows = row + 1;
    const rowH = new Array(nRows).fill(0);
    L.forEach((layer, li) => {
      const h = li === 0 ? resH : nodeH;
      rowH[rowOf[li]] = Math.max(rowH[rowOf[li]], layer.length * (h + gapY) - gapY);
    });
    const rowY = []; let acc = pad;
    for (let r = 0; r < nRows; r++) { rowY[r] = acc; acc += rowH[r] + rowGap; }
    // horizontal alignment per row: center (no ragged-right whitespace) —
    // except a lone continuation row, which tucks under the previous row's
    // last column so its wrap connector stays short
    const rowLis = [];
    L.forEach((_, li) => (rowLis[rowOf[li]] = rowLis[rowOf[li]] || []).push(li));
    const contentW = maxRowW - 2 * pad;
    const xOff = rowLis.map((lis, r) => {
      const last = lis[lis.length - 1], lw = last === 0 ? resW : nodeW;
      const rowW = layerX[last] + lw - pad;
      if (r > 0 && lis.length === 1) {
        const prev = rowLis[r - 1];
        return Math.max(0, Math.min(layerX[prev[prev.length - 1]] - pad, contentW - rowW));
      }
      return (contentW - rowW) / 2;
    });
    // wrapped graphs reserve a LEFT gutter too, so the drop lanes into a
    // row's first column have room to sit side by side instead of stacking
    const LX = nRows > 1 ? 34 : 0;
    const pos = {};
    L.forEach((layer, li) => {
      const w = li === 0 ? resW : nodeW, h = li === 0 ? resH : nodeH;
      const used = layer.length * (h + gapY) - gapY;
      let y = rowY[rowOf[li]] + (rowH[rowOf[li]] - used) / 2; // center within row
      layer.forEach(n => { pos[n.name] = { x: LX + layerX[li] + xOff[rowOf[li]], y, w, h, kind: n.kind, row: rowOf[li] }; y += h + gapY; });
    });
    const W = LX + maxRowW + (nRows > 1 ? 26 : 0), H = acc - rowGap + pad; // gutters for the wrap lanes
    let edges = '';
    // ---- collect edges: same-row (flat) + per-source wrap groups ----------
    const flat = [];
    const wrapGroups = new Map();
    for (const j of pl.jobs) for (const inp of j.inputs || []) {
      const targets = (inp.passed && inp.passed.length) ? inp.passed : [inp.res];
      for (const from of targets) {
        const a = pos[from], b = pos[j.name];
        if (!a || !b) continue;
        const sw = inp.passed && inp.passed.length ? 2 : 1.4;
        const dash = inp.trigger === false ? 'stroke-dasharray="4 4"' : '';
        if (a.row === b.row) flat.push({ from, to: j.name, a, b, sw, dash });
        else {
          const key = from + '|' + b.row;
          if (!wrapGroups.has(key)) wrapGroups.set(key, { from, a, row: b.row, sw, dash, targets: [] });
          wrapGroups.get(key).targets.push({ name: j.name, p: b });
        }
      }
    }
    // ---- wrap lanes: topmost source takes the outermost right lane and the
    // lowest channel; entry lanes reverse so channels never cross drops -----
    const byRow = {};
    for (const g of wrapGroups.values()) (byRow[g.row] = byRow[g.row] || []).push(g);
    for (const row of Object.keys(byRow)) {
      const gs = byRow[row].sort((p, q) => p.a.y - q.a.y);
      gs.forEach((g, i) => {
        g.k = (gs.length - 1 - i) % 5;
        g.kIn = Math.min(gs.length, 5) - 1 - g.k;
        g.xR = LX + maxRowW - pad + 10 + g.k * 6;
        g.cy = rowY[g.row] - Math.round(rowGap * 0.62) + g.k * 6;
        if (g.targets.length > 1) {
          g.targets.sort((p, q) => p.p.y - q.p.y);
          g.jx = Math.max(8, 8 + g.k * 6);
          g.jy = g.targets.reduce((s2, t) => s2 + t.p.y + t.p.h / 2, 0) / g.targets.length + (g.k - (gs.length - 1) / 2) * 22;
        }
      });
    }
    // ---- ports: a node's outgoing/incoming attachment points spread evenly
    // along its edge, ordered by where the OTHER end sits vertically --------
    const outs = {}, ins = {};
    const slot = (m, name) => (m[name] = m[name] || []);
    const cYp = p => p.y + p.h / 2;
    for (const e of flat) {
      slot(outs, e.from).push({ key: cYp(e.b), set: y => { e.y1 = y; } });
      slot(ins, e.to).push({ key: cYp(e.a), set: y => { e.y2 = y; } });
    }
    for (const g of wrapGroups.values()) {
      slot(outs, g.from).push({ key: 1e6 + g.row, set: y => { g.y1 = y; } }); // trunk leaves at the bottom port
      if (g.targets.length === 1) {
        // drops arrive from above; among drops, the upper channel's takes the
        // lower port (its horizontal then passes under the inner verticals)
        slot(ins, g.targets[0].name).push({ key: -1e6 - g.cy, set: y => { g.entryY = y; } });
      } else {
        g.fanY = {};
        for (const t of g.targets)
          slot(ins, t.name).push({ key: g.jy, set: y => { g.fanY[t.name] = y; } });
      }
    }
    for (const m of [outs, ins]) for (const name of Object.keys(m)) {
      const p = pos[name], list = m[name].sort((x2, y2) => x2.key - y2.key);
      list.forEach((it, i) => it.set(p.y + p.h * (i + 1) / (list.length + 1)));
    }
    // ---- emit -------------------------------------------------------------
    for (const e of flat) {
      const x1 = e.a.x + e.a.w, x2 = e.b.x, mx = (x1 + x2) / 2;
      edges += `<path d="M${x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${x2},${e.y2}" fill="none"
        stroke="var(--edge)" stroke-width="${e.sw}" ${e.dash}/>`;
    }
    for (const g of wrapGroups.values()) {
      const R = 10, cap = 'stroke-linecap="round" stroke-linejoin="round"';
      const head = (x2, y2) => `<path d="M${x2 - 1},${y2} l-8,-4.5 v9 z" fill="var(--edge)"/>`;
      const trunkTo = (ex, ey) => `<path d="M${g.a.x + g.a.w},${g.y1} H${g.xR - R} q${R},0 ${R},${R} V${g.cy - R} q0,${R} -${R},${R} H${ex + R} q-${R},0 -${R},${R} V${ey}"
          fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>`;
      if (g.targets.length === 1) {
        const b2 = g.targets[0].p, y2 = g.entryY, ex = Math.max(6, b2.x - 12 - g.kIn * 5);
        edges += trunkTo(ex, y2 - R) +
          `<path d="M${ex},${y2 - R} q0,${R} ${R},${R} H${b2.x - 2}" fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>` +
          head(b2.x, y2);
      } else {
        // fan-out splits ONCE at an invisible node in the new row's gutter
        edges += trunkTo(g.jx, g.jy);
        for (const t of g.targets) {
          const y2 = g.fanY[t.name], mx = (g.jx + t.p.x) / 2;
          edges += `<path d="M${g.jx},${g.jy} C${mx},${g.jy} ${mx},${y2} ${t.p.x - 2},${y2}" fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>` + head(t.p.x, y2);
        }
      }
    }
    let nodes = '';
    const refs = new Set();
    for (const [nm, n] of Object.entries(pos)) {
      if (n.kind === 'res') {
        const r = pl.resources.find(r => r.name === nm);
        const border = r.checkError ? 'var(--warn)' : (r.pinned ? 'var(--run)' : 'var(--edge)');
        nodes += `<g class="gnode"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" fill="var(--bg1)" stroke="${border}" stroke-width="${r.pinned || r.checkError ? 2.5 : 1.4}"/>
          <text x="${n.x + 10}" y="${n.y + n.h / 2 + 4}" class="t-res">${r.pinned ? '📌 ' : ''}${r.checkError ? '⚠ ' : ''}${esc(nm)}</text></g>`;
        continue;
      }
      // job node: colored per the selected context; per-node ref annotation
      let cell, refUsed;
      if (ctxRef) { cell = P.jobCell(pl, nm, ctxRef); refUsed = ctxRef; }
      else { // primary-latest: per-job latest build (annotated), else decision on newest primary ref
        const bs = P.jobBuilds(pl, nm);
        if (bs.length) { cell = { kind: 'build', build: bs[0], status: P.bStatus(bs[0]) }; refUsed = Object.values(bs[0].intent.versions)[0]; }
        else { cell = { kind: 'none', status: 'none' }; refUsed = ''; }
      }
      if (refUsed) refs.add(refUsed);
      const s = cell.status;
      const j = pl.jobs.find(j => j.name === nm);
      const sub = cell.kind === 'build'
        ? `#${cell.build.n} · ${cell.build.end ? fmtDur(bDur(cell.build)) : st(s).label}${cell.build.artifacts ? ' · 📦' : ''}`
        : cell.kind === 'decision' ? reasonLabel(cell.decision) : 'no build';
      const fill = cell.kind === 'build' ? st(s).color : 'var(--mut3)';
      const g = `<g class="gnode ${s === 'started' ? 'pulse' : ''}">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="5" fill="${fill}"/>
        <text x="${n.x + 9}" y="${n.y + 17}" class="t-job">${esc(nm)}${j.approve ? ' ⧖' : ''}</text>
        <text x="${n.x + 9}" y="${n.y + 32}" class="t-sub">${esc(sub)}${!ctxRef && refUsed ? ' @' + esc(refUsed) : ''}</text></g>`;
      // real SVG link — keyboard-focusable and announced, unlike an onclick <g>
      nodes += cell.kind === 'build' ? `<a href="#/b/${cell.build.id}" aria-label="${esc(nm)}: ${esc(sub)}">${g}</a>` : g;
    }
    const spanning = !ctxRef && refs.size > 1 ? `<div class="spanning">composite view — spanning ${[...refs].join(' … ')} (each node shows its own ref; pick a context to make it one commit)</div>` : '';
    return spanning + `<div class="graph-scroll"><svg width="${W}" height="${H}" aria-label="pipeline graph">${edges}${nodes}</svg></div>`;
  }

  // ---------- Pipeline page -------------------------------------------------
  VIEWS.pipeline = function (name, view, ctx) {
    const pl = P.getPipeline(name);
    if (!pl) return '<div class="page">Unknown pipeline</div>';
    view = view || 'graph';
    const s = P.primaryStatus(pl);
    const V = v => `<a class="tab ${view === v ? 'on' : ''}" href="#/p/${name}/${v}">${v[0].toUpperCase() + v.slice(1)}</a>`;
    // context chips: primary-latest + lineage heads + recent versions
    const res = pl.resources[0];
    const ctxChips = [`<a class="commit-chip ${!ctx ? 'on' : ''}" href="#/p/${name}/${view}">primary-latest</a>`]
      .concat((res.versions || []).slice(0, 4).map(v =>
        `<a class="commit-chip ${ctx === v.id.ref ? 'on' : ''}" href="#/p/${name}/${view}/${v.id.ref}" title="${esc(v.meta.msg || '')}">${esc(v.id.ref)}</a>`));
    let body = '';
    if (view === 'graph') {
      body = graphSVG(pl, ctx || null);
      // outputs of the builds this graph is showing (same per-node selection:
      // the chosen context, or each job's latest build on primary-latest)
      const outs = [];
      for (const j of pl.jobs) {
        let bb = null;
        if (ctx) { const c = P.jobCell(pl, j.name, ctx); bb = c.kind === 'build' ? c.build : null; }
        else bb = P.jobBuilds(pl, j.name)[0] || null;
        if (bb && bb.artifacts) for (const a of bb.artifacts) outs.push({ a, b: bb });
      }
      if (outs.length) body += `<h3>Outputs <span class="mut small">— produced by ${ctx ? `<code>${esc(ctx)}</code>` : 'the builds shown'}</span></h3>
        <div class="tbl-scroll"><table class="tbl ctbl wtbl">
        ${outs.map(({ a, b: ab }) => `<tr>
          <td class="nowrap">📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a></td>
          <td class="mut small nowrap">${esc(a.size)}</td>
          <td class="mut small nowrap">${a.sha ? `sha256 <code>${esc(a.sha)}…</code>` : ''}</td>
          <td class="mut small">${a.dest ? `→ ${esc(a.dest)}` : '<span class="mut">worker-local · retention pending</span>'}</td>
          <td class="mut small r nowrap">from <a href="#/b/${ab.id}">${esc(ab.job)} #${ab.n}</a></td>
        </tr>`).join('')}
        </table></div>`;
    }
    else if (view === 'versions') {
      body = `<div class="tbl-scroll"><table class="tbl">${(res.versions || []).map(v => {
        return `<tr><td width="20">${res.pinned && res.pinned.ref === v.id.ref ? '📌' : ''}</td>
          <td><code>${esc(v.id.ref)}</code></td>
          <td>${esc(v.meta.msg || '')} ${v.meta.author ? `<span class="mut small">· ${esc(v.meta.author)}</span>` : ''}</td>
          <td class="mut small nowrap">${ago(v.meta.at)}</td>
          <td><span class="dots">${pl.jobs.filter(P.isRunJob).map(j => VIEWS.jobDot(pl, j.name, v.id.ref)).join('')}</span></td>
        </tr>`;
      }).join('')}</table></div>
      ${res.pinned ? `<div class="warnbox gap">📌 pinned to <code>${esc(res.pinned.ref)}</code> by <b>${esc(res.pinned.actor)}</b> — "${esc(res.pinned.reason)}" (${ago(res.pinned.at)}). Newer versions are ignored; escape hatches carry actor + reason.</div>` : ''}`;
    } else if (view === 'config') {
      body = `<div class="pad">
        <div class="mut small gap-s">Revision-guarded set (CAS): a stale editor gets a conflict + three-way diff, never a silent overwrite. Restore creates a new revision.</div>
        <div class="tbl-scroll"><table class="tbl"><thead><tr><th>rev</th><th>by</th><th>when</th><th>note</th><th></th></tr></thead>
        ${pl.configHistory.map((h, i) => `<tr><td><b>${h.rev}</b>${i === 0 ? ' <span class="chip">current</span>' : ''}</td>
          <td>${esc(h.by)}</td><td class="mut small">${ago(h.at)}</td><td>${esc(h.note)}</td>
          <td class="r">${i > 0 ? `<button class="btn sm" data-act="noop">diff</button> <button class="btn sm" data-act="noop">restore as rev ${pl.configHistory[0].rev + 1}</button>` : ''}</td></tr>`).join('')}
        </table></div></div>`;
    }
    return `<div class="page">
      <div class="crumbs"><a href="#/pipelines">pipelines</a> / <b>${esc(pl.team)}/${esc(name)}</b>
        ${pl.primaryContext.kind !== 'lineages' ? `<span class="c-${s} ${s === 'started' ? 'pulse' : ''}">${st(s).sym} ${st(s).label}</span>` : '<span class="mut small">per-PR status — see Changes</span>'}
        ${pl.public ? '<span class="chip">public</span>' : ''}
        ${pl.paused ? `<span class="c-paused">❚❚ paused by ${esc(pl.pausedMeta.actor)} — "${esc(pl.pausedMeta.reason)}"</span>` : ''}
        <span class="tabs-inline">${V('graph')}${V('versions')}${V('config')}</span>
        <span class="sp"></span>
        <button class="btn sm" data-act="${pl.paused ? 'unpause' : 'pause'}" data-arg="${name}">${pl.paused ? '▶ Unpause' : '❚❚ Pause'}</button>
      </div>
      ${view === 'graph' ? `<div class="ctx-banner">context: ${ctxChips.join('')} <span class="mut small">— statuses are for this context only</span></div>` : ''}
      ${pl.resources.some(r => r.checkError) ? `<div class="errbox">⚠ ${esc(pl.resources.find(r => r.checkError).name)} check failing — new versions are not being detected. <button class="btn sm" data-act="check" data-arg="${name}|${esc(pl.resources.find(r => r.checkError).name)}">↻ Re-check</button></div>` : ''}
      ${body}
    </div>`;
  };

  // ---------- Pipelines: dense data table (weather + duration trend) --------
  let pipFilter = '', pipChip = 'all';
  window._pipF = v => { pipFilter = v; P.App.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._pipC = c => { pipChip = c; P.App.refresh(); };

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
    let pls = P.pipelines();
    const total = pls.length;
    const isPR = pl => pl.primaryContext.kind === 'lineages';
    if (pipChip === 'failing') pls = pls.filter(pl => P.primaryStatus(pl) === 'failed' || (isPR(pl) && P.secondaryCounts(pl).failing));
    else if (pipChip === 'running') pls = pls.filter(pl => ['started', 'pending'].includes(P.primaryStatus(pl)) || (isPR(pl) && P.secondaryCounts(pl).running));
    else if (pipChip === 'paused') pls = pls.filter(pl => pl.paused);
    else if (pipChip === 'pr') pls = pls.filter(isPR);
    if (pipFilter) {
      const q = pipFilter.toLowerCase();
      pls = pls.filter(pl => (pl.team + '/' + pl.name + ' ' + pl.desc).toLowerCase().includes(q));
    }
    const order = s => s === 'failed' ? 0 : s === 'started' ? 1 : 2;
    const sorted = g => g.slice().sort((a, b) => order(P.primaryStatus(a)) - order(P.primaryStatus(b)) || a.name.localeCompare(b.name));
    const row = pl => {
      const s = P.primaryStatus(pl);
      const pr = isPR(pl);
      const counts = pr ? P.secondaryCounts(pl) : null;
      const hist = P.plHistory(pl);
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
    const grouped = !P.team() && pls.length > 9;
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
        <span class="mut small">${pls.length} of ${total}${P.team() ? ' · team ' + esc(P.team()) : ''}</span>
      </div>
      <div class="tbl-scroll"><table class="tbl ctbl ptbl">${head}<tbody>${rows}</tbody></table></div>
      <p class="mut small">Weather = last 10 completed runs (glyph is the pass rate); duration bars are the same runs oldest→newest — ↑/↓ marks the last run drifting beyond ±25%/−20% of the median. Real installs derive both from the builds table; deep history lands with Insights (Phase 4).</p>
    </div>`;
  };

  // ---------- Build page v3: two-pane run view ------------------------------
  // Sidebar keeps the whole run's stages AND the current build's steps on
  // hand; the log pane gets the rest of the viewport (logs can be 40MB —
  // finding a step must not mean scrolling through them blind).
  VIEWS.build = function (id) {
    const b = P.getBuild(id);
    if (!b) return '<div class="page">Build not found</div>';
    const pl = P.getPipeline(b.pipeline);
    const s = P.bStatus(b);
    const ref = Object.values(b.intent.versions)[0];
    const vm = P.vmeta(pl, ref);
    const failIdx = P.firstFailStep(b);
    // waiting builds included: the approval card's "diff since last deploy"
    // link needs a cmpbox to reveal (it used to point at nothing)
    const cmp = ['failed', 'succeeded', 'warning', 'waiting_for_approval'].includes(b.status) ? P.compareWithLastGreen(b) : null;
    const cmpHidden = b.status === 'waiting_for_approval';
    const history = P.jobBuilds(pl, b.job).slice(0, 8);
    const stall = P.lastOutputAge(b);
    const j = pl.jobs.find(x => x.name === b.job);
    const newerExists = b.status === 'waiting_for_approval' && pl.resources[0].versions[0] && pl.resources[0].versions[0].id.ref !== ref;
    // PR-triggered build → the change it belongs to (for the way back up)
    const lin = pl.primaryContext.kind === 'lineages'
      ? D().lineages.find(l => (l.pl || 'pikoci-pr') === pl.name && l.changes.some(c => c.id.ref === ref)) : null;

    const actions = [];
    if (b.status === 'waiting_for_approval') actions.push(
      `<button class="btn primary" data-act="approve" data-arg="${b.id}">✓ Approve</button>`,
      `<button class="btn danger" data-act="rejectask" data-arg="${b.id}">✕ Reject…</button>`);
    if (s === 'held') actions.push(`<button class="btn primary" data-act="release" data-arg="${b.id}">▶ Release</button>`);
    if (['started', 'pending'].includes(b.status) && s !== 'held') actions.push(`<button class="btn" data-act="cancel" data-arg="${b.id}">Cancel</button>`);
    if (['failed', 'succeeded', 'cancelled', 'warning'].includes(b.status)) actions.push(`<button class="btn" data-act="retry" data-arg="${b.id}">↻ Retry</button>`);

    // --- sidebar: the run's stages (jobs at this ref, DAG order, matrix grouped)
    const depths = layers(pl).depth;
    const runJobs = pl.jobs.filter(P.isRunJob).slice()
      .sort((a, c) => (depths[a.name] - depths[c.name]) || a.name.localeCompare(c.name));
    let sideJobs = '', lastGrp = null;
    for (const jj of runJobs) {
      const g = jj.group || null;
      if (g !== lastGrp) {
        if (g) sideJobs += `<div class="b2-grp">${esc(g)} <span class="mut">(matrix ×${runJobs.filter(x => x.group === g).length})</span></div>`;
        lastGrp = g;
      }
      const label = g ? jj.name.slice(g.length + 2) : jj.name;
      const c = P.jobCell(pl, jj.name, ref);
      if (c.kind === 'build') {
        const cs = c.status;
        sideJobs += `<a class="jrow ${c.build.id === b.id ? 'on' : ''}" href="#/b/${c.build.id}">
          <span class="c-${cs} ${cs === 'started' ? 'pulse' : ''}">${st(cs).sym}</span>
          <span class="jname">${esc(label)}</span>
          <span class="mut small nowrap">${c.build.end ? fmtDur(bDur(c.build)) : st(cs).label}</span></a>`;
      } else if (c.kind === 'decision') {
        sideJobs += `<span class="jrow dim">${VIEWS.reasonChip(c.decision, jj.name)}<span class="jname">${esc(label)}</span></span>`;
      } else {
        sideJobs += `<span class="jrow dim"><span class="mut">·</span><span class="jname">${esc(label)}</span><span class="mut small">no build</span></span>`;
      }
    }

    // --- sidebar: this build's steps — click = expand (if folded) + scroll to it
    const sideSteps = b.steps.map((sp, i) => `<button type="button" class="jrow st"
      onclick="const x=document.getElementById('step-${i}');if(!x)return;const d=x.querySelector('.step-head + div');if(d&&d.hidden){d.hidden=false;x.querySelector('.step-head').setAttribute('aria-expanded','true')}x.scrollIntoView({behavior:'smooth'})">
      <span class="c-${sp.status} ${sp.status === 'started' ? 'pulse' : ''}">${st(sp.status).sym}</span>
      <span class="mut small type">${sp.type}</span><span class="jname">${esc(sp.name)}</span>
      <span class="mut small nowrap">${sp.dur ? fmtDur(sp.dur) : ''}</span></button>`).join('')
      || '<div class="jrow dim"><span class="mut small">no steps yet</span></div>';

    return `<div class="page b2-page">
      <div class="crumbs b2-head">
        <span class="c-${s} ${s === 'started' ? 'pulse' : ''} b2-sym">${st(s).sym}</span>
        <div class="b2-titles">
          <div class="b2-title">${esc(vm.meta.msg || b.job + ' #' + b.n)}</div>
          <div class="mut small" data-live><a href="#/p/${b.pipeline}/graph">${esc(b.pipeline)}</a> #${b.n}
            ${lin ? ` · <a href="#/changes/pr/${lin.n}"><b>PR #${lin.n}</b></a>` : ''}
            · <code>${esc(ref)}</code>${vm.meta.author ? ' · ' + esc(vm.meta.author) : ''} · ${ago(b.start)}
            · <span class="c-${s}">${st(s).label}</span> ${fmtDur(bDur(b)) ? '· ' + fmtDur(bDur(b)) : ''}
            · <span title="cause">${esc(b.cause.detail)}</span> · rev ${b.intent.configRev}
            ${b.retryOf ? ` · <span class="chip">retry of ${esc(b.retryOf)}</span>` : ''}
            ${b.queue && s !== 'held' ? ` · <b>${b.queue.matching === 0 ? `no healthy worker with tag "${esc(b.queue.tag)}"` : `${b.queue.matching} matching worker for "${esc(b.queue.tag)}", busy`}</b>` : ''}
            ${s === 'held' ? ' · <b>held: awaiting maintainer release (fork PR)</b>' : ''}
            ${stall != null && stall > 60 ? ` · <b class="c-failed">no output for ${fmtDur(stall)}</b>` : ''}</div>
        </div>
        <span class="sp"></span>${actions.join(' ')}
      </div>

      <div class="b2">
        <aside class="b2-side" id="b2side" data-keep-scroll>
          ${lin ? `<a class="jrow b2-back" href="#/changes/pr/${lin.n}" title="${esc(lin.title)}">
            <span aria-hidden="true">←</span><span class="jname"><b>PR #${lin.n}</b> ${esc(lin.title)}</span></a>` : ''}
          <div class="b2-sec">run · <code>${esc(ref)}</code></div>
          ${sideJobs}
          <div class="b2-sec">steps — ${esc(b.job)}</div>
          ${sideSteps}
          <div class="b2-sec">history — ${esc(b.job)}</div>
          <div class="b2-hist">${history.map(x => `<a class="c-${P.bStatus(x)}" href="#/b/${x.id}" title="${ago(x.start)}" ${x.id === b.id ? 'style="font-weight:700;text-decoration:underline"' : ''}>${st(P.bStatus(x)).sym}#${x.n}</a>`).join(' ')}</div>
          <details class="b2-det" data-det="prov:${b.id}"><summary>provenance</summary>
            intent: ${Object.entries(b.intent.versions).map(([r, v]) => `<code title="${esc(r)}">${esc(v)}</code>`).join(' ')}
            ${b.resolved ? `<br>resolved: ${Object.entries(b.resolved.versions).map(([r, v]) => `<code>${esc(v)}</code>`).join(' ')} on <b>${esc(b.resolved.worker)}</b>` : '<br><i>not yet resolved (pending builds show intent only)</i>'}
            ${vm.meta.msg ? `<br>"${esc(vm.meta.msg)}" (${esc(vm.meta.author || '')})` : ''}
          </details>
          <details class="b2-det" data-det="local:${b.id}"><summary>run locally</summary>
            same job, same config, your working tree:
            <pre class="cmdline">pikoci run -p pipeline.hcl -j ${esc(b.job)} --resource ${esc(Object.keys(b.intent.versions)[0])}=./</pre>
            <button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.previousElementSibling.textContent);P.toast('Copied')">copy</button>
          </details>
          <div class="b2-det mut"><span class="kbd">f</span> next failure · <span class="kbd">⌘K</span> actions</div>
        </aside>

        <main class="b2-log" id="logpane" data-keep-scroll ${b.status === 'started' ? 'data-follow' : ''}>
          ${b.status === 'waiting_for_approval' ? `<div class="appr-card">
            <div><b>⧖ ${esc(j.approve.name)}</b> — 1 of ${j.approve.need} approvals</div>
            <div class="mut small">bound to <code>${esc(ref)}</code> @ config rev ${b.intent.configRev} · maria approved ${ago(Date.now() - 12 * 60e3)}
              · <a href="javascript:void(0)" onclick="document.getElementById('cmpbox')&&(document.getElementById('cmpbox').hidden=false)">diff since last deploy</a></div>
            ${newerExists ? `<div class="warn-line">⚠ <b>superseded-while-waiting</b>: trunk has moved past <code>${esc(ref)}</code> — approving deploys the bound version, not the newest.</div>` : ''}
            <div class="mut small">while gated the build holds no worker and nothing has run — on approval it queues, then starts.</div>
            <div class="rejbox" id="rejbox-${b.id}" hidden data-fold="rej:${b.id}">
              <input aria-label="reject reason (required)" placeholder="reason — required, recorded in the audit log">
              <button class="btn danger" data-act="reject" data-arg="${b.id}">✕ Reject build</button>
            </div>
          </div>` : ''}

          ${failIdx >= 0 ? `<div class="err-first">
            <div class="err-head">✕ first failure: ${esc(b.steps[failIdx].name)}
              <a href="javascript:void(0)" onclick="document.getElementById('step-${failIdx}').scrollIntoView({behavior:'smooth'})">jump ↓</a></div>
            <pre class="log excerpt">${b.steps[failIdx].log.filter(l => /FAIL|ERROR|Error /.test(l)).slice(0, 4).map(l => `<span class="l-err">${esc(l)}</span>`).join('\n')}</pre>
          </div>` : ''}

          ${VIEWS.testSection(pl, b)}

          ${cmp ? `<div class="cmp" id="cmpbox" ${cmpHidden ? `hidden data-fold="cmp:${b.id}"` : ''}>
            <b>Compare with last green</b> <span class="mut small">(#${cmp.green.n}, ${ago(cmp.green.start)})</span>
            ${cmp.diffs.length ? cmp.diffs.map(d => `<div class="small">· ${esc(d.res)}: <code>${esc(d.from)}</code> → <code>${esc(d.to)}</code>
              ${d.toMeta.msg ? `— "${esc(d.toMeta.msg)}" (${esc(d.toMeta.author || '')})` : ''}</div>`).join('')
            : '<div class="small mut">· same input versions — look at environment, not code</div>'}
            <div class="small mut">· duration ${cmp.durDelta >= 0 ? '+' : ''}${fmtDur(Math.abs(cmp.durDelta))} vs last green</div>
          </div>` : ''}

          ${!b.steps.length ? `<div class="panel"><div class="pad mut">
            ${s === 'held' ? 'Nothing has run — this build is held awaiting maintainer release; no code or secrets have touched a worker.'
          : b.queue ? `Nothing has run yet — the build is queued (${b.queue.matching === 0 ? `no healthy worker with tag "${esc(b.queue.tag)}"` : `${b.queue.matching} matching worker, busy`}). Output will stream here when a worker picks it up.`
          : 'No output yet — steps will appear when the build starts.'}
          </div></div>` : ''}
          <div id="steps">
          ${b.steps.map((sp, i) => `<div class="step" id="step-${i}">
            <button class="step-head" aria-expanded="${sp.status === 'failed' || sp.status === 'started'}"
              onclick="const x=this.nextElementSibling;x.hidden=!x.hidden;this.setAttribute('aria-expanded',!x.hidden)">
              <span class="c-${sp.status} ${sp.status === 'started' ? 'pulse' : ''}">${st(sp.status).sym}</span>
              <span class="mut small type">${sp.type}</span><b>${esc(sp.name)}</b>
              <span class="sp"></span><span class="mut small">${sp.dur ? fmtDur(sp.dur) : ''}</span>
            </button>
            <div ${sp.status === 'failed' || sp.status === 'started' ? '' : 'hidden'} data-fold="st:${b.id}:${i}">
              ${sp.log.length > 200 ? `<div class="mut small pad-s">showing last 200 of ${sp.log.length} lines · <a href="javascript:void(0)" data-act="noop">download full log</a> <span class="mut">(tail-first)</span></div>` : ''}
              ${sp.log.length ? `<pre class="log">${sp.log.slice(-200).map((l, k) => `<span class="ln"><span class="lno">${Math.max(0, sp.log.length - 200) + k + 1}</span>${/FAIL|ERROR|Error /.test(l) ? `<span class="l-err">${esc(l)}</span>` : /✓|^ok |OK$|PASS/.test(l) ? `<span class="l-ok">${esc(l)}</span>` : /^\$ /.test(l) ? `<span class="l-cmd">${esc(l)}</span>` : esc(l)}</span>`).join('\n')}</pre>` : '<div class="pad-s mut small">no output yet</div>'}
            </div>
          </div>`).join('')}
          </div>
          ${b.artifacts && b.artifacts.length ? `<h3>Outputs</h3>
          <div class="tbl-scroll"><table class="tbl ctbl wtbl">
          ${b.artifacts.map(a => `<tr>
            <td class="nowrap">📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a></td>
            <td class="mut small nowrap">${esc(a.size)}</td>
            <td class="mut small nowrap">${a.sha ? `sha256 <code>${esc(a.sha)}…</code>` : ''}</td>
            <td class="mut small">${a.dest ? `→ ${esc(a.dest)}` : '<span class="mut">worker-local · retention pending</span>'}</td>
          </tr>`).join('')}
          </table></div>` : ''}
        </main>
      </div>
    </div>`;
  };

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
      const stats = P.testStats(b);
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
        const isNew = P.isNewFailure(pl, b.job, b, t.id);
        const hist = P.testHistory(pl, b.job, b, t.id);
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
        oninput="window._tq=this.value;P.App.refresh();const f=[...document.querySelectorAll('input[aria-label=&quot;find a test&quot;]')][0];if(f){f.focus();f.setSelectionRange(999,999)}">
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
        const d = P.measurementDelta(pl, b, m);
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

  // ---------- Ops / Audit / Teams / Settings --------------------------------
  // ---------- Queue: "when does my job start / how big is the workload" -----
  VIEWS.queue = function () {
    const scoped = b => P.inTeam(P.getPipeline(b.pipeline));
    const pend = D().builds.filter(b => b.status === 'pending' && !b.heldReason && b.queue && scoped(b))
      .sort((a, b) => a.start - b.start);
    const running = D().builds.filter(b => b.status === 'started' && scoped(b)).sort((a, b) => a.start - b.start);
    const workers = D().workers.filter(w => !P.team() || !w.team || w.team === P.team());
    const pools = D().pools.filter(p => !P.team() || !p.team || p.team === P.team());
    const online = workers.filter(w => w.status === 'online');
    const booting = workers.filter(w => w.status === 'provisioning');
    // --concurrency N registers N single-build workers (name-1…name-N);
    // capacity is counted in registered workers, not "slots" (Workers.md)
    const regd = online.reduce((s, w) => s + (w.concurrency || 1), 0);
    const busy = online.reduce((s, w) => s + (w.running || 0), 0);
    const poolFor = t => pools.find(p => p.tags.includes(t));
    // per-tag capacity for tags in demand
    const tags = [...new Set(pend.map(b => b.queue.tag))];
    return `<div class="page"><h1>Queue${P.team() ? ` <span class="mut small">· team ${esc(P.team())}</span>` : ''}</h1>
      <div class="meta" data-live><b>${running.length}</b> running · <b>${pend.length}</b> queued ·
        capacity <b>${busy}/${regd}</b> registered workers busy <span class="mut small">(--concurrency N registers N single-build workers)</span> on ${online.length} healthy host${online.length === 1 ? '' : 's'}${booting.length ? ` <b class="c-pending">+ ${booting.length} provisioning</b> (${booting.reduce((s, w) => s + (w.concurrency || 1), 0)} more on the way)` : ''}</div>
      ${pend.length ? `<h2>Waiting</h2>
      <div class="tbl-scroll"><table class="tbl ctbl"><thead><tr><th></th><th>build</th><th>needs</th><th>why it waits</th><th class="r">waiting</th><th class="r"></th></tr></thead>
      ${pend.map(b => `<tr onclick="location.hash='#/b/${b.id}'">
        <td class="c-pending">⏳</td>
        <td class="ct-title"><div class="ctt"><a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a></div></td>
        <td><code>${esc(b.queue.tag)}</code></td>
        <td class="${b.queue.matching === 0 && !poolFor(b.queue.tag) ? 'c-failed' : 'mut'} small">${b.queue.matching === 0
          ? (poolFor(b.queue.tag)
            ? `<span class="c-pending">pool ${esc(poolFor(b.queue.tag).name)} scaling up from zero (~${poolFor(b.queue.tag).bootSecs}s boot) — capacity on the way, not a config problem</span>`
            : `no healthy worker with tag "${esc(b.queue.tag)}" and no pool serves it — config problem, not load`)
          : `${b.queue.matching} matching worker, busy${b.queue.ahead ? ` · ${b.queue.ahead} ahead` : ''}`}</td>
        <td class="mut small r nowrap">${ago(b.start)}</td>
        <td class="r"><button class="btn sm" data-act="cancel" data-arg="${b.id}" onclick="event.stopPropagation()">Cancel</button></td>
      </tr>`).join('')}</table></div>` : '<div class="allclear">✓ Queue is empty — new jobs start as soon as a matching worker is free.</div>'}
      ${tags.length ? `<h2>Capacity by tag</h2>
      <div class="tbl-scroll"><table class="tbl ctbl"><thead><tr><th>tag</th><th>healthy workers</th><th class="r">busy</th><th class="r">queued</th></tr></thead>
      ${tags.map(t => {
      const m = online.filter(w => w.tags.includes(t));
      const bp = booting.filter(w => w.tags.includes(t));
      const pool = poolFor(t);
      return `<tr><td><code>${esc(t)}</code></td>
        <td>${m.length ? m.map(w => `<b>${esc(w.name)}</b>`).join(', ') : ''}${bp.length ? `${m.length ? ', ' : ''}<span class="c-pending">${bp.map(w => esc(w.name)).join(', ')} (booting)</span>` : ''}${!m.length && !bp.length ? (pool ? `<span class="c-pending">pool ${esc(pool.name)} · scaled to zero, scales 0–${pool.max} on demand</span>` : '<span class="c-failed">none — and no pool serves this tag</span>') : ''}</td>
        <td class="r">${m.reduce((s, w) => s + (w.running || 0), 0)}</td>
        <td class="r">${pend.filter(b => b.queue.tag === t).length}</td></tr>`;
    }).join('')}</table></div>` : ''}
      <h2>Running</h2>
      ${running.length ? `<div class="tbl-scroll"><table class="tbl ctbl">
      ${running.map(b => `<tr onclick="location.hash='#/b/${b.id}'">
        <td class="c-started pulse">●</td>
        <td class="ct-title"><div class="ctt"><a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a></div></td>
        <td class="mut small">on <b>${esc(b.worker)}</b></td>
        <td class="mut small r nowrap" data-live>${fmtDur(bDur(b))}</td>
      </tr>`).join('')}</table></div>` : '<div class="mut pad-s small">nothing running right now</div>'}
      <p class="mut small">Worker health lives under <a href="#/workers">Workers</a>.</p>
    </div>`;
  };

  // ---------- Workers: "are the machines well" ------------------------------
  // Static workers are pets with names; ephemeral instances are cattle whose
  // stable object is the POOL — instances group under it, terminated ones
  // roll up into a count instead of littering the table.
  VIEWS.workers = function (name) {
    if (name) return VIEWS.workerDetail(name);
    // Global workers are visible to every team, but dispatch PREFERS team
    // workers: a global worker skips a team's builds while that team has a
    // healthy team worker of its own (Workers.md)
    const workers = D().workers.filter(w => !P.team() || !w.team || w.team === P.team());
    const pools = D().pools.filter(p => !P.team() || !p.team || p.team === P.team());
    const gauge = (frac, warnAt) => {
      if (frac == null) return '<span class="mut small" title="no fresh heartbeat — last known value withheld rather than shown as current">—</span>';
      const pct = Math.round(frac * 100);
      const warn = frac >= warnAt;
      return `<span class="disk"><span class="disk-bar"><span style="width:${pct}%;background:${warn ? 'var(--warn, #d33)' : 'var(--spark)'}"></span></span>
        <span class="${warn ? 'c-failed' : 'mut'} small">${pct}%${warn ? ' ⚠' : ''}</span></span>`;
    };
    const disk = w => gauge(w.status === 'stale' ? null : w.disk, 0.85);
    const cpu = w => gauge(w.status === 'stale' ? null : w.cpu, 0.9);
    const row = w => `<tr onclick="location.hash='#/workers/${encodeURIComponent(w.name)}'">
        <td class="nowrap"><a class="row-link" href="#/workers/${encodeURIComponent(w.name)}"><b>${esc(w.name)}</b></a>${(w.concurrency || 1) > 1 ? ` <span class="mut small" title="--concurrency ${w.concurrency} registers ${esc(w.name)}-1…${esc(w.name)}-${w.concurrency} — each registered worker runs one build">×${w.concurrency}</span>` : ''}</td>
        <td class="nowrap">${w.status === 'provisioning'
        ? `<span class="c-pending pulse">◌</span> provisioning <span class="mut small">(${Math.round(w.up / 1000)}s)</span>`
        : `<span class="c-${w.status === 'online' ? 'succeeded' : 'failed'}">●</span> ${w.status === 'online' ? 'healthy' : w.status}${w.lastSeen ? ` <span class="mut small">(${ago(w.lastSeen)})</span>` : ''}${w.ephemeral && w.up ? ` <span class="mut small">· up ${P.fmtDur(w.up / 1000)}</span>` : ''}`}</td>
        <td>${w.team || '<span class="mut" title="global workers skip a team&#39;s builds while that team has a healthy team worker">Global</span>'}</td>
        <td>${w.tags.map(t => `<code>${t}</code>`).join(' ')}</td>
        <td class="nowrap">${w.status === 'provisioning' ? '<span class="mut small">—</span>' : cpu(w)}</td>
        <td class="nowrap">${w.status === 'provisioning' ? '<span class="mut small">—</span>' : disk(w)}</td>
        <td class="mut small">${w.version}${w.version < 'v0.9.4' ? ' <span class="chip" title="older than the server">behind</span>' : ''}</td>
        <td class="r">${w.running ? `${w.running}/${w.concurrency} busy` : w.status === 'provisioning' ? '' : '<span class="mut">idle</span>'}</td>
        <td class="r">${w.status === 'provisioning' ? '' : `<button class="btn sm" data-act="drain" data-arg="${esc(w.name)}" onclick="event.stopPropagation()" title="drain is worker-side today (SIGQUIT); click for details">drain</button>`}</td>
      </tr>`;
    const statics = workers.filter(w => !w.pool);
    const poolRows = pools.map(p => {
      const inst = workers.filter(w => w.pool === p.name);
      const online = inst.filter(w => w.status === 'online').length;
      const booting = inst.filter(w => w.status === 'provisioning').length;
      return `<tr class="tsub"><td colspan="9">⛅ ${esc(p.name)}
        <span class="mut">· ${esc(p.provider)} · autoscale ${p.min}–${p.max} · <b>${online} healthy</b>${booting ? ` + ${booting} provisioning` : ''}${online + booting === 0 ? ' — <b>scaled to zero</b> (first job boots one, ~' + p.bootSecs + 's)' : ''}
        · idle TTL ${esc(p.idleTtl)} · today: ${p.buildsToday} builds on ${p.terminatedToday + online} instances</span></td></tr>
      ${inst.map(row).join('')}`;
    }).join('');
    return `<div class="page"><h1>Workers${P.team() ? ` <span class="mut small">· team ${esc(P.team())} + Global</span>` : ''}</h1>
      <div class="tbl-scroll"><table class="tbl ctbl wtbl"><thead><tr><th>worker</th><th>state</th><th>team</th><th>tags</th><th>cpu</th><th>disk</th><th>version</th><th class="r">running</th><th class="r"></th></tr></thead>
      <tbody>
      ${statics.length ? `<tr class="tsub"><td colspan="9">static <span class="mut">· ${statics.length} registered</span></td></tr>${statics.map(row).join('')}` : ''}
      ${poolRows}
      </tbody></table></div>
      <p class="mut small">Ephemeral instances are addressed by pool, not by name: a build's provenance keeps the instance name as a tombstone record (it must never dangle), but health, drain, and capacity questions are asked of the pool. Terminated instances roll up into the pool's daily count.</p>
      <p class="mut small">This dashboard is admin-only (Workers.md). Global workers skip a team's builds while that team has a healthy team worker — team workers win dispatch, global workers are the fallback.</p>
      <h2>Storage</h2>
      <div class="mut small pad-s">artifacts: — · logs: 41 MB · meta-records (decisions, receipts, config history): 2.1 MB — retention classes with reference-preservation apply (never orphan a config rev a kept build ran under).</div>
      <p class="mut small">Scheduling load lives under <a href="#/queue">Queue</a>. Click a worker for its telemetry.</p>
    </div>`;
  };

  // ---------- Worker detail: cpu/disk overlaid, runs as bands ---------------
  let wkRange = 168; // hours shown: 168 / 24 / 6
  window._wkR = h => { wkRange = h; P.App.refresh(); };
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

  VIEWS.audit = function () {
    // audit is team-scoped in the backend too (per-team audit log endpoint)
    const rows = D().audit.filter(a => !P.team() || a.target.startsWith(P.team() + '/'));
    return `<div class="page"><h1>Audit${P.team() ? ` <span class="mut small">· team ${esc(P.team())}</span>` : ''}</h1>
      ${rows.length ? '' : `<div class="mut pad">No recorded actions for team ${esc(P.team())} in the demo window.</div>`}
      <div class="tbl-scroll"><table class="tbl"><thead><tr><th>when</th><th>who</th><th>action</th><th>target</th><th>detail</th></tr></thead>
      ${rows.map(a => `<tr><td class="mut small nowrap">${ago(a.at)}</td><td><b>${esc(a.user)}</b></td>
        <td><code>${esc(a.action)}</code></td><td>${esc(a.target)}</td><td class="mut small">${esc(a.detail)}</td></tr>`).join('')}</table></div>
      <p class="mut small">Every action in the preview writes here — approvals record what they were bound to; holds, releases, supersessions, pins and pauses carry actor + reason.</p></div>`;
  };

  VIEWS.teams = function () {
    return `<div class="page narrow"><h1>Teams</h1>
      ${D().teams.map(t => `<section class="panel"><div class="panel-head"><b>${esc(t.name)}</b><span class="mut small">${esc(t.desc)}</span></div>
        <div class="tbl-scroll"><table class="tbl">${t.members.map(m => `<tr><td><b>${esc(m.user)}</b></td><td><span class="chip">${m.role}</span></td>
          <td class="r"><button class="btn sm" data-act="noop">change role</button></td></tr>`).join('')}</table></div></section>`).join('')}
      <p class="mut small">Denied actions elsewhere follow "why + who can help" — e.g. a write-role user sees "release needs maintain — ask egon or maria."</p></div>`;
  };

  VIEWS.settings = function () {
    return `<div class="page narrow"><h1>Settings</h1>
      <section class="panel"><div class="panel-head"><b>Preview controls</b></div><div class="pad">
        <button class="btn" data-act="theme">◐ Toggle light/dark</button>
        <button class="btn" data-act="solo">${D().soloMode ? 'Restore full install' : 'Simulate solo install'}</button>
        <span class="mut small">— solo drops the nav to Home · Pipelines (+ Settings, always present and uncounted); every gated URL still resolves to a teaching page.</span>
      </div></section>
      <section class="panel"><div class="panel-head"><b>Workers</b> <span class="mut small">(always reachable here, even on one-worker installs)</span></div>
        <div class="pad"><a href="#/workers">Open workers →</a> · <a href="#/queue">queue →</a></div></section>
      <section class="panel"><div class="panel-head"><b>Notifications</b></div>
        <div class="pad mut small">Pipeline-level notifiers ship today: Slack/Discord webhooks and forge status checks (Notifications.md) — configured in the pipeline, not here. <b>Per-user</b> channels land with K15 (Phase 3): a generic per-user webhook first — a forge comment can't carry a production-deploy approval. Until then, the Home strip and forge checks are the per-person entry points, and this page says so instead of showing a dead matrix.</div></section>
      <section class="panel"><div class="panel-head"><b>API tokens</b></div>
        <div class="pad mut small">cli-egon · personal — <button class="btn sm danger" data-act="noop">delete</button> <button class="btn sm" data-act="noop">create token…</button>
        <div>tokens never rotate in place: delete + recreate (API-Tokens.md); a new token is shown once, capped at your role. Team <i>worker</i> tokens are the exception — regenerate them in Team settings.</div></div></section>
      <section class="panel"><div class="panel-head"><b>Audit</b></div><div class="pad"><a href="#/audit">Open audit log →</a></div></section>
    </div>`;
  };
})();
