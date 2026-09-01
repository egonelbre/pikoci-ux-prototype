// main/pikoci trunk history: six runs covering the states the UX has to
// explain — a failed unit test, a docs-only commit, a gated deploy, a live
// run, and a retry of a failure.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, gitLog, lintLog, testLog, intgLog, BUILDS } = D;

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
    // services wrap the run (Pipeline.md): they start BEFORE any get/task
    // step and get an unconditional stop at the end, whatever happened between
    b('pikoci', 'test-integration', n, o.intg || 'succeeded', ref, ago - 200e3, 78, [
      S('services: start', 'services', 'succeeded', 3, ['postgres:16 up', 'redis:7 up']),
      S('git.pikoci', 'get', 'succeeded', 5, gitLog(ref)),
      S('integration', 'task', o.intg || 'succeeded', 70, intgLog(o.intg === 'started' ? 23 : 48)),
      S('services: stop', 'services', o.intg === 'started' ? 'pending' : 'succeeded', 1,
        o.intg === 'started' ? [] : ['postgres:16 stopped', 'redis:7 stopped', 'stop runs unconditionally, even after failure']),
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
    // gate lifecycle (Approval-Gates.md): the gate blocks the WHOLE build —
    // while waiting, no step has run and no worker is held; on approval the
    // build goes Approved → Pending (queued) → Started.
    const wait = o.deploy === 'waiting_for_approval';
    b('pikoci', 'deploy', n, o.deploy || 'succeeded', ref, ago - 400e3, 34, [
      S('approval: deploy to production', 'approve', wait ? 'pending' : 'succeeded', 0,
        wait ? ['waiting for 2 approvals (1/2)', 'approved by maria 12 minutes ago'] : ['approved by maria', 'approved by egon', 'gate passed']),
      S('git.pikoci', 'get', wait ? 'pending' : 'succeeded', 5, wait ? [] : gitLog(ref)),
      S('deploy', 'task', wait ? 'pending' : 'succeeded', 29,
        wait ? [] : ['$ ./deploy.sh production', 'rolling restart on ci.pikoci.com ... done', 'health check: 200 OK', 'deploy: OK']),
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

  D.LIVE = LIVE;
})();
