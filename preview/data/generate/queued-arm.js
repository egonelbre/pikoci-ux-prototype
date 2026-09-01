// One queued arm64 build whose tag is served by a pool scaled to zero, so
// the Queue can give the honest ephemeral answer: scaling up, not stuck.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, PIPELINES } = D;

  // a queued arm64 build: its tag is served by the aws-arm pool (scaled to 0),
  // so the Queue can show the honest ephemeral answer — scaling up, not stuck
  (function genArmQueued() {
    const ap = PIPELINES.find(p => p.name === 'android-app');
    const ref = ap.resources[0].versions[0].id.ref;
    b('android-app', 'deploy', 41, 'pending', ref, 3 * min, 0, [],
      { team: 'mobile', res: 'git.android-app', cause: { kind: 'version', detail: 'git.android-app ' + ref, runId: 'run-' + ref },
        queue: { matching: 0, busy: false, ahead: 0, tag: 'arm64' } });
  })();
})();
