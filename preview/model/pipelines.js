// Pipeline and build queries. Read-only functions over window.DATA — no DOM,
// no markup, so they can be reasoned about (and tested) on their own.
(function (PK) {
  'use strict';
  const M = (PK.model = PK.model || {});
  const app = PK.app;
  const { RANK, bStatus } = PK.status;
  const { bDur } = PK.fmt;
  const D = () => window.DATA;

  // ---------- queries -------------------------------------------------------
  // team scope (maps 1:1 to the backend: every pipeline, audit entry and
  // worker token is team-scoped; '' = all teams I can see)
  const team = () => app.session.team;
  const inTeam = pl => !app.session.team || (pl && pl.team === app.session.team);
  const pipelines = () => (D().soloMode ? D().pipelines.filter(p => p.name === 'hello-world') : D().pipelines).filter(inTeam);
  const getPipeline = name => D().pipelines.find(p => p.name === name);
  const getBuild = id => D().builds.find(b => b.id === id);
  // scheduling is cron resources, not a job field (Cron.md): a "scheduled
  // job" is simply one whose only trigger is a cron resource
  const cronTrigger = j => (j.inputs || []).find(i => i.trigger && /^cron\./.test(i.res));
  const isRunJob = j => (j.inputs || []).some(i => i.trigger && !/^cron\./.test(i.res));
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

  Object.assign(M, {
    team, inTeam, pipelines, getPipeline, getBuild, cronTrigger, isRunJob,
    vmeta, jobBuilds, decisionFor, jobCell, primaryRef, primaryStatus,
    plHistory, compareWithLastGreen,
  });
})(window.PK = window.PK || {});
