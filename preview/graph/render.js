// The pipeline DAG. Wraps like text when a chain is longer than the canvas:
// rows are packed greedily, cross-row edges get nested lanes down the right
// gutter, and a fan-out to several targets splits once at an invisible node
// in the new row rather than at the wrap point.
(function (PK) {
  'use strict';
  const { esc, fmtDur, bDur } = PK.fmt;
  const { st, reasonLabel } = PK.status;

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
      if (ctxRef) { cell = PK.model.jobCell(pl, nm, ctxRef); refUsed = ctxRef; }
      else { // primary-latest: per-job latest build (annotated), else decision on newest primary ref
        const bs = PK.model.jobBuilds(pl, nm);
        if (bs.length) { cell = { kind: 'build', build: bs[0], status: PK.status.bStatus(bs[0]) }; refUsed = Object.values(bs[0].intent.versions)[0]; }
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
  PK.graph = { layers, graphSVG };
})(window.PK);
