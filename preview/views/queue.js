// Queue: when does my job start, and how big is the workload? Honest answers
// only — matching capacity per tag, never a fabricated ETA.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago, bDur } = PK.fmt;
  const { dataTable } = PK.ui;
  const D = () => window.DATA;

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

    const whyWaits = b => b.queue.matching === 0
      ? (poolFor(b.queue.tag)
        ? `<span class="c-pending">pool ${esc(poolFor(b.queue.tag).name)} scaling up from zero (~${poolFor(b.queue.tag).bootSecs}s boot) — capacity on the way, not a config problem</span>`
        : `no healthy worker with tag "${esc(b.queue.tag)}" and no pool serves it — config problem, not load`)
      : `${b.queue.matching} matching worker, busy${b.queue.ahead ? ` · ${b.queue.ahead} ahead` : ''}`;

    const waiting = dataTable({
      cols: [
        { width: 'icon' },
        { label: 'build', width: 'content' },
        { label: 'needs', width: 'content' },
        { label: 'why it waits', width: 'fill', measure: '22ch', cls: 'small' },
        { label: 'waiting', width: 'content', align: 'right', cls: 'mut small' },
        { width: 'action' },
      ],
      rows: pend.map(b => ({
        nav: `#/b/${b.id}`,
        cells: [
          { h: '⏳', cls: 'c-pending' },
          `<a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a>`,
          `<code>${esc(b.queue.tag)}</code>`,
          { h: whyWaits(b), cls: b.queue.matching === 0 && !poolFor(b.queue.tag) ? 'c-failed' : 'mut' },
          ago(b.start),
          `<button class="btn sm" data-act="cancel" data-arg="${b.id}">Cancel</button>`,
        ],
      })),
    });

    const capacity = dataTable({
      cols: [
        { label: 'tag', width: 'content' },
        { label: 'healthy workers', width: 'fill' },
        { label: 'busy', width: 'content', align: 'right' },
        { label: 'queued', width: 'content', align: 'right' },
      ],
      rows: tags.map(t => {
        const m = online.filter(w => w.tags.includes(t));
        const bp = booting.filter(w => w.tags.includes(t));
        const pool = poolFor(t);
        const who = m.length ? m.map(w => `<b>${esc(w.name)}</b>`).join(', ') : '';
        const boot = bp.length ? `${m.length ? ', ' : ''}<span class="c-pending">${bp.map(w => esc(w.name)).join(', ')} (booting)</span>` : '';
        const none = !m.length && !bp.length
          ? (pool ? `<span class="c-pending">pool ${esc(pool.name)} · scaled to zero, scales 0–${pool.max} on demand</span>`
            : '<span class="c-failed">none — and no pool serves this tag</span>')
          : '';
        return { cells: [`<code>${esc(t)}</code>`, who + boot + none,
          m.reduce((s, w) => s + (w.running || 0), 0),
          pend.filter(b => b.queue.tag === t).length] };
      }),
    });

    const runs = dataTable({
      cols: [
        { width: 'icon' },
        { width: 'content' },
        { width: 'fill', cls: 'mut small' },
        { width: 'content', align: 'right', cls: 'mut small' },
      ],
      rows: running.map(b => ({
        nav: `#/b/${b.id}`,
        cells: [
          { h: '●', cls: 'c-started pulse' },
          `<a class="row-link" href="#/b/${b.id}"><b>${esc(b.pipeline)}/${esc(b.job)}</b> #${b.n}</a>`,
          `on <b>${esc(b.worker)}</b>`,
          { h: fmtDur(bDur(b)), attrs: 'data-live' },
        ],
      })),
    });

    return `<div class="page"><h1>Queue${PK.model.team() ? ` <span class="mut small">· team ${esc(PK.model.team())}</span>` : ''}</h1>
      <div class="meta" data-live><b>${running.length}</b> running · <b>${pend.length}</b> queued ·
        capacity <b>${busy}/${regd}</b> registered workers busy <span class="mut small">(--concurrency N registers N single-build workers)</span> on ${online.length} healthy host${online.length === 1 ? '' : 's'}${booting.length ? ` <b class="c-pending">+ ${booting.length} provisioning</b> (${booting.reduce((s, w) => s + (w.concurrency || 1), 0)} more on the way)` : ''}</div>
      ${pend.length ? `<h2>Waiting</h2>${waiting}` : '<div class="allclear">✓ Queue is empty — new jobs start as soon as a matching worker is free.</div>'}
      ${tags.length ? `<h2>Capacity by tag</h2>${capacity}` : ''}
      <h2>Running</h2>
      ${running.length ? runs : '<div class="mut pad-s small">nothing running right now</div>'}
      <p class="mut small">Worker health lives under <a href="#/workers">Workers</a>.</p>
    </div>`;
  };
})(window.PK);
