// pikoci logo generator — PICO-8 blue hex, yellow border + navy keyline,
// cream clockwise arc arrow, yellow dot.
//
// The whole arrow (shaft, barb, head) is ONE bent shape. halfArrow(x) is
// the arrow's half-profile drawn flat: given x along the spine it returns
// the half-width y. The spine is then wrapped around the circle — x becomes
// arc length (angle = x/r), y becomes a radial offset (r ± y) — so every
// edge of the arrow, the head's taper included, genuinely bends with the
// curve instead of being a straight shape pasted at a tangent.
const NAVY = '#1D2B53', BLUE = '#29ADFF', YELLOW = '#FFEC27', CREAM = '#FFF1E8';
const C = 50, rad = d => d * Math.PI / 180, deg = v => v * 180 / Math.PI;
const P = (th, r) => [C + r * Math.cos(rad(th)), C + r * Math.sin(rad(th))];
const f = n => +n.toFixed(2);
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const hex = R => Array.from({ length: 6 }, (_, i) => pt(P(-90 + i * 60, R))).join(' ');

// half-profile of a flat arrow of total length L, pointing toward +x:
// rounded tail cap, straight shaft, then the head's linear taper to the tip
function halfArrow(x, o) {
  const { L, shaft, headLen, headW } = o;
  if (x <= 0 || x >= L) return 0;
  if (x >= L - headLen) return headW * (L - x) / headLen;      // head taper
  if (x < shaft) return shaft * Math.sqrt(1 - ((shaft - x) / shaft) ** 2); // tail cap
  return shaft;
}

function bentArrow(o) {
  const { r, th1 } = o;
  const xb = o.L - o.headLen;                    // barb position on the spine
  // sample the spine; land exactly on the barb so its edge stays radial
  const xs = [];
  for (let i = 0; i <= o.N; i++) xs.push(o.L * i / o.N);
  xs.push(xb); xs.sort((a, b) => a - b);
  const thAt = x => th1 + deg(x / r);            // clockwise: angle grows with x
  const outer = [], inner = [];
  for (const x of xs) {
    const y = halfArrow(x, o), th = thAt(x);
    outer.push(P(th, r + y)); inner.push(P(th, r - y));
    if (x === xb) { outer.push(P(th, r + o.headW)); inner.push(P(th, r - o.headW)); }
  }
  // forward along the outer edge, back along the inner: one closed shape
  return `M${pt(outer[0])} L` + outer.map(pt).join(' ') + ' ' +
    inner.reverse().map(pt).join(' ') + ' Z';
}

function logo(o) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="${hex(o.Rout)}" fill="${NAVY}"/>
  <polygon points="${hex(o.Rmid)}" fill="${YELLOW}"/>
  <polygon points="${hex(o.Rin)}" fill="${BLUE}"/>
  <path d="${bentArrow(o)}" fill="${CREAM}"/>
  <circle cx="50" cy="50" r="${o.dot}" fill="${YELLOW}"/>
</svg>`;
}

const fs = require('fs');
const r = 23;
const params = {
  Rout: 48, Rmid: 43.5, Rin: 39, dot: 7,
  r, th1: -82,                       // tail angle; arrow sweeps clockwise
  L: r * rad(268),                   // spine length = 268° of arc
  shaft: 3.5,                        // half-width of the stroke (was width 7)
  headLen: r * rad(34), headW: 10,   // head: 34° of arc long, 20 wide
  N: 180,
};
fs.writeFileSync('pikoci-logo.svg', logo(params));
fs.writeFileSync('variant-noline.svg', logo({ ...params, Rout: 46, Rmid: 46, Rin: 40.5 }));
console.log('written', 'L=' + f(params.L), 'headLen=' + f(params.headLen));
