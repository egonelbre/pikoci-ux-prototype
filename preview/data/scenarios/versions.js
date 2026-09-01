// Trunk commit history for main/pikoci — the version list every other
// canonical scenario refers back to (K3: identity | metadata).
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // ---------- versions: identity | metadata (K3) ---------------------------
  // versions[resource] = [{id:{ref,(pr),(fork)}, meta:{msg,author,at,(title,draft)}}]
  const trunkVersions = [
    { id: { ref: '9f31c02' }, meta: { msg: 'scheduler: respect pinned versions on retrigger', author: 'egon', at: now - 20 * min } },
    { id: { ref: 'c7b2f90' }, meta: { msg: 'fix flaky TestSchedulerRace', author: 'maria', at: now - 3 * hr } },
    { id: { ref: '5f8c771' }, meta: { msg: 'ui: build tab status stripes', author: 'egon', at: now - 8 * hr } },
    { id: { ref: '0c4f5a6' }, meta: { msg: 'docs: approval gates examples', author: 'sam', at: now - 26 * hr } },
    { id: { ref: 'b3d9e02' }, meta: { msg: 'worker: reconnect with backoff', author: 'maria', at: now - 30 * hr } },
    { id: { ref: 'f0b6d15' }, meta: { msg: 'notif: discord embeds', author: 'egon', at: now - 3 * day } },
  ];

  D.trunkVersions = trunkVersions;
})();
