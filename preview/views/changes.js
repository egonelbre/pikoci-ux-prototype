// Changes: the change-centric inbox. Four tabs over the same idea — what is
// moving and who owns it. Built for hundreds of open PRs and thousands of
// branches, so both tabs are queries with filters, never pickers.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const D = () => window.DATA;

  // ---------- Changes: dense table (built for 100s of open PRs) -------------
  let chgFilter = '', chgChip = 'all', chgBots = true;
  window._chgF = v => { chgFilter = v; PK.app.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._chgC = c => { chgChip = c; PK.app.refresh(); };
  window._chgB = () => { chgBots = !chgBots; PK.app.refresh(); };
  let brFilter = '', brChip = 'active';
  window._brF = v => { brFilter = v; PK.app.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._brC = c => { brChip = c; PK.app.refresh(); };

  VIEWS.changes = function (tab, prN) {
    tab = tab || 'open';
    if (tab === 'pr' && prN) return VIEWS.prDetail(+prN);
    const T = (k, lbl) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/changes/${k}">${lbl}</a>`;
    let body = '';

    if (tab === 'mine' || tab === 'open') {
      // aggregates every PR pipeline in scope — 50 repos with their own
      // lint/verify pipelines land in ONE inbox, scoped by the team dropdown
      let ls = PK.model.lineages().filter(l => tab === 'open' || PK.model.mine(l));
      const total = ls.length;
      if (!chgBots) ls = ls.filter(l => !l.bot);
      const held = l => !l.summary && D().builds.some(b => b.heldReason && Object.values(b.intent.versions)[0] === PK.model.lineageHead(l).id.ref);
      if (chgChip === 'failing') ls = ls.filter(l => PK.model.lineageStatus(l) === 'failed');
      else if (chgChip === 'running') ls = ls.filter(l => ['started', 'pending'].includes(PK.model.lineageStatus(l)));
      else if (chgChip === 'held') ls = ls.filter(held);
      else if (chgChip === 'drafts') ls = ls.filter(l => l.draft);
      if (chgFilter) {
        const q = chgFilter.toLowerCase();
        ls = ls.filter(l => (l.n + ' ' + l.title + ' ' + l.author + ' ' + l.branch + ' ' + (l.pl || 'pikoci-pr')).toLowerCase().includes(q));
      }
      ls.sort((a, b) => (PK.model.mine(b) ? 1 : 0) - (PK.model.mine(a) ? 1 : 0) || b.updated - a.updated);
      const shown = ls.slice(0, 200);
      const chip = (k, lbl) => `<button class="chip-btn ${chgChip === k ? 'on' : ''}" onclick="_chgC('${k}')">${lbl}</button>`;
      body = `
      <div class="ctoolbar">
        <input data-filter aria-label="filter changes" placeholder="filter #, title, author, branch, repo…  ( / )" value="${esc(chgFilter)}" oninput="_chgF(this.value)">
        ${chip('all', 'all')}${chip('failing', '✕ failing')}${chip('running', '● started')}${chip('held', '⛔ held')}${chip('drafts', 'drafts')}
        <label class="small mut"><input type="checkbox" ${chgBots ? 'checked' : ''} onchange="_chgB()"> bots</label>
        <span class="sp"></span>
        <span class="mut small">${shown.length}${ls.length > 200 ? ' of ' + ls.length : ''} shown · ${total} open${PK.model.team() ? ' in ' + esc(PK.model.team()) : ''}</span>
      </div>
      <div class="tbl-scroll"><table class="tbl ctbl fixed">
        <colgroup><col style="width:30px"><col><col style="width:92px"><col style="width:114px"><col style="width:188px"><col style="width:132px"><col style="width:84px"></colgroup>
        <thead><tr><th></th><th>PR</th><th>repo</th><th>author</th><th>branch @ head</th><th class="r">checks</th><th class="r">updated</th></tr></thead>
        <tbody>
        ${shown.map(l => {
        const lpl = PK.model.lineagePl(l);
        const jobNames = lpl.jobs.map(j => j.name);
        const head = PK.model.lineageHead(l);
        const s = PK.model.lineageStatus(l);
        const isHeld = held(l);
        const old = l.changes.filter(c => c.superseded).length;
        return `<tr class="${PK.model.mine(l) ? 'mine-row' : ''}" onclick="location.hash='#/changes/pr/${l.n}'">
          <td class="c-${isHeld ? 'held' : s} ${s === 'started' ? 'pulse' : ''}">${isHeld ? '⛔' : st(s).sym}</td>
          <td class="ct-title" title="${esc(l.title)}"><div class="ctt">
            <a class="row-link" href="#/changes/pr/${l.n}"><b>#${l.n}</b> ${esc(l.title)}</a>
            ${l.draft ? '<span class="chip">draft</span>' : ''}${l.fork ? '<span class="chip">fork</span>' : ''}
            ${isHeld ? '<span class="badge held-badge">held</span>' : ''}
            ${old ? `<span class="chip" title="superseded commits — builds auto-cancelled within this lineage">+${old} superseded</span>` : ''}
            ${l.forge ? `<a class="mut small" href="${esc(l.forge.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="open on ${esc(l.forge.kind)}">↗</a>` : ''}</div></td>
          <td class="mut small nowrap" title="${esc(lpl.team)}/${esc(lpl.name)}">${esc(lpl.name.replace(/-pr$/, ''))}</td>
          <td class="mut nowrap">${PK.model.mine(l) ? `<span class="you-mark" title="your PR" aria-label="your PR">★</span> ` : ''}${esc(l.author)}</td>
          <td class="nowrap"><code class="trunc-code" title="${esc(l.branch)}">${esc(l.branch)}</code> <code>${esc(head.id.ref)}</code></td>
          <td class="r nowrap"><span class="dots" onclick="event.stopPropagation()">
            ${l.summary ? l.summary.map((sst, i) => VIEWS.dotStatic(sst, jobNames[i] || 'check')).join('')
          : lpl.jobs.map(j => VIEWS.jobDot(lpl, j.name, head.id.ref)).join('')}</span></td>
          <td class="mut small r nowrap">${ago(l.updated)}</td>
        </tr>`;
      }).join('')}
        </tbody>
      </table></div>`;
    } else if (tab === 'repos') {
      if (prN) return VIEWS.branchFeed(prN);
      // The branch surface at company scale (50 repos × 100 releases + 30
      // branches) is thousands of branch pipelines, almost all quiet or EOL.
      // The REPO is the stable top-level object — ~50 of them, each a
      // roll-up of its branches: worst-active status, red branches named on
      // the summary line, branches inside on expand. Quiet branches (no
      // commit in 30d) stay hidden until "all" or search. Feature branches
      // never appear at all — they enter as PRs (Open PRs).
      const rows = PK.model.branchIndex();
      const q = (brFilter || '').toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const quiet = r => Date.now() - r.lastAt > 30 * 86400e3;
      const rank = r => r.status === 'paused' ? 6.5 : (PK.status.RANK[r.status] !== undefined ? PK.status.RANK[r.status] : 9);
      // "attention" = red AND alive — a branch red for a year is archaeology,
      // reachable via "all" and search, not something to shout about
      const attn = r => ['failed', 'waiting_for_approval', 'held'].includes(r.status) && !quiet(r);
      const match = r => { const hay = (r.repo + ' ' + r.branch + ' ' + r.name).toLowerCase(); return terms.every(t => hay.includes(t)); };
      const C = (k, lbl) => `<button class="chip-btn ${brChip === k ? 'on' : ''}" onclick="_brC('${k}')">${lbl}</button>`;
      const groups = {};
      for (const r of rows) (groups[r.repo] = groups[r.repo] || []).push(r);
      const CAPB = 60;
      let shownBranches = 0;
      const glist = Object.entries(groups).map(([repo, g]) => {
        const vis = q ? g.filter(match)
          : brChip === 'attention' ? g.filter(attn)
            : brChip === 'active' ? g.filter(r => !quiet(r)) : g;
        const sorted = vis.slice().sort((a, b) => (rank(a) - rank(b)) || (b.lastAt - a.lastAt));
        const alive = g.filter(r => !quiet(r));
        const pool = alive.length ? alive : g;
        const worst = pool.slice().sort((a, b) => rank(a) - rank(b))[0];
        return {
          repo, g, sorted, team: g[0].team, red: g.filter(attn),
          active: alive.length, worst: worst.status, wrank: rank(worst),
          lastAt: Math.max(...g.map(r => r.lastAt)),
        };
      }).filter(x => x.sorted.length)
        .sort((a, b) => (a.wrank - b.wrank) || (b.lastAt - a.lastAt));
      glist.forEach(x => { shownBranches += x.sorted.length; });
      const brRow = r => {
        const href = '#/changes/repos/' + encodeURIComponent(r.name);
        const head = r.pl ? null : r.commits[0];
        return `<tr onclick="location.hash='${href}'">
          <td class="c-${r.status} ${r.status === 'started' ? 'pulse' : ''} nowrap">${st(r.status).sym}</td>
          <td class="nowrap"><div class="ctt"><a class="row-link" href="${href}"><code>${esc(r.branch)}</code></a>${r.note ? ` <span class="mut small">${esc(r.note)}</span>` : ''}</div></td>
          <td class="mut small"><div class="ctt"><span class="shrink">${esc(r.headMsg || (head ? head.msg : ''))}</span></div></td>
          <td class="mut small nowrap">${esc(r.headAuthor || (head ? head.author : ''))}</td>
          <td class="r nowrap"><span class="dots">${r.pl
            ? r.pl.jobs.filter(PK.model.isRunJob).slice(0, 5).map(j => VIEWS.jobDot(r.pl, j.name, r.headRef)).join('')
            : head.summary.map((s2, i2) => VIEWS.dotStatic(s2, r.jobs[i2] || 'check')).join('')}</span></td>
          <td class="mut small r nowrap">${ago(r.lastAt)}</td></tr>`;
      };
      // same display as Pipelines: ONE table, a tsub header row per repo
      // (roll-up: worst status, counts, red branches named), branch rows under
      const grp = x => `<tr class="tsub"><td colspan="6"><span class="c-${x.worst} ${x.worst === 'started' ? 'pulse' : ''}">${st(x.worst).sym}</span> <b>${esc(x.repo)}</b>
          <span class="mut">· ${esc(x.team)} · ${x.g.length} branch${x.g.length === 1 ? '' : 'es'}${x.active !== x.g.length ? `, ${x.active} active` : ''}${x.red.length ? ` · <b class="c-failed">${x.red.length} red:</b> ${x.red.slice(0, 3).map(r => `<code>${esc(r.branch)}</code>`).join(' ')}${x.red.length > 3 ? ` +${x.red.length - 3}` : ''}` : ''} · ${ago(x.lastAt)}</span></td></tr>
        ${x.sorted.slice(0, CAPB).map(brRow).join('')}
        ${x.sorted.length > CAPB ? `<tr><td></td><td colspan="5" class="mut small">first ${CAPB} of ${x.sorted.length} branches — narrow with the filter</td></tr>` : ''}`;
      body = `<div class="ctoolbar">
          <input data-filter aria-label="filter repos and branches" placeholder="filter repo, branch…  ( / )" value="${esc(brFilter)}" oninput="_brF(this.value)">
          ${C('active', 'active')}${C('attention', '✕ needs attention')}${C('all', 'all')}
          <span class="sp"></span>
          <span class="mut small">${glist.length} repos · ${shownBranches} of ${rows.length} branches${!q && brChip === 'active' ? ' · quiet (no commit in 30d) hidden' : ''}</span>
        </div>
        ${glist.length ? `<div class="tbl-scroll"><table class="tbl ctbl fixed">
        <colgroup><col style="width:30px"><col style="width:220px"><col><col style="width:110px"><col style="width:96px"><col style="width:84px"></colgroup>
        <thead><tr><th></th><th>branch</th><th>last commit</th><th>author</th><th class="r">checks</th><th class="r">updated</th></tr></thead>
        <tbody>${glist.map(grp).join('')}</tbody></table></div>`
          : '<div class="mut pad">Nothing matches. Clear the filter or switch chips.</div>'}
        <p class="mut small">Every watched branch is its own pipeline (a git resource tracks one ref). Feature branches don't live here — they arrive as PRs.</p>`;
    } else if (tab === 'scheduled') {
      const pl = PK.model.getPipeline('hello-world');
      if (!PK.model.inTeam(pl)) return `<div class="page">
        <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('repos', 'Repos')}${T('scheduled', 'Scheduled')}</div>
        <div class="mut pad">Scheduled ticks in the demo dataset live in <b>oss/hello-world</b>. Pick “all teams” or “oss” in the top bar.</div></div>`;
      body = `<div class="tbl-scroll"><table class="tbl ctbl"><tbody>
        ${pl.resources[0].versions.concat([{ id: { ref: new Date(D().now - 30 * 60e3).toISOString().slice(0, 16) + 'Z' }, meta: { at: D().now - 30 * 60e3 } }]).map(v => `<tr>
          <td>⏱</td><td class="ct-title"><div class="ctt"><code>${esc(v.id.ref)}</code><span class="mut shrink">cron.every-10m · oss/hello-world</span></div></td>
          <td></td><td class="r"><span class="dots">${VIEWS.jobDot(pl, 'gen', v.id.ref)}</span></td>
          <td class="mut small r nowrap">${ago(v.meta.at)}</td></tr>`).join('')}
      </tbody></table></div>`;
    }

    return `<div class="page">
      <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('repos', 'Repos')}${T('scheduled', 'Scheduled')}</div>
      ${body || '<div class="mut pad">No changes match. Clear the filter or switch tabs.</div>'}
    </div>`;
  };
})(window.PK);
