// The status vocabulary: how a state looks, how bad it is, and how a reason
// code reads. RANK is the comparator every "worst of" roll-up sorts by.
(function (PK) {
  'use strict';

  // ---------- status metadata ----------------------------------------------
  const STATUS = {
    succeeded: { color: 'var(--ok)', sym: '✓', label: 'succeeded' },
    failed: { color: 'var(--bad)', sym: '✕', label: 'failed' },
    started: { color: 'var(--run)', sym: '●', label: 'started' },
    pending: { color: 'var(--pend)', sym: '○', label: 'pending' },
    cancelled: { color: 'var(--cancel)', sym: '⊘', label: 'cancelled' },
    warning: { color: 'var(--warn)', sym: '!', label: 'passed (allowed failure)' }, // own glyph — never color-only vs ✓ (WCAG 1.4.1)
    skipped: { color: 'var(--pend)', sym: '◇', label: 'branch not taken' },
    waiting_for_approval: { color: 'var(--appr)', sym: '⧖', label: 'waiting for approval' },
    held: { color: 'var(--appr)', sym: '⛔', label: 'held' },
    paused: { color: 'var(--pause)', sym: '❚❚', label: 'paused' },
    none: { color: 'var(--mut3)', sym: '·', label: 'no builds' },
  };
  const RANK = { failed: 0, waiting_for_approval: 1, held: 2, started: 3, pending: 4, cancelled: 5, warning: 6, succeeded: 7, skipped: 8, none: 9 };
  const st = s => STATUS[s] || STATUS.none;
  // display status of a build (held sub-state, R3-6/K7)
  const bStatus = b => (b.status === 'pending' && b.heldReason) ? 'held' : b.status;

  // reason codes → family + display text (derived at render time, R2-15/CX4-2)
  const REASON = {
    upstream: { family: 'waiting', text: 'upstream' },
    'held-untrusted': { family: 'waiting', text: 'maintainer release' },
    'held-gate': { family: 'waiting', text: 'approval' },
    capacity: { family: 'waiting', text: 'capacity' },
    pause: { family: 'waiting', text: 'paused' },
    'pinned-mismatch': { family: 'waiting', text: 'pinned version' },
    'no-version': { family: 'waiting', text: 'no satisfying version' },
    'draft-deferral': { family: 'waiting', text: 'draft deferral' },
    'not-affected': { family: 'wont_run', text: 'not affected' },
    superseded: { family: 'wont_run', text: 'superseded' },
    'overlap-skipped': { family: 'wont_run', text: 'overlap policy' },
  };
  const reasonLabel = d => (REASON[d.code] ? (REASON[d.code].family === 'waiting' ? 'waiting: ' : "won't run: ") + REASON[d.code].text : d.code);

  PK.status = { STATUS, RANK, st, bStatus, REASON, reasonLabel };
})(window.PK = window.PK || {});
