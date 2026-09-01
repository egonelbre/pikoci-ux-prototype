// One pipeline: graph, versions, config history.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const { graphSVG } = PK.graph;
  const { dataTable } = PK.ui;

  // ---------- Pipeline page -------------------------------------------------
  VIEWS.pipeline = function (name, view, ctx) {
    const pl = PK.model.getPipeline(name);
    if (!pl) return '<div class="page">Unknown pipeline</div>';
    view = view || 'graph';
    const s = PK.model.primaryStatus(pl);
    const V = v => `<a class="tab ${view === v ? 'on' : ''}" href="#/p/${name}/${v}">${v[0].toUpperCase() + v.slice(1)}</a>`;
    // context chips: primary-latest + lineage heads + recent versions
    const res = pl.resources[0];
    const ctxChips = [`<a class="commit-chip ${!ctx ? 'on' : ''}" href="#/p/${name}/${view}">primary-latest</a>`]
      .concat((res.versions || []).slice(0, 4).map(v =>
        `<a class="commit-chip ${ctx === v.id.ref ? 'on' : ''}" href="#/p/${name}/${view}/${v.id.ref}" title="${esc(v.meta.msg || '')}">${esc(v.id.ref)}</a>`));
    let body = '';
    if (view === 'graph') {
      body = graphSVG(pl, ctx || null);
      // outputs of the builds this graph is showing (same per-node selection:
      // the chosen context, or each job's latest build on primary-latest)
      const outs = [];
      for (const j of pl.jobs) {
        let bb = null;
        if (ctx) { const c = PK.model.jobCell(pl, j.name, ctx); bb = c.kind === 'build' ? c.build : null; }
        else bb = PK.model.jobBuilds(pl, j.name)[0] || null;
        if (bb && bb.artifacts) for (const a of bb.artifacts) outs.push({ a, b: bb });
      }
      if (outs.length) body += `<h3>Outputs <span class="mut small">— produced by ${ctx ? `<code>${esc(ctx)}</code>` : 'the builds shown'}</span></h3>
        ${dataTable({
        className: 'wtbl',
        cols: [
          { width: 'content' },
          { width: 'content', cls: 'mut small' },
          { width: 'content', cls: 'mut small' },
          { width: 'fill', cls: 'mut small' },
          { width: 'content', align: 'right', cls: 'mut small' },
        ],
        rows: outs.map(({ a, b: ab }) => ({ cells: [
          `📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a>`,
          esc(a.size),
          a.sha ? `sha256 <code>${esc(a.sha)}…</code>` : '',
          a.dest ? `→ ${esc(a.dest)}` : '<span class="mut">worker-local · retention pending</span>',
          `from <a href="#/b/${ab.id}">${esc(ab.job)} #${ab.n}</a>`,
        ] })),
      })}`;
    }
    else if (view === 'versions') {
      body = `${dataTable({
        dense: false,
        cols: [
          { width: 'icon' },
          { width: 'content' },
          { width: 'fill' },
          { width: 'content', cls: 'mut small' },
          { width: 'content' },
        ],
        rows: (res.versions || []).map(v => ({ cells: [
          res.pinned && res.pinned.ref === v.id.ref ? '📌' : '',
          `<code>${esc(v.id.ref)}</code>`,
          `${esc(v.meta.msg || '')} ${v.meta.author ? `<span class="mut small">· ${esc(v.meta.author)}</span>` : ''}`,
          ago(v.meta.at),
          `<span class="dots">${pl.jobs.filter(PK.model.isRunJob).map(j => VIEWS.jobDot(pl, j.name, v.id.ref)).join('')}</span>`,
        ] })),
      })}
      ${res.pinned ? `<div class="warnbox gap">📌 pinned to <code>${esc(res.pinned.ref)}</code> by <b>${esc(res.pinned.actor)}</b> — "${esc(res.pinned.reason)}" (${ago(res.pinned.at)}). Newer versions are ignored; escape hatches carry actor + reason.</div>` : ''}`;
    } else if (view === 'config') {
      body = `<div class="pad">
        <div class="mut small gap-s">Revision-guarded set (CAS): a stale editor gets a conflict + three-way diff, never a silent overwrite. Restore creates a new revision.</div>
        ${dataTable({
        dense: false,
        cols: [
          { label: 'rev', width: 'content' },
          { label: 'by', width: 'content' },
          { label: 'when', width: 'content', cls: 'mut small' },
          { label: 'note', width: 'fill' },
          { width: 'action' },
        ],
        rows: pl.configHistory.map((h, i) => ({ cells: [
          `<b>${h.rev}</b>${i === 0 ? ' <span class="chip">current</span>' : ''}`,
          esc(h.by), ago(h.at), esc(h.note),
          i > 0 ? `<button class="btn sm" data-act="noop">diff</button> <button class="btn sm" data-act="noop">restore as rev ${pl.configHistory[0].rev + 1}</button>` : '',
        ] })),
      })}</div>`;
    }
    return `<div class="page">
      <div class="crumbs"><a href="#/pipelines">pipelines</a> / <b>${esc(pl.team)}/${esc(name)}</b>
        ${pl.primaryContext.kind !== 'lineages' ? `<span class="c-${s} ${s === 'started' ? 'pulse' : ''}">${st(s).sym} ${st(s).label}</span>` : '<span class="mut small">per-PR status — see Changes</span>'}
        ${pl.public ? '<span class="chip">public</span>' : ''}
        ${pl.paused ? `<span class="c-paused">❚❚ paused by ${esc(pl.pausedMeta.actor)} — "${esc(pl.pausedMeta.reason)}"</span>` : ''}
        <span class="tabs-inline">${V('graph')}${V('versions')}${V('config')}</span>
        <span class="sp"></span>
        <button class="btn sm" data-act="${pl.paused ? 'unpause' : 'pause'}" data-arg="${name}">${pl.paused ? '▶ Unpause' : '❚❚ Pause'}</button>
      </div>
      ${view === 'graph' ? `<div class="ctx-banner">context: ${ctxChips.join('')} <span class="mut small">— statuses are for this context only</span></div>` : ''}
      ${pl.resources.some(r => r.checkError) ? `<div class="errbox">⚠ ${esc(pl.resources.find(r => r.checkError).name)} check failing — new versions are not being detected. <button class="btn sm" data-act="check" data-arg="${name}|${esc(pl.resources.find(r => r.checkError).name)}">↻ Re-check</button></div>` : ''}
      ${body}
    </div>`;
  };
})(window.PK);
