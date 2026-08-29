// Additive PR dataset for variation 14 (change-centric). Load AFTER data.js.
// Adds: DATA.prs, a `main/pikoci-pr` pipeline, and interleaved PR builds —
// deliberately including everything that breaks pipeline-centric UIs:
// concurrent PRs, superseded commits (auto-cancelled), a fork PR waiting for
// CI approval, a queued build, and interleaved per-job build numbers.
(function () {
  'use strict';
  const D = window.DATA;
  const now = Date.now();
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;

  // ---------- PR pipeline ----------
  const PRPIPE = {
    team: 'main', name: 'pikoci-pr', public: false, paused: false,
    desc: 'PR checks for pikoci (triggered per pull request)',
    resources: [
      { name: 'git.pikoci-pr', type: 'git (pr)', pinned: null, checkEvery: '1m', lastCheck: now - 30 * 1000, checkError: null, versions: [] },
    ],
    jobs: [
      { name: 'lint', paused: false, inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
      { name: 'test-unit', paused: false, inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
      { name: 'test-matrix', paused: false, matrix: ['linux', 'macos'], inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
      { name: 'test-integration', paused: false, inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: ['lint', 'test-unit'] }] },
    ],
  };
  D.pipelines.push(PRPIPE);

  // ---------- PRs ----------
  D.prs = [
    {
      n: 481, title: 'scheduler: fix pinned version retrigger', author: 'egon', branch: 'fix/pinned-retrigger',
      draft: false, fork: false, created: now - 26 * hr, updated: now - 55 * min,
      commits: [
        { ref: '9aa31c2', msg: 'address review: guard nil version', at: now - 55 * min, superseded: false },
        { ref: 'c0ffee1', msg: 'scheduler: fix pinned version retrigger', at: now - 3 * hr, superseded: true },
      ],
    },
    {
      n: 476, title: 'mysql: add TLS connection options', author: 'maria', branch: 'mysql-tls',
      draft: false, fork: false, created: now - 2 * day, updated: now - 25 * min,
      commits: [{ ref: '8899aa1', msg: 'mysql: add TLS connection options', at: now - 25 * min, superseded: false }],
    },
    {
      n: 489, title: 'docs: fix typos in Runners.md', author: 'newcontrib', branch: 'patch-1',
      draft: false, fork: true, created: now - 40 * min, updated: now - 40 * min, ciApproval: 'required',
      commits: [{ ref: 'fee1bad', msg: 'docs: fix typos in Runners.md', at: now - 40 * min, superseded: false }],
    },
    {
      n: 472, title: 'wip: retry semantics for put steps', author: 'sam', branch: 'retry-put',
      draft: true, fork: false, created: now - 4 * day, updated: now - 2 * day,
      commits: [{ ref: 'd4a11f0', msg: 'wip: retry semantics', at: now - 2 * day, superseded: false }],
    },
  ];

  // resource versions mirror PR head commits (with PR metadata attached)
  for (const pr of D.prs) for (const c of pr.commits)
    PRPIPE.resources[0].versions.push({ ref: c.ref, msg: `PR #${pr.n}: ${c.msg}`, author: pr.author, at: c.at, pr: pr.n });
  PRPIPE.resources[0].versions.sort((a, b) => b.at - a.at);

  // ---------- PR builds (interleaved numbering across PRs, on purpose) ----------
  let id = 9000;
  // per-job global counters — this is exactly why "group by build number" breaks
  const counter = { 'lint': 204, 'test-unit': 199, 'test-matrix/linux': 187, 'test-matrix/macos': 186, 'test-integration': 171 };
  function PB(job, ref, status, startAgo, durSec, steps, opts) {
    const o = opts || {};
    const b = {
      id: 'pr' + (id++), team: 'main', pipeline: 'pikoci-pr', job,
      n: ++counter[job], status,
      start: now - startAgo,
      end: (status === 'started' || status === 'pending') ? null : now - startAgo + durSec * 1000,
      worker: o.worker || 'helsinki-2',
      versions: { 'git.pikoci-pr': ref },
      steps: steps || [],
      trigger: { kind: 'resource', detail: 'git.pikoci-pr' },
      queue: o.queue || null,
    };
    D.builds.push(b);
    return b;
  }
  const S = (name, type, status, dur, log) => ({ name, type, status, dur, log: log || [] });
  const git = ref => [
    "Cloning into 'pikoci'...",
    `Fetching pull request head ${ref}...`,
    `HEAD is now at ${ref} (merge of PR into master)`,
  ];

  // PR #472 (draft, stale): lint failed 2d ago
  PB('lint', 'd4a11f0', 'failed', 2 * day, 44, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('d4a11f0')),
    S('lint', 'task', 'failed', 38, ['$ make lint', 'go vet ./...', 'pikoci/resource/put.go:88: unreachable code', 'ERROR: vet failed', 'make: *** [lint] Error 1']),
  ]);
  PB('test-unit', 'd4a11f0', 'succeeded', 2 * day, 170, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('d4a11f0')),
    S('go test', 'task', 'succeeded', 162, ['$ go test ./...', 'ok  \tgithub.com/pikoci/pikoci/pikoci/resource\t2.1s', 'PASS: all packages']),
  ]);

  // PR #481, commit c0ffee1 (superseded): builds auto-cancelled when 9aa31c2 was pushed
  PB('lint', 'c0ffee1', 'succeeded', 3 * hr, 46, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('c0ffee1')),
    S('lint', 'task', 'succeeded', 40, ['$ make lint', 'lint: OK']),
  ]);
  PB('test-unit', 'c0ffee1', 'cancelled', 3 * hr, 61, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('c0ffee1')),
    S('go test', 'task', 'cancelled', 54, ['$ go test ./...', 'ok  \tgithub.com/pikoci/pikoci/pikoci/build\t1.9s', '… superseded by 9aa31c2 — auto-cancelled']),
  ]);
  PB('test-matrix/linux', 'c0ffee1', 'cancelled', 3 * hr, 30, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('c0ffee1')),
    S('go test (linux)', 'task', 'cancelled', 24, ['… superseded by 9aa31c2 — auto-cancelled']),
  ]);

  // PR #481, commit 9aa31c2 (latest, MINE): test-unit fails
  PB('lint', '9aa31c2', 'succeeded', 52 * min, 47, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('9aa31c2')),
    S('lint', 'task', 'succeeded', 41, ['$ make lint', 'go vet ./...', 'lint: OK']),
  ]);
  PB('test-unit', '9aa31c2', 'failed', 51 * min, 176, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('9aa31c2')),
    S('go test', 'task', 'failed', 168, [
      '$ go test ./...',
      'ok  \tgithub.com/pikoci/pikoci/pikoci/build\t2.02s',
      'ok  \tgithub.com/pikoci/pikoci/pikoci/resource\t1.41s',
      '--- FAIL: TestSchedulerRace (2.41s)',
      '    tick_test.go:184: expected build for job "deploy" with version ref=9aa31c2, got none',
      '    tick_test.go:190: nil pinned version dereference in guard path',
      'FAIL',
      'FAIL\tgithub.com/pikoci/pikoci/pikoci/scheduler\t4.81s',
      'make: *** [test] Error 1',
    ]),
  ]);
  PB('test-matrix/linux', '9aa31c2', 'succeeded', 50 * min, 141, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('9aa31c2')),
    S('go test (linux)', 'task', 'succeeded', 134, ['$ go test ./...', 'PASS: all packages']),
  ]);
  PB('test-matrix/macos', '9aa31c2', 'succeeded', 50 * min, 188, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('9aa31c2')),
    S('go test (macos)', 'task', 'succeeded', 180, ['$ go test ./...', 'PASS: all packages']),
  ], { worker: 'mac-mini' });
  // test-integration for 9aa31c2 never created (upstream failed) — intentional gap

  // PR #481: egon retried test-unit 8 minutes ago — same failure. This also makes
  // the "latest per job" graph genuinely mixed (test-unit @9aa31c2, rest @8899aa1).
  PB('test-unit', '9aa31c2', 'failed', 8 * min, 174, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('9aa31c2')),
    S('go test', 'task', 'failed', 166, [
      '$ go test ./...',
      '--- FAIL: TestSchedulerRace (2.38s)',
      '    tick_test.go:190: nil pinned version dereference in guard path',
      'FAIL\tgithub.com/pikoci/pikoci/pikoci/scheduler\t4.77s',
      'make: *** [test] Error 1',
      '(retry of #202 — not flaky, same failure)',
    ]),
  ]);

  // PR #476 (maria): green so far, integration running, macos matrix queued
  PB('lint', '8899aa1', 'succeeded', 24 * min, 45, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('8899aa1')),
    S('lint', 'task', 'succeeded', 39, ['$ make lint', 'lint: OK']),
  ]);
  PB('test-unit', '8899aa1', 'succeeded', 23 * min, 171, [
    S('git.pikoci-pr', 'get', 'succeeded', 6, git('8899aa1')),
    S('go test', 'task', 'succeeded', 163, ['$ go test ./...', 'ok  \tgithub.com/pikoci/pikoci/pikoci/mysql\t3.8s', 'PASS: all packages']),
  ]);
  PB('test-matrix/linux', '8899aa1', 'succeeded', 22 * min, 139, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('8899aa1')),
    S('go test (linux)', 'task', 'succeeded', 132, ['$ go test ./...', 'PASS: all packages']),
  ]);
  PB('test-matrix/macos', '8899aa1', 'pending', 12 * min, 0, [], { queue: { pos: 2, reason: 'mac-mini busy (1 runner with tag darwin)' } });
  PB('test-integration', '8899aa1', 'started', 6 * min, 0, [
    S('git.pikoci-pr', 'get', 'succeeded', 5, git('8899aa1')),
    S('services', 'task', 'succeeded', 4, ['postgres:16 up', 'redis:7 up', 'mysql:8 up (TLS)']),
    S('integration', 'task', 'started', 0, ['$ make integration', 'running 48 integration specs', '  ✓ spec 01 (0.44s)', '  ✓ spec 02 (1.02s)', '  ✓ spec 03 (0.31s)', '  ✓ spec 04 (0.87s)']),
  ]);
  // PR #489 (fork): NO builds — waiting for CI approval. The gap is the point.
})();
