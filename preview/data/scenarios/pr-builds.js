// Builds for the handwritten PR lineages, and the structured checks (K23)
// they report: lint findings as failed checks with source context, a data
// race with its output, a partial suite from a cancelled run, and a junit
// report that failed to parse.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, T, gitLog, lintLog, testLog, intgLog } = D;

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
    S('services: start', 'services', 'succeeded', 4, ['postgres:16 up', 'redis:7 up', 'mysql:8 up (TLS)']),
    S('git.pikoci-pr', 'get', 'succeeded', 5, gitLog('8899aa1')),
    S('integration', 'task', 'started', 0, intgLog(4)),
    S('services: stop', 'services', 'pending', 0, []),
  ]);
  // #489 fork: HELD build (K7) — pending + held-untrusted
  prBuild('lint', 205, 'pending', 'fee1bad', 40 * min, 0, [], { heldReason: 'held-untrusted' });
})();
