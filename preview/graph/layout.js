// DAG geometry. Pure numbers in, pure numbers out — no SVG, no strings, no
// DOM. graph/render.js turns what this returns into a picture.
//
// The hard part is wrapping. A pipeline like `packaging` is 19 stages long, so
// the graph has to flow like text: pack layers left-to-right, start a new row
// when the next one would not fit, and route the edge that crosses rows down a
// lane in the right gutter and back into the new row's first column. Several
// such edges at once need nested lanes that do not cross each other.
//
// A wrap connector is expensive — it crosses the whole canvas — so the layout
// works to have as few as possible. Invisible junction nodes do that in both
// directions: a source feeding three jobs in the new row splits ONCE at a node
// in that row (fan-out), and three sources feeding the same job merge ONCE at
// a node in their own row (fan-in). delivery's 17 cross-row edges become 4
// trunks rather than 17 parallel lines.
//
// The other way a line goes wrong is passing UNDER a node: an edge spanning
// several layers (a cron resource triggering a late job) would run straight
// through everything in between. Those get an orthogonal detour along a
// horizontal channel that is clear in every column they cross.
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
    leftGutter: 88,          // left margin on wrapped graphs: the arrival drops
                             // into the first column sit side by side here, each
                             // needing a corner, a run and an arrow head, and
                             // they are spaced by dropStride like their lanes
    laneStride: 6,           // offset between nested channels in the row gap,
                             // where vertical space is scarce
    dropStride: 12,          // horizontal offset between the vertical drops in
                             // the right gutter. Space is cheap out there and
                             // these are long lines, so they get more room than
                             // the channels: at 6px three drops read as one
                             // thick line rather than three routes
    maxLanes: 5,             // more than five nested lanes stop being followable
    fanSpread: 22,           // vertical separation between invisible fan-out nodes
    cornerR: 10,             // rounded corner radius on routed wrap connectors
    detourClear: 12,         // gap kept between a routed long edge and a node box
    detourStride: 6,         // separation between long edges sharing one channel
    detourInset: 2,          // keep a line just off an alley's own edges
    headGap: 6,              // clear space between an arrow head and its node
    headLen: 8,              // length of the arrow head itself
    arriveRun: 9,            // straight run between the last corner and the head,
                             // so the curve and the triangle stay separate shapes
    mergeGap: 30,            // room each side of a fan-in's invisible merge node
    detourStub: 16,          // straight run out of a port before the first turn
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
    let W = LX + maxRowW + (nRows > 1 ? 26 : 0);
    let H = acc - rowGap + pad;   // a bus lane for long edges can extend this

    // ---- edges: same-row ones are simple beziers; cross-row ones are
    // grouped, because a wrap connector is expensive — it crosses the whole
    // canvas — so as few of them as possible should exist.
    //
    //   fan-out  one source feeding several jobs in the next row is ONE trunk
    //            that splits at an invisible node IN THE NEW ROW
    //   fan-in   several sources feeding the SAME job in the next row merge at
    //            an invisible node IN THEIR OWN ROW, so again only one trunk
    //            crosses instead of three parallel ones
    const flat = [];
    const cross = [];
    for (const j of pl.jobs) for (const inp of j.inputs || []) {
      const targets = (inp.passed && inp.passed.length) ? inp.passed : [inp.res];
      for (const from of targets) {
        const a = pos[from], b = pos[j.name];
        if (!a || !b) continue;
        const sw = inp.passed && inp.passed.length ? 2 : 1.4;
        const dash = inp.trigger === false ? 'stroke-dasharray="4 4"' : '';
        if (a.row === b.row) flat.push({ from, to: j.name, a, b, sw, dash });
        else cross.push({ from, a, to: j.name, b, sw, dash });
      }
    }

    // fan-in first: it saves the most lines, so it wins any edge both
    // groupings would claim
    const wrapGroups = new Map();
    const inBy = new Map();
    for (const e of cross) {
      const k = e.to + '|' + e.a.row;
      (inBy.get(k) || inBy.set(k, []).get(k)).push(e);
    }
    const claimed = new Set();
    for (const [k, es] of inBy) {
      if (es.length < 2) continue;
      es.forEach(e => claimed.add(e));
      wrapGroups.set('in:' + k, {
        kind: 'in', to: es[0].to, b: es[0].b, row: es[0].b.row, srcRow: es[0].a.row,
        sw: Math.max(...es.map(e => e.sw)), dash: es.every(e => e.dash) ? es[0].dash : '',
        sources: es.map(e => ({ name: e.from, p: e.a })),
      });
    }
    for (const e of cross) {
      if (claimed.has(e)) continue;
      const key = 'out:' + e.from + '|' + e.b.row;
      if (!wrapGroups.has(key)) wrapGroups.set(key, {
        kind: 'out', from: e.from, a: e.a, row: e.b.row, sw: e.sw, dash: e.dash, targets: [],
      });
      wrapGroups.get(key).targets.push({ name: e.to, p: e.b });
    }

    // ---- lanes: the topmost source takes the OUTERMOST right lane and the
    // LOWEST channel, so lanes nest instead of crossing. Entry lanes reverse
    // (kIn), so a channel coming in from outside ends up inside afterwards ----
    // What a trunk is ranked by: for a fan-out, where it LEAVES — for a fan-in,
    // where it ARRIVES. A fan-in's start is its merge node, and that is ours to
    // place, so the targets lead and the merge nodes follow. Ranking fan-ins by
    // their sources instead is what made delivery's lines cross: all three
    // itest groups share the same five unit jobs, so the key was a tie and the
    // lanes came out in an order unrelated to where they were going.
    const rankY = g => g.kind === 'in' ? g.b.y + g.b.h / 2 : g.a.y;
    const srcY = g => g.sources.reduce((s2, t) => s2 + t.p.y + t.p.h / 2, 0) / g.sources.length;
    const byRow = {};
    for (const g of wrapGroups.values()) (byRow[g.row] = byRow[g.row] || []).push(g);
    for (const r of Object.keys(byRow)) {
      const gs = byRow[r].sort((p, q) => rankY(p) - rankY(q));

      // The merge node sits right of every source, and the lane has to clear
      // it. That floor is shared by the whole row: computing it per group and
      // clamping each xR against it separately is what collapsed delivery's
      // three drops onto one x — the clamp overwrote the lane offset, so three
      // trunks came down the canvas on top of each other.
      let laneBase = LX + maxRowW - pad + 10;
      for (const g of gs) {
        if (g.kind !== 'in') continue;
        g.sources.sort((p, q) => p.p.y - q.p.y);
        g.mx = Math.max(...g.sources.map(t => t.p.x + t.p.w)) + o.mergeGap;
        laneBase = Math.max(laneBase, g.mx + o.mergeGap);
      }

      gs.forEach((g, i) => {
        g.k = (gs.length - 1 - i) % o.maxLanes;
        g.kIn = Math.min(gs.length, o.maxLanes) - 1 - g.k;
        g.xR = laneBase + g.k * o.dropStride;
        g.cy = rowY[g.row] - Math.round(rowGap * 0.62) + g.k * o.laneStride;
        W = Math.max(W, g.xR + 16);
        // where the trunk turns from vertical back to horizontal. It has to
        // leave room for the whole arrival — corner, straight run, head, gap —
        // or the curve and the triangle overlap into a blob.
        const arrival = o.cornerR + o.arriveRun + o.headLen + o.headGap;
        const tgt = g.kind === 'in' ? g.b : g.targets[0].p;
        g.entryX = Math.max(6, tgt.x - arrival - g.kIn * o.dropStride);
        if (g.kind !== 'in' && g.targets.length > 1) {
          g.targets.sort((p, q) => p.p.y - q.p.y);
          g.jx = Math.max(8, 8 + g.k * o.dropStride);            // the invisible node
          g.jy = g.targets.reduce((s2, t) => s2 + t.p.y + t.p.h / 2, 0) / g.targets.length
            + (g.k - (gs.length - 1) / 2) * o.fanSpread;
        }
      });

      // Merge nodes, placed after the lanes because they follow them. gs is
      // already in target order, so among the fan-ins sharing a merge column
      // the topmost target sits highest — which is also the one on the
      // outermost lane, so no two routes cross anywhere along their length.
      const cols = new Map();
      for (const g of gs) {
        if (g.kind !== 'in') continue;
        const c = Math.round(g.mx);
        (cols.get(c) || cols.set(c, []).get(c)).push(g);
      }
      for (const list of cols.values()) {
        const mid = list.reduce((s2, g) => s2 + srcY(g), 0) / list.length;
        list.forEach((g, i2) => { g.my = mid + (i2 - (list.length - 1) / 2) * o.fanSpread; });
      }
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
      if (g.kind === 'in') {
        // one port per source, and ONE arrival on the target — the whole point
        g.srcY1 = {};
        for (const t of g.sources)
          slot(outs, t.name).push({ key: 1e6 + g.my, set: y => { g.srcY1[t.name] = y; } });
        slot(ins, g.to).push({ key: -1e6 - g.cy, set: y => { g.entryY = y; } });
        continue;
      }
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

    // ---- long edges: route AROUND what they would otherwise cross ---------
    // A resource that feeds a late job (a cron triggering `build`, say) spans
    // several layers, and a straight bezier from one to the other passes
    // behind every node in between — it reads as a line disappearing under a
    // box and reappearing on the far side. Such an edge gets an orthogonal
    // detour through a horizontal channel that is clear in every column it
    // crosses. Runs last, because it needs the port positions above.
    const nodeList = Object.entries(pos).map(([name, q]) => Object.assign({ name }, q));
    const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
    const wants = [];
    for (const e of flat) {
      const x1 = e.a.x + e.a.w, x2 = e.b.x;
      const lo = Math.min(e.y1, e.y2), hi = Math.max(e.y1, e.y2);
      // what sits in the corridor between the two endpoints
      const inSpan = nodeList.filter(q => q.name !== e.from && q.name !== e.to
        && q.row === e.a.row && q.x < x2 && q.x + q.w > x1);
      // a long edge whose straight line happens to miss everything stays straight
      if (!inSpan.some(q => q.y < hi + o.detourClear && q.y + q.h > lo - o.detourClear)) continue;

      // free horizontal bands: everything in the corridor is an obstacle,
      // whatever its own y — the channel has to clear the whole column
      const blocked = inSpan
        .map(q => [q.y - o.detourClear, q.y + q.h + o.detourClear])
        .sort((p, q) => p[0] - q[0]);
      const merged = [];
      for (const b2 of blocked) {
        const last = merged[merged.length - 1];
        if (last && b2[0] <= last[1]) last[1] = Math.max(last[1], b2[1]);
        else merged.push(b2.slice());
      }
      const bands = [];
      let cursor = pad / 2;
      for (const [g0, g1] of merged) { if (g0 - cursor > 10) bands.push([cursor, g0]); cursor = Math.max(cursor, g1); }
      if (H - pad / 2 - cursor > 10) bands.push([cursor, H - pad / 2]);
      if (!bands.length) continue;

      // rank the alleys by how near each gets the line to where it wanted to be
      const ideal = (e.y1 + e.y2) / 2;
      const ranked = bands.map(([g0, g1]) => ({ g0, g1, y: clamp(ideal, g0 + o.detourInset, g1 - o.detourInset) }))
        .sort((p, q) => Math.abs(p.y - ideal) - Math.abs(q.y - ideal));
      wants.push({ e, ideal, ranked });
    }

    // Assign alleys with a capacity. The gap between two node rows is only
    // gapY - 2*detourClear wide, so it holds one or two lines, not five —
    // without a cap they pack in half a pixel apart and read as one wobbly
    // line. Assigned top-to-bottom, so lines in the same alley do not cross.
    const capOf = b => Math.max(1, Math.floor((b.g1 - b.g0) / o.detourStride));
    const load = new Map();
    const overflow = [];
    for (const want of wants.sort((p, q) => p.ideal - q.ideal)) {
      const picked = want.ranked.find(b => (load.get(b.g0 + ':' + b.g1) || []).length < capOf(b));
      if (!picked) { overflow.push(want); continue; }
      const key = picked.g0 + ':' + picked.g1;
      const list = load.get(key) || [];
      list.push(want);
      load.set(key, list);
      want.e.detour = { y: picked.y, lo: picked.g0, hi: picked.g1 };
    }

    // Nowhere left inside: run under the whole row on a bus lane, and grow the
    // canvas to hold it. Always available, always clear, and it reads as a
    // deliberate bus rather than as lines squeezed between boxes.
    if (overflow.length) {
      const rowsUsed = new Set(overflow.map(w => w.e.a.row));
      const busY = {};
      for (const r of rowsUsed) {
        const bottom = Math.max(...nodeList.filter(q => q.row === r).map(q => q.y + q.h));
        busY[r] = bottom + o.detourClear + o.detourStride;
      }
      overflow.sort((p, q) => p.ideal - q.ideal).forEach((w, i2) => {
        const y = busY[w.e.a.row] + i2 * o.detourStride;
        w.e.detour = { y, lo: y - o.detourStride / 2, hi: y + o.detourStride / 2, bus: true };
        H = Math.max(H, y + o.detourClear + pad / 2);
      });
    }

    // several lines in one alley: spread them evenly, in start order
    for (const list of load.values()) {
      if (list.length < 2) continue;
      const { lo, hi } = list[0].e.detour;
      const room = Math.max(0, hi - lo - 2 * o.detourInset);
      const stride = Math.min(o.detourStride, room / (list.length - 1));
      const base = (lo + hi) / 2;
      list.sort((p, q) => p.e.y1 - q.e.y1).forEach((w, i2) => {
        w.e.detour.y = clamp(base + (i2 - (list.length - 1) / 2) * stride, lo + o.detourInset, hi - o.detourInset);
      });
    }

    // Several long edges leaving the same column converge on the same two
    // vertical stubs, which would draw them on top of each other. Stagger the
    // turn points, ordered by channel, so the verticals nest like the wrap
    // lanes do instead of overlapping.
    const stagger = (keyOf, field) => {
      const by = new Map();
      for (const e of flat) {
        if (!e.detour) continue;
        const k = Math.round(keyOf(e));
        (by.get(k) || by.set(k, []).get(k)).push(e);
      }
      for (const list of by.values()) {
        if (list.length < 2) continue;
        list.sort((p, q) => p.detour.y - q.detour.y);
        list.forEach((e, i2) => { e.detour[field] = i2; });
      }
    };
    stagger(e => e.a.x + e.a.w, 'kOut');
    stagger(e => e.b.x, 'kIn');

    return { W, H, pos, flat, wraps: [...wrapGroups.values()], nRows, opts: o };
  }

  PK.graph = Object.assign(PK.graph || {}, { layers, layout, OPTS });
})(window.PK);
