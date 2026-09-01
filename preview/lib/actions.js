// Every action the preview can perform, and the one listener that dispatches
// them. Actions are idempotent and answer conflicts in words ("already
// decided - the first response counted") rather than failing silently.
(function (PK) {
  'use strict';
  const app = PK.app;
  const toast = PK.toast;
  const { getBuild, getPipeline } = PK.model;
  const D = () => window.DATA;

  // ---------- actions: idempotent, with conflict answers (K18/ideal #9) ----
  const done = new Set(); // idempotency keys
  const ACT = {
    approve(id) {
      const key = 'approve:' + id;
      if (done.has(key)) return toast('Already approved — one vote per person', 'info');
      done.add(key);
      const b = getBuild(id); if (!b) return;
      // gate lifecycle (Approval-Gates.md): a gated build holds no worker and
      // has run nothing; passing the gate makes it Pending (queued), then a
      // worker picks it up and it goes Started.
      const ap = b.steps.find(s => s.type === 'approve');
      if (ap) { ap.status = 'succeeded'; ap.log.push('approved by egon just now', 'gate passed (2/2)'); }
      b.status = 'pending';
      b.queue = b.queue || { tag: 'linux', reason: 'gate passed — waiting for a worker' };
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'build.approved', target: `${b.pipeline} ${b.job} #${b.n}`, detail: 'approval 2/2 — gate passed' });
      toast('Approved — build queued'); app.refresh();
      setTimeout(() => { // a worker picks it up
        b.status = 'started'; b.start = Date.now(); b._lastOutput = Date.now(); b.queue = null;
        b.worker = 'helsinki-1';
        b.resolved = { versions: b.intent.versions, worker: b.worker };
        b.steps.forEach(s => { if (s.status === 'pending') s.status = 'started'; });
        app.refresh();
      }, 1500);
      setTimeout(() => {
        b.status = 'succeeded'; b.end = Date.now();
        b.steps.forEach(s => { if (s.status === 'started') s.status = 'succeeded'; });
        const env = D().environments.find(e => e.name === 'prod');
        if (env && b.job === 'deploy') {
          env.version = Object.values(b.intent.versions)[0]; env.deployedAt = Date.now(); env.byBuild = '#' + b.n; env.verified = true;
          env.history.unshift({ version: env.version, at: Date.now(), build: '#' + b.n, ok: true });
        }
        app.refresh();
      }, 9000);
    },
    drain(name) {
      // fidelity (Workers.md): drain is initiated ON the worker — SIGQUIT to
      // the worker process; the server sends nothing. Server-initiated drain
      // needs worker addressing and is a plan extension (K21).
      const w = D().workers.find(x => x.name === name);
      toast(w && w.ephemeral
        ? 'Drain is worker-side today (SIGQUIT on the instance). Pool-level drain-and-terminate is planned (K21).'
        : 'Drain is worker-side today: send SIGQUIT to the worker process — it finishes current builds and exits. Server-initiated drain is planned (K21).', 'info');
    },
    rejectask(id) { // reveal the reason box — rejecting REQUIRES a reason (Approval-Gates.md)
      const box = document.getElementById('rejbox-' + id);
      if (box) { box.hidden = !box.hidden; if (!box.hidden) { const i = box.querySelector('input'); if (i) i.focus(); } }
    },
    reject(id) {
      const key = 'gate:' + id; // approve/reject share a gate key — first write wins
      if (done.has('approve:' + id) || done.has(key)) return toast('Already decided — the first response counted', 'info');
      const box = document.getElementById('rejbox-' + id);
      const reason = box ? (box.querySelector('input') || {}).value || '' : '';
      if (!reason.trim()) return toast('A reason is required to reject', 'info');
      done.add(key);
      const b = getBuild(id); if (!b) return;
      b.status = 'failed'; b.end = Date.now();
      const ap = b.steps.find(s => s.type === 'approve');
      if (ap) { ap.status = 'failed'; ap.log.push('rejected by egon just now: ' + reason); }
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'build.rejected', target: `${b.pipeline} ${b.job} #${b.n}`, detail: reason });
      toast('Rejected — build failed'); app.refresh();
    },
    release(id) { // K7: release a held fork build (maintain+, audited)
      const key = 'release:' + id;
      if (done.has(key)) return toast('Already released', 'info');
      done.add(key);
      const b = getBuild(id); if (!b) return;
      b.heldReason = null; b.status = 'started'; b.start = Date.now(); b._lastOutput = Date.now();
      b.steps = [{ name: 'lint', type: 'task', status: 'started', dur: 0, log: ['$ make lint (released by egon — no secrets granted)', 'working…'] }];
      const ref = Object.values(b.intent.versions)[0];
      D().decisions = D().decisions.filter(d => !(d.ref === ref && d.code === 'held-untrusted'));
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'build.released', target: `${b.pipeline} ${b.job} #${b.n}`, detail: 'held-untrusted released (no secrets)' });
      toast('Released — CI running without secrets'); app.refresh();
      setTimeout(() => { b.status = 'succeeded'; b.end = Date.now(); b.steps[0].status = 'succeeded'; b.steps[0].dur = 40; b.steps[0].log.push('lint: OK'); app.refresh(); }, 8000);
    },
    retry(id) {
      const b = getBuild(id); if (!b) return;
      if (b.heldReason || (b.intent.versions['git.pikoci-pr'] && D().lineages.find(l => l.fork && l.changes.some(c => c.id.ref === Object.values(b.intent.versions)[0])))) {
        // R4-4: retry of a fork build re-derives the hold; maintain+ retry implies release
        toast('Fork build: retry by maintain+ implies release (audited)', 'info');
      }
      const nb = {
        id: 'b' + Math.floor(Math.random() * 1e9), team: b.team, pipeline: b.pipeline, job: b.job, n: b.n,
        status: 'started', start: Date.now(), end: null, worker: b.worker, _lastOutput: Date.now(),
        intent: b.intent, resolved: null,
        cause: { kind: 'retry', detail: `retry of #${b.n} by egon`, runId: b.cause.runId }, retryOf: '#' + b.n,
        heldReason: null, queue: null,
        steps: [{ name: 'retrying…', type: 'task', status: 'started', dur: 0, log: ['$ (simulated retry — same run, new attempt)'] }],
      };
      D().builds.push(nb);
      toast(`Retrying ${b.job} #${b.n} — attempt within the same run`); app.refresh();
      const iv = setInterval(() => { nb.steps[0].log.push('… ' + new Date().toLocaleTimeString()); nb._lastOutput = Date.now(); app.refresh(); }, 2000);
      setTimeout(() => {
        clearInterval(iv); nb.status = 'succeeded'; nb.end = Date.now();
        nb.resolved = { versions: nb.intent.versions, worker: nb.worker };
        nb.steps[0].status = 'succeeded'; nb.steps[0].dur = (nb.end - nb.start) / 1000; nb.steps[0].log.push('done: OK'); app.refresh();
      }, 10000);
    },
    cancel(id) {
      const key = 'cancel:' + id;
      if (done.has(key)) return toast('Already cancelled', 'info');
      done.add(key);
      const b = getBuild(id); if (!b) return;
      b.status = 'cancelled'; b.end = Date.now();
      b.steps.forEach(s => { if (['started', 'pending'].includes(s.status)) s.status = 'cancelled'; });
      toast('Cancelled'); app.refresh();
    },
    trigger(arg) {
      const [plName, job] = arg.split('|');
      toast(`Triggered ${job} (simulated)`);
      const pl = getPipeline(plName); const j = pl.jobs.find(x => x.name === job);
      if (j && j.lastSuccess) j.lastSuccess = Date.now();
      app.refresh();
    },
    unpause(name) {
      const pl = getPipeline(name); pl.paused = false; pl.pausedMeta = null;
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'pipeline.unpaused', target: name, detail: '' });
      toast('Unpaused ' + name); app.refresh();
    },
    pause(name) {
      const pl = getPipeline(name);
      const reason = window.prompt('Reason (optional — prefilled for solo installs):', '—') || '—';
      pl.paused = true; pl.pausedMeta = { actor: 'egon', reason, at: Date.now(), until: null };
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'pipeline.paused', target: name, detail: `"${reason}"` });
      toast('Paused ' + name); app.refresh();
    },
    check(arg) { toast('Checking ' + arg.split('|')[1] + '…'); },
    snooze(key) {
      app.session.snoozed.add(key);
      toast('Snoozed for this session', 'info'); app.refresh();
    },
    rollback(env) {
      const e = D().environments.find(x => x.name === env);
      const prev = e.history[1];
      if (!prev) return toast('No previous version', 'info');
      if (!window.confirm(`Rollback ${env} to ${prev.version}?\n\nThis triggers deploy with version ${prev.version} and pins the resource so the scheduler doesn't roll forward. Audited.`)) return;
      e.version = prev.version; e.deployedAt = Date.now(); e.byBuild = 'rollback'; e.verified = true;
      e.history.unshift({ version: prev.version, at: Date.now(), build: 'rollback', ok: true });
      // pin the resource of the environment's OWN pipeline (audit fix: this
      // used to always pin pikoci's, whatever environment was rolled back)
      const pl = getPipeline(e.pipeline.split('/')[1]);
      if (pl && pl.resources[0]) pl.resources[0].pinned = { ref: prev.version, actor: 'egon', reason: 'rollback of ' + env, at: Date.now() };
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'env.rolled_back', target: e.pipeline + ' ' + env, detail: `to ${prev.version} · pinned` });
      toast(`Rolled back ${env} to ${prev.version} — resource pinned`); app.refresh();
    },
    solo() { D().soloMode = !D().soloMode; toast(D().soloMode ? 'Simulating a solo install — watch the nav' : 'Full install restored'); location.hash = '#/'; app.refresh(); },
    theme() {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      document.documentElement.setAttribute('data-theme', cur === 'light' ? 'dark' : 'light');
      app.refresh();
    },
    // the header button and the keyboard shortcut open the same palette
    palette() { PK.pal.open = !PK.pal.open; PK.pal.q = ''; PK.pal.render(); },
    // "copy" next to a command line: the <pre> is the button's previous sibling
    copyprev(_arg, el) {
      const pre = el && el.previousElementSibling;
      if (!pre || !navigator.clipboard) return toast('Clipboard not available', 'info');
      // a denied clipboard (headless, insecure context, user policy) rejects —
      // say so rather than leaving an unhandled rejection in the console
      navigator.clipboard.writeText(pre.textContent).then(
        () => toast('Copied'),
        () => toast('Could not copy — select the line and copy manually', 'info'));
    },
    noop() { toast('Not wired in the preview'); },
  };
  // capture phase: in-row buttons stopPropagation() to suppress the row's
  // onclick navigation — a bubble-phase listener here would never see them
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const [fn, arg] = [el.getAttribute('data-act'), el.getAttribute('data-arg')];
    // the element is passed too, for the few actions that act on their
    // surroundings rather than on an id (copy-the-line-above)
    if (ACT[fn]) ACT[fn](arg, el);
  }, true);

  PK.act = ACT;
})(window.PK = window.PK || {});
