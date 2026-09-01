// A git resource tracks ONE ref, so every maintained branch is its own
// pipeline. Feature branches never appear here — they arrive as PRs.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, PIPELINES } = D;

  // ---------- release branches (K10-adjacent): long-lived version branches --
  // A git resource tracks ONE ref, so every maintained branch is its own
  // pipeline; the Changes → Branches tab is the attention-ranked feed of
  // exactly these branch-kind pipelines. Feature branches never appear here:
  // they enter as PRs and live in the lineage inbox.
  (function genReleaseBranches() {
    const mkBranch = (team, repo, branch, commits, jobs) => {
      const name = `${repo}-${branch}`;
      const res = `git.${name}`;
      PIPELINES.push({
        team, name, public: false, desc: `${repo} maintenance branch ${branch}`,
        primaryContext: { kind: 'branch', label: branch, resource: res },
        paused: false, pausedMeta: null, configRev: 3,
        configHistory: [{ rev: 3, by: 'maria', at: now - 30 * day, note: 'cut ' + branch }],
        resources: [{ name: res, type: 'git', pinned: null, checkEvery: '5m', lastCheck: now - 2 * min, checkError: null,
          versions: commits.map(c => ({ id: { ref: c.ref }, meta: { msg: c.msg, author: c.author, at: now - c.agoMin * min } })) }],
        jobs: jobs.map(j => ({ name: j, inputs: [{ res, trigger: true, passed: [] }] })),
      });
      return { name, res };
    };
    // pikoci release-1.4: backports; the latest one broke test-unit (newly red)
    const r14 = mkBranch('main', 'pikoci', 'release-1.4', [
      { ref: 'f4a0b1c', msg: 'backport: pin retrigger fix (#481)', author: 'maria', agoMin: 70 },
      { ref: 'e2d93aa', msg: 'backport: worker reconnect backoff', author: 'egon', agoMin: 26 * 60 },
      { ref: 'c8b1774', msg: 'release-1.4: bump to v1.4.6', author: 'maria', agoMin: 9 * 24 * 60 },
    ], ['lint', 'test-unit', 'build']);
    const br = (ref, job, stx, agoMin, dur, log) =>
      b(r14.name, job, 30 + Math.abs(ref.charCodeAt(0) - 99), stx, ref, agoMin * min, dur,
        [S(r14.res, 'get', 'succeeded', 4, ['ref: ' + ref]), S(job, 'task', stx, dur - 4, log)],
        { team: 'main', res: r14.res, cause: { kind: 'version', detail: r14.res + ' ' + ref, runId: 'run-' + ref } });
    br('f4a0b1c', 'lint', 'succeeded', 65, 40, ['ok']);
    br('f4a0b1c', 'test-unit', 'failed', 63, 160, ['$ go test ./...', 'FAIL: TestPinRetrigger — backport depends on scheduler API not in 1.4', 'make: *** [test] Error 1']);
    br('e2d93aa', 'lint', 'succeeded', 25 * 60, 41, ['ok']);
    br('e2d93aa', 'test-unit', 'succeeded', 25 * 60, 150, ['ok']);
    br('e2d93aa', 'build', 'succeeded', 25 * 60 - 10, 88, ['ok']);
    br('c8b1774', 'test-unit', 'succeeded', 9 * 24 * 60, 149, ['ok']);
    // pikoci release-1.3: quiet LTS branch, all green, nothing recent
    const r13 = mkBranch('main', 'pikoci', 'release-1.3', [
      { ref: 'b7c2900', msg: 'backport: CVE-2026-1188 fix', author: 'egon', agoMin: 12 * 24 * 60 },
      { ref: 'a91f002', msg: 'release-1.3: bump to v1.3.11', author: 'maria', agoMin: 31 * 24 * 60 },
    ], ['lint', 'test-unit', 'build']);
    for (const ref of ['b7c2900', 'a91f002']) for (const j of ['lint', 'test-unit', 'build'])
      b(r13.name, j, ref === 'b7c2900' ? 61 : 60, 'succeeded', ref, (ref === 'b7c2900' ? 12 : 31) * 24 * 60 * min, 90,
        [S(r13.res, 'get', 'succeeded', 4, ['ref: ' + ref]), S(j, 'task', 'succeeded', 80, ['ok'])],
        { team: 'main', res: r13.res, cause: { kind: 'version', detail: r13.res + ' ' + ref, runId: 'run-' + ref } });
    // checkout release-2.1 (payments): active, green
    const c21 = mkBranch('payments', 'checkout', 'release-2.1', [
      { ref: 'd1e8f30', msg: 'backport: TLS options for mysql pool', author: 'anna', agoMin: 3 * 60 },
      { ref: 'cc90a17', msg: 'release-2.1: bump to v2.1.9', author: 'kris', agoMin: 6 * 24 * 60 },
    ], ['test', 'build']);
    for (const [ref, agoM] of [['d1e8f30', 3 * 60], ['cc90a17', 6 * 24 * 60]]) for (const j of ['test', 'build'])
      b(c21.name, j, ref === 'd1e8f30' ? 18 : 17, 'succeeded', ref, agoM * min, 70,
        [S(c21.res, 'get', 'succeeded', 4, ['ref: ' + ref]), S(j, 'task', 'succeeded', 60, ['ok'])],
        { team: 'payments', res: c21.res, cause: { kind: 'version', detail: c21.res + ' ' + ref, runId: 'run-' + ref } });
  })();
})();
