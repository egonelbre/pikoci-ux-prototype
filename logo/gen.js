// pikoci logo generator — PICO-8 blue hex, yellow border + navy keyline,
// cream clockwise arc arrow, yellow dot. The arrowhead is a radial-base
// triangle in the arc's (angle, radius) frame: base corners sit on the
// radius through the arc's end, tip further along the same circle — so the
// head continues the curve instead of being a flat triangle pasted on.
const NAVY = '#1D2B53', BLUE = '#29ADFF', YELLOW = '#FFEC27', CREAM = '#FFF1E8';
const C = 50, rad = d => d * Math.PI / 180;
const P = (deg, r) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];
const f = n => +n.toFixed(2);
const pt = ([x, y]) => `${f(x)},${f(y)}`;
const hex = R => Array.from({ length: 6 }, (_, i) => pt(P(-90 + i * 60, R))).join(' ');

function logo(o) {
  const s = P(o.th1, o.r), e = P(o.th2, o.r);
  const large = ((o.th2 - o.th1 + 360) % 360) > 180 ? 1 : 0;
  const tip = P(o.th2 + o.tipD, o.r);
  const a = P(o.th2, o.r + o.w), b = P(o.th2, o.r - o.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="${hex(o.Rout)}" fill="${NAVY}"/>
  <polygon points="${hex(o.Rmid)}" fill="${YELLOW}"/>
  <polygon points="${hex(o.Rin)}" fill="${BLUE}"/>
  <path d="M${pt(s)} A${o.r},${o.r} 0 ${large},1 ${pt(e)}" fill="none" stroke="${CREAM}" stroke-width="${o.sw}" stroke-linecap="round"/>
  <path d="M${pt(a)} L${pt(tip)} L${pt(b)} Z" fill="${CREAM}"/>
  <circle cx="50" cy="50" r="${o.dot}" fill="${YELLOW}"/>
</svg>`;
}

const fs = require('fs');
const params = { Rout: 48, Rmid: 43.5, Rin: 39, r: 23, sw: 7, th1: -82, th2: 155, tipD: 14, w: 11, dot: 7 };
fs.writeFileSync('pikoci-logo.svg', logo(params));
fs.writeFileSync('variant-noline.svg', logo({ ...params, Rout: 46, Rmid: 46, Rin: 40.5 }));
console.log('written');
