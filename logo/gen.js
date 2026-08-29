// pikoci logo generator — PICO-8 blue hex, yellow border + navy keyline,
// cream clockwise arrow, yellow dot.
//
// The arrow is ONE bent shape defined by two functions of x (arc length
// along the spine): halfW(x) — the half-width profile (rounded tail cap,
// shaft that swells then slims to a neck, barb jump, head taper to the
// tip) — and spineR(x), the spine's distance from the center (constant on
// the shaft; on the head it drifts OUTWARD so the tip straightens and
// points "up" like a drawn arrow instead of curling forever).
const NAVY = '#1D2B53', BLUE = '#29ADFF', YELLOW = '#FFEC27', CREAM = '#FFF1E8';
const HC = 50, rad = d => d * Math.PI / 180, deg = v => v * 180 / Math.PI;
// the arrow (and its dot) sit on their own center, nudged up-right so the
// head's outward drift doesn't tip the composition inside the hexagon
const AC = { x: 51.5, y: 48.5 };
const P = (th, r) => [AC.x + r * Math.cos(rad(th)), AC.y + r * Math.sin(rad(th))];
const f = n => +n.toFixed(2);
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const hex = R => Array.from({ length: 6 }, (_, i) => pt([HC + R * Math.cos(rad(-90 + i * 60)), HC + R * Math.sin(rad(-90 + i * 60))])).join(' ');
const smooth = t => t * t * (3 - 2 * t);

function halfW(x, o) {
  if (x <= 0 || x >= o.L) return 0;
  if (x >= o.Ls) return o.headW * Math.pow(1 - (x - o.Ls) / o.headLen, o.taperPow);
  const a = x / o.Ls;
  let w = a < 0.45
    ? o.wTail + (o.wMax - o.wTail) * smooth(a / 0.45)
    : o.wMax + (o.wNeck - o.wMax) * smooth((a - 0.45) / 0.55);
  if (x < o.wTail) w *= Math.sqrt(1 - ((o.wTail - x) / o.wTail) ** 2); // round cap
  return w;
}
const spineR = (x, o) => x <= o.Ls ? o.r : o.r + o.drift * Math.pow((x - o.Ls) / o.headLen, 1.6);

function bentArrow(o) {
  const xs = [];
  for (let i = 0; i <= o.N; i++) xs.push(o.L * i / o.N);
  xs.push(o.Ls); xs.sort((a, b) => a - b);
  const outer = [], inner = [];
  for (const x of xs) {
    const th = o.th1 + deg(x / o.r), rc = spineR(x, o), y = halfW(x, o);
    outer.push(P(th, rc + y)); inner.push(P(th, rc - y));
    if (x === o.Ls) { outer.push(P(th, rc + o.headW)); inner.push(P(th, rc - o.headW)); } // barb
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
const Ls = r * rad(206), headLen = r * rad(38);
const params = {
  Rout: 48, Rmid: 43.5, Rin: 39, dot: 7,
  r, th1: -13,  // tail ~2 o'clock, gap at top, tip points up                 // tail at ~2 o'clock; head lands upper-left, tip up
  Ls, headLen, L: Ls + headLen,
  wTail: 4.0, wMax: 5.0, wNeck: 3.3,   // tapered shaft
  headW: 9.5, taperPow: 1.1,           // big head, near-straight edges
  drift: 4.5,                          // tip pulls outward like the reference
  N: 220,
};
fs.writeFileSync('pikoci-logo.svg', logo(params));
fs.writeFileSync('variant-noline.svg', logo({ ...params, Rout: 46, Rmid: 46, Rin: 40.5 }));
console.log('written');
