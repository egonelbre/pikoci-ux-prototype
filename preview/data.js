// Preview dataset — implements the UX-PLAN v4.1 data model on fake data:
// version identity vs metadata split (K3), provenance on builds (K1),
// decision records for non-runs (K5, two families), hatch metadata (K17),
// lineages with supersession (K10), a held fork build (K7), environments
// (K11), and the scenario set every prototype used (running build, waiting
// approval, failed trunk job, check error, stuck pending, expired hatch).
(function () {
  'use strict';
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
    const l = ['$ make integration', 'starting service postgres:16 ... up (1.2s)', 'starting service redis:7 ... up (0.4s)', 'running 48 integration specs'];
    for (let i = 1; i <= n; i++) l.push(`  ✓ spec ${String(i).padStart(2, '0')} (${(Math.random() * 2 + 0.1).toFixed(2)}s)`);
    if (n >= 48) l.push('', '48 passed, 0 failed');
    return l;
  };
  const siteLog = ok => ['$ mkdocs build --strict', 'INFO - Building documentation...',
    ...(ok ? ['site: OK'] : ["ERROR - Error reading page 'Scaling.md': [Errno 2] No such file or directory", 'Aborted with 1 error in strict mode!', 'make: *** [site] Error 1'])];

  // ---------- versions: identity | metadata (K3) ---------------------------
  // versions[resource] = [{id:{ref,(pr),(fork)}, meta:{msg,author,at,(title,draft)}}]
  const trunkVersions = [
    { id: { ref: '9f31c02' }, meta: { msg: 'scheduler: respect pinned versions on retrigger', author: 'egon', at: now - 20 * min } },
    { id: { ref: 'c7b2f90' }, meta: { msg: 'fix flaky TestSchedulerRace', author: 'maria', at: now - 3 * hr } },
    { id: { ref: '5f8c771' }, meta: { msg: 'ui: build tab status stripes', author: 'egon', at: now - 8 * hr } },
    { id: { ref: '0c4f5a6' }, meta: { msg: 'docs: approval gates examples', author: 'sam', at: now - 26 * hr } },
    { id: { ref: 'b3d9e02' }, meta: { msg: 'worker: reconnect with backoff', author: 'maria', at: now - 30 * hr } },
    { id: { ref: 'f0b6d15' }, meta: { msg: 'notif: discord embeds', author: 'egon', at: now - 3 * day } },
  ];

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

  // ---------- builds with provenance (K1) ----------------------------------
  let _id = 1000;
  const BUILDS = [];
  // b(pipeline, job, n, status, ref, startAgo, durSec, steps, opts)
  function b(pipeline, job, n, status, ref, startAgo, durSec, steps, opts) {
    const o = opts || {};
    const x = {
      id: 'b' + (_id++), team: o.team || 'main', pipeline, job, n, status,
      start: now - startAgo,
      end: ['started', 'pending', 'waiting_for_approval'].includes(status) ? null : now - startAgo + durSec * 1000,
      worker: o.worker || 'helsinki-1',
      // provenance (K1): intent at creation, resolution at execution
      intent: { versions: { [o.res || 'git.pikoci']: ref }, configRev: o.configRev || 13 },
      resolved: status === 'pending' ? null : { versions: { [o.res || 'git.pikoci']: ref }, worker: o.worker || 'helsinki-1' },
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

  // --- trunk history main/pikoci (jobs: lint, test-unit, test-matrix--linux/--macos, test-integration, build, deploy) ---
  function trunkRun(n, ref, ago, o) {
    o = o || {};
    b('pikoci', 'lint', n, 'succeeded', ref, ago, 48, [S('git.pikoci', 'get', 'succeeded', 6, gitLog(ref)), S('lint', 'task', 'succeeded', 41, lintLog(true))]);
    b('pikoci', 'test-unit', n, o.unitFail ? 'failed' : 'succeeded', ref, ago - 2e3, 174,
      [S('git.pikoci', 'get', 'succeeded', 7, gitLog(ref)), S('go test', 'task', o.unitFail ? 'failed' : 'succeeded', 166, testLog(!o.unitFail))], { worker: 'helsinki-2' });
    if (!o.docsOnly) {
      b('pikoci', 'test-matrix--linux', n, 'succeeded', ref, ago - 3e3, 140, [S('git.pikoci', 'get', 'succeeded', 6, gitLog(ref)), S('go test (linux)', 'task', 'succeeded', 132, testLog(true))], { worker: 'helsinki-2' });
      b('pikoci', 'test-matrix--macos', n, 'succeeded', ref, ago - 3e3, 188, [S('git.pikoci', 'get', 'succeeded', 6, gitLog(ref)), S('go test (macos)', 'task', 'succeeded', 180, testLog(true))], { worker: 'mac-mini' });
    }
    if (o.stopAfterUnit) return;
    b('pikoci', 'test-integration', n, o.intg || 'succeeded', ref, ago - 200e3, 78, [
      S('git.pikoci', 'get', 'succeeded', 5, gitLog(ref)),
      S('services', 'task', 'succeeded', 3, ['postgres:16 up', 'redis:7 up']),
      S('integration', 'task', o.intg || 'succeeded', 70, intgLog(o.intg === 'started' ? 23 : 48)),
    ]);
    if (o.stopAfterIntg) return;
    b('pikoci', 'build', n, 'succeeded', ref, ago - 290e3, 92, [S('git.pikoci', 'get', 'succeeded', 6, gitLog(ref)), S('compile', 'task', 'succeeded', 86, ['$ make build', 'go build -trimpath -o pikoci .', 'sha256: 4b7c9d21e8aa…', 'build: OK'])],
      { artifacts: [{ name: 'pikoci-linux-amd64', size: '18.4 MB', sha: '4b7c9d21' }, { name: 'pikoci-darwin-arm64', size: '17.9 MB', sha: '9e12f0aa' }, { name: 'checksums.txt', size: '1 KB' }],
        // measurements (K24): {id, value, unit, better} — trends and deltas are
        // generic; what a benchmark MEANS stays with the tool that emitted it
        measurements: [
          { id: 'binary-size/linux-amd64', value: +(17.9 + (n - 137) * 0.08).toFixed(2), unit: 'MB', better: 'lower' },
          { id: 'compile/wall', value: 80 + ((n * 7) % 13), unit: 's', better: 'lower' },
          { id: 'bench/SchedulerTick', value: +(41 + ((n * 11) % 9) + (n === 143 ? 6 : 0)).toFixed(1), unit: 'µs/op', better: 'lower' },
        ] });
    b('pikoci', 'deploy', n, o.deploy || 'succeeded', ref, ago - 400e3, 34, [
      S('git.pikoci', 'get', 'succeeded', 5, gitLog(ref)),
      S('approval: deploy to production', 'approve', o.deploy === 'waiting_for_approval' ? 'pending' : 'succeeded', 0,
        o.deploy === 'waiting_for_approval' ? ['waiting for 2 approvals (1/2)', 'approved by maria 12 minutes ago'] : ['approved by maria', 'approved by egon', 'gate passed']),
      S('deploy', 'task', o.deploy === 'waiting_for_approval' ? 'pending' : 'succeeded', 29,
        o.deploy === 'waiting_for_approval' ? [] : ['$ ./deploy.sh production', 'rolling restart on ci.pikoci.com ... done', 'health check: 200 OK', 'deploy: OK']),
    ], { cause: { kind: 'passed', detail: 'after build', runId: 'run-' + ref } });
  }
  trunkRun(138, 'f0b6d15', 3 * day);
  trunkRun(139, 'b3d9e02', 30 * hr, { unitFail: true, stopAfterUnit: true });
  // docs-only commit: only cheap tier ran; test jobs → not-affected decisions
  trunkRun(140, '0c4f5a6', 26 * hr, { docsOnly: true, stopAfterUnit: true });
  trunkRun(141, '5f8c771', 8 * hr);
  trunkRun(142, 'c7b2f90', 3 * hr, { deploy: 'waiting_for_approval' });
  trunkRun(143, '9f31c02', 14 * min, { intg: 'started', stopAfterIntg: true });
  const LIVE = BUILDS.find(x => x.job === 'test-integration' && x.n === 143);
  // a retry example (A5): retry of the failed #139 test-unit, also failed
  b('pikoci', 'test-unit', 139, 'failed', 'b3d9e02', 29 * hr, 170,
    [S('git.pikoci', 'get', 'succeeded', 6, gitLog('b3d9e02')), S('go test', 'task', 'failed', 164, testLog(false))],
    { cause: { kind: 'retry', detail: 'retry of #139 by egon', runId: 'run-b3d9e02' }, retryOf: '#139', worker: 'helsinki-2' });

  // --- PR builds (pipeline pikoci-pr; lineage-scoped supersession) ---
  function prBuild(job, n, status, ref, ago, dur, steps, o) {
    return b('pikoci-pr', job, n, status, ref, ago, dur, steps, Object.assign({ res: 'git.pikoci-pr' }, o));
  }
  // structured checks (K23): the minimal cross-language shape —
  // {id, s: pass|fail|skip, d: seconds, msg?}. Stable ids are what make
  // history, flake detection and new-vs-known possible; richer shapes stay
  // artifacts. unitTests(overrides) builds the suite for a run.
  const unitBase = {
    'scheduler/TestSchedulerRace': { s: 'pass', d: 2.2 },
    'scheduler/TestPinRetrigger': { s: 'pass', d: 0.4 },
    'scheduler/TestTickJitter': { s: 'pass', d: 0.9 },
    'worker/TestReconnectBackoff': { s: 'pass', d: 1.7 },
    'worker/TestDrainTimeout': { s: 'pass', d: 3.1 },
    'resource/TestGitShallowClone': { s: 'pass', d: 5.8 },
    'hcl/TestParseRemain': { s: 'pass', d: 0.1 },
    'notif/TestMatrixEscaping': { s: 'skip', d: 0, msg: 'quarantined: flaky on CI since #188 — see B3' },
  };
  const unitTests = o => Object.assign({}, unitBase, o || {});
  // filler: real suites run thousands of tests across many packages — enough
  // here to exercise the package roll-up (~50 tests, 10 packages)
  (function () {
    const pkgs = ['api', 'storage', 'cli', 'audit', 'secret', 'transport', 'pipeline', 'version'];
    const kinds = ['Parse', 'Roundtrip', 'Validate', 'Migrate', 'List', 'Auth'];
    let k = 0;
    for (const p of pkgs) for (let i = 0; i < 5 + (k % 3); i++) {
      unitBase[p + '/Test' + kinds[(k + i) % kinds.length] + (i || '')] = { s: 'pass', d: +((k * 13 + i * 7) % 40 / 10 + 0.05).toFixed(2) };
      k++;
    }
  })();
  const T = m => Object.entries(m).map(([id, t]) => Object.assign({ id }, t));

  // #472 draft: cheap tier ran 2d ago
  // lint findings ride the same K23 contract: each finding is a failed check
  // (id = linter/rule@file for cross-run stability, line lives in the message);
  // each clean linter is one passing check, so greens roll up like packages
  prBuild('lint', 201, 'failed', 'd4a11f0', 2 * day, 44, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('d4a11f0')), S('lint', 'task', 'failed', 38, ['$ make lint', 'pikoci/resource/put.go:88: unreachable code', 'ERROR: vet failed', 'make: *** [lint] Error 1'])],
    { tests: [
      // a failing check may carry ctx: a short excerpt. With ln it's source
      // (gutter numbers, hl = offending line); without ln it's raw output.
      { id: 'govet/unreachable@resource/put.go', s: 'fail', d: 0, msg: 'put.go:88: unreachable code',
        ctx: { ln: 84, hl: 88, code: [
          '  if err := s.commit(ctx); err != nil {',
          '    return fmt.Errorf("commit: %w", err)',
          '  }',
          '  return nil',
          '  s.metrics.putTotal.Inc()',
          '}'] } },
      { id: 'staticcheck/SA4006@scheduler/tick.go', s: 'fail', d: 0, msg: 'tick.go:141: value assigned to `next` is never used',
        ctx: { ln: 138, hl: 141, code: [
          'func (s *Scheduler) rearm() {',
          '  next := s.clock.Now().Add(tickInterval)',
          '  if s.paused {',
          '    next = time.Time{}',
          '  }',
          '  s.timer.Reset(tickInterval)'] } },
      { id: 'errcheck@resource/put.go', s: 'fail', d: 0, msg: 'put.go:92: error return value of `w.Close` is not checked',
        ctx: { ln: 89, hl: 92, code: [
          '  if _, err := io.Copy(w, body); err != nil {',
          '    return fmt.Errorf("copy: %w", err)',
          '  }',
          '  w.Close()',
          '  return s.index.Put(ctx, key, w.Sum())'] } },
      { id: 'gofmt', s: 'pass', d: 0.8 }, { id: 'govet', s: 'pass', d: 3.1 },
      { id: 'staticcheck', s: 'pass', d: 11.2 }, { id: 'errcheck', s: 'pass', d: 4.5 },
      { id: 'ineffassign', s: 'pass', d: 1.9 }, { id: 'misspell', s: 'pass', d: 0.6 },
    ] });
  prBuild('test-unit', 198, 'succeeded', 'd4a11f0', 2 * day, 170, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('d4a11f0')), S('go test', 'task', 'succeeded', 162, testLog(true))],
    { tests: T(unitTests()) });
  // #481 superseded commit c0ffee1: cancelled on push
  prBuild('lint', 202, 'succeeded', 'c0ffee1', 3 * hr, 46, [S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('c0ffee1')), S('lint', 'task', 'succeeded', 40, lintLog(true))]);
  prBuild('test-unit', 199, 'cancelled', 'c0ffee1', 3 * hr, 61, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('c0ffee1')), S('go test', 'task', 'cancelled', 54, ['$ go test ./...', '… superseded by 9aa31c2 — auto-cancelled'])],
    { tests: T(unitTests({ 'scheduler/TestSchedulerRace': { s: 'fail', d: 2.4, msg: 'race detected during scheduler tick' } })).slice(0, 4) }); // partial: cancelled mid-run
  // #481 latest 9aa31c2: unit fails (mine)
  prBuild('lint', 203, 'succeeded', '9aa31c2', 52 * min, 47, [S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('9aa31c2')), S('lint', 'task', 'succeeded', 41, lintLog(true))]);
  prBuild('test-unit', 200, 'failed', '9aa31c2', 51 * min, 176, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('9aa31c2')), S('go test', 'task', 'failed', 168, testLog(false))],
    { tests: T(unitTests({
      'scheduler/TestSchedulerRace': { s: 'fail', d: 2.41, msg: 'race detected during scheduler tick — WARNING: DATA RACE at scheduler.go:214',
        ctx: { code: [
          'WARNING: DATA RACE',
          'Write at 0x00c0003a2e10 by goroutine 44:',
          '  pikoci/scheduler.(*Scheduler).tick()  scheduler.go:214',
          'Previous read at 0x00c0003a2e10 by goroutine 41:',
          '  pikoci/scheduler.(*Scheduler).Horizon()  scheduler.go:96',
          '--- FAIL: TestSchedulerRace (2.41s)'] } },
      'scheduler/TestPinRetrigger': { s: 'fail', d: 0.5, msg: 'expected pinned version f0b6d15 to hold, scheduler rolled forward to 9f31c02',
        ctx: { code: [
          '=== RUN   TestPinRetrigger',
          '    pin_test.go:61: pinned f0b6d15, retriggered build',
          '    pin_test.go:66: got version 9f31c02, want f0b6d15',
          '--- FAIL: TestPinRetrigger (0.50s)'] } },
    })) });
  prBuild('test-matrix--linux', 190, 'succeeded', '9aa31c2', 50 * min, 141, [S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('9aa31c2')), S('go test (linux)', 'task', 'succeeded', 134, testLog(true))],
    { artifacts: [{ name: 'coverage-linux.html', size: '1.2 MB' }, { name: 'junit-linux.xml', size: '84 KB' }] });
  prBuild('test-matrix--macos', 189, 'succeeded', '9aa31c2', 50 * min, 188, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('9aa31c2')), S('go test (macos)', 'task', 'succeeded', 180, testLog(true))],
    { worker: 'mac-mini', artifacts: [{ name: 'coverage-macos.html', size: '1.1 MB' }, { name: 'junit-macos.xml', size: '79 KB' }],
      testReportError: 'junit-macos.xml: unexpected EOF at line 812 — report discarded; the build stays green, only the structured view is missing (G5)' });
  // #476 maria: green, integration running, macos queued
  prBuild('lint', 204, 'succeeded', '8899aa1', 24 * min, 45, [S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('8899aa1')), S('lint', 'task', 'succeeded', 39, lintLog(true))]);
  prBuild('test-unit', 201, 'succeeded', '8899aa1', 23 * min, 171, [S('git.pikoci-pr', 'get', 'succeeded', 6, gitLog('8899aa1')), S('go test', 'task', 'succeeded', 163, testLog(true))],
    { artifacts: [{ name: 'coverage.html', size: '1.3 MB' }], tests: T(unitTests()) });
  prBuild('test-matrix--linux', 191, 'succeeded', '8899aa1', 22 * min, 139, [S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('8899aa1')), S('go test (linux)', 'task', 'succeeded', 132, testLog(true))]);
  prBuild('test-matrix--macos', 190, 'pending', '8899aa1', 12 * min, 0, [], { queue: { matching: 1, busy: true, ahead: 0, tag: 'darwin' } });
  prBuild('test-integration', 172, 'started', '8899aa1', 6 * min, 0, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('8899aa1')),
    S('services', 'task', 'succeeded', 4, ['postgres:16 up', 'redis:7 up', 'mysql:8 up (TLS)']),
    S('integration', 'task', 'started', 0, intgLog(4)),
  ]);
  // #489 fork: HELD build (K7) — pending + held-untrusted
  prBuild('lint', 205, 'pending', 'fee1bad', 40 * min, 0, [], { heldReason: 'held-untrusted' });

  // --- main/website: trunk failing ---
  b('website', 'build-site', 89, 'failed', '1d97e35', 5 * hr, 61,
    [S('git.website', 'get', 'succeeded', 4, gitLog('1d97e35')), S('mkdocs', 'task', 'failed', 55, siteLog(false))],
    { res: 'git.website', worker: 'helsinki-2', cause: { kind: 'version', detail: 'git.website 1d97e35', runId: 'run-1d97e35' } });
  b('website', 'build-site', 88, 'succeeded', '8c22b41', 26 * hr, 58,
    [S('git.website', 'get', 'succeeded', 4, gitLog('8c22b41')), S('mkdocs', 'task', 'succeeded', 52, siteLog(true))],
    { res: 'git.website', worker: 'helsinki-2', cause: { kind: 'version', detail: 'git.website 8c22b41', runId: 'run-8c22b41' } });
  b('website', 'publish', 88, 'succeeded', '8c22b41', 26 * hr - 70e3, 21,
    [S('git.website', 'get', 'succeeded', 4, gitLog('8c22b41')), S('rsync', 'task', 'succeeded', 16, ['rsync -az site/ docs.pikoci.com:/srv/docs', 'publish: OK'])],
    { res: 'git.website', cause: { kind: 'passed', detail: 'after build-site', runId: 'run-8c22b41' } });

  // --- platform/infra: stuck pending ---
  b('infra', 'terraform-plan', 54, 'succeeded', 'aa10c3d', 9 * hr, 63,
    [S('git.infra', 'get', 'succeeded', 4, gitLog('aa10c3d')), S('plan', 'task', 'succeeded', 58, ['terraform plan', 'Plan: 2 to add, 1 to change, 0 to destroy.'])],
    { team: 'platform', res: 'git.infra', cause: { kind: 'version', detail: 'git.infra aa10c3d', runId: 'run-aa10c3d' } });
  b('infra', 'terraform-apply', 42, 'pending', 'bb42e1f', 25 * min, 0, [],
    { team: 'platform', res: 'git.infra', cause: { kind: 'manual', detail: 'manual by maria', runId: 'run-manual-42' }, queue: { matching: 0, busy: false, ahead: 0, tag: 'terraform' } });

  // --- oss/hello-world: cron ---
  // ticks 210, 209, 207 built; tick-208 deliberately has NO build so its
  // overlap-skipped decision record is what renders (a build at the same
  // ref would shadow the decision in jobCell)
  for (const i of [0, 1, 3]) {
    b('hello-world', 'gen', 210 - i, 'succeeded', 'tick-' + (210 - i), (10 + i * 10) * min, 2,
      [S('cron.every-10m', 'get', 'succeeded', 0, ['version: tick-' + (210 - i)]), S('echo', 'task', 'succeeded', 1, ['$ echo IN', 'IN'])],
      { team: 'oss', res: 'cron.every-10m', cause: { kind: 'cron', detail: 'tick', runId: 'run-tick-' + (210 - i) } });
  }

  // ---------- decision records (K5): two families --------------------------
  // {pipeline, job, ref, family: 'waiting'|'wont_run', code, text, at}
  const DECISIONS = [
    { pipeline: 'pikoci', job: 'deploy', ref: '9f31c02', family: 'waiting', code: 'upstream', text: 'upstream test-integration still running', at: now - 10 * min },
    { pipeline: 'pikoci', job: 'build', ref: '9f31c02', family: 'waiting', code: 'upstream', text: 'upstream test-integration still running', at: now - 10 * min },
    { pipeline: 'pikoci', job: 'test-matrix--linux', ref: '0c4f5a6', family: 'wont_run', code: 'not-affected', text: 'docs-only change — path rules exclude test-matrix', at: now - 26 * hr },
    { pipeline: 'pikoci', job: 'test-matrix--macos', ref: '0c4f5a6', family: 'wont_run', code: 'not-affected', text: 'docs-only change — path rules exclude test-matrix', at: now - 26 * hr },
    { pipeline: 'pikoci', job: 'test-integration', ref: '0c4f5a6', family: 'wont_run', code: 'not-affected', text: 'docs-only change — path rules exclude integration', at: now - 26 * hr },
    { pipeline: 'pikoci-pr', job: 'test-integration', ref: '9aa31c2', family: 'waiting', code: 'upstream', text: 'upstream test-unit failed for this commit — retry it to proceed', at: now - 48 * min },
    { pipeline: 'pikoci-pr', job: 'test-matrix--linux', ref: 'd4a11f0', family: 'waiting', code: 'draft-deferral', text: 'draft PR — expensive tier deferred until ready for review', at: now - 2 * day },
    { pipeline: 'pikoci-pr', job: 'test-matrix--macos', ref: 'd4a11f0', family: 'waiting', code: 'draft-deferral', text: 'draft PR — expensive tier deferred until ready for review', at: now - 2 * day },
    { pipeline: 'pikoci-pr', job: 'test-integration', ref: 'd4a11f0', family: 'waiting', code: 'draft-deferral', text: 'draft PR — expensive tier deferred until ready for review', at: now - 2 * day },
    { pipeline: 'pikoci-pr', job: 'test-unit', ref: 'fee1bad', family: 'waiting', code: 'held-untrusted', text: 'fork PR — CI held until a maintainer releases it', at: now - 40 * min },
    { pipeline: 'pikoci-pr', job: 'test-matrix--linux', ref: 'fee1bad', family: 'waiting', code: 'held-untrusted', text: 'fork PR — CI held until a maintainer releases it', at: now - 40 * min },
    { pipeline: 'pikoci-pr', job: 'test-integration', ref: 'c0ffee1', family: 'wont_run', code: 'superseded', text: 'superseded by 9aa31c2', at: now - 55 * min },
    { pipeline: 'release', job: 'tag-release', ref: '9f31c02', family: 'waiting', code: 'pause', text: 'pipeline paused by egon — "hold during v0.9.3 investigation"', at: now - 5 * hr },
    { pipeline: 'release', job: 'tag-release', ref: 'c7b2f90', family: 'waiting', code: 'pinned-mismatch', text: 'git.pikoci pinned to f0b6d15 — newer versions ignored', at: now - 3 * hr },
    { pipeline: 'hello-world', job: 'gen', ref: 'tick-208', family: 'wont_run', code: 'overlap-skipped', text: 'previous run still active at tick — overlap policy: skip', at: now - 30 * min },
  ];

  // ---------- pipelines -----------------------------------------------------
  const PIPELINES = [
    {
      team: 'main', name: 'pikoci', public: true, desc: 'Build, test and deploy PikoCI itself',
      primaryContext: { kind: 'branch', label: 'master', resource: 'git.pikoci' },
      paused: false, pausedMeta: null, configRev: 13,
      configHistory: [
        { rev: 13, by: 'egon', at: now - 2 * day, note: 'add nightly-e2e cron job' },
        { rev: 12, by: 'maria', at: now - 9 * day, note: 'approval gate 1→2 approvals' },
        { rev: 11, by: 'egon', at: now - 20 * day, note: 'matrix: add macos leg' },
      ],
      resources: [
        { name: 'git.pikoci', type: 'git', pinned: null, checkEvery: '1m', lastCheck: now - 40e3, checkError: null, versions: trunkVersions },
        { name: 'cron.nightly', type: 'cron', pinned: null, checkEvery: '@daily', lastCheck: now - 5 * hr, checkError: null, versions: [{ id: { ref: '2026-08-28' }, meta: { at: now - 5 * hr } }] },
        {
          name: 'docker.image', type: 'registry-image', pinned: null, checkEvery: '10m', lastCheck: now - 3 * min,
          checkError: 'GET ghcr.io/v2/: 401 Unauthorized (token expired?)',
          versions: [{ id: { ref: 'v0.9.3' }, meta: { at: now - 6 * day } }],
        },
      ],
      jobs: [
        { name: 'lint', tier: 'cheap', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-unit', tier: 'cheap', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-matrix--linux', group: 'test-matrix', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-matrix--macos', group: 'test-matrix', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-integration', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['lint', 'test-unit'] }] },
        { name: 'build', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['test-integration'] }, { res: 'cron.nightly', trigger: false, passed: [] }] },
        { name: 'deploy', approve: { name: 'deploy to production', need: 2 }, env: 'prod', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['build'] }] },
        { name: 'nightly-e2e', cadence: '@daily', inputs: [{ res: 'cron.nightly', trigger: true, passed: [] }], lastSuccess: now - 40 * hr },
      ],
    },
    {
      team: 'main', name: 'pikoci-pr', public: false, desc: 'PR checks for pikoci', prHold: 'forks',
      primaryContext: { kind: 'lineages', label: 'open PRs', resource: 'git.pikoci-pr' },
      paused: false, pausedMeta: null, configRev: 7,
      configHistory: [{ rev: 7, by: 'egon', at: now - 5 * day, note: 'pr_hold = "forks"' }],
      resources: [{ name: 'git.pikoci-pr', type: 'git (pr)', pinned: null, checkEvery: '1m', lastCheck: now - 30e3, checkError: null, versions: LINEAGES.flatMap(l => l.changes) }],
      jobs: [
        { name: 'lint', tier: 'cheap', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-unit', tier: 'cheap', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-matrix--linux', group: 'test-matrix', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-matrix--macos', group: 'test-matrix', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-integration', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: ['lint', 'test-unit'] }] },
      ],
    },
    {
      team: 'main', name: 'website', public: true, desc: 'docs.pikoci.com',
      primaryContext: { kind: 'branch', label: 'main', resource: 'git.website' },
      paused: false, pausedMeta: null, configRev: 4, configHistory: [{ rev: 4, by: 'sam', at: now - 12 * day, note: 'strict mode' }],
      resources: [{
        name: 'git.website', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 80e3, checkError: null,
        versions: [
          { id: { ref: '1d97e35' }, meta: { msg: 'restructure scaling docs', author: 'sam', at: now - 5 * hr } },
          { id: { ref: '8c22b41' }, meta: { msg: 'add secret-types page', author: 'maria', at: now - 26 * hr } },
        ],
      }],
      jobs: [
        { name: 'build-site', inputs: [{ res: 'git.website', trigger: true, passed: [] }] },
        { name: 'publish', inputs: [{ res: 'git.website', trigger: true, passed: ['build-site'] }] },
      ],
    },
    {
      team: 'main', name: 'release', public: false, desc: 'Tag + package releases',
      primaryContext: { kind: 'branch', label: 'master', resource: 'git.pikoci' },
      paused: true,
      pausedMeta: { actor: 'egon', reason: 'hold during v0.9.3 investigation', at: now - 5 * hr, until: now - 1 * hr }, // expired → attention
      configRev: 9, configHistory: [{ rev: 9, by: 'egon', at: now - 30 * day, note: 'goreleaser v2' }],
      resources: [{
        name: 'git.pikoci', type: 'git', pinned: { ref: 'f0b6d15', actor: 'egon', reason: 'last known-good for v0.9.3', at: now - 5 * hr },
        checkEvery: '5m', lastCheck: now - 2 * min, checkError: null, versions: trunkVersions.slice(0, 4),
      }],
      jobs: [{ name: 'tag-release', inputs: [{ res: 'git.pikoci', trigger: false, passed: [] }] }],
    },
    {
      team: 'platform', name: 'infra', public: false, desc: 'Terraform for ci.pikoci.com',
      primaryContext: { kind: 'branch', label: 'main', resource: 'git.infra' },
      paused: false, pausedMeta: null, configRev: 12, configHistory: [{ rev: 12, by: 'maria', at: now - 9 * hr, note: 'add worker node pool' }],
      resources: [{
        name: 'git.infra', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 30e3, checkError: null,
        versions: [
          { id: { ref: 'bb42e1f' }, meta: { msg: 'add worker node pool', author: 'maria', at: now - 40 * min } },
          { id: { ref: 'aa10c3d' }, meta: { msg: 'bump instance size', author: 'maria', at: now - 10 * hr } },
        ],
      }],
      jobs: [
        { name: 'terraform-plan', inputs: [{ res: 'git.infra', trigger: true, passed: [] }] },
        { name: 'terraform-apply', approve: { name: 'apply infra', need: 1 }, env: 'ci-infra', inputs: [{ res: 'git.infra', trigger: false, passed: ['terraform-plan'] }] },
      ],
    },
    {
      team: 'oss', name: 'hello-world', public: true, desc: 'Demo pipeline from the README',
      primaryContext: { kind: 'trigger', label: 'every-10m', resource: 'cron.every-10m' },
      paused: false, pausedMeta: null, configRev: 1, configHistory: [{ rev: 1, by: 'egon', at: now - 60 * day, note: 'initial' }],
      resources: [{
        name: 'cron.every-10m', type: 'cron', pinned: null, checkEvery: '@every 10m', lastCheck: now - 4 * min, checkError: null,
        versions: [{ id: { ref: 'tick-210' }, meta: { at: now - 10 * min } }, { id: { ref: 'tick-209' }, meta: { at: now - 20 * min } }],
      }],
      jobs: [{ name: 'gen', inputs: [{ res: 'cron.every-10m', trigger: true, passed: [] }] }],
    },
  ];

  // ---------- environments (K11) -------------------------------------------
  const ENVIRONMENTS = [
    {
      name: 'prod', pipeline: 'main/pikoci', job: 'deploy',
      version: '5f8c771', deployedAt: now - 8 * hr + 500e3, byBuild: '#141', by: 'auto (gate: maria, egon)',
      verified: true, drift: false,
      history: [
        { version: '5f8c771', at: now - 8 * hr + 500e3, build: '#141', ok: true },
        { version: 'f0b6d15', at: now - 3 * day + 500e3, build: '#139', ok: true },
      ],
    },
    {
      name: 'ci-infra', pipeline: 'platform/infra', job: 'terraform-apply',
      version: 'aa10c3d', deployedAt: now - 8 * hr, byBuild: '#41', by: 'egon',
      verified: true, drift: false, history: [{ version: 'aa10c3d', at: now - 8 * hr, build: '#41', ok: true }],
    },
  ];

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
          resources: [{ name: res, type: 'git (pr)', versions: [] }],
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

  // ---------- delivery: a deep, wide release train (graph stress test) ------
  // build → {lint, vet, sec-scan} → unit matrix ×5 → itest matrix ×3 → e2e
  // → signing → push ×2 → deploy: 8 layers, 16 jobs, two complete runs.
  (function genDelivery() {
    const res = 'git.delivery';
    const refs = [
      { ref: 'e4d5c6b', msg: 'release train: cut 0.9.5-rc2', author: 'maria', at: now - 50 * min },
      { ref: 'a1b2c3d', msg: 'release train: cut 0.9.5-rc1', author: 'egon', at: now - 26 * hr },
    ];
    const J = (name, needs, group) => ({ name, group, inputs: [{ res, trigger: true, passed: needs || [] }] });
    const U = ['linux-go1.24', 'linux-go1.25', 'macos-go1.24', 'macos-go1.25', 'windows-go1.25'];
    const I = ['postgres', 'mysql', 'sqlite'];
    const jobs = [
      J('build'),
      J('lint', ['build']), J('vet', ['build']), J('sec-scan', ['build']),
      ...U.map(u => J('unit--' + u, ['lint', 'vet', 'sec-scan'], 'unit')),
      ...I.map(x => J('itest--' + x, U.map(u => 'unit--' + u), 'itest')),
      J('e2e', I.map(x => 'itest--' + x)),
      J('signing', ['e2e']),
      J('push--amd64', ['signing'], 'push'), J('push--arm64', ['signing'], 'push'),
      J('deploy', ['push--amd64', 'push--arm64']),
    ];
    PIPELINES.push({
      team: 'main', name: 'delivery', public: false,
      desc: 'Release train: build → static checks → unit matrix → itest matrix → e2e → signing → push → deploy',
      primaryContext: { kind: 'branch', label: 'release/0.9.5', resource: res },
      paused: false, pausedMeta: null, configRev: 6,
      configHistory: [{ rev: 6, by: 'maria', at: now - 4 * day, note: 'add windows lane' }, { rev: 5, by: 'egon', at: now - 20 * day, note: 'split itest by db' }],
      resources: [{
        name: res, type: 'git', pinned: null, checkEvery: '1m', lastCheck: now - 40e3, checkError: null,
        versions: refs.map(r => ({ id: { ref: r.ref }, meta: { msg: r.msg, author: r.author, at: r.at } })),
      }],
      jobs,
    });
    const durOf = { build: 190, lint: 44, vet: 38, 'sec-scan': 81, e2e: 364, signing: 26, deploy: 47 };
    const durFor = nm => durOf[nm] || (nm.startsWith('unit--') ? 120 + (nm.length * 7) % 90
      : nm.startsWith('itest--') ? 240 + (nm.length * 13) % 70 : nm.startsWith('push--') ? 88 : 60);
    const depth = {};
    const dOf = nm => {
      if (depth[nm] != null) return depth[nm];
      const j = jobs.find(x => x.name === nm);
      let d = 0;
      for (const p of j.inputs[0].passed) d = Math.max(d, dOf(p) + 1);
      return (depth[nm] = d);
    };
    jobs.forEach(j => dOf(j.name));
    const maxD = Math.max(...Object.values(depth));
    const layerStart = [0];
    for (let d = 1; d <= maxD; d++) {
      layerStart[d] = layerStart[d - 1] + 8 +
        Math.max(...jobs.filter(j => depth[j.name] === d - 1).map(j => durFor(j.name)));
    }
    refs.forEach((r, ri) => {
      const base = ri === 0 ? 50 * min : 26 * hr;
      for (const j of jobs) {
        const status = ri === 0 && j.name === 'sec-scan' ? 'warning' : 'succeeded';
        const dur = durFor(j.name);
        const arts = j.name.startsWith('push--')
          ? [{ name: 'image digest', size: '—', sha: r.ref === 'e4d5c6b' ? 'c1a9e77d' : '5d20b3f1', dest: `ghcr.io/pikoci/pikoci:${ri === 0 ? '0.9.5-rc2' : '0.9.5-rc1'}-${j.name.slice(6)}` }]
          : j.name === 'signing' ? [{ name: 'cosign bundle', size: '4 KB', sha: '77ab01ce' }] : null;
        b('delivery', j.name, 8 - ri, status, r.ref, base - layerStart[depth[j.name]] * 1e3, dur,
          [S(res, 'get', 'succeeded', 5, ['ref: ' + r.ref]),
           S(j.name, 'task', status, dur - 5, status === 'warning'
             ? ['$ make sec-scan', 'WARN: 2 medium CVEs in base image (allowlisted until 0.9.6)', 'exit 0 (warning)']
             : ['$ make ' + j.name.replace(/--.*/, ''), 'OK'])],
          { res, cause: { kind: 'version', detail: res + ' ' + r.ref, runId: 'run-' + r.ref }, configRev: 6, artifacts: arts });
      }
    });
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

  // a queued arm64 build: its tag is served by the aws-arm pool (scaled to 0),
  // so the Queue can show the honest ephemeral answer — scaling up, not stuck
  (function genArmQueued() {
    const ap = PIPELINES.find(p => p.name === 'android-app');
    const ref = ap.resources[0].versions[0].id.ref;
    b('android-app', 'deploy', 41, 'pending', ref, 3 * min, 0, [],
      { team: 'mobile', res: 'git.android-app', cause: { kind: 'version', detail: 'git.android-app ' + ref, runId: 'run-' + ref },
        queue: { matching: 0, busy: false, ahead: 0, tag: 'arm64' } });
  })();

  // ---------- synthetic environments: ~20 deploy targets --------------------
  // Stress the Environments page the way real installs look: many per-service
  // staging/prod targets, most quietly green, a couple demanding attention.
  (function genEnvs() {
    const targets = ['checkout-staging', 'checkout-prod', 'billing-staging', 'billing-prod',
      'ledger-staging', 'ledger-prod', 'storefront-staging', 'storefront-prod',
      'admin-staging', 'admin-prod', 'etl-events', 'warehouse-sync', 'ios-app', 'android-app',
      'docker-images', 'base-ami', 'k8s-upgrade', 'examples'];
    const actors = ['anna', 'kris', 'liis', 'marko', 'jt', 'tanel', 'sam', 'maria'];
    targets.forEach((pn, k) => {
      const pl = PIPELINES.find(p => p.name === pn);
      if (!pl || !pl.resources[0].versions[0]) return;
      const ref = pl.resources[0].versions[0].id.ref;
      const prevRef = (parseInt(ref, 16) - 0x101).toString(16).slice(0, 7);
      const at = now - (2 + k * 5) * hr;
      const bn = '#' + (18 + (k * 7) % 60);
      ENVIRONMENTS.push({
        name: pn, pipeline: pl.team + '/' + pn, job: 'deploy',
        version: ref, deployedAt: at, byBuild: bn, by: actors[k % actors.length],
        verified: k !== 3, // billing-prod still verifying
        drift: k === 9,    // admin-prod: live version not deployed by CI
        history: [
          { version: ref, at, build: bn, ok: k !== 9 },
          { version: prevRef, at: at - (20 + k * 3) * hr, build: '#' + (parseInt(bn.slice(1)) - 1), ok: true },
        ],
      });
    });
  })();

  // ---------- teams / users / workers / audit ------------------------------
  const TEAMS = [
    { name: 'main', desc: 'PikoCI core', members: [{ user: 'egon', role: 'admin' }, { user: 'maria', role: 'maintain' }, { user: 'sam', role: 'write' }, { user: 'riho', role: 'read' }] },
    { name: 'platform', desc: 'Infrastructure', members: [{ user: 'egon', role: 'admin' }, { user: 'maria', role: 'admin' }] },
    { name: 'oss', desc: 'Public demos', members: [{ user: 'egon', role: 'admin' }] },
    { name: 'payments', desc: 'Payments & billing services', members: [{ user: 'anna', role: 'admin' }, { user: 'kris', role: 'write' }, { user: 'egon', role: 'read' }] },
    { name: 'web', desc: 'Storefront & admin', members: [{ user: 'liis', role: 'admin' }, { user: 'marko', role: 'write' }] },
    { name: 'data', desc: 'Data platform', members: [{ user: 'jt', role: 'admin' }, { user: 'tanel', role: 'write' }] },
    { name: 'mobile', desc: 'iOS & Android apps', members: [{ user: 'kris', role: 'admin' }, { user: 'liis', role: 'write' }] },
    { name: 'qa', desc: 'Quality engineering', members: [{ user: 'riho', role: 'admin' }, { user: 'sam', role: 'write' }] },
  ];
  const USERS = [
    { username: 'egon', name: 'Egon', gitAuthors: ['egon'], role: 'admin' },
    { username: 'maria', name: 'Maria K', gitAuthors: ['maria'], role: 'maintain' },
    { username: 'sam', name: 'Sam T', gitAuthors: ['sam'], role: 'write' },
    { username: 'riho', name: 'Riho V', gitAuthors: [], role: 'read' },
  ];
  // Ephemeral capacity: the POOL is the stable, named object; instances are
  // cattle that register with the pool's worker token and disappear on idle.
  const POOLS = [
    { name: 'gcp-ci', provider: 'GCP MIG · e2-standard-8', team: null, tags: ['linux', 'docker'], min: 0, max: 8, idleTtl: '10m', bootSecs: 75, terminatedToday: 14, buildsToday: 132 },
    { name: 'aws-arm', provider: 'AWS ASG · c7g.2xlarge', team: null, tags: ['linux', 'arm64'], min: 0, max: 4, idleTtl: '5m', bootSecs: 95, terminatedToday: 3, buildsToday: 11 },
  ];
  const WORKERS = [
    { name: 'helsinki-1', status: 'online', team: null, tags: ['linux', 'docker', 'exec'], version: 'v0.9.4', running: 0, disk: 0.34, cpu: 0.06, slots: 4 },
    { name: 'helsinki-2', status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 2, disk: 0.91, cpu: 0.71, slots: 4 },
    { name: 'mac-mini', status: 'online', team: 'main', tags: ['darwin', 'exec'], version: 'v0.9.3', running: 0, disk: 0.58, cpu: 0.11, slots: 2 },
    { name: 'builder-gpu', status: 'stale', team: 'platform', tags: ['linux', 'gpu', 'terraform'], version: 'v0.9.1', lastSeen: now - 3 * hr, running: 0, disk: 0.12, cpu: null, slots: 2 },
    // gcp-ci pool: two live instances + one still booting
    { name: 'gcp-ci-7f3a', pool: 'gcp-ci', ephemeral: true, status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 3, slots: 4, disk: 0.22, cpu: 0.93, up: 38 * min },
    { name: 'gcp-ci-9c21', pool: 'gcp-ci', ephemeral: true, status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 1, slots: 4, disk: 0.15, cpu: 0.42, up: 12 * min },
    { name: 'gcp-ci-b04d', pool: 'gcp-ci', ephemeral: true, status: 'provisioning', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 0, slots: 4, disk: 0, cpu: null, up: 40e3 },
    // aws-arm pool: scaled to zero right now — no instance rows at all
  ];

  // last-week telemetry per worker: hourly cpu/disk samples + the runs that
  // produced them (each run carries its disk delta → "what fills the disk")
  (function genWorkerWeek() {
    const jobsBy = { // [pipeline, job, diskDeltaFraction]
      'helsinki-1': [['pikoci', 'lint', 0.001], ['pikoci', 'build', 0.004], ['website', 'build-site', 0.002]],
      'helsinki-2': [['docker-images', 'build', 0.032], ['pikoci', 'test-unit', 0.002], ['pikoci-pr', 'test-unit', 0.001]],
      'mac-mini': [['pikoci', 'test-matrix--macos', 0.003], ['pikoci-pr', 'test-matrix--macos', 0.002]],
      'builder-gpu': [['infra', 'terraform-plan', 0.001]],
      'gcp-ci-7f3a': [['delivery', 'unit--linux-go1.24', 0.004], ['checkout-staging', 'test', 0.003]],
      'gcp-ci-9c21': [['delivery', 'itest--postgres', 0.005], ['etl-orders', 'test', 0.002]],
    };
    for (const w of WORKERS) {
      const specs = jobsBy[w.name];
      if (!specs) continue;
      const seed = [...w.name].reduce((s, c) => s + c.charCodeAt(0), 0);
      const rand = k => (((seed * 9301 + k * 49297) % 233280) + 233280) % 233280 / 233280;
      // ephemeral instances only exist for their uptime; pets get the full week
      const hours = w.ephemeral ? Math.max(1, Math.round((w.up || 0) / hr)) : 168;
      const samples = [], runs = [];
      let disk = 0, n = 300 + seed % 90;
      for (let k = hours; k >= 0; k--) {
        let cpu = 0.04 + rand(k) * 0.09;
        if (k > 0 && rand(k * 5) > (w.ephemeral ? 0.45 : 0.8)) {
          const sp = specs[Math.floor(rand(k * 7) * specs.length)];
          const durM = 6 + Math.round(rand(k * 13) * 28);
          // bind to a real build record of this pipeline/job so the run is navigable
          const real = BUILDS.filter(x => x.pipeline === sp[0] && x.job === sp[1]);
          const rb = real.length ? real[(n + k) % real.length] : null;
          runs.push({ agoH: k, pipeline: sp[0], job: sp[1], n: rb ? rb.n : n++, bid: rb ? rb.id : null, durM, dDisk: sp[2] });
          disk += sp[2];
          cpu = 0.55 + rand(k * 3) * 0.42;
        }
        if (w.name === 'helsinki-2' && k === 118) { // one retention prune mid-week
          runs.push({ agoH: k, pipeline: '(retention)', job: 'docker image prune', n: null, durM: 4, dDisk: -0.11 });
          disk -= 0.11; cpu = 0.18;
        }
        samples.push({ agoH: k, cpu: Math.min(0.97, cpu), disk });
      }
      // pin the trajectory so it ENDS at today's gauge value (never fabricate now)
      const rawEnd = samples[samples.length - 1].disk;
      const target = w.disk == null ? 0.1 : w.disk;
      let scale = 1, s0 = target - rawEnd;
      if (s0 < 0.04) { scale = Math.max(0, (target - 0.04) / Math.max(rawEnd, 0.001)); s0 = target - rawEnd * scale; }
      samples.forEach(s => { s.disk = s0 + s.disk * scale; });
      runs.forEach(r => { r.dDisk *= scale; });
      w.week = { hours, samples, runs };
    }
  })();
  const AUDIT = [
    { at: now - 5 * min, user: 'maria', action: 'build.approve', target: 'main/pikoci deploy #142', detail: 'approval 1/2 · bound to c7b2f90 @ config rev 13' },
    { at: now - 14 * min, user: 'system', action: 'build.create', target: 'main/pikoci #143', detail: 'version git.pikoci 9f31c02' },
    { at: now - 40 * min, user: 'system', action: 'build.hold', target: 'main/pikoci-pr lint #205', detail: 'held-untrusted: fork PR #489' },
    { at: now - 3 * hr, user: 'system', action: 'build.supersede', target: 'main/pikoci-pr c0ffee1', detail: 'lineage PR #481 — superseded by 9aa31c2, 2 builds cancelled' },
    { at: now - 5 * hr, user: 'egon', action: 'resource.pin', target: 'main/release git.pikoci', detail: 'f0b6d15 · "last known-good for v0.9.3" · until —' },
    { at: now - 5 * hr, user: 'egon', action: 'pipeline.pause', target: 'main/release', detail: '"hold during v0.9.3 investigation" · until ' + new Date(now - hr).toISOString().slice(0, 16) },
    { at: now - 2 * day, user: 'egon', action: 'pipeline.set', target: 'main/pikoci', detail: 'config rev 13 (CAS ok, base rev 12)' },
  ];

  window.DATA = {
    now, me: { username: 'egon', role: 'admin', gitAuthors: ['egon'] },
    teams: TEAMS, users: USERS, pipelines: PIPELINES, builds: BUILDS,
    lineages: LINEAGES, decisions: DECISIONS, environments: ENVIRONMENTS,
    workers: WORKERS, pools: POOLS, audit: AUDIT,
    liveBuildId: LIVE ? LIVE.id : null,
    capabilities: { insightsShipped: false, notificationsShipped: false },
    soloMode: false,
  };
})();
