// Queue: when does my job start, and how big is the workload? Honest answers
// only — matching capacity per tag, never a fabricated ETA.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago, bDur } = PK.fmt;
  const D = () => window.DATA;

  // ---------- Ops / Audit / Teams / Settings --------------------------------
  // ---------- Queue: "when does my job start / how big is the workload" -----
  VIEWS.queue = function () {
    const scoped = b => PK.model.inTeam(PK.model.getPipeline(b.pipeline));
    const pend = D().builds.filter(b => b.status === 'pending' && !b.heldReason && b.queue && scoped(b))
      .sort((a, b) => a.start - b.start);
    const running = D().builds.filter(b => b.status === 'started' && scoped(b)).sort((a, b) => a.start - b.start);
    const workers = D().workers.filter(w => !PK.model.team() || !w.team || w.team === PK.model.team());
    const pools = D().pools.filter(p => !PK.model.team() || !p.team || p.team === PK.model.team());
    const online = workers.filter(w => w.status === 'online');
    const booting = workers.filter(w => w.status === 'provisioning');
    // --concurrency N registers N single-build workers (name-1…name-N);
    // capacity is counted in registered workers, not "slots" (Workers.md)
    const regd = online.reduce((s, w) => s + (w.concurrency || 1), 0);
    const busy = online.reduce((s, w) => s + (w.running || 0), 0);
    const poolFor = t => pools.find(p => p.tags.includes(t));
    // per-tag capacity for tags in demand
    const tags = [...new Set(pend.map(b => b.queue.tag))];
    return `<div class="page"><h1>Queue${PK.model.team() ? ` <span class="mut small">· team ${esc(PK.model.team())}</span>` : ''}</h1>
      <div class="meta" data-live><b>${running.length}</b> running · <b>${pend.length}</b> queued ·
        capacity <b>${busy}/${regd}</b> registered workers busy <span class="mut small">(--concurrency N registers N single-build workers)</span> on ${online.length} healthy host${online.length === 1 ? '' : 's'}${booting.length ? ` <b class="c-pending">+ ${booting.length} provisioning</b> (${booting.reduce((s, w) => s + (w.concurrency || 1), 0)} more on the way)` : ''}</div>
      ${pend.length ? `<h2>Waiting</h2>
      <div class="tbl-scroll"><table class="tbl ctbl"><thead><tr><th></th><th>build</th><th>needs</th><th style="width:100%">why it waits</th><th class="r">waiting</th><th class="r"></th></tr></thead>
      ${pend.map(b => `<tr onclick="location.hash='#/b/${b.id}'">
        <td class="c-pending">⏳</td>
        <td class="nowrap"><a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a></td>
        <td class="nowrap"><code>${esc(b.queue.tag)}</code></td>
        <td class="${b.queue.matching === 0 && !poolFor(b.queue.tag) ? 'c-failed' : 'mut'} small why" style="width:100%">${b.queue.matching === 0
          ? (poolFor(b.queue.tag)
            ? `<span class="c-pending">pool ${esc(poolFor(b.queue.tag).name)} scaling up from zero (~${poolFor(b.queue.tag).bootSecs}s boot) — capacity on the way, not a config problem</span>`
            : `no healthy worker with tag "${esc(b.queue.tag)}" and no pool serves it — config problem, not load`)
          : `${b.queue.matching} matching worker, busy${b.queue.ahead ? ` · ${b.queue.ahead} ahead` : ''}`}</td>
        <td class="mut small r nowrap">${ago(b.start)}</td>
        <td class="r nowrap"><button class="btn sm" data-act="cancel" data-arg="${b.id}" onclick="event.stopPropagation()">Cancel</button></td>
      </tr>`).join('')}</table></div>` : '<div class="allclear">✓ Queue is empty — new jobs start as soon as a matching worker is free.</div>'}
      ${tags.length ? `<h2>Capacity by tag</h2>
      <div class="tbl-scroll"><table class="tbl ctbl"><thead><tr><th>tag</th><th>healthy workers</th><th class="r">busy</th><th class="r">queued</th></tr></thead>
      ${tags.map(t => {
      const m = online.filter(w => w.tags.includes(t));
      const bp = booting.filter(w => w.tags.includes(t));
      const pool = poolFor(t);
      return `<tr><td class="nowrap"><code>${esc(t)}</code></td>
        <td>${m.length ? m.map(w => `<b>${esc(w.name)}</b>`).join(', ') : ''}${bp.length ? `${m.length ? ', ' : ''}<span class="c-pending">${bp.map(w => esc(w.name)).join(', ')} (booting)</span>` : ''}${!m.length && !bp.length ? (pool ? `<span class="c-pending">pool ${esc(pool.name)} · scaled to zero, scales 0–${pool.max} on demand</span>` : '<span class="c-failed">none — and no pool serves this tag</span>') : ''}</td>
        <td class="r nowrap">${m.reduce((s, w) => s + (w.running || 0), 0)}</td>
        <td class="r nowrap">${pend.filter(b => b.queue.tag === t).length}</td></tr>`;
    }).join('')}</table></div>` : ''}
      <h2>Running</h2>
      ${running.length ? `<div class="tbl-scroll"><table class="tbl ctbl">
      ${running.map(b => `<tr onclick="location.hash='#/b/${b.id}'">
        <td class="c-started pulse">●</td>
        <td class="nowrap"><a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a></td>
        <td class="mut small">on <b>${esc(b.worker)}</b></td>
        <td class="mut small r nowrap" data-live>${fmtDur(bDur(b))}</td>
      </tr>`).join('')}</table></div>` : '<div class="mut pad-s small">nothing running right now</div>'}
      <p class="mut small">Worker health lives under <a href="#/workers">Workers</a>.</p>
    </div>`;
  };
})(window.PK);
