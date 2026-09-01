// Workers: are the machines well? Static hosts and autoscaled pools, where
// the POOL is the stable object and instances are cattle.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago, fmtDur } = PK.fmt;
  const { dataTable } = PK.ui;
  const D = () => window.DATA;

  // ---------- Workers: "are the machines well" ------------------------------
  // Static workers are pets with names; ephemeral instances are cattle whose
  // stable object is the POOL — instances group under it, terminated ones
  // roll up into a count instead of littering the table.
  VIEWS.workers = function (name) {
    if (name) return VIEWS.workerDetail(name);
    // Global workers are visible to every team, but dispatch PREFERS team
    // workers: a global worker skips a team's builds while that team has a
    // healthy team worker of its own (Workers.md)
    const workers = D().workers.filter(w => !PK.model.team() || !w.team || w.team === PK.model.team());
    const pools = D().pools.filter(p => !PK.model.team() || !p.team || p.team === PK.model.team());
    const gauge = (frac, warnAt) => {
      if (frac == null) return '<span class="mut small" title="no fresh heartbeat — last known value withheld rather than shown as current">—</span>';
      const pct = Math.round(frac * 100);
      const warn = frac >= warnAt;
      return `<span class="disk"><span class="disk-bar"><span style="width:${pct}%;background:${warn ? 'var(--warn, #d33)' : 'var(--spark)'}"></span></span>
        <span class="${warn ? 'c-failed' : 'mut'} small">${pct}%${warn ? ' ⚠' : ''}</span></span>`;
    };
    const disk = w => gauge(w.status === 'stale' ? null : w.disk, 0.85);
    const cpu = w => gauge(w.status === 'stale' ? null : w.cpu, 0.9);
    const state = w => w.status === 'provisioning'
      ? `<span class="c-pending pulse">◌</span> provisioning <span class="mut small">(${Math.round(w.up / 1000)}s)</span>`
      : `<span class="c-${w.status === 'online' ? 'succeeded' : 'failed'}">●</span> ${w.status === 'online' ? 'healthy' : w.status}${w.lastSeen ? ` <span class="mut small">(${ago(w.lastSeen)})</span>` : ''}${w.ephemeral && w.up ? ` <span class="mut small">· up ${fmtDur(w.up / 1000)}</span>` : ''}`;
    const dash = '<span class="mut small">—</span>';
    const row = w => ({
      nav: `#/workers/${encodeURIComponent(w.name)}`,
      cells: [
        `<a class="row-link" href="#/workers/${encodeURIComponent(w.name)}"><b>${esc(w.name)}</b></a>${(w.concurrency || 1) > 1 ? ` <span class="mut small" title="--concurrency ${w.concurrency} registers ${esc(w.name)}-1…${esc(w.name)}-${w.concurrency} — each registered worker runs one build">×${w.concurrency}</span>` : ''}`,
        state(w),
        w.team || '<span class="mut" title="global workers skip a team&#39;s builds while that team has a healthy team worker">Global</span>',
        w.tags.map(t => `<code>${t}</code>`).join(' '),
        w.status === 'provisioning' ? dash : cpu(w),
        w.status === 'provisioning' ? dash : disk(w),
        `${w.version}${w.version < 'v0.9.4' ? ' <span class="chip" title="older than the server">behind</span>' : ''}`,
        w.running ? `${w.running}/${w.concurrency} busy` : w.status === 'provisioning' ? '' : '<span class="mut">idle</span>',
        w.status === 'provisioning' ? '' : `<button class="btn sm" data-act="drain" data-arg="${esc(w.name)}" title="drain is worker-side today (SIGQUIT); click for details">drain</button>`,
      ],
    });
    const statics = workers.filter(w => !w.pool);
    const rows = [];
    if (statics.length) {
      rows.push({ group: `static <span class="mut">· ${statics.length} registered</span>` });
      statics.forEach(w => rows.push(row(w)));
    }
    for (const p of pools) {
      const inst = workers.filter(w => w.pool === p.name);
      const online = inst.filter(w => w.status === 'online').length;
      const booting = inst.filter(w => w.status === 'provisioning').length;
      rows.push({ group: `⛅ ${esc(p.name)}
        <span class="mut">· ${esc(p.provider)} · autoscale ${p.min}–${p.max} · <b>${online} healthy</b>${booting ? ` + ${booting} provisioning` : ''}${online + booting === 0 ? ' — <b>scaled to zero</b> (first job boots one, ~' + p.bootSecs + 's)' : ''}
        · idle TTL ${esc(p.idleTtl)} · today: ${p.buildsToday} builds on ${p.terminatedToday + online} instances</span>` });
      inst.forEach(w => rows.push(row(w)));
    }
    return `<div class="page"><h1>Workers${PK.model.team() ? ` <span class="mut small">· team ${esc(PK.model.team())} + Global</span>` : ''}</h1>
      ${dataTable({
      className: 'wtbl',
      cols: [
        { label: 'worker', width: 'content' },
        { label: 'state', width: 'content' },
        { label: 'team', width: 'content' },
        { label: 'tags', width: 'fill' },
        { label: 'cpu', width: 'content' },
        { label: 'disk', width: 'content' },
        { label: 'version', width: 'content', cls: 'mut small' },
        { label: 'running', width: 'content', align: 'right' },
        { width: 'action' },
      ],
      rows,
    })}
      <p class="mut small">Ephemeral instances are addressed by pool, not by name: a build's provenance keeps the instance name as a tombstone record (it must never dangle), but health, drain, and capacity questions are asked of the pool. Terminated instances roll up into the pool's daily count.</p>
      <p class="mut small">This dashboard is admin-only (Workers.md). Global workers skip a team's builds while that team has a healthy team worker — team workers win dispatch, global workers are the fallback.</p>
      <h2>Storage</h2>
      <div class="mut small pad-s">artifacts: — · logs: 41 MB · meta-records (decisions, receipts, config history): 2.1 MB — retention classes with reference-preservation apply (never orphan a config rev a kept build ran under).</div>
      <p class="mut small">Scheduling load lives under <a href="#/queue">Queue</a>. Click a worker for its telemetry.</p>
    </div>`;
  };
})(window.PK);
