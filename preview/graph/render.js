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
  function edgeSVG(e, o) {
    const x1 = e.a.x + e.a.w, x2 = e.b.x;
    if (e.detour) {
      const p = detourPath(e, x1, x2, o);
      if (p) return `<path d="${p}" fill="none" stroke="var(--edge)" stroke-width="${e.sw}"
        stroke-linecap="round" stroke-linejoin="round" ${e.dash}/>`;
    }
    const mx = (x1 + x2) / 2;
    return `<path d="M${x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${x2},${e.y2}" fill="none"
        stroke="var(--edge)" stroke-width="${e.sw}" ${e.dash}/>`;
  }

  // An edge that spans several layers cannot go straight — it would pass
  // behind every node in between. layout.js picked a clear horizontal channel
  // for it; this draws the two right-angle turns onto it and the two back off,
  // with the same rounded corners the wrap connectors use.
  function detourPath(e, x1, x2, o) {
    const cy = e.detour.y;
    // nested turn points, so several long edges out of one column do not draw
    // their verticals on top of each other
    const xa = x1 + o.detourStub + (e.detour.kOut || 0) * o.laneStride;
    const xb = x2 - o.detourStub - (e.detour.kIn || 0) * o.laneStride;
    const s1 = cy >= e.y1 ? 1 : -1, s2 = e.y2 >= cy ? 1 : -1;
    // the radius has to fit in the shortest leg, or the corners overshoot
    const R = Math.min(o.cornerR, Math.abs(cy - e.y1) / 2, Math.abs(e.y2 - cy) / 2, (xb - xa) / 2);
    if (!(R >= 2)) return null;   // too tight to route; the bezier is fine here
    return `M${x1},${e.y1} H${xa - R}`
      + ` q${R},0 ${R},${s1 * R} V${cy - s1 * R} q0,${s1 * R} ${R},${s1 * R}`
      + ` H${xb - R}`
      + ` q${R},0 ${R},${s2 * R} V${e.y2 - s2 * R} q0,${s2 * R} ${R},${s2 * R}`
      + ` H${x2}`;
  }

  // A wrap connector leaves its source, runs right into its lane, drops into
  // the channel above the target row, and comes back left — all with rounded
  // corners, so it reads as one routed line rather than three segments.
  //
  // Two shapes share that trunk. A fan-OUT splits once at an invisible node in
  // the new row; a fan-IN merges once at an invisible node in its own row, so
  // three sources feeding one job send one line across the canvas, not three.
  function wrapSVG(g, o) {
    const R = o.cornerR;
    const cap = 'stroke-linecap="round" stroke-linejoin="round"';
    // the head sits clear of the node, not touching it
    const head = (x2, y2) => `<path d="M${x2 - o.headGap},${y2} l-${o.headLen},-4.5 v9 z" fill="var(--edge)"/>`;
    const line = d => `<path d="${d}" fill="none" stroke="var(--edge)" stroke-width="${g.sw}" ${cap} ${g.dash}/>`;
    // from a start point: right into the lane, down the channel, back left
    const trunk = (sx, sy, ex, ey) =>
      line(`M${sx},${sy} H${g.xR - R} q${R},0 ${R},${R} V${g.cy - R} q0,${R} -${R},${R} H${ex + R} q-${R},0 -${R},${R} V${ey}`);
    // The last leg: turn out of the drop, run straight for a bit, then the
    // head. layout.js placed the turn far enough back that those three are
    // distinct shapes rather than one smear.
    const arrive = (b2, y2, ex) =>
      line(`M${ex},${y2 - R} q0,${R} ${R},${R} H${b2.x - o.headGap - o.headLen + 1}`) + head(b2.x, y2);

    if (g.kind === 'in') {
      const b2 = g.b, y2 = g.entryY, ex = g.entryX;
      // each source curves into the merge node, then ONE trunk crosses
      let s2 = '';
      for (const t of g.sources) {
        const x1 = t.p.x + t.p.w, y1 = g.srcY1[t.name], mx = (x1 + g.mx) / 2;
        s2 += line(`M${x1},${y1} C${mx},${y1} ${mx},${g.my} ${g.mx},${g.my}`);
      }
      return s2 + trunk(g.mx, g.my, ex, y2 - R) + arrive(b2, y2, ex);
    }

    if (g.targets.length === 1) {
      const b2 = g.targets[0].p, y2 = g.entryY, ex = g.entryX;
      return trunk(g.a.x + g.a.w, g.y1, ex, y2 - R) + arrive(b2, y2, ex);
    }
    // fan-out splits ONCE at the invisible node layout put in the new row
    let s2 = trunk(g.a.x + g.a.w, g.y1, g.jx, g.jy);
    for (const t of g.targets) {
      const y2 = g.fanY[t.name], mx = (g.jx + t.p.x) / 2;
      // a bezier already arrives horizontally, so it only needs to stop at the
      // head rather than reserve a straight run before it
      s2 += line(`M${g.jx},${g.jy} C${mx},${g.jy} ${mx},${y2} ${t.p.x - o.headGap - o.headLen + 1},${y2}`) + head(t.p.x, y2);
    }
    return s2;
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
    for (const e of lay.flat) edges += edgeSVG(e, lay.opts);
    for (const g of lay.wraps) edges += wrapSVG(g, lay.opts);

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
