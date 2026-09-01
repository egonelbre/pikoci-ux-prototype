// Company scale: ~40 more pipelines with real resources, jobs and builds,
// so every page works uniformly on them. Only the dataset is generated.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, PIPELINES } = D;

  // ---------- synthetic pipelines: company scale (~40 total) ---------------
  // Each is a real (small) pipeline — resources, jobs, builds — so every page
  // works on it uniformly; only the dataset is generated. Mirrors the common
  // shape: per-team services with staging/prod variants plus scheduled chores.
  (function genPipelines() {
    const specs = [ // [team, name, desc, pattern: ok|fail|run]
      ['payments', 'checkout-staging', 'Deploy checkout to staging', 'fail'],
      ['payments', 'checkout-prod', 'Deploy checkout to prod', 'ok'],
      ['payments', 'billing-staging', 'Deploy billing to staging', 'ok'],
      ['payments', 'billing-prod', 'Deploy billing to prod', 'ok'],
      ['payments', 'ledger-staging', 'Ledger service, staging', 'run'],
      ['payments', 'ledger-prod', 'Ledger service, prod', 'ok'],
      ['web', 'storefront-staging', 'Storefront, staging', 'ok'],
      ['web', 'storefront-prod', 'Storefront, prod', 'ok'],
      ['web', 'admin-staging', 'Admin panel, staging', 'ok'],
      ['web', 'admin-prod', 'Admin panel, prod', 'ok'],
      ['web', 'seo-reports', 'Nightly SEO crawl', 'ok'],
      ['web', 'perf-budget', 'Lighthouse perf budget', 'ok'],
      ['data', 'etl-events', 'Event ingestion ETL', 'fail'],
      ['data', 'etl-orders', 'Orders ETL', 'ok'],
      ['data', 'warehouse-sync', 'Warehouse sync', 'ok'],
      ['data', 'dbt-models', 'dbt model builds', 'ok'],
      ['data', 'ml-training', 'Weekly model training', 'ok'],
      ['mobile', 'ios-app', 'iOS build & TestFlight', 'ok'],
      ['mobile', 'android-app', 'Android build & Play upload', 'ok'],
      ['mobile', 'mobile-e2e', 'Device-farm E2E', 'run'],
      ['qa', 'e2e-nightly', 'Full-product E2E', 'ok'],
      ['qa', 'load-test', 'Weekly load test', 'ok'],
      ['qa', 'chaos', 'Chaos experiments', 'ok'],
      ['platform', 'docker-images', 'Base image rebuilds', 'ok'],
      ['platform', 'base-ami', 'AMI baking', 'ok'],
      ['platform', 'backups', 'DB backup verify', 'ok'],
      ['platform', 'secrets-rotation', 'Monthly secret rotation', 'ok'],
      ['platform', 'k8s-upgrade', 'Cluster upgrade rehearsal', 'ok'],
      ['main', 'cli-release', 'pikoci CLI packages', 'ok'],
      ['main', 'homebrew-tap', 'Homebrew formula bump', 'ok'],
      ['main', 'docs-links', 'Nightly docs link check', 'ok'],
      ['main', 'deps-audit', 'Dependency audit', 'ok'],
      ['oss', 'examples', 'Example pipelines CI', 'ok'],
      ['oss', 'actions-mirror', 'Mirror to GitHub', 'ok'],
      // per-repo PR pipelines (their lineages come from genPRs above)
      ['payments', 'checkout-pr', 'PR checks for checkout', 'pr'],
      ['payments', 'billing-pr', 'PR checks for billing', 'pr'],
      ['web', 'storefront-pr', 'PR checks for storefront', 'pr'],
      ['web', 'admin-pr', 'PR checks for admin', 'pr'],
      ['data', 'etl-pr', 'PR checks for the ETL repos', 'pr'],
      ['mobile', 'app-pr', 'PR checks for the mobile app', 'pr'],
      ['platform', 'infra-pr', 'PR checks for infra (plan only)', 'pr'],
      ['qa', 'e2e-pr', 'PR checks for the E2E suite', 'pr'],
    ];
    const authors = ['anna', 'kris', 'liis', 'marko', 'jt', 'tanel', 'sam', 'maria'];
    specs.forEach((sp, i) => {
      const [team, name, desc, pat] = sp;
      const res = 'git.' + name;
      const ref = (0x900000 + i * 6151).toString(16).slice(0, 7);
      const author = authors[i % authors.length];
      // hist: last-10 completed runs [status, durSec] — feeds weather + duration
      // trend on the Pipelines table (rich pipelines derive this from real builds)
      const hist = [];
      const base = 45 + (i % 7) * 22;
      const slope = ((i % 5) - 2) * 0.05; // some pipelines trend slower, some faster
      for (let k = 0; k < 10; k++) {
        const wig = (((i * 31 + k * 17) % 13) - 6) / 40;
        const failK = pat === 'fail' ? (k === 9 || (i + k) % 7 === 3) : ((i + k) % 9 === 4 && k < 8);
        hist.push([failK ? 'failed' : 'succeeded', Math.max(8, Math.round(base * (1 + slope * k + wig)))]);
      }
      if (pat === 'pr') { // lineage-kind: per-PR status, no branch builds
        PIPELINES.push({
          team, name, public: false, desc, prHold: 'forks', hist,
          primaryContext: { kind: 'lineages', label: 'open PRs', resource: res },
          paused: false, pausedMeta: null, configRev: 2,
          configHistory: [{ rev: 2, by: author, at: now - (3 + i) * day, note: 'add lint tier' }],
          resources: [{ name: res, type: 'git', params: { pr: true }, versions: [] }],
          jobs: [{ name: 'lint', inputs: [{ res }] }, { name: 'test', inputs: [{ res }] }],
        });
        return;
      }
      PIPELINES.push({
        team, name, public: false, desc, hist,
        primaryContext: { kind: 'branch', label: 'main', resource: res },
        paused: false, pausedMeta: null, configRev: 2 + (i % 5),
        configHistory: [{ rev: 2 + (i % 5), by: author, at: now - (3 + i) * day, note: 'tune ' + name }],
        resources: [{ name: res, type: 'git', versions: [{ id: { ref }, meta: { msg: desc.toLowerCase(), author, at: now - (40 + i * 53) * min } }] }],
        jobs: [
          { name: 'test', inputs: [{ res }] },
          { name: 'build', inputs: [{ res, passed: ['test'] }] },
          { name: 'deploy', inputs: [{ res, passed: ['build'] }] },
        ],
      });
      const n = 20 + (i * 7) % 60;
      const stAgo = (35 + i * 53) * min;
      const mk = (job, status, off, dur, log) =>
        b(name, job, n, status, ref, stAgo - off, dur,
          [S(res, 'get', 'succeeded', 4, ['ref: ' + ref]), S(job, 'task', status, Math.max(dur - 4, 1), log)],
          { team, res, cause: { kind: 'version', detail: res + ' ' + ref, runId: 'run-' + ref } });
      // off is subtracted from stAgo → downstream jobs start LATER (smaller ago)
      if (pat === 'fail') {
        mk('test', 'failed', 0, 60 + i, ['$ make test', 'FAIL: ' + name + ' test_' + (i * 13 % 97)]);
      } else if (pat === 'run') {
        mk('test', 'succeeded', 0, 50 + i, ['ok']);
        // running build started minutes ago, not hours — this is load, not a hang
        mk('build', 'started', stAgo - (4 + (i % 11)) * min, 80, ['building…']);
      } else {
        mk('test', 'succeeded', 0, 50 + i, ['ok']);
        mk('build', 'succeeded', (60 + i) * 1e3, 90 + i, ['ok']);
        mk('deploy', 'succeeded', (170 + 2 * i) * 1e3, 30, ['deployed']);
      }
    });
  })();
})();
