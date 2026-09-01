// The attention strip: what is asking for YOU, ranked, degrading honestly.
// Ownership-scoped — other people's failing PRs go to notShown, because they
// belong in their inbox, not yours.
(function (PK) {
  'use strict';
  const app = PK.app;
  const { esc, ago } = PK.fmt;
  const { getPipeline, inTeam, pipelines, jobBuilds, lineages, mine,
    lineageStatus, lineageHead, cronTrigger, firstError } = PK.model;
  const D = () => window.DATA;

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
    const snoozed = app.session.snoozed;
    return { items: items.filter(i => !snoozed.has(i.key)).sort((a, b) => a.pri - b.pri), notShown };
  }

  PK.attention = attention;
})(window.PK = window.PK || {});
