// The audit log. Every action is past tense: it records what happened,
// never the imperative the button carried.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  const AUDIT = [
    { at: now - 5 * min, user: 'maria', action: 'build.approved', target: 'main/pikoci deploy #142', detail: 'approval 1/2 · bound to c7b2f90 @ config rev 13' },
    { at: now - 14 * min, user: 'system', action: 'build.created', target: 'main/pikoci #143', detail: 'version git.pikoci 9f31c02' },
    { at: now - 40 * min, user: 'system', action: 'build.held', target: 'main/pikoci-pr lint #205', detail: 'held-untrusted: fork PR #489' },
    { at: now - 3 * hr, user: 'system', action: 'build.superseded', target: 'main/pikoci-pr c0ffee1', detail: 'lineage PR #481 — superseded by 9aa31c2, 2 builds cancelled' },
    { at: now - 5 * hr, user: 'egon', action: 'resource.pinned', target: 'main/release git.pikoci', detail: 'f0b6d15 · "last known-good for v0.9.3" · until —' },
    { at: now - 5 * hr, user: 'egon', action: 'pipeline.paused', target: 'main/release', detail: '"hold during v0.9.3 investigation" · until ' + new Date(now - hr).toISOString().slice(0, 16) },
    { at: now - 2 * day, user: 'egon', action: 'pipeline.updated', target: 'main/pikoci', detail: 'config rev 13 (CAS ok, base rev 12)' },
  ];

  D.AUDIT = AUDIT;
})();
