// pikoci logo generator — same concept (PICO-8 blue hex, yellow border,
// cream clockwise arc arrow, yellow dot), fixed for small sizes, white
// backgrounds, and a bent arrowhead that follows the arc.
const NAVY = '#1D2B53', BLUE = '#29ADFF', YELLOW = '#FFEC27', CREAM = '#FFF1E8';
const C = 50;
const rad = d => d * Math.PI / 180;
const P = (deg, r) => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))];
const f = n => +n.toFixed(2);
const pt = ([x, y]) => `${f(x)},${f(y)}`;

// pointy-top hexagon, scaled
const hex = R => Array.from({ length: 6 }, (_, i) => pt(P(-90 + i * 60, R))).join(' ');

function arrowArc({ r, sw, th1, th2, headLen, headW }) {
  // arc: blunt start th1, travels CLOCKWISE (screen) to th2 where the head sits
  const s = P(th1, r), e = P(th2, r);
  const large = ((th2 - th1 + 360) % 360) > 180 ? 1 : 0;
  const arc = `M${pt(s)} A${r},${r} 0 ${large},1 ${pt(e)}`;
  // bent head: tip ON the same circle further along; barbs behind, edges
  // curved via controls at intermediate angles so the head sweeps with the arc
  const tipA = th2 + headLen;               // degrees past the end
  const T = P(tipA, r);
  const backA = th2 - 1;
  const B1 = P(backA, r + headW), B2 = P(backA, r - headW);
  const c1 = P(th2 + headLen * 0.5, r + headW * 0.45);
  const c2 = P(th2 + headLen * 0.5, r - headW * 0.45);
  const cBack = P(backA + 3, r);
  const head = `M${pt(B1)} Q${pt(c1)} ${pt(T)} Q${pt(c2)} ${pt(B2)} Q${pt(cBack)} ${pt(B1)} Z`;
  return { arc, head, sw };
}

function logo(o) {
  const a = arrowArc(o);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="${hex(o.Rout)}" fill="${NAVY}"/>
  <polygon points="${hex(o.Rmid)}" fill="${YELLOW}"/>
  <polygon points="${hex(o.Rin)}" fill="${BLUE}"/>
  <path d="${a.arc}" fill="none" stroke="${CREAM}" stroke-width="${o.sw}" stroke-linecap="round"/>
  <path d="${a.head}" fill="${CREAM}"/>
  <circle cx="50" cy="50" r="${o.dot}" fill="${YELLOW}"/>
</svg>`;
}

const fs = require('fs');
const params = { Rout: 48, Rmid: 43.5, Rin: 39, r: 23, sw: 7, th1: -82, th2: 152, headLen: 19, headW: 10, dot: 7 };
fs.writeFileSync('pikoci-logo.svg', logo(params));
// variant without the navy keyline (pure original colors) for comparison
fs.writeFileSync('variant-noline.svg', logo({ ...params, Rout: 46, Rmid: 46, Rin: 40.5 }));
console.log('written');
