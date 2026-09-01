// Decision records (K5): why something did NOT run. Two families —
// "waiting" (may still run) and "wont_run" (never will).
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, tickAt } = D;

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
    { pipeline: 'hello-world', job: 'gen', ref: tickAt(30), family: 'wont_run', code: 'overlap-skipped', text: 'previous run still active at tick — overlap policy: skip', at: now - 30 * min },
  ];

  D.DECISIONS = DECISIONS;
})();
