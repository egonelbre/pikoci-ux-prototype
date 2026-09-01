// One branch pipeline's commit history.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;

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
        return `<tr>
          <td class="c-${worst} ${worst === 'started' ? 'pulse' : ''}">${st(worst).sym}</td>
          <td class="ct-title" title="${esc(v.meta.msg || '')}"><div class="ctt"><code>${esc(v.id.ref)}</code><span class="shrink">${esc(v.meta.msg || '')}</span></div></td>
          <td class="mut nowrap">${esc(v.meta.author || '')}</td>
          <td class="r nowrap"><span class="dots">${r.pl.jobs.filter(PK.model.isRunJob).map(j => VIEWS.jobDot(r.pl, j.name, v.id.ref)).join('')}</span></td>
          <td class="mut small r nowrap">${ago(v.meta.at)}</td></tr>`;
      }).join('');
    } else {
      feed = r.commits.map(c => `<tr>
        <td class="c-${r.status}">${st(r.status).sym}</td>
        <td class="ct-title"><div class="ctt"><code>${esc(c.ref)}</code><span class="shrink">${esc(c.msg)}</span></div></td>
        <td class="mut nowrap">${esc(c.author)}</td>
        <td class="r nowrap"><span class="dots">${c.summary.map((s2, i2) => VIEWS.dotStatic(s2, r.jobs[i2] || 'check')).join('')}</span></td>
        <td class="mut small r nowrap">${ago(c.at)}</td></tr>`).join('');
    }
    return `<div class="page">${tabs}
      <div class="meta"><a href="#/changes/repos">← repos</a> · <b>${esc(r.team)}/${esc(r.repo)}</b>
        · branch <code>${esc(r.branch)}</code>${r.pl ? ` · <a href="#/p/${esc(r.pl.name)}/graph">pipeline →</a>` : ' · <span class="mut small">summary-only demo row — rich history exists for the hand-built branches</span>'}</div>
      <div class="tbl-scroll"><table class="tbl ctbl">
      <thead><tr><th></th><th>commit</th><th>author</th><th class="r">checks</th><th class="r">when</th></tr></thead>
      <tbody>${feed}</tbody></table></div></div>`;
  };
})(window.PK);
