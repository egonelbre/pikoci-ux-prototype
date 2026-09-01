// PR page, verdict first: what is blocking, said in words, with the evidence
// inline — then the anatomy, then superseded pushes below.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago, bDur } = PK.fmt;
  const { st, reasonLabel } = PK.status;
  const D = () => window.DATA;

  // ---------- PR detail: verdict → evidence → anatomy -----------------------
  // One reading order. The verdict says what's blocking and shows the error
  // right here; the merged timeline is the single anatomy view (table + time
  // + dependencies in one artifact); the graph is a fold-out for deep DAGs.
  function prVerdict(l, pl, head, held) {
    const ref = head.id.ref;
    const jobs = pl.jobs.filter(PK.model.isRunJob);
    const cells = jobs.map(j => ({ j, c: PK.model.jobCell(pl, j.name, ref) }));
    if (held) return `<div class="verdict held">
      <div class="v-head">⛔ <b>Held — fork PR.</b> CI won't run with secrets until a maintainer releases it (pr_hold = "forks"); the forge shows "pending — awaiting maintainer".
        <span class="sp"></span><button class="btn primary sm" data-act="release" data-arg="${held.id}">▶ Release (run CI, no secrets)</button></div>
    </div>`;
    const fb = cells.find(x => x.c.kind === 'build' && x.c.status === 'failed');
    if (fb) {
      const b = fb.c.build;
      const errLines = [];
      for (const sp of b.steps) for (const ln of sp.log) if (/FAIL|ERROR|Error /.test(ln)) errLines.push(ln);
      const cmp = PK.model.compareWithLastGreen(b);
      const blocked = cells.filter(x => x.c.kind === 'decision' && x.c.decision.code === 'upstream').map(x => x.j.name);
      return `<div class="verdict fail">
        <div class="v-head">✕ <b>${esc(b.job)} failed</b> on <code>${esc(ref)}</code>
          <span class="sp"></span>
          <a class="btn sm" href="#/b/${b.id}">Full log</a>
          <button class="btn sm primary" data-act="retry" data-arg="${b.id}">↻ Retry</button></div>
        ${errLines.length ? `<pre class="log excerpt">${errLines.slice(0, 3).map(x => `<span class="l-err">${esc(x)}</span>`).join('\n')}</pre>` : ''}
        ${b.tests ? (() => { const ts = PK.model.testStats(b); const nw = b.tests.filter(t => t.s === 'fail' && PK.model.isNewFailure(pl, b.job, b, t.id)).length; return `<div class="small">checks: ${ts.pass} passed · <b class="c-failed">${ts.fail} failed</b>${nw ? ` <b class="c-failed">(${nw} new)</b>` : ' (all known)'} — <a href="#/b/${b.id}">details</a></div>`; })() : ''}
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
      if (l.summary) return `<div class="verdict none">Checks for this change ran on its forge — this demo lineage carries only a summary. Status: <span class="c-${PK.model.lineageStatus(l)}">${st(PK.model.lineageStatus(l)).label}</span>.</div>`;
      return `<div class="verdict run">· Checks haven't started for <code>${esc(ref)}</code> yet.</div>`;
    }
    return `<div class="verdict run">
      · <b>${withB.filter(x => x.c.status === 'succeeded').length} of ${cells.length} checks green</b> —
      ${cells.filter(x => x.c.kind !== 'build').map(x => `${esc(x.j.name)}: ${x.c.kind === 'decision' ? esc(reasonLabel(x.c.decision)) : 'not started'}`).join(' · ')}</div>`;
  }

  VIEWS.prDetail = function (n) {
    const l = D().lineages.find(x => x.n === n);
    if (!l) return '<div class="page">PR not found</div>';
    const pl = PK.model.lineagePl(l);
    const head = PK.model.lineageHead(l);
    const held = D().builds.find(b => b.heldReason && Object.values(b.intent.versions)[0] === head.id.ref);
    const s = PK.model.lineageStatus(l);
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
        ? `<div class="tbl-scroll"><table class="tbl ctbl">${pl.jobs.filter(PK.model.isRunJob).map((j, i) => `<tr>
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
})(window.PK);
