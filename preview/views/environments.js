// Environments: what version is live where, with drift and guided rollback.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { dataTable, filterBar } = PK.ui;
  const D = () => window.DATA;

  // ---------- Environments --------------------------------------------------
  const env = {
    filter: PK.state.use('environments.filter', ''),
    chip: PK.state.use('environments.chip', 'all'),
  };

  VIEWS.environments = function (name) {
    if (name) return VIEWS.envDetail(name);
    let envs = D().environments.filter(e => !PK.model.team() || e.pipeline.split('/')[0] === PK.model.team());
    const total = envs.length;
    // attention first: drift, then verifying, then quiet greens (newest deploy first)
    const order = e => e.drift ? 0 : !e.verified ? 1 : 2;
    const attn = envs.filter(e => order(e) < 2).length;
    if (env.chip.get() === 'attention') envs = envs.filter(e => order(e) < 2);
    else if (env.chip.get() === 'drift') envs = envs.filter(e => e.drift);
    else if (env.chip.get() === 'verifying') envs = envs.filter(e => !e.verified);
    if (env.filter.get()) {
      const q = env.filter.get().toLowerCase();
      envs = envs.filter(e => (e.name + ' ' + e.pipeline + ' ' + e.version + ' ' + e.by).toLowerCase().includes(q));
    }
    const sorted = g => g.slice().sort((a, b) => order(a) - order(b) || b.deployedAt - a.deployedAt);
    const row = e => ({
      nav: `#/environments/${encodeURIComponent(e.name)}`,
      cells: [
        e.drift ? '<span class="c-failed" title="live version was not deployed by CI">⚠</span>' : e.verified ? '<span class="c-succeeded">✓</span>' : '<span class="c-started pulse">●</span>',
        `<a class="row-link" href="#/environments/${encodeURIComponent(e.name)}"><b>${esc(e.name)}</b></a>${e.drift ? ' <span class="badge held-badge">drift</span>' : ''}${e.verified ? '' : ' <span class="chip">verifying…</span>'}`,
        `${esc(e.pipeline)} · ${esc(e.job)}`,
        `<code>${esc(e.version)}</code>`,
        `${ago(e.deployedAt)} · ${esc(e.byBuild)} (${esc(e.by)})`,
      ],
    });
    // same grouping as the Pipelines table: team subheads at all-teams scale
    const grouped = !PK.model.team() && envs.length > 9;
    const rows = [];
    if (grouped) {
      for (const t of D().teams) {
        const g = sorted(envs.filter(e => e.pipeline.split('/')[0] === t.name));
        if (!g.length) continue;
        rows.push({ group: `${esc(t.name)} <span class="mut">· ${g.length}</span>` });
        g.forEach(e => rows.push(row(e)));
      }
    } else sorted(envs).forEach(e => rows.push(row(e)));
    return `<div class="page"><h1>Environments <span class="mut small">${total}${PK.model.team() ? ' · team ' + esc(PK.model.team()) : ''}</span></h1>
      ${filterBar({
      filterKey: 'environments.filter', chipKey: 'environments.chip',
      label: 'filter environments',
      placeholder: 'filter name, pipeline, version…  ( / )',
      chips: [['all', 'all'], ['attention', `⚠ needs attention${attn ? ' · ' + attn : ''}`], ['drift', '⚠ drift'], ['verifying', '● verifying']],
      count: `${envs.length} of ${total}`,
    })}
      ${envs.length ? '' : (total ? '<div class="mut pad">Nothing matches this filter.</div>' : `<div class="mut pad">No environments declared by team ${esc(PK.model.team())}'s pipelines.</div>`)}
      ${dataTable({
      cols: [
        { width: 'icon' },
        { label: 'environment', width: 'content' },
        // the pipeline column soaks up the leftover width and truncates
        { label: 'pipeline', width: 'title', cls: 'mut small' },
        { label: 'live version', width: 'content' },
        { label: 'deployed', width: 'content', cls: 'mut small' },
      ],
      rows,
    })}
    </div>`;
  };

  VIEWS.envDetail = function (name) {
    const e = D().environments.find(x => x.name === name);
    if (!e) return '<div class="page">Environment not found — <a href="#/environments">environments</a></div>';
    const plName = e.pipeline.split('/')[1];
    return `<div class="page narrow">
      <div class="crumbs"><a href="#/environments">environments</a> / <b>${esc(e.name)}</b>
        ${e.drift ? '<span class="c-failed">⚠ drift</span>' : e.verified ? '<span class="c-succeeded">verified ✓</span>' : '<span class="c-started pulse">● verifying…</span>'}
        <span class="mut small">deploy target of <a href="#/p/${esc(plName)}/graph">${esc(e.pipeline)}</a> · job <code>${esc(e.job)}</code></span>
        <span class="sp"></span>
        <button class="btn" data-act="rollback" data-arg="${esc(e.name)}">↩ Rollback…</button></div>
      ${e.drift ? `<div class="warnbox">⚠ <b>Drift</b> — the live version was not deployed by CI (an out-of-band change).
        Rollback re-establishes a CI-deployed version; the audit log records who and why.</div>` : ''}
      <section class="panel"><div class="panel-head"><b>Live now</b></div>
        <div class="pad">
          <div style="font-size:20px"><code>${esc(e.version)}</code></div>
          <div class="mut small gap-s">deployed ${ago(e.deployedAt)} · build ${esc(e.byBuild)} · by ${esc(e.by)}
            ${e.verified ? ' · post-deploy verification passed' : ' · post-deploy verification still running'}</div>
          <div class="mut small">rollback is guided: trigger-with-version + pin, confirmed, audited</div>
        </div></section>
      <section class="panel"><div class="panel-head"><b>History</b><span class="mut small">newest first</span></div>
        ${dataTable({
      cols: [
        { width: 'icon' },
        { width: 'content' },
        { width: 'fill', cls: 'mut small' },
        { width: 'content', align: 'right', cls: 'mut small' },
        { width: 'action' },
      ],
      rows: e.history.map((h, i) => ({ cells: [
        h.ok ? '<span class="c-succeeded">✓</span>' : '<span class="c-failed">✕</span>',
        `<code>${esc(h.version)}</code>${i === 0 ? ' <span class="chip">live</span>' : ''}`,
        esc(h.build),
        ago(h.at),
        i > 0 ? `<button class="btn sm" data-act="rollback" data-arg="${esc(e.name)}">↩ Roll back to this</button>` : '',
      ] })),
    })}</section>
    </div>`;
  };
})(window.PK);
