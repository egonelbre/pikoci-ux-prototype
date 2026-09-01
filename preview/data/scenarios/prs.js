// PR lineages (K10): four handwritten cases carrying the interesting states
// (supersession, fork, draft), then 140 synthetic ones so the Changes table
// is exercised at the scale a real install has. Forge back-links last.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // ---------- lineages (K10): PRs of main/pikoci ---------------------------
  const LINEAGES = [
    {
      kind: 'pr', n: 481, title: 'scheduler: fix pinned version retrigger', author: 'egon', branch: 'fix/pinned-retrigger',
      draft: false, fork: false, updated: now - 55 * min,
      changes: [
        { id: { ref: '9aa31c2', pr: 481 }, meta: { msg: 'address review: guard nil version', author: 'egon', at: now - 55 * min }, superseded: false },
        { id: { ref: 'c0ffee1', pr: 481 }, meta: { msg: 'scheduler: fix pinned version retrigger', author: 'egon', at: now - 3 * hr }, superseded: true },
      ],
    },
    {
      kind: 'pr', n: 476, title: 'mysql: add TLS connection options', author: 'maria', branch: 'mysql-tls',
      draft: false, fork: false, updated: now - 25 * min,
      changes: [{ id: { ref: '8899aa1', pr: 476 }, meta: { msg: 'mysql: add TLS connection options', author: 'maria', at: now - 25 * min }, superseded: false }],
    },
    {
      kind: 'pr', n: 489, title: 'docs: fix typos in Runners.md', author: 'newcontrib', branch: 'patch-1',
      draft: false, fork: true, updated: now - 40 * min,
      changes: [{ id: { ref: 'fee1bad', pr: 489, fork: true }, meta: { msg: 'docs: fix typos in Runners.md', author: 'newcontrib', at: now - 40 * min }, superseded: false }],
    },
    {
      kind: 'pr', n: 472, title: 'wip: retry semantics for put steps', author: 'sam', branch: 'retry-put',
      draft: true, fork: false, updated: now - 2 * day,
      changes: [{ id: { ref: 'd4a11f0', pr: 472 }, meta: { msg: 'wip: retry semantics', author: 'sam', at: now - 2 * day }, superseded: false }],
    },
  ];

  // synthetic PR volume — the Changes table must survive 100s of open PRs
  // spread across many repos (each repo has its own PR pipeline; `pl` names it).
  // Synthetic lineages carry a precomputed per-job `summary` instead of builds.
  (function genPRs() {
    const humans = ['sam', 'riho', 'anna', 'jt', 'kris', 'marko', 'liis', 'tanel'];
    const bots = ['renovate[bot]', 'dependabot[bot]'];
    const topics = ['worker: reconnect jitter', 'docs: clarify serial_groups', 'hcl: better error spans',
      'ui: keyboard nav fixes', 'resource: git shallow clone', 'scheduler: tick metrics',
      'secret: vault v2 auth', 'notif: matrix escaping', 'build: cache key by go.sum',
      'api: paginate versions', 'runner: podman support', 'audit: export csv'];
    const deps = ['bump golang.org/x/crypto', 'bump preact 10.27', 'bump postgres driver', 'bump alpine base image'];
    // repos with their own PR pipelines (created in genPipelines below)
    const repos = ['checkout-pr', 'billing-pr', 'storefront-pr', 'admin-pr', 'etl-pr', 'app-pr', 'infra-pr', 'e2e-pr'];
    let n = 471;
    for (let i = 0; i < 140; i++) {
      const repo = i % 3 === 0 ? 'pikoci-pr' : repos[i % repos.length];
      const bot = i % 4 === 3;
      const author = bot ? bots[(i >> 2) % bots.length] : humans[i % humans.length];
      const title = bot ? deps[(i >> 2) % deps.length] : topics[i % topics.length];
      const r = i % 11;
      // summary per job — pikoci-pr: [lint, test-unit, matrix-linux, matrix-macos, integration];
      // other repos run a 2-job [lint, test] pipeline
      const summary = repo === 'pikoci-pr'
        ? (r === 0 ? ['failed', 'succeeded', 'succeeded', 'succeeded', 'none'] :
          r === 1 ? ['succeeded', 'failed', 'succeeded', 'succeeded', 'none'] :
          r === 2 ? ['succeeded', 'succeeded', 'started', 'pending', 'none'] :
          ['succeeded', 'succeeded', 'succeeded', 'succeeded', 'succeeded'])
        : (r === 0 ? ['failed', 'succeeded'] :
          r === 1 ? ['succeeded', 'failed'] :
          r === 2 ? ['succeeded', 'started'] :
          ['succeeded', 'succeeded']);
      n -= (1 + (i % 3));
      const ref = (0x100000 + i * 7919).toString(16).slice(0, 7);
      LINEAGES.push({
        kind: 'pr', pl: repo, n, title, author, branch: bot ? 'deps/' + ref : 'feat/' + ref,
        draft: !bot && i % 9 === 5, fork: false, bot,
        updated: now - (30 + i * 67) * min,
        summary,
        changes: [{ id: { ref, pr: n }, meta: { msg: title, author, at: now - (30 + i * 67) * min }, superseded: false }],
      });
    }
  })();
  // forge back-links (K3 metadata): every change knows the forge PR/MR/CL it
  // came from — GitHub, GitLab and Gerrit shapes all represented
  (function genForge() {
    for (const l of LINEAGES) {
      const plName = l.pl || 'pikoci-pr';
      const repo = plName === 'pikoci-pr' ? 'pikoci' : plName.replace(/-pr$/, '');
      l.forge = plName === 'infra-pr'
        ? { kind: 'Gerrit', url: `https://gerrit.example.com/c/pikoci/${repo}/+/${l.n}` }
        : ['storefront-pr', 'admin-pr', 'etl-pr'].includes(plName)
          ? { kind: 'GitLab', url: `https://gitlab.example.com/pikoci/${repo}/-/merge_requests/${l.n}` }
          : { kind: 'GitHub', url: `https://github.com/pikoci/${repo}/pull/${l.n}` };
    }
  })();

  D.LINEAGES = LINEAGES;
})();
