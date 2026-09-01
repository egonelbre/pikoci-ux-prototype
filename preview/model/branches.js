// One index over every watched branch: the handful of rich branch-kind
// pipelines plus the summary-only mass. This is what a server-side
// branch-index endpoint would return, team-scoped.
(function (PK) {
  'use strict';
  const M = (PK.model = PK.model || {});
  const { pipelines, primaryStatus, team } = M;
  const D = () => window.DATA;

  // one index over every watched branch: rich branch-kind pipelines + the
  // summary-only mass (DATA.branches) — what a server-side branch-index
  // endpoint would return, team-scoped
  function branchIndex() {
    const real = pipelines().filter(pl => pl.primaryContext.kind === 'branch').map(pl => {
      const lbl = pl.primaryContext.label;
      const r = pl.resources.find(x => x.name === pl.primaryContext.resource);
      const v = r && r.versions[0];
      // fold deploy pipelines into their repo: checkout-staging is repo
      // "checkout", branch main, variant "staging"
      let repo = pl.name, note = null;
      const m = pl.name.match(/^(.+)-(staging|prod)$/);
      if (m) { repo = m[1]; note = m[2]; }
      else if (pl.name.endsWith('-' + lbl)) repo = pl.name.slice(0, -lbl.length - 1);
      return {
        name: pl.name, team: pl.team, pl, repo, note,
        branch: lbl, status: primaryStatus(pl), lastAt: v ? (v.meta.at || 0) : 0,
        headRef: v ? v.id.ref : null, headMsg: v ? (v.meta.msg || '') : '', headAuthor: v ? (v.meta.author || '') : '',
      };
    });
    return real.concat(D().branches.filter(x => !team() || x.team === team()));
  }

  M.branchIndex = branchIndex;
})(window.PK = window.PK || {});
