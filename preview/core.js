// Preview core — the UX-PLAN v4.1 semantics: two-family reason display,
// primary-context roll-ups, capability-gated navigation with teaching empty
// states, idempotent actions with conflict answers, hatch metadata, themes,
// keyboard layer (/, f, ⌘K), live-build simulation.
(function () {
  'use strict';
  const D = () => window.DATA;

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

  // ---------- misc ----------------------------------------------------------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDur = sec => {
    if (sec == null) return '–';
    sec = Math.round(sec);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60);
    return m < 60 ? m + 'm ' + (sec % 60 ? sec % 60 + 's' : '') : Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  };
  const ago = ts => {
    if (!ts) return '–';
    let d = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (d < 60) return d + 's ago';
    d = Math.round(d / 60); if (d < 60) return d + 'm ago';
    d = Math.round(d / 60); if (d < 24) return d + 'h ago';
    return Math.round(d / 24) + 'd ago';
  };
  const bDur = b => b.end ? Math.max(0, b.end - b.start) / 1000 : (b.status === 'started' ? (Date.now() - b.start) / 1000 : null);
  const lastOutputAge = b => {
    if (b.status !== 'started' || !b._lastOutput) return null; // unknown ≠ stalled
    return Math.round((Date.now() - b._lastOutput) / 1000);
  };

  // ---------- queries -------------------------------------------------------
  // team scope (maps 1:1 to the backend: every pipeline, audit entry and
  // worker token is team-scoped; '' = all teams I can see)
  const team = () => App.session.team;
  const inTeam = pl => !App.session.team || (pl && pl.team === App.session.team);
  const pipelines = () => (D().soloMode ? D().pipelines.filter(p => p.name === 'hello-world') : D().pipelines).filter(inTeam);
  const getPipeline = name => D().pipelines.find(p => p.name === name);
  const getBuild = id => D().builds.find(b => b.id === id);
  // scheduling is cron resources, not a job field (Cron.md): a "scheduled
  // job" is simply one whose only trigger is a cron resource
  const cronTrigger = j => (j.inputs || []).find(i => i.trigger && /^cron\./.test(i.res));
  const isRunJob = j => (j.inputs || []).some(i => i.trigger && !/^cron\./.test(i.res));
  // one index over every watched branch: rich branch-kind pipelines + the
  // summary-only mass (DATA.branches) — what a server-side branch-index
  // endpoint would return, team-scoped
  function branchIndex() {
    const real = pipelines().filter(pl => pl.primaryContext.kind === 'branch').map(pl => {
      const lbl = pl.primaryContext.label;
      const r = pl.resources.find(x => x.name === pl.primaryContext.resource);
      const v = r && r.versions[0];
      // fold deploy pipelines into their repo: checkout-staging is repo
      // "checkout", branch main, variant "staging"
      let repo = pl.name, note = null;
      const m = pl.name.match(/^(.+)-(staging|prod)$/);
      if (m) { repo = m[1]; note = m[2]; }
      else if (pl.name.endsWith('-' + lbl)) repo = pl.name.slice(0, -lbl.length - 1);
      return {
        name: pl.name, team: pl.team, pl, repo, note,
        branch: lbl, status: primaryStatus(pl), lastAt: v ? (v.meta.at || 0) : 0,
        headRef: v ? v.id.ref : null, headMsg: v ? (v.meta.msg || '') : '', headAuthor: v ? (v.meta.author || '') : '',
      };
    });
    return real.concat(D().branches.filter(x => !team() || x.team === team()));
  }
  const vmeta = (pl, ref) => {
    for (const r of pl.resources) {
      const v = (r.versions || []).find(v => v.id.ref === ref);
      if (v) return v;
    }
    return { id: { ref }, meta: {} };
  };
  function jobBuilds(pl, job, ref) {
    return D().builds.filter(b => b.pipeline === pl.name && b.job === job &&
      (!ref || Object.values(b.intent.versions).includes(ref)))
      .sort((a, b) => b.start - a.start);
  }
  function decisionFor(pl, job, ref) {
    return D().decisions.find(d => d.pipeline === pl.name && d.job === job && d.ref === ref) || null;
  }
  // status of (job, context-ref): build status, or decision reason, or none
  function jobCell(pl, job, ref) {
    const bs = jobBuilds(pl, job, ref);
    if (bs.length) return { kind: 'build', build: bs[0], status: bStatus(bs[0]) };
    const d = decisionFor(pl, job, ref);
    if (d) return { kind: 'decision', decision: d, status: 'none' };
    return { kind: 'none', status: 'none' };
  }
  // primary-context roll-up (CX3-5): card color from the primary context ONLY
  function primaryRef(pl) {
    const res = pl.resources.find(r => r.name === pl.primaryContext.resource);
    if (!res || !res.versions.length) return null;
    if (pl.primaryContext.kind === 'lineages') return null; // PR pipelines have no single primary
    return res.versions[0].id.ref;
  }
  function primaryStatus(pl) {
    if (pl.paused) return 'paused';
    if (pl.primaryContext.kind === 'lineages') {
      // PR pipeline card: neutral unless MY lineage fails (counts elsewhere)
      return 'none';
    }
    // worst across jobs for the latest primary versions (per-job latest within primary lineage)
    const res = pl.resources.find(r => r.name === pl.primaryContext.resource);
    const refs = (res ? res.versions : []).map(v => v.id.ref);
    let worst = 'none';
    for (const j of pl.jobs) {
      let s = 'none';
      for (const ref of refs) { // newest ref with a build for this job
        const c = jobCell(pl, j.name, ref);
        if (c.kind === 'build') { s = c.status; break; }
        if (c.kind === 'decision') { s = 'none'; break; } // reasons don't color
      }
      if (RANK[s] < RANK[worst]) worst = s;
    }
    return worst;
  }
  function secondaryCounts(pl) { // PR lineage failures → counts, never card color
    const ls = D().lineages.filter(l => (l.pl || 'pikoci-pr') === pl.name);
    const out = { failing: 0, held: 0, running: 0, total: ls.length };
    for (const l of ls) {
      const worst = lineageStatus(l);
      const held = !l.summary && D().builds.some(b => b.heldReason &&
        Object.values(b.intent.versions)[0] === lineageHead(l).id.ref);
      if (held) out.held++;
      else if (worst === 'failed') out.failing++;
      else if (worst === 'started' || worst === 'pending') out.running++;
    }
    return out;
  }
  function lineageHead(l) { return l.changes.find(c => !c.superseded) || l.changes[0]; }
  // each repo has its own PR pipeline; a lineage names it via `pl`
  const lineagePl = l => getPipeline(l.pl || 'pikoci-pr');
  const lineages = () => D().lineages.filter(l => inTeam(lineagePl(l)));
  function lineageStatus(l) {
    if (l.summary) return l.summary.slice().sort((a, b) => RANK[a] - RANK[b])[0];
    const pl = lineagePl(l);
    const ref = lineageHead(l).id.ref;
    let worst = 'none';
    for (const j of pl.jobs) {
      const c = jobCell(pl, j.name, ref);
      const s = c.kind === 'build' ? c.status : 'none';
      if (RANK[s] < RANK[worst]) worst = s;
    }
    return worst;
  }
  const mine = l => D().me.gitAuthors.includes(l.author);

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
  // recent completed runs (oldest→newest) for weather + duration trend;
  // synthetic pipelines carry a precomputed `hist`, real ones derive from builds
  function plHistory(pl) {
    if (pl.hist) return pl.hist.map(h => ({ status: h[0], dur: h[1] }));
    return D().builds.filter(b => b.pipeline === pl.name && b.end)
      .sort((a, b) => a.start - b.start).slice(-10)
      .map(b => ({ status: b.status, dur: (b.end - b.start) / 1000, id: b.id }));
  }
  function compareWithLastGreen(b) { // R12
    const pl = getPipeline(b.pipeline);
    const green = D().builds.filter(x => x.pipeline === b.pipeline && x.job === b.job && x.status === 'succeeded' && x.start < b.start)
      .sort((a, c) => c.start - a.start)[0];
    if (!green) return null;
    const diffs = [];
    for (const [res, ref] of Object.entries(b.intent.versions)) {
      const old = green.intent.versions[res];
      if (old !== ref) diffs.push({ res, from: old, to: ref, fromMeta: vmeta(pl, old).meta, toMeta: vmeta(pl, ref).meta });
    }
    return { green, diffs, durDelta: (bDur(b) || 0) - (bDur(green) || 0) };
  }

  // ---------- attention items (ownership-scoped, degrading honestly) -------
  function attention() {
    const items = [], notShown = [];
    if (D().soloMode) return { items: [], notShown: [] };
    // approvals with bound context (C2) + superseded-while-waiting
    for (const b of D().builds.filter(b => b.status === 'waiting_for_approval')) {
      const pl = getPipeline(b.pipeline);
      if (!inTeam(pl)) continue;
      const newer = pl.resources[0].versions[0].id.ref !== Object.values(b.intent.versions)[0];
      items.push({
        cls: 'appr', icon: '⧖', pri: 0, key: 'appr:' + b.id,
        text: `${b.pipeline} / ${b.job} #${b.n} waiting for your approval (1/2 — maria ✓)`,
        sub: `bound to ${esc(Object.values(b.intent.versions)[0])} @ config rev ${b.intent.configRev}` + (newer ? ' · ⚠ superseded-while-waiting: trunk has moved' : ''),
        actions: [{ label: '✓ Approve', act: 'approve', arg: b.id, primary: true }, { label: '✕ Reject', act: 'reject', arg: b.id, danger: true }, { label: 'View', href: '#/b/' + b.id }],
      });
    }
    // held fork release (maintainer duty)
    for (const b of D().builds.filter(b => b.heldReason === 'held-untrusted' && b.status === 'pending')) {
      if (!inTeam(getPipeline(b.pipeline))) continue;
      const l = D().lineages.find(l => l.changes.some(c => c.id.ref === Object.values(b.intent.versions)[0]));
      items.push({
        cls: 'held', icon: '⛔', pri: 0, key: 'held:' + b.id,
        text: `PR #${l.n} by ${l.author} (fork) — CI held, awaiting maintainer release`,
        sub: 'fork PRs never run with secrets automatically (pr_hold = "forks")',
        actions: [{ label: '▶ Release (run CI)', act: 'release', arg: b.id, primary: true }, { label: 'View PR', href: '#/changes/pr/' + l.n }],
      });
    }
    // my failing changes (identity join exists for egon; team-scoped via each PR pipeline)
    for (const l of lineages().filter(mine)) {
      if (lineageStatus(l) === 'failed') {
        const ref = lineageHead(l).id.ref;
        const fb = D().builds.find(b => b.pipeline === (l.pl || 'pikoci-pr') && b.status === 'failed' && Object.values(b.intent.versions)[0] === ref);
        items.push({
          cls: 'fail', icon: '✕', pri: 1, key: 'mine:' + l.n,
          text: `Your PR #${l.n}: ${fb ? fb.job : 'checks'} failing on ${ref}`,
          sub: fb ? firstError(fb) : '',
          actions: [{ label: 'Log', href: fb ? '#/b/' + fb.id : '#/changes' }, { label: '↻ Retry', act: 'retry', arg: fb ? fb.id : '' }],
        });
      }
    }
    // trunk failures (primary context only)
    for (const pl of pipelines()) {
      if (pl.primaryContext.kind === 'lineages' || pl.paused) continue;
      for (const j of pl.jobs) {
        const bs = jobBuilds(pl, j.name);
        if (bs.length && bs[0].status === 'failed') {
          items.push({
            cls: 'fail', icon: '✕', pri: 1, key: 'trunk:' + pl.name + ':' + j.name,
            text: `Trunk: ${pl.name} / ${j.name} failing since ${ago(bs[0].start)}`,
            sub: firstError(bs[0]),
            actions: [{ label: 'Log', href: '#/b/' + bs[0].id }, { label: '↻ Retry', act: 'retry', arg: bs[0].id }],
          });
        }
      }
    }
    // expired hatches (K17)
    for (const pl of pipelines()) {
      if (pl.pausedMeta && pl.pausedMeta.until && pl.pausedMeta.until < Date.now()) {
        items.push({
          cls: 'hatch', icon: '❚❚', pri: 2, key: 'hatch:' + pl.name,
          text: `${pl.name} pause expired ${ago(pl.pausedMeta.until)} — "${pl.pausedMeta.reason}" (by ${pl.pausedMeta.actor})`,
          sub: 'unpause, or extend with a new until-date',
          actions: [{ label: '▶ Unpause', act: 'unpause', arg: pl.name }, { label: 'Keep paused', act: 'snooze', arg: 'hatch:' + pl.name }],
        });
      }
    }
    // check errors
    for (const pl of pipelines()) for (const r of pl.resources) {
      if (r.checkError) items.push({
        cls: 'err', icon: '⚠', pri: 2, key: 'check:' + pl.name + ':' + r.name,
        text: `${pl.name} / ${r.name} check failing — new versions not detected`,
        sub: r.checkError,
        actions: [{ label: '↻ Re-check', act: 'check', arg: pl.name + '|' + r.name }, { label: 'Open', href: '#/p/' + pl.name + '/graph' }],
      });
    }
    // stuck pending (honest queue wording, K16)
    for (const b of D().builds.filter(b => b.status === 'pending' && !b.heldReason && b.queue && Date.now() - b.start > 10 * 60e3)) {
      if (!inTeam(getPipeline(b.pipeline))) continue;
      const q = b.queue;
      items.push({
        cls: 'stuck', icon: '⏳', pri: 2, key: 'stuck:' + b.id,
        text: `${b.pipeline} / ${b.job} #${b.n} pending ${ago(b.start)}`,
        sub: q.matching === 0 ? `no healthy worker with tag "${q.tag}" — config problem, not load` : `${q.matching} matching worker for "${q.tag}", busy`,
        actions: [{ label: 'Queue', href: '#/queue' }, { label: 'Cancel', act: 'cancel', arg: b.id }],
      });
    }
    // overdue scheduled (D3). Scheduling is cron RESOURCES with check_interval
    // (Cron.md) — not a job attribute; overdue = the job's cron trigger keeps
    // ticking but the job hasn't succeeded across recent ticks.
    for (const pl of pipelines()) for (const j of pl.jobs) {
      const cronIn = cronTrigger(j);
      if (cronIn && j.lastSuccess && Date.now() - j.lastSuccess > 36 * 3600e3) {
        const res = pl.resources.find(r => r.name === cronIn.res);
        items.push({
          cls: 'overdue', icon: '⏰', pri: 2, key: 'overdue:' + pl.name + ':' + j.name,
          text: `${pl.name} / ${j.name} overdue — ${cronIn.res} (${res ? res.checkEvery : 'cron'}) has ticked since; last success ${ago(j.lastSuccess)}`,
          sub: 'scheduled jobs alert on missed runs, not only failures',
          actions: [{ label: '▶ Run now', act: 'trigger', arg: pl.name + '|' + j.name }],
        });
      }
    }
    // not shown: others' PR failures (their inbox)
    for (const l of lineages().filter(l => !mine(l))) {
      if (lineageStatus(l) === 'failed') notShown.push(l);
    }
    const snoozed = App.session.snoozed;
    return { items: items.filter(i => !snoozed.has(i.key)).sort((a, b) => a.pri - b.pri), notShown };
  }
  function firstError(b) {
    for (const s of b.steps) for (const l of s.log) if (/FAIL|ERROR|Error /.test(l)) return l.trim();
    return '';
  }
  function firstFailStep(b) { return b.steps.findIndex(s => s.status === 'failed'); }

  // ---------- capability-gated navigation (§3.1) ---------------------------
  function navItems() {
    const d = D();
    const items = [{ id: 'home', label: 'Home', href: '#/' }, { id: 'pipelines', label: 'Pipelines', href: '#/pipelines' }];
    const gates = {
      changes: !d.soloMode && d.lineages.length > 0, // metadata exists (K3)
      environments: !d.soloMode && d.environments.length > 0,
      insights: d.capabilities.insightsShipped,
      ops: !d.soloMode && (d.workers.length >= 2 || App.session.opsPinned), // gates Queue + Workers together
      audit: !d.soloMode && d.teams.some(t => t.members.length >= 2),
    };
    if (gates.changes) items.push({ id: 'changes', label: 'Changes', href: '#/changes' });
    if (gates.environments) items.push({ id: 'environments', label: 'Environments', href: '#/environments' });
    if (gates.insights) items.push({ id: 'insights', label: 'Insights', href: '#/insights' });
    if (gates.ops) { // two tabs, one gate: different questions over related data
      items.push({ id: 'queue', label: 'Queue', href: '#/queue' });
      items.push({ id: 'workers', label: 'Workers', href: '#/workers' });
      App.session.opsPinned = true;
    }
    if (gates.audit) items.push({ id: 'audit', label: 'Audit', href: '#/audit' });
    return items; // Settings rendered separately, always present, uncounted
  }
  const gatedEmpty = { // teaching empty states for gated-off URLs (R2-13)
    insights: ['Insights is not built yet.', 'When it ships (Phase 4) and this install has ~200 builds, this page will show duration trends, the flake board (pass-after-retry), queue times, and stale escape hatches. Until then this URL stays reachable — deep links never 404 because of gating.'],
    changes: ['No change metadata yet.', 'The Changes view appears when version metadata enrichment provides commit messages, authors, and PR fields. Until then, each pipeline has a Versions tab.'],
    environments: ['No deploy targets declared.', 'Declare an environment on a deploy job and this page will show what version is live where, with verification state and guided rollback.'],
    queue: ['Single-worker install.', 'Queue appears with a second worker (or any stuck build) — on one worker, jobs either run or wait for that worker. It answers "when does my job start, and how big is the workload?" honestly: matching capacity per tag, no fake ETAs.'],
    workers: ['Single-worker install.', 'Workers appears with a second worker (or any stuck build). The one worker is always reachable from Settings — a solo operator still needs drain, upgrade, and registration.'],
    audit: ['Solo install.', 'The audit log gains a nav slot with a second team member. It is reachable from Settings meanwhile.'],
  };

  // ---------- actions: idempotent, with conflict answers (K18/ideal #9) ----
  const done = new Set(); // idempotency keys
  function toast(msg, kind) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show' + (kind ? ' ' + kind : '');
    clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 5000);
  }
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
      toast('Approved — build queued'); App.refresh();
      setTimeout(() => { // a worker picks it up
        b.status = 'started'; b.start = Date.now(); b._lastOutput = Date.now(); b.queue = null;
        b.worker = 'helsinki-1';
        b.resolved = { versions: b.intent.versions, worker: b.worker };
        b.steps.forEach(s => { if (s.status === 'pending') s.status = 'started'; });
        App.refresh();
      }, 1500);
      setTimeout(() => {
        b.status = 'succeeded'; b.end = Date.now();
        b.steps.forEach(s => { if (s.status === 'started') s.status = 'succeeded'; });
        const env = D().environments.find(e => e.name === 'prod');
        if (env && b.job === 'deploy') {
          env.version = Object.values(b.intent.versions)[0]; env.deployedAt = Date.now(); env.byBuild = '#' + b.n; env.verified = true;
          env.history.unshift({ version: env.version, at: Date.now(), build: '#' + b.n, ok: true });
        }
        App.refresh();
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
      toast('Rejected — build failed'); App.refresh();
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
      toast('Released — CI running without secrets'); App.refresh();
      setTimeout(() => { b.status = 'succeeded'; b.end = Date.now(); b.steps[0].status = 'succeeded'; b.steps[0].dur = 40; b.steps[0].log.push('lint: OK'); App.refresh(); }, 8000);
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
      toast(`Retrying ${b.job} #${b.n} — attempt within the same run`); App.refresh();
      const iv = setInterval(() => { nb.steps[0].log.push('… ' + new Date().toLocaleTimeString()); nb._lastOutput = Date.now(); App.refresh(); }, 2000);
      setTimeout(() => {
        clearInterval(iv); nb.status = 'succeeded'; nb.end = Date.now();
        nb.resolved = { versions: nb.intent.versions, worker: nb.worker };
        nb.steps[0].status = 'succeeded'; nb.steps[0].dur = (nb.end - nb.start) / 1000; nb.steps[0].log.push('done: OK'); App.refresh();
      }, 10000);
    },
    cancel(id) {
      const key = 'cancel:' + id;
      if (done.has(key)) return toast('Already cancelled', 'info');
      done.add(key);
      const b = getBuild(id); if (!b) return;
      b.status = 'cancelled'; b.end = Date.now();
      b.steps.forEach(s => { if (['started', 'pending'].includes(s.status)) s.status = 'cancelled'; });
      toast('Cancelled'); App.refresh();
    },
    trigger(arg) {
      const [plName, job] = arg.split('|');
      toast(`Triggered ${job} (simulated)`);
      const pl = getPipeline(plName); const j = pl.jobs.find(x => x.name === job);
      if (j && j.lastSuccess) j.lastSuccess = Date.now();
      App.refresh();
    },
    unpause(name) {
      const pl = getPipeline(name); pl.paused = false; pl.pausedMeta = null;
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'pipeline.unpaused', target: name, detail: '' });
      toast('Unpaused ' + name); App.refresh();
    },
    pause(name) {
      const pl = getPipeline(name);
      const reason = window.prompt('Reason (optional — prefilled for solo installs):', '—') || '—';
      pl.paused = true; pl.pausedMeta = { actor: 'egon', reason, at: Date.now(), until: null };
      D().audit.unshift({ at: Date.now(), user: 'egon', action: 'pipeline.paused', target: name, detail: `"${reason}"` });
      toast('Paused ' + name); App.refresh();
    },
    check(arg) { toast('Checking ' + arg.split('|')[1] + '…'); },
    snooze(key) {
      App.session.snoozed.add(key);
      toast('Snoozed for this session', 'info'); App.refresh();
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
      toast(`Rolled back ${env} to ${prev.version} — resource pinned`); App.refresh();
    },
    solo() { D().soloMode = !D().soloMode; toast(D().soloMode ? 'Simulating a solo install — watch the nav' : 'Full install restored'); location.hash = '#/'; App.refresh(); },
    theme() {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      document.documentElement.setAttribute('data-theme', cur === 'light' ? 'dark' : 'light');
      App.refresh();
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
    if (ACT[fn]) ACT[fn](arg);
  }, true);

  // ---------- keyboard layer + palette -------------------------------------
  function paletteItems() {
    const items = [];
    for (const b of D().builds.filter(b => b.status === 'waiting_for_approval'))
      items.push({ label: `⧖ Approve ${b.pipeline}/${b.job} #${b.n}`, kind: 'action', run: () => ACT.approve(b.id) });
    for (const b of D().builds.filter(b => b.heldReason))
      items.push({ label: `▶ Release held PR build (${b.pipeline} #${b.n})`, kind: 'action', run: () => ACT.release(b.id) });
    for (const pl of pipelines()) items.push({ label: `${st(primaryStatus(pl)).sym} ${pl.team}/${pl.name}`, kind: 'pipeline', run: () => location.hash = '#/p/' + pl.name + '/graph' });
    for (const l of D().lineages) items.push({ label: `PR #${l.n} ${l.title}`, kind: 'change', run: () => location.hash = '#/changes/pr/' + l.n });
    items.push({ label: '🌍 Environments', kind: 'page', run: () => location.hash = '#/environments' });
    items.push({ label: '⏳ Queue', kind: 'page', run: () => location.hash = '#/queue' });
    items.push({ label: '⚙ Workers', kind: 'page', run: () => location.hash = '#/workers' });
    items.push({ label: '☰ Audit', kind: 'page', run: () => location.hash = '#/audit' });
    return items;
  }
  const Pal = { open: false, q: '', sel: 0 };
  function renderPalette() {
    let el = document.getElementById('palette');
    if (!el) { el = document.createElement('div'); el.id = 'palette'; document.body.appendChild(el); }
    const app = ['hdr', 'main'].map(id => document.getElementById(id));
    if (!Pal.open) {
      el.innerHTML = '';
      app.forEach(x => x && x.removeAttribute('inert'));
      // hand focus back to where ⌘K makes sense to return
      const back = document.querySelector('[data-palette-btn]');
      if (Pal._hadFocus && back) back.focus({ preventScroll: true });
      Pal._hadFocus = false;
      return;
    }
    Pal._hadFocus = true;
    app.forEach(x => x && x.setAttribute('inert', '')); // contain focus in the dialog
    const q = Pal.q.toLowerCase();
    const items = paletteItems().filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 9);
    if (Pal.sel >= items.length) Pal.sel = Math.max(0, items.length - 1);
    el.innerHTML = `<div class="pal-back"><div class="pal-box" role="dialog" aria-modal="true" aria-label="command palette">
      <input id="palin" role="combobox" aria-expanded="true" aria-controls="pal-list" aria-activedescendant="pal-${Pal.sel}"
        placeholder="Jump to pipeline / change, or run an action…" value="${esc(Pal.q)}" aria-label="search commands">
      <div id="pal-list" role="listbox" aria-label="results">
      ${items.map((it, i) => `<div class="pal-row ${i === Pal.sel ? 'sel' : ''}" id="pal-${i}" role="option" aria-selected="${i === Pal.sel}" data-pal="${i}">${esc(it.label)}<span class="pal-k">${it.kind}</span></div>`).join('')}
      ${!items.length ? '<div class="pal-row mut">no matches</div>' : ''}
      </div>
    </div></div>`;
    el.querySelector('.pal-back').onclick = ev => { if (ev.target.classList.contains('pal-back')) { Pal.open = false; renderPalette(); } };
    el.querySelectorAll('[data-pal]').forEach(r => r.onclick = () => { const it = items[+r.getAttribute('data-pal')]; Pal.open = false; renderPalette(); it && it.run(); });
    const inp = el.querySelector('#palin');
    inp.oninput = () => { Pal.q = inp.value; Pal.sel = 0; renderPalette(); };
    inp.onkeydown = ev => {
      if (ev.key === 'ArrowDown') { Pal.sel++; renderPalette(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp') { Pal.sel = Math.max(0, Pal.sel - 1); renderPalette(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { const it = items[Pal.sel]; Pal.open = false; renderPalette(); it && it.run(); }
      else if (ev.key === 'Escape') { Pal.open = false; renderPalette(); }
    };
    inp.focus(); inp.setSelectionRange(999, 999);
  }
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { Pal.open = !Pal.open; Pal.q = ''; renderPalette(); e.preventDefault(); return; }
    if (Pal.open || ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) return;
    if (e.key === 'Escape') { // dismiss open reason popovers
      document.querySelectorAll('.reason-detail:not([hidden])').forEach(p => {
        p.hidden = true;
        const btn = p.previousElementSibling;
        if (btn && btn.setAttribute) { btn.setAttribute('aria-expanded', 'false'); btn.focus(); }
      });
    }
    if (e.key === '/') { const f = document.querySelector('[data-filter]'); if (f) { f.focus(); e.preventDefault(); } }
    if (e.key === 'f') {
      const errs = [...document.querySelectorAll('.l-err')];
      if (!errs.length) return;
      window.__fi = ((window.__fi ?? -1) + 1) % errs.length;
      errs[window.__fi].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  // ---------- live sim ------------------------------------------------------
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
      App.refresh();
    }, 2500);
  }

  // ---------- router / app --------------------------------------------------
  const App = {
    _render: null,
    session: { snoozed: new Set(), opsPinned: false, team: '' },
    route() { const h = location.hash.replace(/^#\/?/, ''); return h ? h.split('/').map(decodeURIComponent) : []; },
    refresh() {
      if (!App._render) return;
      // live ticks re-render the whole page — carry the user's UI state across:
      // scroll positions, folded/expanded panes, open <details>, filter focus.
      const saves = [];
      document.querySelectorAll('[data-keep-scroll]').forEach(el => { if (el.id) saves.push([el.id, el.scrollTop]); });
      // table scroll containers: keep horizontal position by index (stable within a view)
      const tblX = [...document.querySelectorAll('.tbl-scroll')].map(el => el.scrollLeft);
      const folds = {};
      document.querySelectorAll('[data-fold]').forEach(el => { folds[el.getAttribute('data-fold')] = el.hidden; });
      const dets = {};
      document.querySelectorAll('details[data-det]').forEach(el => { dets[el.getAttribute('data-det')] = el.open; });
      // focus identity survives the innerHTML rebuild: match by data-filter,
      // then data-act(+arg), then id, then href (a11y: live pages tick every 2–5s)
      const ae = document.activeElement;
      let aeSel = null, refocus = false;
      if (ae && ae !== document.body) {
        if (ae.hasAttribute && ae.hasAttribute('data-filter')) refocus = true;
        else if (ae.dataset && ae.dataset.act) aeSel = `[data-act="${ae.dataset.act}"]` + (ae.dataset.arg ? `[data-arg="${(window.CSS && CSS.escape ? CSS.escape(ae.dataset.arg) : ae.dataset.arg)}"]` : '');
        else if (ae.id) aeSel = '#' + (window.CSS && CSS.escape ? CSS.escape(ae.id) : ae.id);
        else if (ae.getAttribute && ae.getAttribute('href')) aeSel = `a[href="${ae.getAttribute('href')}"]`;
      }
      const wy = window.scrollY;
      App._render(App.route());
      if (aeSel) { try { const el = document.querySelector(aeSel); if (el) el.focus({ preventScroll: true }); } catch (e) { /* selector edge */ } }
      document.querySelectorAll('[data-fold]').forEach(el => {
        const k = el.getAttribute('data-fold');
        if (k in folds) {
          el.hidden = folds[k];
          const btn = el.previousElementSibling;
          if (btn && btn.hasAttribute('aria-expanded')) btn.setAttribute('aria-expanded', String(!el.hidden));
        }
      });
      document.querySelectorAll('details[data-det]').forEach(el => {
        const k = el.getAttribute('data-det');
        if (k in dets) el.open = dets[k];
      });
      if (refocus) { const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
      for (const [id, t] of saves) { const el = document.getElementById(id); if (el) el.scrollTop = t; }
      [...document.querySelectorAll('.tbl-scroll')].forEach((el, i) => { if (tblX[i]) el.scrollLeft = tblX[i]; });
      window.scrollTo(0, wy);
      document.querySelectorAll('[data-follow]').forEach(el => { el.scrollTop = el.scrollHeight; });
    },
    start(render) {
      App._render = render;
      window.addEventListener('hashchange', () => {
        App.refresh();
        // announce navigation: title + move focus into the new view (SR users)
        const h = location.hash.replace(/^#\/?/, '');
        document.title = 'PikoCI — ' + (h ? h.split('/').slice(0, 2).join(' / ') : 'home');
        const m = document.getElementById('main');
        if (m) { m.tabIndex = -1; m.focus({ preventScroll: true }); }
      });
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
        document.documentElement.setAttribute('data-theme', 'dark');
      App.refresh();
      startLiveSim();
      setInterval(() => { if (document.querySelector('[data-live]')) App.refresh(); }, 5000);
    },
  };

  function setTeam(t) {
    App.session.team = t;
    toast(t ? 'Showing team ' + t + ' only' : 'Showing all teams', 'info');
    App.refresh();
  }

  window.P = {
    STATUS, RANK, st, bStatus, REASON, reasonLabel,
    esc, fmtDur, ago, bDur, lastOutputAge,
    team, setTeam, inTeam, lineages, lineagePl,
    pipelines, getPipeline, getBuild, vmeta, jobBuilds, decisionFor, jobCell, isRunJob, branchIndex,
    primaryRef, primaryStatus, secondaryCounts, lineageHead, lineageStatus, mine, plHistory,
    testStats, testRuns, testHistory, isNewFailure, measurementDelta,
    compareWithLastGreen, attention, firstError, firstFailStep,
    navItems, gatedEmpty, ACT, App, toast,
  };
})();
