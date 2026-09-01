// Lineages (K10): a PR and its successive pushes. Supersession means the
// lineage, not the newest build, is the unit the UI reasons about.
(function (PK) {
  'use strict';
  const M = (PK.model = PK.model || {});
  const { RANK } = PK.status;
  const { inTeam, getPipeline, jobCell } = M;
  const D = () => window.DATA;

  function secondaryCounts(pl) { // PR lineage failures → counts, never card color
    const ls = D().lineages.filter(l => (l.pl || 'pikoci-pr') === pl.name);
    const out = { failing: 0, held: 0, running: 0, total: ls.length };
    for (const l of ls) {
      const worst = lineageStatus(l);
      const held = !l.summary && D().builds.some(b => b.heldReason &&
        Object.values(b.intent.versions)[0] === lineageHead(l).id.ref);
      if (held) out.held++;
      else if (worst === 'failed') out.failing++;
      else if (worst === 'started' || worst === 'pending') out.running++;
    }
    return out;
  }
  function lineageHead(l) { return l.changes.find(c => !c.superseded) || l.changes[0]; }
  // each repo has its own PR pipeline; a lineage names it via `pl`
  const lineagePl = l => getPipeline(l.pl || 'pikoci-pr');
  const lineages = () => D().lineages.filter(l => inTeam(lineagePl(l)));
  function lineageStatus(l) {
    if (l.summary) return l.summary.slice().sort((a, b) => RANK[a] - RANK[b])[0];
    const pl = lineagePl(l);
    const ref = lineageHead(l).id.ref;
    let worst = 'none';
    for (const j of pl.jobs) {
      const c = jobCell(pl, j.name, ref);
      const s = c.kind === 'build' ? c.status : 'none';
      if (RANK[s] < RANK[worst]) worst = s;
    }
    return worst;
  }
  const mine = l => D().me.gitAuthors.includes(l.author);

  Object.assign(M, { secondaryCounts, lineageHead, lineagePl, lineages, lineageStatus, mine });
})(window.PK = window.PK || {});
