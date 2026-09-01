// Geometry to SVG. Takes what graph/layout.js computed and draws it: routed
// connectors with rounded corners for the wrap lanes, plain beziers within a
// row, and a node per resource and job.
//
// Nothing here decides where anything goes — if a line overlaps or a lane
// crosses, the fix is in layout.js.
(function (PK) {
  'use strict';
  const { esc, fmtDur, bDur } = PK.fmt;
  const { st, reasonLabel } = PK.status;
  const { layout } = PK.graph;

  // ---------- edges ---------------------------------------------------------
  function edgeSVG(e) {
    const x1 = e.a.x + e.a.w, x2 = e.b.x, mx = (x1 + x2) / 2;
    return `<path d="M${x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${x2},${e.y2}" fill="none"
        stroke="var(--edge)" stroke-width="${e.sw}" ${e.dash}/>`;
  }

  // A wrap connector leaves its source, runs right into its lane, drops into
  // the channel above the target row, and comes back left — all with rounded
  // corners, so it reads as one routed line rather than three segments.
  function wrapSVG(g, R) {
    const cap = 'stroke-linecap="round" stroke-linejoin="round"';
    const head = (x2, y2) => `<path d="M${x2 - 1},${y2} l-8,-4.5 v9 z" fill="var(--edge)"/>`;
    const trunkTo = (ex, ey) => `<path d="M${g.a.x + g.a.w},${g.y1} H${g.xR - R} q${R},0 ${R},${R} V${g.cy - R} q0,${R} -${R},${R} H${ex + R} q-${R},0 -${R},${R} V${ey}"
          fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>`;
    if (g.targets.length === 1) {
      const b2 = g.targets[0].p, y2 = g.entryY, ex = Math.max(6, b2.x - 12 - g.kIn * 5);
      return trunkTo(ex, y2 - R) +
        `<path d="M${ex},${y2 - R} q0,${R} ${R},${R} H${b2.x - 2}" fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>` +
        head(b2.x, y2);
    }
    // fan-out splits ONCE at the invisible node layout put in the new row
    let s = trunkTo(g.jx, g.jy);
    for (const t of g.targets) {
      const y2 = g.fanY[t.name], mx = (g.jx + t.p.x) / 2;
      s += `<path d="M${g.jx},${g.jy} C${mx},${g.jy} ${mx},${y2} ${t.p.x - 2},${y2}" fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>` + head(t.p.x, y2);
    }
    return s;
  }

  // ---------- nodes ---------------------------------------------------------
  function resSVG(pl, nm, n) {
    const r = pl.resources.find(r => r.name === nm);
    const border = r.checkError ? 'var(--warn)' : (r.pinned ? 'var(--run)' : 'var(--edge)');
    return `<g class="gnode"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="14" fill="var(--bg1)" stroke="${border}" stroke-width="${r.pinned || r.checkError ? 2.5 : 1.4}"/>
          <text x="${n.x + 10}" y="${n.y + n.h / 2 + 4}" class="t-res">${r.pinned ? '📌 ' : ''}${r.checkError ? '⚠ ' : ''}${esc(nm)}</text></g>`;
  }

  // Which build (or decision) a job node is coloured by. With a context ref
  // it is that commit's cell; without one it is the job's own latest build,
  // which is why such a graph annotates each node with its ref.
  function cellFor(pl, nm, ctxRef) {
    if (ctxRef) return { cell: PK.model.jobCell(pl, nm, ctxRef), refUsed: ctxRef };
    const bs = PK.model.jobBuilds(pl, nm);
    if (bs.length) return { cell: { kind: 'build', build: bs[0], status: PK.status.bStatus(bs[0]) }, refUsed: Object.values(bs[0].intent.versions)[0] };
    return { cell: { kind: 'none', status: 'none' }, refUsed: '' };
  }

  function jobSVG(pl, nm, n, cell, refUsed, ctxRef) {
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
    // a real SVG link — keyboard-focusable and announced, unlike an onclick <g>
    return cell.kind === 'build' ? `<a href="#/b/${cell.build.id}" aria-label="${esc(nm)}: ${esc(sub)}">${g}</a>` : g;
  }

  // ---------- the whole picture --------------------------------------------
  function graphSVG(pl, ctxRef) {
    const lay = layout(pl);
    let edges = '';
    for (const e of lay.flat) edges += edgeSVG(e);
    for (const g of lay.wraps) edges += wrapSVG(g, lay.opts.cornerR);

    let nodes = '';
    const refs = new Set();
    for (const [nm, n] of Object.entries(lay.pos)) {
      if (n.kind === 'res') { nodes += resSVG(pl, nm, n); continue; }
      const { cell, refUsed } = cellFor(pl, nm, ctxRef);
      if (refUsed) refs.add(refUsed);
      nodes += jobSVG(pl, nm, n, cell, refUsed, ctxRef);
    }

    const spanning = !ctxRef && refs.size > 1 ? `<div class="spanning">composite view — spanning ${[...refs].join(' … ')} (each node shows its own ref; pick a context to make it one commit)</div>` : '';
    return spanning + `<div class="graph-scroll"><svg width="${lay.W}" height="${lay.H}" aria-label="pipeline graph">${edges}${nodes}</svg></div>`;
  }

  PK.graph = Object.assign(PK.graph, { graphSVG });
})(window.PK);
