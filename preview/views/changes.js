// Changes: the change-centric inbox. Four tabs over the same idea — what is
// moving and who owns it. Built for hundreds of open PRs and thousands of
// branches, so both tabs are queries with filters, never pickers.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const { dataTable, filterBar } = PK.ui;
  const D = () => window.DATA;

  // ---------- Changes: dense table (built for 100s of open PRs) -------------
  const chg = {
    filter: PK.state.use('changes.filter', ''),
    chip: PK.state.use('changes.chip', 'all'),
    bots: PK.state.use('changes.bots', true),
  };
  const br = {
    filter: PK.state.use('repos.filter', ''),
    chip: PK.state.use('repos.chip', 'active'),
  };

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
      if (!chg.bots.get()) ls = ls.filter(l => !l.bot);
      const held = l => !l.summary && D().builds.some(b => b.heldReason && Object.values(b.intent.versions)[0] === PK.model.lineageHead(l).id.ref);
      if (chg.chip.get() === 'failing') ls = ls.filter(l => PK.model.lineageStatus(l) === 'failed');
      else if (chg.chip.get() === 'running') ls = ls.filter(l => ['started', 'pending'].includes(PK.model.lineageStatus(l)));
      else if (chg.chip.get() === 'held') ls = ls.filter(held);
      else if (chg.chip.get() === 'drafts') ls = ls.filter(l => l.draft);
      if (chg.filter.get()) {
        const q = chg.filter.get().toLowerCase();
        ls = ls.filter(l => (l.n + ' ' + l.title + ' ' + l.author + ' ' + l.branch + ' ' + (l.pl || 'pikoci-pr')).toLowerCase().includes(q));
      }
      ls.sort((a, b) => (PK.model.mine(b) ? 1 : 0) - (PK.model.mine(a) ? 1 : 0) || b.updated - a.updated);
      const shown = ls.slice(0, 200);
      body = `
      ${filterBar({
        filterKey: 'changes.filter', chipKey: 'changes.chip',
        label: 'filter changes',
        placeholder: 'filter #, title, author, branch, repo…  ( / )',
        chips: [['all', 'all'], ['failing', '✕ failing'], ['running', '● started'], ['held', '⛔ held'], ['drafts', 'drafts']],
        extra: `<label class="small mut"><input type="checkbox" data-state="changes.bots" ${chg.bots.get() ? 'checked' : ''}> bots</label>`,
        count: `${shown.length}${ls.length > 200 ? ' of ' + ls.length : ''} shown · ${total} open${PK.model.team() ? ' in ' + esc(PK.model.team()) : ''}`,
      })}
      ${dataTable({
        layout: 'fixed',
        cols: [
          { width: 'icon', px: '30px' },
          { label: 'PR', width: 'title' },
          { label: 'repo', width: 'content', px: '92px', cls: 'mut small' },
          { label: 'author', width: 'content', px: '114px', cls: 'mut' },
          { label: 'branch @ head', width: 'content', px: '188px' },
          { label: 'checks', width: 'content', px: '132px', align: 'right' },
          { label: 'updated', width: 'content', px: '84px', align: 'right', cls: 'mut small' },
        ],
        rows: shown.map(l => {
          const lpl = PK.model.lineagePl(l);
          const jobNames = lpl.jobs.map(j => j.name);
          const head = PK.model.lineageHead(l);
          const s = PK.model.lineageStatus(l);
          const isHeld = held(l);
          const old = l.changes.filter(c => c.superseded).length;
          return {
            nav: `#/changes/pr/${l.n}`,
            cls: PK.model.mine(l) ? 'mine-row' : null,
            cells: [
              { h: isHeld ? '⛔' : st(s).sym, cls: `c-${isHeld ? 'held' : s} ${s === 'started' ? 'pulse' : ''}` },
              { h: `<a class="row-link" href="#/changes/pr/${l.n}"><b>#${l.n}</b> ${esc(l.title)}</a>
              ${l.draft ? '<span class="chip">draft</span>' : ''}${l.fork ? '<span class="chip">fork</span>' : ''}
              ${isHeld ? '<span class="badge held-badge">held</span>' : ''}
              ${old ? `<span class="chip" title="superseded commits — builds auto-cancelled within this lineage">+${old} superseded</span>` : ''}
              ${l.forge ? `<a class="mut small" href="${esc(l.forge.url)}" target="_blank" rel="noopener" title="open on ${esc(l.forge.kind)}">↗</a>` : ''}`,
                title: l.title },
              { h: esc(lpl.name.replace(/-pr$/, '')), title: `${lpl.team}/${lpl.name}` },
              `${PK.model.mine(l) ? '<span class="you-mark" title="your PR" aria-label="your PR">★</span> ' : ''}${esc(l.author)}`,
              `<code class="trunc-code" title="${esc(l.branch)}">${esc(l.branch)}</code> <code>${esc(head.id.ref)}</code>`,
              `<span class="dots">${l.summary
                ? l.summary.map((sst, i) => VIEWS.dotStatic(sst, jobNames[i] || 'check')).join('')
                : lpl.jobs.map(j => VIEWS.jobDot(lpl, j.name, head.id.ref)).join('')}</span>`,
              ago(l.updated),
            ],
          };
        }),
      })}`;
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
      const q = (br.filter.get() || '').toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      const quiet = r => Date.now() - r.lastAt > 30 * 86400e3;
      const rank = r => r.status === 'paused' ? 6.5 : (PK.status.RANK[r.status] !== undefined ? PK.status.RANK[r.status] : 9);
      // "attention" = red AND alive — a branch red for a year is archaeology,
      // reachable via "all" and search, not something to shout about
      const attn = r => ['failed', 'waiting_for_approval', 'held'].includes(r.status) && !quiet(r);
      const match = r => { const hay = (r.repo + ' ' + r.branch + ' ' + r.name).toLowerCase(); return terms.every(t => hay.includes(t)); };
      const groups = {};
      for (const r of rows) (groups[r.repo] = groups[r.repo] || []).push(r);
      const CAPB = 60;
      let shownBranches = 0;
      const glist = Object.entries(groups).map(([repo, g]) => {
        const vis = q ? g.filter(match)
          : br.chip.get() === 'attention' ? g.filter(attn)
            : br.chip.get() === 'active' ? g.filter(r => !quiet(r)) : g;
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
        return {
          nav: href,
          cells: [
            { h: st(r.status).sym, cls: `c-${r.status} ${r.status === 'started' ? 'pulse' : ''}` },
            `<a class="row-link" href="${href}"><code>${esc(r.branch)}</code></a>${r.note ? ` <span class="mut small">${esc(r.note)}</span>` : ''}`,
            esc(r.headMsg || (head ? head.msg : '')),
            esc(r.headAuthor || (head ? head.author : '')),
            `<span class="dots">${r.pl
              ? r.pl.jobs.filter(PK.model.isRunJob).slice(0, 5).map(j => VIEWS.jobDot(r.pl, j.name, r.headRef)).join('')
              : head.summary.map((s2, i2) => VIEWS.dotStatic(s2, r.jobs[i2] || 'check')).join('')}</span>`,
            ago(r.lastAt),
          ],
        };
      };
      // same display as Pipelines: ONE table, a group header row per repo
      // (roll-up: worst status, counts, red branches named), branch rows under
      const brRows = [];
      for (const x of glist) {
        brRows.push({ group: `<span class="c-${x.worst} ${x.worst === 'started' ? 'pulse' : ''}">${st(x.worst).sym}</span> <b>${esc(x.repo)}</b>
          <span class="mut">· ${esc(x.team)} · ${x.g.length} branch${x.g.length === 1 ? '' : 'es'}${x.active !== x.g.length ? `, ${x.active} active` : ''}${x.red.length ? ` · <b class="c-failed">${x.red.length} red:</b> ${x.red.slice(0, 3).map(r => `<code>${esc(r.branch)}</code>`).join(' ')}${x.red.length > 3 ? ` +${x.red.length - 3}` : ''}` : ''} · ${ago(x.lastAt)}</span>` });
        x.sorted.slice(0, CAPB).forEach(r => brRows.push(brRow(r)));
        if (x.sorted.length > CAPB) brRows.push({ raw: `<tr><td></td><td colspan="5" class="mut small">first ${CAPB} of ${x.sorted.length} branches — narrow with the filter</td></tr>` });
      }
      body = `${filterBar({
        filterKey: 'repos.filter', chipKey: 'repos.chip',
        label: 'filter repos and branches',
        placeholder: 'filter repo, branch…  ( / )',
        chips: [['active', 'active'], ['attention', '✕ needs attention'], ['all', 'all']],
        count: `${glist.length} repos · ${shownBranches} of ${rows.length} branches${!q && br.chip.get() === 'active' ? ' · quiet (no commit in 30d) hidden' : ''}`,
      })}
        ${glist.length ? dataTable({
        layout: 'fixed',
        cols: [
          { width: 'icon', px: '30px' },
          { label: 'branch', width: 'content', px: '220px' },
          { label: 'last commit', width: 'title', cls: 'mut small' },
          { label: 'author', width: 'content', px: '110px', cls: 'mut small' },
          { label: 'checks', width: 'content', px: '96px', align: 'right' },
          { label: 'updated', width: 'content', px: '84px', align: 'right', cls: 'mut small' },
        ],
        rows: brRows,
      }) : '<div class="mut pad">Nothing matches. Clear the filter or switch chips.</div>'}
        <p class="mut small">Every watched branch is its own pipeline (a git resource tracks one ref). Feature branches don't live here — they arrive as PRs.</p>`;
    } else if (tab === 'scheduled') {
      const pl = PK.model.getPipeline('hello-world');
      if (!PK.model.inTeam(pl)) return `<div class="page">
        <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('repos', 'Repos')}${T('scheduled', 'Scheduled')}</div>
        <div class="mut pad">Scheduled ticks in the demo dataset live in <b>oss/hello-world</b>. Pick “all teams” or “oss” in the top bar.</div></div>`;
      body = dataTable({
        cols: [
          { width: 'icon' },
          { width: 'title' },
          { width: 'content', align: 'right' },
          { width: 'content', align: 'right', cls: 'mut small' },
        ],
        rows: pl.resources[0].versions
          .concat([{ id: { ref: new Date(D().now - 30 * 60e3).toISOString().slice(0, 16) + 'Z' }, meta: { at: D().now - 30 * 60e3 } }])
          .map(v => ({ cells: [
            '⏱',
            `<code>${esc(v.id.ref)}</code><span class="mut shrink">cron.every-10m · oss/hello-world</span>`,
            `<span class="dots">${VIEWS.jobDot(pl, 'gen', v.id.ref)}</span>`,
            ago(v.meta.at),
          ] })),
      });
    }

    return `<div class="page">
      <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('repos', 'Repos')}${T('scheduled', 'Scheduled')}</div>
      ${body || '<div class="mut pad">No changes match. Clear the filter or switch tabs.</div>'}
    </div>`;
  };
})(window.PK);
