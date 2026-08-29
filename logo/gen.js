// pikoci logo generator — PICO-8 blue hex, yellow border + navy keyline,
// cream clockwise arrow, yellow dot.
//
// The arrow is one shape built from a SPINE + a half-width PROFILE:
//   spine  — a circle along the shaft; over the head the curvature eases
//            from 1/r down to 0 (clothoid-style), so the head straightens
//            smoothly with NO kink: curvature is continuous at the barb and
//            monotonic after it. The hand-drawn "tip escapes outward" drift
//            falls out of this for free.
//   halfW  — rounded tail cap, uniform shaft (the reference's stroke is
//            even; width games read as wobble), barb jump, taper to tip.
// Edges are offsets along the spine's local normal (not radial), so the
// taper reads straight even while the head still carries a little bend.
const NAVY = '#1D2B53', BLUE = '#29ADFF', YELLOW = '#FFEC27', CREAM = '#FFF1E8';
const HC = 50, rad = d => d * Math.PI / 180, deg = v => v * 180 / Math.PI;
const AC = { x: 51.5, y: 48.5 }; // arrow + dot center, nudged in the hex
const f = n => +n.toFixed(2);
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const hex = R => Array.from({ length: 6 }, (_, i) =>
  pt([HC + R * Math.cos(rad(-90 + i * 60)), HC + R * Math.sin(rad(-90 + i * 60))])).join(' ');
const smooth = t => t * t * (3 - 2 * t);

function halfW(x, o) {
  if (x <= 0 || x >= o.L) return 0;
  if (x >= o.Ls) return o.headW * Math.pow(1 - (x - o.Ls) / o.headLen, o.taperPow);
  // uniform shaft (like the reference) with a round tail cap
  if (x < o.w) return o.w * Math.sqrt(1 - ((o.w - x) / o.w) ** 2);
  return o.w;
}

// spine samples: {x, p, t} — position and unit tangent at arc length x
function spine(o) {
  const pts = [];
  const n1 = Math.round(o.N * o.Ls / o.L);
  for (let i = 0; i <= n1; i++) {
    const x = o.Ls * i / n1, th = rad(o.th1) + x / o.r;
    pts.push({ x, p: [AC.x + o.r * Math.cos(th), AC.y + o.r * Math.sin(th)],
      t: [-Math.sin(th), Math.cos(th)] });
  }
  // head: integrate heading with easing curvature k(t) = (1/r)(1-t)^ease
  let { p, t } = pts[pts.length - 1];
  p = p.slice(); t = t.slice();
  const steps = 300, ds = o.headLen / steps;
  for (let i = 1; i <= steps; i++) {
    const k = (1 / o.r) * Math.pow(1 - i / steps, o.ease);
    const dth = k * ds, c = Math.cos(dth), s = Math.sin(dth);
    t = [t[0] * c - t[1] * s, t[0] * s + t[1] * c];
    p = [p[0] + t[0] * ds, p[1] + t[1] * ds];
    if (i % 3 === 0 || i === steps) pts.push({ x: o.Ls + (i / steps) * o.headLen, p: p.slice(), t: t.slice() });
  }
  return pts;
}

function bentArrow(o) {
  const sp = spine(o);
  const outer = [], inner = [];
  const off = (s, w) => { const n = [s.t[1], -s.t[0]]; // outward normal
    return [[s.p[0] + n[0] * w, s.p[1] + n[1] * w], [s.p[0] - n[0] * w, s.p[1] - n[1] * w]]; };
  let barbDone = false;
  for (const s of sp) {
    if (!barbDone && s.x >= o.Ls) { // barb: jump from neck width to headW
      const [a1, b1] = off(s, o.w);
      const [a2, b2] = off(s, o.headW);
      outer.push(a1, a2); inner.push(b1, b2); barbDone = true;
      if (s.x === o.Ls) continue;
    }
    const [a, b] = off(s, halfW(s.x, o));
    outer.push(a); inner.push(b);
  }
  return `M${pt(outer[0])} L` + outer.map(pt).join(' ') + ' ' + inner.reverse().map(pt).join(' ') + ' Z';
}

function logo(o) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="${hex(o.Rout)}" fill="${NAVY}"/>
  <polygon points="${hex(o.Rmid)}" fill="${YELLOW}"/>
  <polygon points="${hex(o.Rin)}" fill="${BLUE}"/>
  <path d="${bentArrow(o)}" fill="${CREAM}"/>
  <circle cx="${AC.x}" cy="${AC.y}" r="${o.dot}" fill="${YELLOW}"/>
</svg>`;
}

const fs = require('fs');
const r = 21;
const Ls = r * rad(206), headLen = 14;
const params = {
  Rout: 48, Rmid: 43.5, Rin: 39, dot: 7,
  r, th1: -13, Ls, headLen, L: Ls + headLen,
  w: 4.2,                              // uniform shaft half-width
  headW: 9.5, taperPow: 1.05,
  ease: 1.3,   // how fast the head's curvature fades: 0 = stays on the circle
  N: 220,
};
// NOTE: pikoci-logo.svg is now HAND-TUNED (Affinity source: pikoci-logo.af)
// — pixel-aligned by Egon on top of this generator's output. Do not
// overwrite it; the generator writes its draft next to it instead.
fs.writeFileSync('generated.svg', logo(params));
fs.writeFileSync('variant-noline.svg', logo({ ...params, Rout: 46, Rmid: 46, Rin: 40.5 }));
console.log('written');
