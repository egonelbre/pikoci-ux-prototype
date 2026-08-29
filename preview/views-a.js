// Views A: shell, Home (attention strip + wall), Changes, Environments,
// and the teaching empty states for gated-off sections.
(function () {
  'use strict';
  const { esc, st, ago, fmtDur, bDur, reasonLabel } = P;
  const D = () => window.DATA;

  // ---------- shell ---------------------------------------------------------
  window.VIEWS = window.VIEWS || {};
  VIEWS.shell = function (route) {
    const sec = route[0] || 'home';
    const items = P.navItems();
    const attn = P.attention();
    const active = id => (sec === id || (id === 'home' && !route[0]) || (id === 'pipelines' && ['p', 'b'].includes(sec))) ? 'on' : '';
    const tsel = P.team();
    return `<header>
      <a class="logo" href="#/">▞ PikoCI <span class="preview-tag">preview</span></a>
      <select class="team-sel" aria-label="team scope" title="team scope — filters every page (maps to the backend's team scoping)"
        onchange="P.setTeam(this.value)">
        <option value="">all teams</option>
        ${D().teams.map(t => `<option value="${esc(t.name)}" ${tsel === t.name ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}
      </select>
      <nav aria-label="primary">
        ${items.map(i => `<a class="${active(i.id)}" href="${i.href}">${i.label}</a>`).join('')}
      </nav>
      ${attn.items.length ? `<a href="#/" class="attn-badge" title="items needing you">${attn.items.length}</a>` : ''}
      <span class="sp"></span>
      <button class="ghost" data-act="theme" title="toggle theme">◐</button>
      <button class="ghost" data-palette-btn aria-label="open command palette" onclick="document.dispatchEvent(new KeyboardEvent('keydown',{key:'k',metaKey:true}))">⌘K</button>
      <a class="${sec === 'settings' ? 'on' : ''}" href="#/settings">egon ⚙</a>
    </header>`;
  };

  // ---------- reason chip (focusable, two families) -------------------------
  VIEWS.reasonChip = function (d, ctx) {
    const id = 'r-' + Math.random().toString(36).slice(2, 8);
    const key = 'rsn:' + [d.pipeline, d.job, d.ref, d.code, ctx || ''].join('|');
    const fam = P.REASON[d.code] ? P.REASON[d.code].family : 'waiting';
    return `<span class="reason-wrap"><button class="reason ${fam}" aria-expanded="false" aria-controls="${id}"
      aria-label="${esc(reasonLabel(d))}"
      onclick="event.stopPropagation();const p=document.getElementById('${id}');const open=p.hidden;p.hidden=!open;this.setAttribute('aria-expanded',open)"
      title="${esc(reasonLabel(d))}">${fam === 'waiting' ? '…' : '∅'}</button>
      <span id="${id}" hidden data-fold="${esc(key)}" class="reason-detail"><b>${esc(reasonLabel(d))}</b> — ${esc(d.text)}${ctx ? ' · ' + esc(ctx) : ''}</span></span>`;
  };

  // per-job dot for a (pipeline, job, ref) cell
  VIEWS.jobDot = function (pl, job, ref) {
    const c = P.jobCell(pl, job, ref);
    if (c.kind === 'build') {
      const s = c.status;
      return `<a class="dot ${s === 'started' ? 'pulse' : ''}" href="#/b/${c.build.id}"
        title="${esc(job)}: ${st(s).label}" style="background:${st(s).color}">${st(s).sym}</a>`;
    }
    if (c.kind === 'decision') return `<span class="dot none" title="${esc(job)}">${VIEWS.reasonChip(c.decision, job)}</span>`;
    return `<span class="dot none" title="${esc(job)}: no build">·</span>`;
  };

  // ---------- Home ----------------------------------------------------------
  VIEWS.home = function () {
    const { items, notShown } = P.attention();
    const strip = items.length ? `<section class="strip" aria-label="needs attention">
      ${items.map(t => `<div class="strip-row ${t.cls}">
        <span class="strip-icon" aria-hidden="true">${t.icon}</span>
        <div class="strip-body">
          <div>${esc(t.text)}</div>
          ${t.sub ? `<div class="mut small">${esc(t.sub)}</div>` : ''}
        </div>
        <div class="strip-actions">
          ${t.actions.map(a => a.href
      ? `<a class="btn sm" href="${a.href}">${esc(a.label)}</a>`
      : `<button class="btn sm ${a.primary ? 'primary' : ''} ${a.danger ? 'danger' : ''}" data-act="${a.act}" data-arg="${esc(a.arg)}">${esc(a.label)}</button>`).join('')}
          <button class="ghost sm" data-act="snooze" data-arg="${esc(t.key)}" title="snooze (session)">–</button>
        </div>
      </div>`).join('')}
    </section>` : `<div class="allclear">✓ Nothing needs you — all green.</div>`;

    const card = pl => {
      const s = P.primaryStatus(pl);
      const isPR = pl.primaryContext.kind === 'lineages';
      const counts = isPR ? P.secondaryCounts(pl) : null;
      const lastB = D().builds.filter(b => b.pipeline === pl.name).sort((a, b) => b.start - a.start)[0];
      return `<a class="card" href="#/p/${pl.name}/graph" style="--card:${isPR ? 'var(--mut3)' : st(s).color}">
        <div class="card-head"><b>${esc(pl.name)}</b><span class="mut small">${esc(pl.team)}</span>
          <span class="sp"></span>
          ${isPR
          ? `<span class="mut small">${counts.failing ? `<b class="c-fail">${counts.failing} failing</b> · ` : ''}${counts.held ? `${counts.held} held · ` : ''}${counts.running ? `${counts.running} running` : 'per-PR status'}</span>`
          : `<span class="c-${s} ${s === 'started' ? 'pulse' : ''}">${st(s).sym}</span>`}
        </div>
        <div class="mut small">${esc(pl.desc)}</div>
        <div class="card-foot mut small" data-live>
          ${pl.paused ? '❚❚ paused · ' : ''}${pl.primaryContext.kind !== 'lineages' ? esc(pl.primaryContext.label) + ' · ' : ''}${lastB ? '#' + lastB.n + ' · ' + ago(lastB.start) : 'no builds'}
        </div>
      </a>`;
    };
    const pls = P.pipelines();
    // all-teams at company scale: group the wall by team (dropdown scopes it)
    const cards = (!P.team() && pls.length > 9)
      ? D().teams.map(t => {
        const g = pls.filter(p => p.team === t.name);
        return g.length ? `<h2 class="team-head">${esc(t.name)} <span class="mut small">${g.length} pipeline${g.length > 1 ? 's' : ''}</span></h2><div class="cards">${g.map(card).join('')}</div>` : '';
      }).join('')
      : `<div class="cards">${pls.map(card).join('')}</div>`;

    return `<div class="page">
      ${strip}
      ${notShown.length ? `<div class="not-shown">▸ ${notShown.length} failing PR${notShown.length > 1 ? 's' : ''} not shown here: ${notShown.slice(0, 3).map(l => `<a href="#/changes/pr/${l.n}">#${l.n}</a> (${esc(l.author)}${l.draft ? ', draft' : ''})`).join(', ')}${notShown.length > 3 ? ` and <a href="#/changes/open">${notShown.length - 3} more</a>` : ''} — their failure, their inbox.</div>` : ''}
      ${cards}
    </div>`;
  };

  // ---------- Changes: dense table (built for 100s of open PRs) -------------
  let chgFilter = '', chgChip = 'all', chgBots = true;
  window._chgF = v => { chgFilter = v; P.App.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._chgC = c => { chgChip = c; P.App.refresh(); };
  window._chgB = () => { chgBots = !chgBots; P.App.refresh(); };

  VIEWS.dotStatic = function (status, job) {
    if (status === 'none') return `<span class="dot sm none" title="${esc(job)}">·</span>`;
    return `<span class="dot sm ${status === 'started' ? 'pulse' : ''}" title="${esc(job)}: ${st(status).label}" style="background:${st(status).color}">${st(status).sym}</span>`;
  };

  VIEWS.changes = function (tab, prN) {
    tab = tab || 'open';
    if (tab === 'pr' && prN) return VIEWS.prDetail(+prN);
    const T = (k, lbl) => `<a class="tab ${tab === k ? 'on' : ''}" href="#/changes/${k}">${lbl}</a>`;
    let body = '';

    if (tab === 'mine' || tab === 'open') {
      // aggregates every PR pipeline in scope — 50 repos with their own
      // lint/verify pipelines land in ONE inbox, scoped by the team dropdown
      let ls = P.lineages().filter(l => tab === 'open' || P.mine(l));
      const total = ls.length;
      if (!chgBots) ls = ls.filter(l => !l.bot);
      const held = l => !l.summary && D().builds.some(b => b.heldReason && Object.values(b.intent.versions)[0] === P.lineageHead(l).id.ref);
      if (chgChip === 'failing') ls = ls.filter(l => P.lineageStatus(l) === 'failed');
      else if (chgChip === 'running') ls = ls.filter(l => ['started', 'pending'].includes(P.lineageStatus(l)));
      else if (chgChip === 'held') ls = ls.filter(held);
      else if (chgChip === 'drafts') ls = ls.filter(l => l.draft);
      if (chgFilter) {
        const q = chgFilter.toLowerCase();
        ls = ls.filter(l => (l.n + ' ' + l.title + ' ' + l.author + ' ' + l.branch + ' ' + (l.pl || 'pikoci-pr')).toLowerCase().includes(q));
      }
      ls.sort((a, b) => (P.mine(b) ? 1 : 0) - (P.mine(a) ? 1 : 0) || b.updated - a.updated);
      const shown = ls.slice(0, 200);
      const chip = (k, lbl) => `<button class="chip-btn ${chgChip === k ? 'on' : ''}" onclick="_chgC('${k}')">${lbl}</button>`;
      body = `
      <div class="ctoolbar">
        <input data-filter aria-label="filter changes" placeholder="filter #, title, author, branch, repo…  ( / )" value="${esc(chgFilter)}" oninput="_chgF(this.value)">
        ${chip('all', 'all')}${chip('failing', '✕ failing')}${chip('running', '● running')}${chip('held', '⛔ held')}${chip('drafts', 'drafts')}
        <label class="small mut"><input type="checkbox" ${chgBots ? 'checked' : ''} onchange="_chgB()"> bots</label>
        <span class="sp"></span>
        <span class="mut small">${shown.length}${ls.length > 200 ? ' of ' + ls.length : ''} shown · ${total} open${P.team() ? ' in ' + esc(P.team()) : ''}</span>
      </div>
      <div class="tbl-scroll"><table class="tbl ctbl fixed">
        <colgroup><col style="width:30px"><col><col style="width:92px"><col style="width:114px"><col style="width:188px"><col style="width:132px"><col style="width:84px"></colgroup>
        <thead><tr><th></th><th>PR</th><th>repo</th><th>author</th><th>branch @ head</th><th class="r">checks</th><th class="r">updated</th></tr></thead>
        <tbody>
        ${shown.map(l => {
        const lpl = P.lineagePl(l);
        const jobNames = lpl.jobs.map(j => j.name);
        const head = P.lineageHead(l);
        const s = P.lineageStatus(l);
        const isHeld = held(l);
        const old = l.changes.filter(c => c.superseded).length;
        return `<tr class="${P.mine(l) ? 'mine-row' : ''}" onclick="location.hash='#/changes/pr/${l.n}'">
          <td class="c-${isHeld ? 'held' : s} ${s === 'started' ? 'pulse' : ''}">${isHeld ? '⛔' : st(s).sym}</td>
          <td class="ct-title" title="${esc(l.title)}"><div class="ctt">
            <a class="row-link" href="#/changes/pr/${l.n}"><b>#${l.n}</b> ${esc(l.title)}</a>
            ${l.draft ? '<span class="chip">draft</span>' : ''}${l.fork ? '<span class="chip">fork</span>' : ''}
            ${isHeld ? '<span class="badge held-badge">held</span>' : ''}
            ${old ? `<span class="chip" title="superseded commits — builds auto-cancelled within this lineage">+${old} superseded</span>` : ''}
            ${l.forge ? `<a class="mut small" href="${esc(l.forge.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="open on ${esc(l.forge.kind)}">↗</a>` : ''}</div></td>
          <td class="mut small nowrap" title="${esc(lpl.team)}/${esc(lpl.name)}">${esc(lpl.name.replace(/-pr$/, ''))}</td>
          <td class="mut nowrap">${P.mine(l) ? `<span class="you-mark" title="your PR" aria-label="your PR">★</span> ` : ''}${esc(l.author)}</td>
          <td class="nowrap"><code class="trunc-code" title="${esc(l.branch)}">${esc(l.branch)}</code> <code>${esc(head.id.ref)}</code></td>
          <td class="r nowrap"><span class="dots" onclick="event.stopPropagation()">
            ${l.summary ? l.summary.map((sst, i) => VIEWS.dotStatic(sst, jobNames[i] || 'check')).join('')
          : lpl.jobs.map(j => VIEWS.jobDot(lpl, j.name, head.id.ref)).join('')}</span></td>
          <td class="mut small r nowrap">${ago(l.updated)}</td>
        </tr>`;
      }).join('')}
        </tbody>
      </table></div>`;
    } else if (tab === 'trunk') {
      const pl = P.getPipeline('pikoci');
      if (!P.inTeam(pl)) return `<div class="page">
        <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('trunk', 'Trunk')}${T('scheduled', 'Scheduled')}</div>
        <div class="mut pad">Trunk feeds follow each team's branch pipelines — the demo dataset only carries commit-level trunk data for <b>main/pikoci</b>. Pick “all teams” or “main” in the top bar.</div></div>`;
      body = `<div class="tbl-scroll"><table class="tbl ctbl">
        <thead><tr><th></th><th>commit</th><th>author</th><th class="r">checks</th><th class="r">when</th></tr></thead><tbody>
        ${pl.resources[0].versions.map(v => {
        let worst = 'none';
        for (const j of pl.jobs) {
          const c = P.jobCell(pl, j.name, v.id.ref);
          if (c.kind === 'build' && P.RANK[c.status] < P.RANK[worst]) worst = c.status;
        }
        return `<tr>
          <td class="c-${worst} ${worst === 'started' ? 'pulse' : ''}">${st(worst).sym}</td>
          <td class="ct-title" title="${esc(v.meta.msg || '')}"><div class="ctt"><code>${esc(v.id.ref)}</code><span class="shrink">${esc(v.meta.msg || '')}</span></div></td>
          <td class="mut nowrap">${esc(v.meta.author || '')}</td>
          <td class="r nowrap"><span class="dots">${pl.jobs.filter(j => !j.cadence).map(j => VIEWS.jobDot(pl, j.name, v.id.ref)).join('')}</span></td>
          <td class="mut small r nowrap">${ago(v.meta.at)}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    } else if (tab === 'scheduled') {
      const pl = P.getPipeline('hello-world');
      if (!P.inTeam(pl)) return `<div class="page">
        <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('trunk', 'Trunk')}${T('scheduled', 'Scheduled')}</div>
        <div class="mut pad">Scheduled ticks in the demo dataset live in <b>oss/hello-world</b>. Pick “all teams” or “oss” in the top bar.</div></div>`;
      body = `<div class="tbl-scroll"><table class="tbl ctbl"><tbody>
        ${pl.resources[0].versions.concat([{ id: { ref: 'tick-208' }, meta: { at: D().now - 30 * 60e3 } }]).map(v => `<tr>
          <td>⏱</td><td class="ct-title"><div class="ctt"><code>${esc(v.id.ref)}</code><span class="mut shrink">cron.every-10m · oss/hello-world</span></div></td>
          <td></td><td class="r"><span class="dots">${VIEWS.jobDot(pl, 'gen', v.id.ref)}</span></td>
          <td class="mut small r nowrap">${ago(v.meta.at)}</td></tr>`).join('')}
      </tbody></table></div>`;
    }

    return `<div class="page">
      <div class="tabs">${T('mine', 'Mine')}${T('open', 'Open PRs')}${T('trunk', 'Trunk')}${T('scheduled', 'Scheduled')}</div>
      ${body || '<div class="mut pad">No changes match. Clear the filter or switch tabs.</div>'}
    </div>`;
  };

  // ---------- PR detail: verdict → evidence → anatomy -----------------------
  // One reading order. The verdict says what's blocking and shows the error
  // right here; the merged timeline is the single anatomy view (table + time
  // + dependencies in one artifact); the graph is a fold-out for deep DAGs.
  function prVerdict(l, pl, head, held) {
    const ref = head.id.ref;
    const jobs = pl.jobs.filter(j => !j.cadence);
    const cells = jobs.map(j => ({ j, c: P.jobCell(pl, j.name, ref) }));
    if (held) return `<div class="verdict held">
      <div class="v-head">⛔ <b>Held — fork PR.</b> CI won't run with secrets until a maintainer releases it (pr_hold = "forks"); the forge shows "pending — awaiting maintainer".
        <span class="sp"></span><button class="btn primary sm" data-act="release" data-arg="${held.id}">▶ Release (run CI, no secrets)</button></div>
    </div>`;
    const fb = cells.find(x => x.c.kind === 'build' && x.c.status === 'failed');
    if (fb) {
      const b = fb.c.build;
      const errLines = [];
      for (const sp of b.steps) for (const ln of sp.log) if (/FAIL|ERROR|Error /.test(ln)) errLines.push(ln);
      const cmp = P.compareWithLastGreen(b);
      const blocked = cells.filter(x => x.c.kind === 'decision' && x.c.decision.code === 'upstream').map(x => x.j.name);
      return `<div class="verdict fail">
        <div class="v-head">✕ <b>${esc(b.job)} failed</b> on <code>${esc(ref)}</code>
          <span class="sp"></span>
          <a class="btn sm" href="#/b/${b.id}">Full log</a>
          <button class="btn sm primary" data-act="retry" data-arg="${b.id}">↻ Retry</button></div>
        ${errLines.length ? `<pre class="log excerpt">${errLines.slice(0, 3).map(x => `<span class="l-err">${esc(x)}</span>`).join('\n')}</pre>` : ''}
        ${b.tests ? (() => { const ts = P.testStats(b); const nw = b.tests.filter(t => t.s === 'fail' && P.isNewFailure(pl, b.job, b, t.id)).length; return `<div class="small">checks: ${ts.pass} passed · <b class="c-failed">${ts.fail} failed</b>${nw ? ` <b class="c-failed">(${nw} new)</b>` : ' (all known)'} — <a href="#/b/${b.id}">details</a></div>`; })() : ''}
        <div class="mut small">${blocked.length ? `<b>${blocked.join(', ')}</b> won't start until it passes · ` : ''}${cmp ? (cmp.diffs.length
          ? `since last green (#${cmp.green.n}, ${ago(cmp.green.start)}): ${cmp.diffs.map(d => `<code>${esc(d.from)}</code>→<code>${esc(d.to)}</code>${d.toMeta.msg ? ` — "${esc(d.toMeta.msg)}"` : ''}`).join(' · ')}`
          : 'same input versions as last green — suspect environment or flake, not this change') : 'no earlier green run of this job to compare against'}</div>
      </div>`;
    }
    const running = cells.filter(x => x.c.kind === 'build' && ['started', 'pending'].includes(x.c.build.status));
    if (running.length) {
      const done = cells.filter(x => x.c.kind === 'build' && x.c.build.end).length;
      return `<div class="verdict run" data-live>● <b>Checks running</b> — ${done} of ${cells.length} finished ·
        ${running.map(x => `${esc(x.j.name)} ${x.c.build.status === 'pending' ? '(queued)' : fmtDur(bDur(x.c.build)) + ' in'}`).join(' · ')}</div>`;
    }
    const withB = cells.filter(x => x.c.kind === 'build');
    if (withB.length && withB.every(x => x.c.status === 'succeeded') && withB.length === cells.length)
      return `<div class="verdict ok">✓ <b>All ${cells.length} checks passed</b> on <code>${esc(ref)}</code>.</div>`;
    if (!withB.length) {
      if (l.summary) return `<div class="verdict none">Checks for this change ran on its forge — this demo lineage carries only a summary. Status: <span class="c-${P.lineageStatus(l)}">${st(P.lineageStatus(l)).label}</span>.</div>`;
      return `<div class="verdict run">· Checks haven't started for <code>${esc(ref)}</code> yet.</div>`;
    }
    return `<div class="verdict run">
      · <b>${withB.filter(x => x.c.status === 'succeeded').length} of ${cells.length} checks green</b> —
      ${cells.filter(x => x.c.kind !== 'build').map(x => `${esc(x.j.name)}: ${x.c.kind === 'decision' ? esc(reasonLabel(x.c.decision)) : 'not started'}`).join(' · ')}</div>`;
  }

  VIEWS.prDetail = function (n) {
    const l = D().lineages.find(x => x.n === n);
    if (!l) return '<div class="page">PR not found</div>';
    const pl = P.lineagePl(l);
    const head = P.lineageHead(l);
    const held = D().builds.find(b => b.heldReason && Object.values(b.intent.versions)[0] === head.id.ref);
    const s = P.lineageStatus(l);
    const arts = D().builds.filter(b => b.pipeline === pl.name && Object.values(b.intent.versions)[0] === head.id.ref && b.artifacts);
    return `<div class="page b2-page">
      <div class="crumbs"><a href="#/changes">changes</a> / <b>#${l.n} ${esc(l.title)}</b>
        <span class="c-${held ? 'held' : s}">${held ? '⛔ held' : st(s).sym + ' ' + st(s).label}</span>
        ${l.draft ? '<span class="chip">draft</span>' : ''}${l.fork ? '<span class="chip">fork</span>' : ''}
        <span class="mut small">${esc(l.author)} · <code>${esc(l.branch)}</code> · <a href="#/p/${esc(pl.name)}/graph">${esc(pl.team)}/${esc(pl.name)}</a></span>
        ${l.forge ? `<a class="forge-link" href="${esc(l.forge.url)}" target="_blank" rel="noopener" title="${esc(l.forge.url)}">${esc(l.forge.kind)} ↗</a>` : ''}</div>
      <div class="ctx-banner">viewing checks for
        ${l.changes.map(c => `<span class="commit-chip ${c.id.ref === head.id.ref ? 'on' : ''} ${c.superseded ? 'sup' : ''}">${esc(c.id.ref)}${c.superseded ? ' (superseded)' : ''}</span>`).join('')}
        — every row below is scoped to this one commit</div>
      ${prVerdict(l, pl, head, held)}
      ${l.summary && !D().builds.some(b => b.pipeline === pl.name && Object.values(b.intent.versions)[0] === head.id.ref)
        ? `<div class="tbl-scroll"><table class="tbl ctbl">${pl.jobs.filter(j => !j.cadence).map((j, i) => `<tr>
            <td width="26">${VIEWS.dotStatic(l.summary[i] || 'none', j.name)}</td>
            <td><b>${esc(j.name)}</b></td>
            <td class="mut small r">${st(l.summary[i] || 'none').label}</td>
          </tr>`).join('')}</table></div>`
        : VIEWS.runTimeline(pl, head.id.ref)}
      ${arts.length ? `<h3>Artifacts <span class="mut small">— produced by this commit's builds</span></h3>
        <div class="tbl-scroll"><table class="tbl ctbl wtbl">${arts.flatMap(b => b.artifacts.map(a => `<tr>
          <td class="nowrap">📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a></td>
          <td class="mut small nowrap">${esc(a.size)}</td>
          <td class="mut small">from <a href="#/b/${b.id}">${esc(b.job)} #${b.n}</a></td>
          <td class="mut small r">worker-local · retention pending</td>
        </tr>`)).join('')}</table></div>` : ''}
      <details class="b2-det inline-det" data-det="prg:${l.n}" open><summary>pipeline graph</summary>
        ${VIEWS.runGraph(pl, head.id.ref)}</details>
      ${l.changes.filter(c => c.superseded).length ? `<h3>Superseded commits</h3>
        ${l.changes.filter(c => c.superseded).map(c => `<div class="mut small pad-s"><code>${esc(c.id.ref)}</code> ${esc(c.meta.msg)} — builds auto-cancelled on push (supersession is scoped to this lineage only)</div>`).join('')}` : ''}
    </div>`;
  };

  // ---------- mini run graph (per-commit): label + timing only --------------
  VIEWS.runGraph = function (pl, ref) {
    // jobs only, layered by passed-constraints; no build numbers, no resources
    const depth = {};
    const jd = name => {
      if (depth[name] != null) return depth[name];
      depth[name] = 0;
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of j.inputs || []) for (const p of inp.passed || []) d = Math.max(d, jd(p) + 1);
      return (depth[name] = d);
    };
    const jobs = pl.jobs.filter(j => !j.cadence);
    jobs.forEach(j => jd(j.name));
    const nodeW = 122, nodeH = 36, gapX = 56, gapY = 12, pad = 10;
    const maxD = Math.max(0, ...jobs.map(j => depth[j.name]));
    const pos = {}; let maxH = 0;
    for (let d = 0; d <= maxD; d++) {
      const col = jobs.filter(j => depth[j.name] === d);
      let y = pad;
      col.forEach(j => { pos[j.name] = { x: pad + d * (nodeW + gapX), y }; y += nodeH + gapY; });
      maxH = Math.max(maxH, y);
    }
    for (let d = 0; d <= maxD; d++) { // center columns
      const col = jobs.filter(j => depth[j.name] === d).map(j => pos[j.name]);
      if (!col.length) continue;
      const used = col[col.length - 1].y + nodeH - pad;
      const off = (maxH - pad - used) / 2;
      col.forEach(p => p.y += off);
    }
    const W = pad * 2 + (maxD + 1) * nodeW + maxD * gapX, H = maxH + pad;
    let edges = '';
    for (const j of jobs) for (const inp of j.inputs || []) for (const p of inp.passed || []) {
      const a = pos[p], b = pos[j.name];
      if (!a || !b) continue;
      const x1 = a.x + nodeW, y1 = a.y + nodeH / 2, x2 = b.x, y2 = b.y + nodeH / 2, mx = (x1 + x2) / 2;
      edges += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" fill="none" stroke="var(--edge)" stroke-width="1.6"/>`;
    }
    let nodes = '';
    for (const j of jobs) {
      const p = pos[j.name];
      const c = P.jobCell(pl, j.name, ref);
      let timing, fill, click = '';
      if (c.kind === 'build') {
        const s = c.status;
        timing = c.build.end ? fmtDur(bDur(c.build)) : (s === 'held' ? 'held' : c.build.status === 'pending' ? 'queued' : 'running');
        fill = st(s).color;
        click = `onclick="location.hash='#/b/${c.build.id}'"`;
      } else if (c.kind === 'decision') {
        timing = P.REASON[c.decision.code] && P.REASON[c.decision.code].family === 'wont_run' ? "won't run" : 'waiting';
        fill = 'var(--mut3)';
      } else { timing = '—'; fill = 'var(--mut3)'; }
      const pulse = c.kind === 'build' && c.build.status === 'started' ? 'pulse' : '';
      const g = `<g class="gnode ${pulse}">
        <rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="5" fill="${fill}"/>
        <text x="${p.x + 8}" y="${p.y + 15}" class="t-job" style="font-size:11px">${esc(j.name)}</text>
        <text x="${p.x + 8}" y="${p.y + 28}" class="t-sub">${esc(timing)}</text></g>`;
      // real SVG link: focusable, Enter works, exposed to AT (not a mute onclick <g>)
      nodes += c.kind === 'build' ? `<a href="#/b/${c.build.id}" aria-label="${esc(j.name)}: ${esc(timing)}">${g}</a>` : g;
    }
    return `<div class="run-graph" data-live><svg width="${W}" height="${H}" aria-label="run graph">${edges}${nodes}</svg></div>`;
  };

  // ---------- run timeline: checks table + waterfall + DAG in ONE view ------
  // Rows in stage order carry status, name, build link and duration; bars sit
  // between them on a shared time scale; dependency connectors encode the DAG.
  VIEWS.runTimeline = function (pl, ref) {
    const depth = {};
    const jd = name => {
      if (depth[name] != null) return depth[name];
      depth[name] = 0;
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of j.inputs || []) for (const p of inp.passed || []) d = Math.max(d, jd(p) + 1);
      return (depth[name] = d);
    };
    const jobs = pl.jobs.filter(j => !j.cadence);
    jobs.forEach(j => jd(j.name));
    jobs.sort((a, b) => depth[a.name] - depth[b.name] || a.name.localeCompare(b.name));
    const cells = jobs.map(j => ({ j, c: P.jobCell(pl, j.name, ref) }));
    const timed = cells.filter(x => x.c.kind === 'build' && x.c.build.start && (x.c.build.end || x.c.build.status === 'started'));
    if (!cells.some(x => x.c.kind !== 'none')) return '<div class="mut pad">No runs recorded for this commit in the demo dataset.</div>';
    const t0 = timed.length ? Math.min(...timed.map(x => x.c.build.start)) : 0;
    const t1 = timed.length ? Math.max(...timed.map(x => x.c.build.end || Date.now())) : 1;
    const span = Math.max(t1 - t0, 1000);
    const wall = span / 1000;
    const busy = timed.reduce((a, x) => a + ((x.c.build.end || Date.now()) - x.c.build.start) / 1000, 0);
    const ladder = [60, 300, 600, 900, 1800, 3600, 7200]; // 1m 5m 10m 15m 30m 1h 2h
    const step = ladder.find(s => wall / s <= 8) || 7200;
    const ticks = [];
    for (let t = step; t < wall; t += step) ticks.push(t);
    const gridLines = ticks.map(t => `<i class="wf-grid" style="left:${t / wall * 100}%"></i>`).join('');
    const leftOf = b => (b.start - t0) / span * 100;
    const endOf = b => ((b.end || Date.now()) - t0) / span * 100;
    // dependency connectors: vertical line at downstream start, from upstream row to downstream row
    const rowIdx = {}; cells.forEach((x, i) => rowIdx[x.j.name] = i);
    const axisH = 18, rowH = 28;
    let deps = '';
    for (const x of cells) {
      for (const inp of x.j.inputs || []) for (const up of inp.passed || []) {
        const upC = cells[rowIdx[up]];
        if (!upC || upC.c.kind !== 'build' || !upC.c.build.end) continue;
        const xPct = x.c.kind === 'build' && x.c.build.start ? leftOf(x.c.build) : endOf(upC.c.build);
        const y1 = axisH + rowIdx[up] * rowH + rowH / 2;
        const y2 = axisH + rowIdx[x.j.name] * rowH + rowH / 2;
        deps += `<i class="wf-dep" style="left:${xPct}%;top:${Math.min(y1, y2)}px;height:${Math.abs(y2 - y1)}px" title="${esc(x.j.name)} needs ${esc(up)}"></i>`;
      }
    }
    return `<div class="wf" data-live>
      <div class="wf-row wf-axis"><div class="wf-lbl"></div>
        <div class="wf-lane">${ticks.map(t => `<span class="wf-tick" style="left:${t / wall * 100}%">${fmtDur(t)}</span>`).join('')}</div></div>
      <div class="wf-body">
      <div class="wf-deps">${deps}</div>
      ${cells.map(x => {
      const { j, c } = x;
      const name = `<span class="wf-name" ${j.group ? `title="matrix group: ${esc(j.group)}"` : ''}>${esc(j.name)}</span>`;
      if (c.kind === 'build') {
        const b = c.build, s = c.status;
        const hasBar = b.start && (b.end || b.status === 'started');
        const tail = b.end ? fmtDur(bDur(b)) : (s === 'held' ? 'held' : b.status === 'pending' ? 'queued' : fmtDur(bDur(b)) + '…');
        return `<div class="wf-row">
          <div class="wf-lbl click" onclick="location.hash='#/b/${b.id}'" title="open ${esc(j.name)} #${b.n}"><span class="c-${s} ${b.status === 'started' ? 'pulse' : ''}">${st(s).sym}</span>${name}
            <a class="wf-n small" href="#/b/${b.id}" onclick="event.stopPropagation()">#${b.n}</a>
            <span class="wf-d mut small">${esc(tail)}</span></div>
          <div class="wf-lane">${gridLines}${hasBar ? `<div class="wf-bar ${b.status === 'started' ? 'pulse' : ''}"
            style="left:${leftOf(b)}%;width:${Math.max(endOf(b) - leftOf(b), 1)}%;background:${st(s).color}"
            onclick="location.hash='#/b/${b.id}'" title="${esc(j.name)} #${b.n}: ${st(s).label}"></div>`
          : `<span class="wf-ghost" style="left:2%">${s === 'held' ? '⛔ held — awaiting maintainer' : b.queue ? (b.queue.matching === 0 ? `queued — no worker with tag "${esc(b.queue.tag)}"` : `queued — ${b.queue.matching} matching worker, busy`) : 'queued'}</span>`}</div>
        </div>`;
      }
      const ghostX = (j.inputs || []).flatMap(i => i.passed || []).map(up => cells[rowIdx[up]])
        .filter(u => u && u.c.kind === 'build' && u.c.build.end).map(u => endOf(u.c.build));
      return `<div class="wf-row">
        <div class="wf-lbl"><span class="mut">·</span>${name}</div>
        <div class="wf-lane">${gridLines}<span class="wf-ghost" style="left:${ghostX.length ? Math.min(Math.max(...ghostX), 78).toFixed(1) : 2}%">
          ${c.kind === 'decision' ? `${P.REASON[c.decision.code] && P.REASON[c.decision.code].family === 'wont_run' ? '∅' : '…'} ${esc(reasonLabel(c.decision))}` : 'no build'}</span></div>
      </div>`;
    }).join('')}
      </div>
      ${timed.length ? `<div class="mut small wf-note">wall clock <b>${fmtDur(wall)}</b> · job time <b>${fmtDur(busy)}</b> · vertical lines mark dependencies</div>` : ''}
    </div>`;
  };

  // ---------- Environments --------------------------------------------------
  let envFilter = '', envChip = 'all';
  window._envF = v => { envFilter = v; P.App.refresh(); const f = document.querySelector('[data-filter]'); if (f) { f.focus(); f.setSelectionRange(999, 999); } };
  window._envC = c => { envChip = c; P.App.refresh(); };

  VIEWS.environments = function (name) {
    if (name) return VIEWS.envDetail(name);
    let envs = D().environments.filter(e => !P.team() || e.pipeline.split('/')[0] === P.team());
    const total = envs.length;
    // attention first: drift, then verifying, then quiet greens (newest deploy first)
    const order = e => e.drift ? 0 : !e.verified ? 1 : 2;
    const attn = envs.filter(e => order(e) < 2).length;
    if (envChip === 'attention') envs = envs.filter(e => order(e) < 2);
    else if (envChip === 'drift') envs = envs.filter(e => e.drift);
    else if (envChip === 'verifying') envs = envs.filter(e => !e.verified);
    if (envFilter) {
      const q = envFilter.toLowerCase();
      envs = envs.filter(e => (e.name + ' ' + e.pipeline + ' ' + e.version + ' ' + e.by).toLowerCase().includes(q));
    }
    const sorted = g => g.slice().sort((a, b) => order(a) - order(b) || b.deployedAt - a.deployedAt);
    const chip = (k, lbl) => `<button class="chip-btn ${envChip === k ? 'on' : ''}" onclick="_envC('${k}')">${lbl}</button>`;
    const row = e => `<tr onclick="location.hash='#/environments/${encodeURIComponent(e.name)}'">
          <td>${e.drift ? '<span class="c-failed" title="live version was not deployed by CI">⚠</span>' : e.verified ? '<span class="c-succeeded">✓</span>' : '<span class="c-started pulse">●</span>'}</td>
          <td class="ct-title"><div class="ctt"><a class="row-link" href="#/environments/${encodeURIComponent(e.name)}"><b>${esc(e.name)}</b></a>
            ${e.drift ? '<span class="badge held-badge">drift</span>' : ''}${e.verified ? '' : '<span class="chip">verifying…</span>'}</div></td>
          <td class="mut small nowrap">${esc(e.pipeline)} · ${esc(e.job)}</td>
          <td><code>${esc(e.version)}</code></td>
          <td class="mut small nowrap">${ago(e.deployedAt)} · ${esc(e.byBuild)} (${esc(e.by)})</td>
          <td class="r nowrap"><button class="btn sm" data-act="rollback" data-arg="${esc(e.name)}" onclick="event.stopPropagation()">↩ Rollback…</button></td>
        </tr>`;
    // same grouping as the Pipelines table: team subheads at all-teams scale
    const grouped = !P.team() && envs.length > 9;
    const rows = grouped
      ? D().teams.map(t => {
        const g = sorted(envs.filter(e => e.pipeline.split('/')[0] === t.name));
        return g.length ? `<tr class="tsub"><td colspan="6">${esc(t.name)} <span class="mut">· ${g.length}</span></td></tr>${g.map(row).join('')}` : '';
      }).join('')
      : sorted(envs).map(row).join('');
    return `<div class="page"><h1>Environments <span class="mut small">${total}${P.team() ? ' · team ' + esc(P.team()) : ''}</span></h1>
      <div class="ctoolbar">
        <input data-filter aria-label="filter environments" placeholder="filter name, pipeline, version…  ( / )" value="${esc(envFilter)}" oninput="_envF(this.value)">
        ${chip('all', 'all')}${chip('attention', `⚠ needs attention${attn ? ' · ' + attn : ''}`)}${chip('drift', '⚠ drift')}${chip('verifying', '● verifying')}
        <span class="sp"></span>
        <span class="mut small">${envs.length} of ${total}</span>
      </div>
      ${envs.length ? '' : (total ? '<div class="mut pad">Nothing matches this filter.</div>' : `<div class="mut pad">No environments declared by team ${esc(P.team())}'s pipelines.</div>`)}
      <div class="tbl-scroll"><table class="tbl ctbl">
        <thead><tr><th></th><th>environment</th><th>pipeline</th><th>live version</th><th>deployed</th><th class="r"></th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
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
        <div class="tbl-scroll"><table class="tbl ctbl">
        ${e.history.map((h, i) => `<tr>
          <td width="24">${h.ok ? '<span class="c-succeeded">✓</span>' : '<span class="c-failed">✕</span>'}</td>
          <td><code>${esc(h.version)}</code>${i === 0 ? ' <span class="chip">live</span>' : ''}</td>
          <td class="mut small">${esc(h.build)}</td>
          <td class="mut small nowrap r">${ago(h.at)}</td>
          <td class="r">${i > 0 ? `<button class="btn sm" data-act="rollback" data-arg="${esc(e.name)}">↩ Roll back to this</button>` : ''}</td>
        </tr>`).join('')}
        </table></div></section>
    </div>`;
  };

  // ---------- gated-off teaching empty states -------------------------------
  VIEWS.gated = function (id) {
    const g = P.gatedEmpty[id];
    if (!g) return '<div class="page">Not found</div>';
    return `<div class="page narrow"><div class="empty">
      <h1>${esc(g[0])}</h1><p class="mut">${esc(g[1])}</p>
      <p><a href="#/">← Home</a></p>
    </div></div>`;
  };
})();
