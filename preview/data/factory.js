// The shared workshop every scenario and generator builds with: the clock,
// the log generators, the build factory, and the collections they fill.
//
// b() assigns build ids from a counter, so the ORDER in which the scenario and
// generator files run decides every id in the dataset. index.html loads them in
// the order data/index.js documents; changing it renames builds.
(function () {
  'use strict';
  const PK = (window.PK = window.PK || {});

  const now = Date.now();
  const min = 60e3, hr = 3600e3, day = 24 * hr;
  // ---------- log generators (compact) ------------------------------------
  const gitLog = (ref) => [
    "Cloning into 'pikoci'...",
    'remote: Enumerating objects: 12643, done.',
    'Receiving objects: 100% (12643/12643), 8.42 MiB | 21.30 MiB/s, done.',
    `HEAD is now at ${ref}`,
  ];
  const lintLog = ok => ['$ make lint', 'go vet ./...', 'gofmt -l .', ok ? 'lint: OK' : 'pikoci/scheduler/tick.go\nERROR: files need gofmt\nmake: *** [lint] Error 1'].flatMap(s => s.split('\n'));
  const testLog = (ok) => {
    const pkgs = ['build', 'config', 'job', 'pipeline', 'resource', 'role', 'runner', 'scheduler', 'secret', 'team', 'worker'];
    const l = ['$ go test ./...'];
    for (const p of pkgs) {
      if (!ok && p === 'scheduler') {
        l.push('--- FAIL: TestSchedulerRace (2.41s)',
          '    tick_test.go:190: nil pinned version dereference in guard path',
          'FAIL\tgithub.com/pikoci/pikoci/pikoci/scheduler\t4.81s');
      } else l.push(`ok  \tgithub.com/pikoci/pikoci/pikoci/${p}\t${(Math.random() * 3 + 0.2).toFixed(2)}s`);
    }
    l.push(ok ? 'PASS: all packages' : 'make: *** [test] Error 1');
    return l;
  };
  const intgLog = (n) => {
    const l = ['$ make integration', 'services already up (started before this step)', 'running 48 integration specs'];
    for (let i = 1; i <= n; i++) l.push(`  ✓ spec ${String(i).padStart(2, '0')} (${(Math.random() * 2 + 0.1).toFixed(2)}s)`);
    if (n >= 48) l.push('', '48 passed, 0 failed');
    return l;
  };
  const siteLog = ok => ['$ mkdocs build --strict', 'INFO - Building documentation...',
    ...(ok ? ['site: OK'] : ["ERROR - Error reading page 'Scaling.md': [Errno 2] No such file or directory", 'Aborted with 1 error in strict mode!', 'make: *** [site] Error 1'])];
  let _id = 1000;
  const BUILDS = [];
  // b(pipeline, job, n, status, ref, startAgo, durSec, steps, opts)
  function b(pipeline, job, n, status, ref, startAgo, durSec, steps, opts) {
    const o = opts || {};
    const x = {
      id: 'b' + (_id++), team: o.team || 'main', pipeline, job, n, status,
      start: now - startAgo,
      end: ['started', 'pending', 'waiting_for_approval'].includes(status) ? null : now - startAgo + durSec * 1000,
      // a gated build waits consuming no worker (Approval-Gates.md); pending
      // builds are queued, also unassigned — a worker exists only once started
      worker: ['pending', 'waiting_for_approval'].includes(status) ? null : (o.worker || 'helsinki-1'),
      // provenance (K1): intent at creation, resolution at execution
      intent: { versions: { [o.res || 'git.pikoci']: ref }, configRev: o.configRev || 13 },
      resolved: ['pending', 'waiting_for_approval'].includes(status) ? null : { versions: { [o.res || 'git.pikoci']: ref }, worker: o.worker || 'helsinki-1' },
      cause: o.cause || { kind: 'version', detail: `git.pikoci ${ref}`, runId: 'run-' + ref },
      heldReason: o.heldReason || null, // K7: sub-state of pending
      queue: o.queue || null,
      steps: steps || [],
      retryOf: o.retryOf || null,
      artifacts: o.artifacts || null, // [{name, size}] — outputs on the page (R34)
      tests: o.tests || null, // K23 checks: [{id, s: pass|fail|skip, d, msg?}]
      measurements: o.measurements || null, // K24: [{id, value, unit, better}]
      testReportError: o.testReportError || null, // G5: ingestion failed, degrade honestly
    };
    BUILDS.push(x);
    return x;
  }
  const S = (name, type, status, dur, log) => ({ name, type, status, dur, log: log || [] });
  const T = m => Object.entries(m).map(([id, t]) => Object.assign({ id }, t));
  // a cron version's identity is its DATE (Cron.md: the version field is
  // `date`, not a ref) — ticks are minute-precision timestamps, 10min apart
  const tickAt = agoMin => new Date(now - agoMin * min).toISOString().slice(0, 16) + 'Z';

  PK.data = {
    now, min, hr, day,
    gitLog, lintLog, testLog, intgLog, siteLog,
    BUILDS, b, S, T, tickAt,
  };
})();
