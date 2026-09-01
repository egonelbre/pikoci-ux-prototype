// The live build: #143 streams specs until it finishes, so log following,
// stall detection and the ticking duration have something real to show.
(function (PK) {
  'use strict';
  const app = PK.app;
  const { getBuild } = PK.model;
  const D = () => window.DATA;

  function startLiveSim() {
    const b = getBuild(D().liveBuildId); if (!b) return;
    const step = b.steps[b.steps.length - 1];
    let i = 23;
    b._lastOutput = Date.now();
    const iv = setInterval(() => {
      if (b.status !== 'started') { clearInterval(iv); return; }
      i++;
      step.log.push(`  ✓ spec ${String(i).padStart(2, '0')} (${(Math.random() * 2 + 0.1).toFixed(2)}s)`);
      b._lastOutput = Date.now();
      if (i >= 48) {
        step.log.push('', '48 passed, 0 failed'); step.status = 'succeeded'; step.dur = 78;
        b.status = 'succeeded'; b.end = Date.now(); b.resolved = { versions: b.intent.versions, worker: b.worker };
        clearInterval(iv);
      }
      app.refresh();
    }, 2500);
  }

  PK.live = { start: startLiveSim };
})(window.PK = window.PK || {});
