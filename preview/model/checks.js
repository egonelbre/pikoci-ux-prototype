// Structured checks (K23) and measurements (K24). Stable check ids are what
// make history, flake detection and new-vs-known failures possible.
(function (PK) {
  'use strict';
  const M = (PK.model = PK.model || {});
  const { jobBuilds } = M;

  // ---------- structured checks (K23) + measurements (K24) ------------------
  function testStats(b) {
    if (!b.tests) return null;
    const c = { pass: 0, fail: 0, skip: 0, dur: 0 };
    for (const t of b.tests) { c[t.s] = (c[t.s] || 0) + 1; c.dur += t.d || 0; }
    return c;
  }
  // last runs of this job that carried structured results, oldest→newest
  function testRuns(pl, job, upTo) {
    return jobBuilds(pl, job).filter(x => x.tests && x.start <= upTo.start).slice(0, 8).reverse();
  }
  // per-test history across those runs (null = not in that run's report)
  function testHistory(pl, job, b, id) {
    return testRuns(pl, job, b).map(x => {
      const t = x.tests.find(t => t.id === id);
      return { b: x, s: t ? t.s : null };
    });
  }
  // a failure is NEW when no earlier run with results shows it failing
  function isNewFailure(pl, job, b, id) {
    return !jobBuilds(pl, job).some(x => x.tests && x.start < b.start &&
      x.tests.some(t => t.id === id && t.s === 'fail'));
  }
  // delta vs the same measurement on the last green run of this job
  function measurementDelta(pl, b, m) {
    const prev = jobBuilds(pl, b.job).find(x => x.measurements && x.start < b.start && x.status === 'succeeded');
    if (!prev) return null;
    const pm = prev.measurements.find(x => x.id === m.id);
    if (!pm || !pm.value) return null;
    return { prev: pm.value, pct: (m.value - pm.value) / pm.value * 100 };
  }

  Object.assign(M, { testStats, testRuns, testHistory, isNewFailure, measurementDelta });
})(window.PK = window.PK || {});
