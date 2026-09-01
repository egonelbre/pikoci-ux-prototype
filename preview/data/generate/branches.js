// The branch surface at real scale: 50 repos x ~117 branches. No picker
// survives that, which is why the Repos tab is a query over this index.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // ---------- branch index: the branch surface at REAL scale ----------------
  // 50 repos × (100 releases + 30 branches) means thousands of branch
  // pipelines, almost all quiet or EOL. No picker survives that; the
  // Branches tab is a QUERY over this index (filter + attention ranking +
  // quiet-hidden-by-default). Rich data exists for a handful of branch
  // pipelines above; the mass is summary-only rows — the same trick genPRs
  // uses for PR volume. A real server would serve this as one indexed
  // endpoint over the same pipeline objects.
  const BRANCHES = [];
  (function genBranchIndex() {
    const teams = ['payments', 'web', 'data', 'mobile', 'qa', 'platform', 'main', 'oss'];
    const svc = ['checkout', 'billing', 'ledger', 'storefront', 'admin', 'etl', 'warehouse', 'search',
      'auth', 'identity', 'notify', 'mailer', 'gateway', 'ratelimit', 'catalog', 'inventory',
      'pricing', 'orders', 'shipping', 'returns', 'fraud', 'kyc', 'payout', 'invoicing',
      'metrics', 'tracing', 'logging', 'flags', 'config', 'assets', 'images', 'video',
      'mobile-api', 'push', 'sms', 'webhooks', 'exports', 'imports', 'backup', 'archiver',
      'scheduler-svc', 'queue-svc', 'cache-svc', 'geo', 'i18n', 'ab-test', 'recs', 'ranking', 'crawler', 'sdk'];
    const authors = ['anna', 'kris', 'liis', 'marko', 'jt', 'tanel', 'sam', 'maria'];
    const rnd = seed => { let x = seed | 0; return () => ((x = Math.imul(x ^ (x >>> 15), 2654435761) >>> 0) % 1000) / 1000; };
    svc.forEach((repo, i) => {
      const r = rnd(i * 7919 + 17);
      const team = teams[i % teams.length];
      const major = 1 + (i % 4);
      const nRel = 60 + Math.floor(r() * 60); // maintained + EOL release lines
      const nOther = 20 + Math.floor(r() * 14); // long-lived non-release branches
      const mk = (branch, ageD, status, msg) => {
        const author = authors[Math.floor(r() * authors.length)];
        const at = now - ageD * day - Math.floor(r() * 20) * hr;
        BRANCHES.push({
          team, repo, branch, name: repo + '@' + branch, status, lastAt: at,
          jobs: ['test', 'build'],
          commits: [{ ref: (0x400000 + i * 4093 + ageD * 13).toString(16).slice(0, 7), msg, author, at,
            summary: status === 'none' ? ['none', 'none'] : [status, status === 'failed' ? 'none' : status] }],
        });
      };
      for (let k = 0; k < nRel; k++) {
        const minor = nRel - k;
        // the 2–3 newest lines are maintained (recent backports); the rest
        // are EOL — years old, nothing will ever build them again
        const maintained = k < 2 + Math.floor(r() * 2);
        const ageD = maintained ? Math.floor(r() * 25) : 40 + k * 21 + Math.floor(r() * 30);
        const status = maintained ? (r() < 0.08 ? 'failed' : 'succeeded') : (r() < 0.05 ? 'failed' : r() < 0.5 ? 'succeeded' : 'none');
        mk(`release-${major}.${minor}`, ageD,
          status, maintained ? `backport: ${['CVE fix', 'crash on reconnect', 'TLS options', 'off-by-one in pager'][Math.floor(r() * 4)]}` : `release-${major}.${minor}: final`);
      }
      for (let k = 0; k < nOther; k++) {
        const names = ['develop', 'canary', 'v-next', 'perf-rewrite', 'arm64-port', 'py3-migration',
          'ui-refresh', 'proto-v2', 'sharding', 'multi-region', 'lts-hardening', 'wasm-target', 'no-cgo', 'sso'];
        const branch = names[k % names.length] + (k >= names.length ? '-' + Math.ceil(k / names.length) : '');
        const active = r() < 0.25;
        mk(branch, active ? Math.floor(r() * 14) : 60 + Math.floor(r() * 500),
          active ? (r() < 0.08 ? 'failed' : r() < 0.2 ? 'started' : 'succeeded') : (r() < 0.6 ? 'succeeded' : 'none'),
          'merge main into ' + branch);
      }
    });
  })();

  D.BRANCHES = BRANCHES;
})();
