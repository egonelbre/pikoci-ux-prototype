// DAG geometry. Pure numbers in, pure numbers out — no SVG, no strings, no
// DOM. graph/render.js turns what this returns into a picture.
//
// The hard part is wrapping. A pipeline like `packaging` is 19 stages long, so
// the graph has to flow like text: pack layers left-to-right, start a new row
// when the next one would not fit, and route the edge that crosses rows down a
// lane in the right gutter and back into the new row's first column. Several
// such edges at once need nested lanes that do not cross each other, and a
// source that fans out to three targets in the new row should split ONCE —
// at an invisible node in that row — rather than dragging three long parallel
// lines across the whole canvas.
//
// Every constant below was tuned by eye against the packaging and delivery
// pipelines; the comment on each says what it is trading off, so the next
// person adjusting one knows what will move.
(function (PK) {
  'use strict';

  const OPTS = {
    nodeW: 158, nodeH: 44,   // a job node: fits "test-matrix--linux" + a sub-line
    resW: 130, resH: 30,     // a resource node: name only, so shorter and flatter
    gapX: 84, gapY: 36,      // within a row: enough for a bezier to read as a curve
    pad: 20,
    MAXW: 1160,              // wrap width — a 13" laptop with the nav open
    rowGap: 52,              // vertical space between rows; the wrap lanes live here
    wrapGutter: 42,          // right margin held back so a lane never clips the edge
    leftGutter: 34,          // left margin on wrapped graphs, so drops into the
                             // first column sit side by side instead of stacking
    laneStride: 6,           // offset between nested lanes; below ~5 they merge visually
    maxLanes: 5,             // more than five nested lanes stop being followable
    fanSpread: 22,           // vertical separation between invisible fan-out nodes
    cornerR: 10,             // rounded corner radius on routed wrap connectors
  };

  // Layer assignment: resources first, then jobs by dependency depth.
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

  function layout(pl, o) {
    o = Object.assign({}, OPTS, o || {});
    const { nodeW, nodeH, resW, resH, gapX, gapY, pad, MAXW, rowGap, wrapGutter } = o;
    const L = layers(pl).out;

    // ---- rows: pack layers left to right, wrap when the next will not fit ---
    const rowOf = [], layerX = [];
    let x = pad, row = 0, maxRowW = 0;
    L.forEach((layer, li) => {
      const w = li === 0 ? resW : nodeW;
      if (x + w + pad + wrapGutter > MAXW && x > pad) { row++; x = pad; }
      rowOf[li] = row; layerX[li] = x; x += w + gapX;
      maxRowW = Math.max(maxRowW, x - gapX + pad);
    });
    const nRows = row + 1;

    // ---- row heights and vertical origins -----------------------------------
    const rowH = new Array(nRows).fill(0);
    L.forEach((layer, li) => {
      const h = li === 0 ? resH : nodeH;
      rowH[rowOf[li]] = Math.max(rowH[rowOf[li]], layer.length * (h + gapY) - gapY);
    });
    const rowY = []; let acc = pad;
    for (let r = 0; r < nRows; r++) { rowY[r] = acc; acc += rowH[r] + rowGap; }

    // ---- horizontal alignment: centre each row, so there is no ragged-right
    // whitespace — except a lone continuation row, which tucks under the
    // previous row's last column to keep its wrap connector short -------------
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

    const LX = nRows > 1 ? o.leftGutter : 0;
    const pos = {};
    L.forEach((layer, li) => {
      const w = li === 0 ? resW : nodeW, h = li === 0 ? resH : nodeH;
      const used = layer.length * (h + gapY) - gapY;
      let y = rowY[rowOf[li]] + (rowH[rowOf[li]] - used) / 2; // centre within row
      layer.forEach(n => { pos[n.name] = { x: LX + layerX[li] + xOff[rowOf[li]], y, w, h, kind: n.kind, row: rowOf[li] }; y += h + gapY; });
    });
    const W = LX + maxRowW + (nRows > 1 ? 26 : 0), H = acc - rowGap + pad;

    // ---- edges: same-row ones are simple beziers; cross-row ones group by
    // source, because one source feeding three jobs in the next row is ONE
    // trunk with a fan-out, not three separate long lines --------------------
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

    // ---- lanes: the topmost source takes the OUTERMOST right lane and the
    // LOWEST channel, so lanes nest instead of crossing. Entry lanes reverse
    // (kIn), so a channel coming in from outside ends up inside afterwards ----
    const byRow = {};
    for (const g of wrapGroups.values()) (byRow[g.row] = byRow[g.row] || []).push(g);
    for (const r of Object.keys(byRow)) {
      const gs = byRow[r].sort((p, q) => p.a.y - q.a.y);
      gs.forEach((g, i) => {
        g.k = (gs.length - 1 - i) % o.maxLanes;
        g.kIn = Math.min(gs.length, o.maxLanes) - 1 - g.k;
        g.xR = LX + maxRowW - pad + 10 + g.k * o.laneStride;
        g.cy = rowY[g.row] - Math.round(rowGap * 0.62) + g.k * o.laneStride;
        if (g.targets.length > 1) {
          g.targets.sort((p, q) => p.p.y - q.p.y);
          g.jx = Math.max(8, 8 + g.k * o.laneStride);            // the invisible node
          g.jy = g.targets.reduce((s2, t) => s2 + t.p.y + t.p.h / 2, 0) / g.targets.length
            + (g.k - (gs.length - 1) / 2) * o.fanSpread;
        }
      });
    }

    // ---- ports: a node's attachment points spread evenly along its edge,
    // ordered by where the OTHER end sits vertically, so lines fan out in the
    // same order they arrive and never cross on the last few pixels ----------
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

    return { W, H, pos, flat, wraps: [...wrapGroups.values()], nRows, opts: o };
  }

  PK.graph = Object.assign(PK.graph || {}, { layers, layout, OPTS });
})(window.PK);
