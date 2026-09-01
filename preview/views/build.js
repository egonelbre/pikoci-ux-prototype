// The build page: error first, then provenance, then the steps. Two panes —
// what happened on the left, the log on the right.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago, bDur } = PK.fmt;
  const { st } = PK.status;
  const { layers } = PK.graph;
  const D = () => window.DATA;

  // ---------- Build page v3: two-pane run view ------------------------------
  // Sidebar keeps the whole run's stages AND the current build's steps on
  // hand; the log pane gets the rest of the viewport (logs can be 40MB —
  // finding a step must not mean scrolling through them blind).
  VIEWS.build = function (id) {
    const b = PK.model.getBuild(id);
    if (!b) return '<div class="page">Build not found</div>';
    const pl = PK.model.getPipeline(b.pipeline);
    const s = PK.status.bStatus(b);
    const ref = Object.values(b.intent.versions)[0];
    const vm = PK.model.vmeta(pl, ref);
    const failIdx = PK.model.firstFailStep(b);
    // waiting builds included: the approval card's "diff since last deploy"
    // link needs a cmpbox to reveal (it used to point at nothing)
    const cmp = ['failed', 'succeeded', 'warning', 'waiting_for_approval'].includes(b.status) ? PK.model.compareWithLastGreen(b) : null;
    const cmpHidden = b.status === 'waiting_for_approval';
    const history = PK.model.jobBuilds(pl, b.job).slice(0, 8);
    const stall = PK.fmt.lastOutputAge(b);
    const j = pl.jobs.find(x => x.name === b.job);
    const newerExists = b.status === 'waiting_for_approval' && pl.resources[0].versions[0] && pl.resources[0].versions[0].id.ref !== ref;
    // PR-triggered build → the change it belongs to (for the way back up)
    const lin = pl.primaryContext.kind === 'lineages'
      ? D().lineages.find(l => (l.pl || 'pikoci-pr') === pl.name && l.changes.some(c => c.id.ref === ref)) : null;

    const actions = [];
    if (b.status === 'waiting_for_approval') actions.push(
      `<button class="btn primary" data-act="approve" data-arg="${b.id}">✓ Approve</button>`,
      `<button class="btn danger" data-act="rejectask" data-arg="${b.id}">✕ Reject…</button>`);
    if (s === 'held') actions.push(`<button class="btn primary" data-act="release" data-arg="${b.id}">▶ Release</button>`);
    if (['started', 'pending'].includes(b.status) && s !== 'held') actions.push(`<button class="btn" data-act="cancel" data-arg="${b.id}">Cancel</button>`);
    if (['failed', 'succeeded', 'cancelled', 'warning'].includes(b.status)) actions.push(`<button class="btn" data-act="retry" data-arg="${b.id}">↻ Retry</button>`);

    // --- sidebar: the run's stages (jobs at this ref, DAG order, matrix grouped)
    const depths = layers(pl).depth;
    const runJobs = pl.jobs.filter(PK.model.isRunJob).slice()
      .sort((a, c) => (depths[a.name] - depths[c.name]) || a.name.localeCompare(c.name));
    let sideJobs = '', lastGrp = null;
    for (const jj of runJobs) {
      const g = jj.group || null;
      if (g !== lastGrp) {
        if (g) sideJobs += `<div class="b2-grp">${esc(g)} <span class="mut">(matrix ×${runJobs.filter(x => x.group === g).length})</span></div>`;
        lastGrp = g;
      }
      const label = g ? jj.name.slice(g.length + 2) : jj.name;
      const c = PK.model.jobCell(pl, jj.name, ref);
      if (c.kind === 'build') {
        const cs = c.status;
        sideJobs += `<a class="jrow ${c.build.id === b.id ? 'on' : ''}" href="#/b/${c.build.id}">
          <span class="c-${cs} ${cs === 'started' ? 'pulse' : ''}">${st(cs).sym}</span>
          <span class="jname">${esc(label)}</span>
          <span class="mut small nowrap">${c.build.end ? fmtDur(bDur(c.build)) : st(cs).label}</span></a>`;
      } else if (c.kind === 'decision') {
        sideJobs += `<span class="jrow dim">${VIEWS.reasonChip(c.decision, jj.name)}<span class="jname">${esc(label)}</span></span>`;
      } else {
        sideJobs += `<span class="jrow dim"><span class="mut">·</span><span class="jname">${esc(label)}</span><span class="mut small">no build</span></span>`;
      }
    }

    // --- sidebar: this build's steps — click = expand (if folded) + scroll to it
    const sideSteps = b.steps.map((sp, i) => `<button type="button" class="jrow st"
      onclick="const x=document.getElementById('step-${i}');if(!x)return;const d=x.querySelector('.step-head + div');if(d&&d.hidden){d.hidden=false;x.querySelector('.step-head').setAttribute('aria-expanded','true')}x.scrollIntoView({behavior:'smooth'})">
      <span class="c-${sp.status} ${sp.status === 'started' ? 'pulse' : ''}">${st(sp.status).sym}</span>
      <span class="mut small type">${sp.type}</span><span class="jname">${esc(sp.name)}</span>
      <span class="mut small nowrap">${sp.dur ? fmtDur(sp.dur) : ''}</span></button>`).join('')
      || '<div class="jrow dim"><span class="mut small">no steps yet</span></div>';

    return `<div class="page b2-page">
      <div class="crumbs b2-head">
        <span class="c-${s} ${s === 'started' ? 'pulse' : ''} b2-sym">${st(s).sym}</span>
        <div class="b2-titles">
          <div class="b2-title">${esc(vm.meta.msg || b.job + ' #' + b.n)}</div>
          <div class="mut small" data-live><a href="#/p/${b.pipeline}/graph">${esc(b.pipeline)}</a> #${b.n}
            ${lin ? ` · <a href="#/changes/pr/${lin.n}"><b>PR #${lin.n}</b></a>` : ''}
            · <code>${esc(ref)}</code>${vm.meta.author ? ' · ' + esc(vm.meta.author) : ''} · ${ago(b.start)}
            · <span class="c-${s}">${st(s).label}</span> ${fmtDur(bDur(b)) ? '· ' + fmtDur(bDur(b)) : ''}
            · <span title="cause">${esc(b.cause.detail)}</span> · rev ${b.intent.configRev}
            ${b.retryOf ? ` · <span class="chip">retry of ${esc(b.retryOf)}</span>` : ''}
            ${b.queue && s !== 'held' ? ` · <b>${b.queue.matching === 0 ? `no healthy worker with tag "${esc(b.queue.tag)}"` : `${b.queue.matching} matching worker for "${esc(b.queue.tag)}", busy`}</b>` : ''}
            ${s === 'held' ? ' · <b>held: awaiting maintainer release (fork PR)</b>' : ''}
            ${stall != null && stall > 60 ? ` · <b class="c-failed">no output for ${fmtDur(stall)}</b>` : ''}</div>
        </div>
        <span class="sp"></span>${actions.join(' ')}
      </div>

      <div class="b2">
        <aside class="b2-side" id="b2side" data-keep-scroll>
          ${lin ? `<a class="jrow b2-back" href="#/changes/pr/${lin.n}" title="${esc(lin.title)}">
            <span aria-hidden="true">←</span><span class="jname"><b>PR #${lin.n}</b> ${esc(lin.title)}</span></a>` : ''}
          <div class="b2-sec">run · <code>${esc(ref)}</code></div>
          ${sideJobs}
          <div class="b2-sec">steps — ${esc(b.job)}</div>
          ${sideSteps}
          <div class="b2-sec">history — ${esc(b.job)}</div>
          <div class="b2-hist">${history.map(x => `<a class="c-${PK.status.bStatus(x)}" href="#/b/${x.id}" title="${ago(x.start)}" ${x.id === b.id ? 'style="font-weight:700;text-decoration:underline"' : ''}>${st(PK.status.bStatus(x)).sym}#${x.n}</a>`).join(' ')}</div>
          <details class="b2-det" data-det="prov:${b.id}"><summary>provenance</summary>
            intent: ${Object.entries(b.intent.versions).map(([r, v]) => `<code title="${esc(r)}">${esc(v)}</code>`).join(' ')}
            ${b.resolved ? `<br>resolved: ${Object.entries(b.resolved.versions).map(([r, v]) => `<code>${esc(v)}</code>`).join(' ')} on <b>${esc(b.resolved.worker)}</b>` : '<br><i>not yet resolved (pending builds show intent only)</i>'}
            ${vm.meta.msg ? `<br>"${esc(vm.meta.msg)}" (${esc(vm.meta.author || '')})` : ''}
          </details>
          <details class="b2-det" data-det="local:${b.id}"><summary>run locally</summary>
            same job, same config, your working tree:
            <pre class="cmdline">pikoci run -p pipeline.hcl -j ${esc(b.job)} --resource ${esc(Object.keys(b.intent.versions)[0])}=./</pre>
            <button class="btn sm" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.previousElementSibling.textContent);PK.toast('Copied')">copy</button>
          </details>
          <div class="b2-det mut"><span class="kbd">f</span> next failure · <span class="kbd">⌘K</span> actions</div>
        </aside>

        <main class="b2-log" id="logpane" data-keep-scroll ${b.status === 'started' ? 'data-follow' : ''}>
          ${b.status === 'waiting_for_approval' ? `<div class="appr-card">
            <div><b>⧖ ${esc(j.approve.name)}</b> — 1 of ${j.approve.need} approvals</div>
            <div class="mut small">bound to <code>${esc(ref)}</code> @ config rev ${b.intent.configRev} · maria approved ${ago(Date.now() - 12 * 60e3)}
              · <a href="javascript:void(0)" onclick="document.getElementById('cmpbox')&&(document.getElementById('cmpbox').hidden=false)">diff since last deploy</a></div>
            ${newerExists ? `<div class="warn-line">⚠ <b>superseded-while-waiting</b>: trunk has moved past <code>${esc(ref)}</code> — approving deploys the bound version, not the newest.</div>` : ''}
            <div class="mut small">while gated the build holds no worker and nothing has run — on approval it queues, then starts.</div>
            <div class="rejbox" id="rejbox-${b.id}" hidden data-fold="rej:${b.id}">
              <input aria-label="reject reason (required)" placeholder="reason — required, recorded in the audit log">
              <button class="btn danger" data-act="reject" data-arg="${b.id}">✕ Reject build</button>
            </div>
          </div>` : ''}

          ${failIdx >= 0 ? `<div class="err-first">
            <div class="err-head">✕ first failure: ${esc(b.steps[failIdx].name)}
              <a href="javascript:void(0)" onclick="document.getElementById('step-${failIdx}').scrollIntoView({behavior:'smooth'})">jump ↓</a></div>
            <pre class="log excerpt">${b.steps[failIdx].log.filter(l => /FAIL|ERROR|Error /.test(l)).slice(0, 4).map(l => `<span class="l-err">${esc(l)}</span>`).join('\n')}</pre>
          </div>` : ''}

          ${VIEWS.testSection(pl, b)}

          ${cmp ? `<div class="cmp" id="cmpbox" ${cmpHidden ? `hidden data-fold="cmp:${b.id}"` : ''}>
            <b>Compare with last green</b> <span class="mut small">(#${cmp.green.n}, ${ago(cmp.green.start)})</span>
            ${cmp.diffs.length ? cmp.diffs.map(d => `<div class="small">· ${esc(d.res)}: <code>${esc(d.from)}</code> → <code>${esc(d.to)}</code>
              ${d.toMeta.msg ? `— "${esc(d.toMeta.msg)}" (${esc(d.toMeta.author || '')})` : ''}</div>`).join('')
            : '<div class="small mut">· same input versions — look at environment, not code</div>'}
            <div class="small mut">· duration ${cmp.durDelta >= 0 ? '+' : ''}${fmtDur(Math.abs(cmp.durDelta))} vs last green</div>
          </div>` : ''}

          ${!b.steps.length ? `<div class="panel"><div class="pad mut">
            ${s === 'held' ? 'Nothing has run — this build is held awaiting maintainer release; no code or secrets have touched a worker.'
          : b.queue ? `Nothing has run yet — the build is queued (${b.queue.matching === 0 ? `no healthy worker with tag "${esc(b.queue.tag)}"` : `${b.queue.matching} matching worker, busy`}). Output will stream here when a worker picks it up.`
          : 'No output yet — steps will appear when the build starts.'}
          </div></div>` : ''}
          <div id="steps">
          ${b.steps.map((sp, i) => `<div class="step" id="step-${i}">
            <button class="step-head" aria-expanded="${sp.status === 'failed' || sp.status === 'started'}"
              onclick="const x=this.nextElementSibling;x.hidden=!x.hidden;this.setAttribute('aria-expanded',!x.hidden)">
              <span class="c-${sp.status} ${sp.status === 'started' ? 'pulse' : ''}">${st(sp.status).sym}</span>
              <span class="mut small type">${sp.type}</span><b>${esc(sp.name)}</b>
              <span class="sp"></span><span class="mut small">${sp.dur ? fmtDur(sp.dur) : ''}</span>
            </button>
            <div ${sp.status === 'failed' || sp.status === 'started' ? '' : 'hidden'} data-fold="st:${b.id}:${i}">
              ${sp.log.length > 200 ? `<div class="mut small pad-s">showing last 200 of ${sp.log.length} lines · <a href="javascript:void(0)" data-act="noop">download full log</a> <span class="mut">(tail-first)</span></div>` : ''}
              ${sp.log.length ? `<pre class="log">${sp.log.slice(-200).map((l, k) => `<span class="ln"><span class="lno">${Math.max(0, sp.log.length - 200) + k + 1}</span>${/FAIL|ERROR|Error /.test(l) ? `<span class="l-err">${esc(l)}</span>` : /✓|^ok |OK$|PASS/.test(l) ? `<span class="l-ok">${esc(l)}</span>` : /^\$ /.test(l) ? `<span class="l-cmd">${esc(l)}</span>` : esc(l)}</span>`).join('\n')}</pre>` : '<div class="pad-s mut small">no output yet</div>'}
            </div>
          </div>`).join('')}
          </div>
          ${b.artifacts && b.artifacts.length ? `<h3>Outputs</h3>
          <div class="tbl-scroll"><table class="tbl ctbl wtbl">
          ${b.artifacts.map(a => `<tr>
            <td class="nowrap">📦 <a href="javascript:void(0)" data-act="noop" title="download — served from the worker that built it">${esc(a.name)}</a></td>
            <td class="mut small nowrap">${esc(a.size)}</td>
            <td class="mut small nowrap">${a.sha ? `sha256 <code>${esc(a.sha)}…</code>` : ''}</td>
            <td class="mut small">${a.dest ? `→ ${esc(a.dest)}` : '<span class="mut">worker-local · retention pending</span>'}</td>
          </tr>`).join('')}
          </table></div>` : ''}
        </main>
      </div>
    </div>`;
  };
})(window.PK);
