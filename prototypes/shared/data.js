// Shared fake dataset for all PikoCI UX prototypes.
// Everything lives in a single global: DATA. Mutable on purpose so prototypes
// can simulate actions (approve, retry, pause, pin...).
(function () {
  'use strict';

  const now = Date.now();
  const min = 60 * 1000, hr = 60 * min, day = 24 * hr;

  // ---------- log generators ----------------------------------------------
  function gitLog(sha, branch) {
    return [
      "Cloning into 'pikoci'...",
      "remote: Enumerating objects: 12643, done.",
      "remote: Counting objects: 100% (2231/2231), done.",
      "remote: Compressing objects: 100% (861/861), done.",
      "Receiving objects: 100% (12643/12643), 8.42 MiB | 21.30 MiB/s, done.",
      "Resolving deltas: 100% (8963/8963), done.",
      `HEAD is now at ${sha.slice(0, 7)} on ${branch}`,
    ];
  }
  function lintLog(ok) {
    const l = [
      "$ make lint",
      "go vet ./...",
      "oxlint pikoci/transport/http/assets/js",
      "Found 0 warnings and 0 errors in 214 files",
      "gofmt -l .",
    ];
    if (ok) l.push("lint: OK");
    else l.push("pikoci/scheduler/tick.go", "ERROR: files need gofmt", "make: *** [lint] Error 1");
    return l;
  }
  function testLog(ok, pkgFail) {
    const pkgs = ["apitoken", "auditlog", "build", "condition", "config", "job",
      "notification", "pipeline", "resource", "restype", "role", "runner",
      "scheduler", "secret", "service", "team", "trigger", "user", "wkr"];
    const l = ["$ go test ./...", ""];
    for (const p of pkgs) {
      if (!ok && p === pkgFail) {
        l.push(`--- FAIL: TestSchedulerRace (2.41s)`);
        l.push(`    tick_test.go:184: expected build for job "deploy" with version ref=9f31c02, got none`);
        l.push(`    tick_test.go:190: scheduler advanced past pinned version`);
        l.push(`FAIL`);
        l.push(`FAIL\tgithub.com/pikoci/pikoci/pikoci/${p}\t4.812s`);
      } else {
        l.push(`ok  \tgithub.com/pikoci/pikoci/pikoci/${p}\t${(Math.random() * 3 + 0.2).toFixed(3)}s`);
      }
    }
    l.push("");
    l.push(ok ? "PASS: all packages" : "make: *** [test] Error 1");
    return l;
  }
  function integrationLog(partial) {
    const l = [
      "$ make integration",
      "starting service postgres:16 ... up (1.2s)",
      "starting service redis:7 ... up (0.4s)",
      "running 48 integration specs",
    ];
    const n = partial ? 23 : 48;
    for (let i = 1; i <= n; i++) l.push(`  ✓ spec ${String(i).padStart(2, '0')} (${(Math.random() * 2 + 0.1).toFixed(2)}s)`);
    if (!partial) l.push("", "48 passed, 0 failed (61.3s)");
    return l;
  }
  function buildLog() {
    return [
      "$ make build",
      "go build -trimpath -ldflags '-s -w -X main.version=v0.9.4' -o pikoci .",
      "-rw-r--r-- 1 ci ci 28M pikoci",
      "sha256: 4b7c9d21e8aa04f39c1d2e6f7b8a9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
      "build: OK",
    ];
  }
  function deployLog() {
    return [
      "$ ./deploy.sh production",
      "pushing ghcr.io/pikoci/pikoci:v0.9.4 ...",
      "digest: sha256:7f3a...e91b size: 1786",
      "rolling restart on ci.pikoci.com ... done (8.1s)",
      "health check: 200 OK",
      "deploy: OK",
    ];
  }
  function siteBuildLog(ok) {
    const l = ["$ mkdocs build --strict", "INFO - Building documentation..."];
    if (ok) { l.push("INFO - Documentation built in 3.42 seconds", "site: OK"); }
    else {
      l.push('WARNING - Doc file "Runners.md" contains a link "Workers.md#tags", but the anchor is not found');
      l.push("ERROR - Error reading page 'Scaling.md': [Errno 2] No such file or directory");
      l.push("Aborted with 1 error in strict mode!", "make: *** [site] Error 1");
    }
    return l;
  }

  // ---------- builds -------------------------------------------------------
  // Build: {id, team, pipeline, job, n, status, start, end, worker,
  //         versions:{resName:ver}, trigger:{kind,user?}, steps:[...]}
  // Step: {name, type:get|task|put|approve, status, dur, log:[...]}
  let _id = 1000;
  const BUILDS = [];
  function B(team, pipeline, job, n, status, startAgo, durSec, versions, steps, trigger, worker) {
    const b = {
      id: 'b' + (_id++), team, pipeline, job, n, status,
      start: now - startAgo,
      end: (status === 'started' || status === 'pending' || status === 'waiting_for_approval') ? null : now - startAgo + durSec * 1000,
      worker: worker || 'helsinki-1',
      versions: versions || {}, steps: steps || [],
      trigger: trigger || { kind: 'resource', detail: 'git.pikoci' },
    };
    BUILDS.push(b);
    return b;
  }
  const S = (name, type, status, dur, log) => ({ name, type, status, dur, log: log || [] });

  const shas = ['9f31c02', 'e4d0a11', 'c7b2f90', 'a19e3d4', '5f8c771', 'b3d9e02', '0c4f5a6', 'd8e1b23', '77a2c9e', 'f0b6d15'];
  const commitMsgs = {
    '9f31c02': 'scheduler: respect pinned versions on retrigger',
    'e4d0a11': 'http: stream build logs over SSE',
    'c7b2f90': 'fix flaky TestSchedulerRace',
    'a19e3d4': 'resource: cache check results',
    '5f8c771': 'ui: build tab status stripes',
    'b3d9e02': 'worker: reconnect with backoff',
    '0c4f5a6': 'docs: approval gates examples',
    'd8e1b23': 'hcl: for_each validation errors',
    '77a2c9e': 'audit: filter by pipeline',
    'f0b6d15': 'notif: discord embeds',
  };

  // --- main/pikoci history (the hero pipeline) ---
  // lint + test-unit (parallel) -> test-integration -> build -> deploy(approve)
  // matrix job: test-matrix (linux/macos x go1.24/1.25), triggered with test-unit
  function pikociRun(n, sha, ago, opts) {
    const o = opts || {};
    const v = { 'git.pikoci': sha };
    B('main', 'pikoci', 'lint', n, o.lintFail ? 'failed' : 'succeeded', ago, 48, v, [
      S('git.pikoci', 'get', 'succeeded', 6, gitLog(sha, 'master')),
      S('lint', 'task', o.lintFail ? 'failed' : 'succeeded', 41, lintLog(!o.lintFail)),
    ]);
    B('main', 'pikoci', 'test-unit', n, o.unitFail ? 'failed' : 'succeeded', ago - 2000, 174, v, [
      S('git.pikoci', 'get', 'succeeded', 7, gitLog(sha, 'master')),
      S('go test', 'task', o.unitFail ? 'failed' : 'succeeded', 166, testLog(!o.unitFail, 'scheduler')),
    ], undefined, 'helsinki-2');
    ['linux-go1.24', 'linux-go1.25', 'macos-go1.24', 'macos-go1.25'].forEach((m, i) => {
      B('main', 'pikoci', 'test-matrix/' + m, n, o.matrixFail === m ? 'failed' : 'succeeded', ago - 3000, 140 + i * 22, v, [
        S('git.pikoci', 'get', 'succeeded', 6, gitLog(sha, 'master')),
        S('go test (' + m + ')', 'task', o.matrixFail === m ? 'failed' : 'succeeded', 130 + i * 20, testLog(o.matrixFail !== m, 'wkr')),
      ], undefined, m.startsWith('macos') ? 'mac-mini' : 'helsinki-2');
    });
    if (o.stopAfterUnit) return;
    B('main', 'pikoci', 'test-integration', n, o.intgStatus || 'succeeded', ago - 200 * 1000, 78, v, [
      S('git.pikoci', 'get', 'succeeded', 5, gitLog(sha, 'master')),
      S('services', 'task', 'succeeded', 3, ['postgres:16 up', 'redis:7 up']),
      S('integration', 'task', o.intgStatus || 'succeeded', 70, integrationLog(o.intgStatus === 'started')),
    ]);
    if (o.stopAfterIntegration) return;
    B('main', 'pikoci', 'build', n, 'succeeded', ago - 290 * 1000, 92, v, [
      S('git.pikoci', 'get', 'succeeded', 6, gitLog(sha, 'master')),
      S('compile', 'task', 'succeeded', 86, buildLog()),
    ]);
    B('main', 'pikoci', 'deploy', n, o.deployStatus || 'succeeded', ago - 400 * 1000, 34, v, [
      S('git.pikoci', 'get', 'succeeded', 5, gitLog(sha, 'master')),
      S('approval: deploy to production', 'approve', o.deployStatus === 'waiting_for_approval' ? 'pending' : 'succeeded', 0,
        o.deployStatus === 'waiting_for_approval'
          ? ['waiting for 2 approvals (1/2)', 'approved by maria 12 minutes ago']
          : ['approved by maria', 'approved by egon', 'gate passed']),
      S('deploy', 'task',
        o.deployStatus === 'waiting_for_approval' ? 'pending' : (o.deployStatus === 'failed' ? 'failed' : 'succeeded'),
        o.deployStatus === 'waiting_for_approval' ? 0 : 29,
        o.deployStatus === 'waiting_for_approval' ? [] : deployLog()),
      S('docker.image', 'put', o.deployStatus === 'waiting_for_approval' ? 'pending' : 'succeeded', 8,
        o.deployStatus === 'waiting_for_approval' ? [] : ['pushed ghcr.io/pikoci/pikoci:v0.9.4']),
    ], { kind: 'passed', detail: 'build' });
  }

  pikociRun(136, 'f0b6d15', 3 * day + 4 * hr);
  pikociRun(137, '77a2c9e', 2 * day + 7 * hr);
  pikociRun(138, 'd8e1b23', 1 * day + 9 * hr, { unitFail: true, stopAfterUnit: true });
  pikociRun(139, '0c4f5a6', 1 * day + 6 * hr);
  pikociRun(140, 'b3d9e02', 22 * hr, { matrixFail: 'macos-go1.25', stopAfterUnit: true });
  pikociRun(141, '5f8c771', 8 * hr);
  pikociRun(142, 'c7b2f90', 3 * hr, { deployStatus: 'waiting_for_approval' });
  // #143: currently running (test-integration in flight)
  pikociRun(143, '9f31c02', 14 * min, { intgStatus: 'started', stopAfterIntegration: true });
  const LIVE = BUILDS.find(b => b.job === 'test-integration' && b.n === 143);

  // --- main/website ---
  function websiteRun(n, sha, ago, fail) {
    const v = { 'git.website': sha };
    B('main', 'website', 'build-site', n, fail ? 'failed' : 'succeeded', ago, 61, v, [
      S('git.website', 'get', 'succeeded', 4, gitLog(sha, 'main')),
      S('mkdocs', 'task', fail ? 'failed' : 'succeeded', 55, siteBuildLog(!fail)),
    ], undefined, 'helsinki-2');
    if (!fail) B('main', 'website', 'publish', n, 'succeeded', ago - 70 * 1000, 21, v, [
      S('git.website', 'get', 'succeeded', 4, gitLog(sha, 'main')),
      S('rsync', 'task', 'succeeded', 16, ['rsync -az site/ docs.pikoci.com:/srv/docs', 'publish: OK']),
    ], { kind: 'passed', detail: 'build-site' });
  }
  websiteRun(87, '3e1f0aa', 2 * day);
  websiteRun(88, '8c22b41', 26 * hr);
  websiteRun(89, '1d97e35', 5 * hr, true); // docs are red

  // --- main/release (paused pipeline) ---
  B('main', 'release', 'tag-release', 31, 'succeeded', 6 * day, 45, { 'git.pikoci': 'f0b6d15' }, [
    S('git.pikoci', 'get', 'succeeded', 5, gitLog('f0b6d15', 'master')),
    S('goreleaser', 'task', 'succeeded', 39, ['goreleaser release --clean', '• publishing release v0.9.3', 'release: OK']),
  ], { kind: 'manual', user: 'egon' });

  // --- platform/infra ---
  B('platform', 'infra', 'terraform-plan', 54, 'succeeded', 9 * hr, 63, { 'git.infra': 'aa10c3d' }, [
    S('git.infra', 'get', 'succeeded', 4, gitLog('aa10c3d', 'main')),
    S('plan', 'task', 'succeeded', 58, ['terraform plan', 'Plan: 2 to add, 1 to change, 0 to destroy.']),
  ], undefined, 'helsinki-1');
  B('platform', 'infra', 'terraform-apply', 41, 'cancelled', 8 * hr, 12, { 'git.infra': 'aa10c3d' }, [
    S('git.infra', 'get', 'succeeded', 4, gitLog('aa10c3d', 'main')),
    S('approval: apply infra', 'approve', 'succeeded', 0, ['approved by egon']),
    S('apply', 'task', 'cancelled', 8, ['terraform apply -auto-approve', '^C cancelled by egon']),
  ], { kind: 'manual', user: 'maria' });

  // --- oss/hello-world (public demo) ---
  for (let i = 0; i < 5; i++) {
    B('oss', 'hello-world', 'gen', 210 - i, 'succeeded', (10 + i * 10) * min, 2, { 'cron.every-10m': 't' + (210 - i) }, [
      S('cron.every-10m', 'get', 'succeeded', 0, ['version: tick-' + (210 - i)]),
      S('echo', 'task', 'succeeded', 1, ['$ echo IN', 'IN']),
    ], { kind: 'resource', detail: 'cron.every-10m' }, 'helsinki-1');
  }

  // pending build (stuck: no matching worker) — ops diagnostic story
  B('platform', 'infra', 'terraform-apply', 42, 'pending', 20 * min, 0, { 'git.infra': 'bb42e1f' }, [],
    { kind: 'manual', user: 'maria' });

  // ---------- pipelines ----------------------------------------------------
  const PIPELINES = [
    {
      team: 'main', name: 'pikoci', public: true, paused: false,
      desc: 'Build, test and deploy PikoCI itself',
      resources: [
        { name: 'git.pikoci', type: 'git', pinned: null, checkEvery: '1m', lastCheck: now - 40 * 1000, checkError: null,
          versions: shas.map((s, i) => ({ ref: s, msg: commitMsgs[s], author: ['egon', 'maria', 'sam'][i % 3], at: now - i * 7 * hr })) },
        { name: 'cron.nightly', type: 'cron', pinned: null, checkEvery: '@daily', lastCheck: now - 5 * hr, checkError: null,
          versions: [{ ref: '2026-08-28', at: now - 5 * hr }, { ref: '2026-08-27', at: now - 29 * hr }] },
        { name: 'docker.image', type: 'registry-image', pinned: null, checkEvery: '10m', lastCheck: now - 3 * min,
          checkError: 'GET ghcr.io/v2/: 401 Unauthorized (token expired?)',
          versions: [{ ref: 'v0.9.3', at: now - 6 * day }, { ref: 'v0.9.2', at: now - 12 * day }] },
      ],
      jobs: [
        { name: 'lint', paused: false, inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-unit', paused: false, inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-matrix', paused: false, matrix: ['linux-go1.24', 'linux-go1.25', 'macos-go1.24', 'macos-go1.25'],
          inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-integration', paused: false, inputs: [{ res: 'git.pikoci', trigger: true, passed: ['lint', 'test-unit'] }] },
        { name: 'build', paused: false, inputs: [{ res: 'git.pikoci', trigger: true, passed: ['test-integration'] }, { res: 'cron.nightly', trigger: false, passed: [] }] },
        { name: 'deploy', paused: false, approve: { name: 'deploy to production', need: 2 },
          inputs: [{ res: 'git.pikoci', trigger: true, passed: ['build'] }], outputs: ['docker.image'] },
      ],
    },
    {
      team: 'main', name: 'website', public: true, paused: false,
      desc: 'docs.pikoci.com',
      resources: [
        { name: 'git.website', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 80 * 1000, checkError: null,
          versions: [{ ref: '1d97e35', msg: 'restructure scaling docs', author: 'sam', at: now - 5 * hr },
          { ref: '8c22b41', msg: 'add secret-types page', author: 'maria', at: now - 26 * hr },
          { ref: '3e1f0aa', msg: 'fix nav order', author: 'egon', at: now - 2 * day }] },
      ],
      jobs: [
        { name: 'build-site', paused: false, inputs: [{ res: 'git.website', trigger: true, passed: [] }] },
        { name: 'publish', paused: false, inputs: [{ res: 'git.website', trigger: true, passed: ['build-site'] }] },
      ],
    },
    {
      team: 'main', name: 'release', public: false, paused: true,
      desc: 'Tag + package releases',
      resources: [
        { name: 'git.pikoci', type: 'git', pinned: 'f0b6d15', checkEvery: '5m', lastCheck: now - 2 * min, checkError: null,
          versions: shas.slice(0, 6).map((s, i) => ({ ref: s, msg: commitMsgs[s], author: 'egon', at: now - i * 7 * hr })) },
      ],
      jobs: [
        { name: 'tag-release', paused: true, inputs: [{ res: 'git.pikoci', trigger: false, passed: [] }] },
        { name: 'publish-packages', paused: true, inputs: [{ res: 'git.pikoci', trigger: false, passed: ['tag-release'] }] },
      ],
    },
    {
      team: 'platform', name: 'infra', public: false, paused: false,
      desc: 'Terraform for ci.pikoci.com',
      resources: [
        { name: 'git.infra', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 30 * 1000, checkError: null,
          versions: [{ ref: 'bb42e1f', msg: 'add worker node pool', author: 'maria', at: now - 40 * min },
          { ref: 'aa10c3d', msg: 'bump instance size', author: 'maria', at: now - 10 * hr }] },
      ],
      jobs: [
        { name: 'terraform-plan', paused: false, inputs: [{ res: 'git.infra', trigger: true, passed: [] }] },
        { name: 'terraform-apply', paused: false, approve: { name: 'apply infra', need: 1 },
          inputs: [{ res: 'git.infra', trigger: false, passed: ['terraform-plan'] }] },
      ],
    },
    {
      team: 'oss', name: 'hello-world', public: true, paused: false,
      desc: 'Demo pipeline from the README',
      resources: [
        { name: 'cron.every-10m', type: 'cron', pinned: null, checkEvery: '@every 10m', lastCheck: now - 4 * min, checkError: null,
          versions: [{ ref: 'tick-210', at: now - 10 * min }, { ref: 'tick-209', at: now - 20 * min }] },
      ],
      jobs: [
        { name: 'gen', paused: false, inputs: [{ res: 'cron.every-10m', trigger: true, passed: [] }] },
      ],
    },
  ];

  // ---------- teams / users / workers / audit / tokens ---------------------
  const TEAMS = [
    {
      name: 'main', desc: 'PikoCI core', members: [
        { user: 'egon', role: 'admin' }, { user: 'maria', role: 'maintain' },
        { user: 'sam', role: 'write' }, { user: 'riho', role: 'read' }],
    },
    { name: 'platform', desc: 'Infrastructure', members: [{ user: 'egon', role: 'admin' }, { user: 'maria', role: 'admin' }] },
    { name: 'oss', desc: 'Public demos', members: [{ user: 'egon', role: 'admin' }] },
  ];
  const USERS = [
    { username: 'egon', name: 'Egon', email: 'egon@example.com', provider: 'github', lastSeen: now - 2 * min },
    { username: 'maria', name: 'Maria K', email: 'maria@example.com', provider: 'github', lastSeen: now - 30 * min },
    { username: 'sam', name: 'Sam T', email: 'sam@example.com', provider: 'google', lastSeen: now - 4 * hr },
    { username: 'riho', name: 'Riho V', email: 'riho@example.com', provider: 'local', lastSeen: now - 3 * day },
  ];
  const WORKERS = [
    { name: 'helsinki-1', status: 'online', team: null, tags: ['linux', 'docker', 'exec'], version: 'v0.9.4', since: now - 6 * day, running: ['platform/infra'], builds: 1412 },
    { name: 'helsinki-2', status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', since: now - 6 * day, running: ['main/pikoci #143 test-integration'], builds: 1287 },
    { name: 'mac-mini', status: 'online', team: 'main', tags: ['darwin', 'exec'], version: 'v0.9.3', since: now - 2 * day, running: [], builds: 214 },
    { name: 'builder-gpu', status: 'stale', team: 'platform', tags: ['linux', 'gpu', 'terraform'], version: 'v0.9.1', since: now - 40 * day, lastSeen: now - 3 * hr, running: [], builds: 88 },
  ];
  const AUDIT = [
    { at: now - 5 * min, user: 'maria', action: 'build.approve', target: 'main/pikoci deploy #142', detail: 'approval 1/2' },
    { at: now - 14 * min, user: 'system', action: 'build.create', target: 'main/pikoci #143', detail: 'triggered by git.pikoci 9f31c02' },
    { at: now - 20 * min, user: 'maria', action: 'build.trigger', target: 'platform/infra terraform-apply #42', detail: 'manual' },
    { at: now - 3 * hr, user: 'sam', action: 'build.retry', target: 'main/website build-site #89', detail: '' },
    { at: now - 5 * hr, user: 'egon', action: 'resource.pin', target: 'main/release git.pikoci', detail: 'pinned to f0b6d15' },
    { at: now - 5 * hr, user: 'egon', action: 'pipeline.pause', target: 'main/release', detail: '' },
    { at: now - 8 * hr, user: 'egon', action: 'build.cancel', target: 'platform/infra terraform-apply #41', detail: '' },
    { at: now - 9 * hr, user: 'maria', action: 'pipeline.set', target: 'platform/infra', detail: 'config updated (rev 12)' },
    { at: now - 22 * hr, user: 'egon', action: 'team.member.add', target: 'main', detail: 'riho as read' },
    { at: now - 26 * hr, user: 'system', action: 'worker.stale', target: 'builder-gpu', detail: 'no heartbeat for 30m' },
    { at: now - 2 * day, user: 'maria', action: 'token.create', target: 'team main', detail: 'token "gh-checks"' },
    { at: now - 3 * day, user: 'egon', action: 'pipeline.create', target: 'oss/hello-world', detail: '' },
  ];
  const TOKENS = [
    { name: 'cli-egon', scope: 'personal', created: now - 30 * day, lastUsed: now - 1 * hr },
    { name: 'gh-checks', scope: 'team:main', created: now - 2 * day, lastUsed: now - 4 * min },
  ];

  const HCL = `resource_type "git" {
  source = "pikoci://git"
}

resource "git" "pikoci" {
  params {
    url  = var.git_url
    name = "pikoci"
  }
  check_interval = "1m"
}

resource "cron" "nightly" {
  check_interval = "@daily"
}

job "lint" {
  get "git" "pikoci" { trigger = true }
  task "lint" {
    run "exec" { path = "make" args = ["lint"] }
  }
}

job "test-unit" {
  get "git" "pikoci" { trigger = true }
  task "go-test" {
    run "exec" { path = "make" args = ["test"] }
  }
}

job "test-matrix" {
  matrix {
    os = ["linux", "macos"]
    go = ["1.24", "1.25"]
  }
  get "git" "pikoci" { trigger = true }
  task "go-test" {
    runner = "\${matrix.os == "macos" ? "exec-darwin" : "docker"}"
    run "exec" { path = "make" args = ["test"] }
  }
}

job "test-integration" {
  get "git" "pikoci" {
    trigger = true
    passed  = ["lint", "test-unit"]
  }
  service "postgres" { image = "postgres:16" }
  service "redis"    { image = "redis:7" }
  task "integration" {
    run "exec" { path = "make" args = ["integration"] }
  }
}

job "build" {
  get "git" "pikoci" {
    trigger = true
    passed  = ["test-integration"]
  }
  get "cron" "nightly" {}
  task "compile" {
    run "exec" { path = "make" args = ["build"] }
  }
}

job "deploy" {
  get "git" "pikoci" {
    trigger = true
    passed  = ["build"]
  }
  approve "deploy to production" {
    approvals = 2
    notify "discord" "deploy-alerts" {
      message = "⏳ Build #$BUILD_NUMBER needs approval $BUILD_URL"
    }
  }
  task "deploy" {
    run "exec" { path = "./deploy.sh" args = ["production"] }
  }
  put "docker" "image" {}
}`;

  window.DATA = {
    now, user: { username: 'egon', theme: 'light' },
    teams: TEAMS, users: USERS, pipelines: PIPELINES, builds: BUILDS,
    workers: WORKERS, audit: AUDIT, tokens: TOKENS, hcl: { 'main/pikoci': HCL },
    liveBuildId: LIVE ? LIVE.id : null,
  };
})();
