// One pipeline: graph, versions, config history.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const { graphSVG } = PK.graph;

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
        <div class="tbl-scroll"><table class="tbl ctbl wtbl">
        ${outs.map(({ a, b: ab }) => `<tr>
          <td class="nowrap">📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a></td>
          <td class="mut small nowrap">${esc(a.size)}</td>
          <td class="mut small nowrap">${a.sha ? `sha256 <code>${esc(a.sha)}…</code>` : ''}</td>
          <td class="mut small">${a.dest ? `→ ${esc(a.dest)}` : '<span class="mut">worker-local · retention pending</span>'}</td>
          <td class="mut small r nowrap">from <a href="#/b/${ab.id}">${esc(ab.job)} #${ab.n}</a></td>
        </tr>`).join('')}
        </table></div>`;
    }
    else if (view === 'versions') {
      body = `<div class="tbl-scroll"><table class="tbl">${(res.versions || []).map(v => {
        return `<tr><td width="20">${res.pinned && res.pinned.ref === v.id.ref ? '📌' : ''}</td>
          <td><code>${esc(v.id.ref)}</code></td>
          <td>${esc(v.meta.msg || '')} ${v.meta.author ? `<span class="mut small">· ${esc(v.meta.author)}</span>` : ''}</td>
          <td class="mut small nowrap">${ago(v.meta.at)}</td>
          <td><span class="dots">${pl.jobs.filter(PK.model.isRunJob).map(j => VIEWS.jobDot(pl, j.name, v.id.ref)).join('')}</span></td>
        </tr>`;
      }).join('')}</table></div>
      ${res.pinned ? `<div class="warnbox gap">📌 pinned to <code>${esc(res.pinned.ref)}</code> by <b>${esc(res.pinned.actor)}</b> — "${esc(res.pinned.reason)}" (${ago(res.pinned.at)}). Newer versions are ignored; escape hatches carry actor + reason.</div>` : ''}`;
    } else if (view === 'config') {
      body = `<div class="pad">
        <div class="mut small gap-s">Revision-guarded set (CAS): a stale editor gets a conflict + three-way diff, never a silent overwrite. Restore creates a new revision.</div>
        <div class="tbl-scroll"><table class="tbl"><thead><tr><th>rev</th><th>by</th><th>when</th><th>note</th><th></th></tr></thead>
        ${pl.configHistory.map((h, i) => `<tr><td><b>${h.rev}</b>${i === 0 ? ' <span class="chip">current</span>' : ''}</td>
          <td>${esc(h.by)}</td><td class="mut small">${ago(h.at)}</td><td>${esc(h.note)}</td>
          <td class="r">${i > 0 ? `<button class="btn sm" data-act="noop">diff</button> <button class="btn sm" data-act="noop">restore as rev ${pl.configHistory[0].rev + 1}</button>` : ''}</td></tr>`).join('')}
        </table></div></div>`;
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
