// One branch pipeline's commit history.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const { dataTable } = PK.ui;

  // ---------- Branch feed: one branch pipeline's commit history -------------
  VIEWS.branchFeed = function (name) {
    const tabs = `<div class="tabs">
      <a class="tab" href="#/changes/mine">Mine</a><a class="tab" href="#/changes/open">Open PRs</a>
      <a class="tab on" href="#/changes/repos">Repos</a><a class="tab" href="#/changes/scheduled">Scheduled</a></div>`;
    const r = PK.model.branchIndex().find(x => x.name === name);
    if (!r) return `<div class="page">${tabs}<div class="mut pad">Branch not found — <a href="#/changes/repos">back to repos</a>.</div></div>`;
    let feed;
    if (r.pl) {
      const res = r.pl.resources.find(x => x.name === r.pl.primaryContext.resource);
      feed = (res ? res.versions : []).map(v => {
        let worst = 'none';
        for (const j of r.pl.jobs) {
          const c = PK.model.jobCell(r.pl, j.name, v.id.ref);
          if (c.kind === 'build' && PK.status.RANK[c.status] < PK.status.RANK[worst]) worst = c.status;
        }
        return { cells: [
          { h: st(worst).sym, cls: `c-${worst} ${worst === 'started' ? 'pulse' : ''}` },
          { h: `<code>${esc(v.id.ref)}</code><span class="shrink">${esc(v.meta.msg || '')}</span>`, title: v.meta.msg || '' },
          esc(v.meta.author || ''),
          `<span class="dots">${r.pl.jobs.filter(PK.model.isRunJob).map(j => VIEWS.jobDot(r.pl, j.name, v.id.ref)).join('')}</span>`,
          ago(v.meta.at),
        ] };
      });
    } else {
      feed = r.commits.map(c => ({ cells: [
        { h: st(r.status).sym, cls: `c-${r.status}` },
        `<code>${esc(c.ref)}</code><span class="shrink">${esc(c.msg)}</span>`,
        esc(c.author),
        `<span class="dots">${c.summary.map((s2, i2) => VIEWS.dotStatic(s2, r.jobs[i2] || 'check')).join('')}</span>`,
        ago(c.at),
      ] }));
    }
    return `<div class="page">${tabs}
      <div class="meta"><a href="#/changes/repos">← repos</a> · <b>${esc(r.team)}/${esc(r.repo)}</b>
        · branch <code>${esc(r.branch)}</code>${r.pl ? ` · <a href="#/p/${esc(r.pl.name)}/graph">pipeline →</a>` : ' · <span class="mut small">summary-only demo row — rich history exists for the hand-built branches</span>'}</div>
      ${dataTable({
      cols: [
        { width: 'icon' },
        { label: 'commit', width: 'title' },
        { label: 'author', width: 'content', cls: 'mut' },
        { label: 'checks', width: 'content', align: 'right' },
        { label: 'when', width: 'content', align: 'right', cls: 'mut small' },
      ],
      rows: feed,
    })}</div>`;
  };
})(window.PK);
