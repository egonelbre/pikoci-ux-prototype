// Home: what needs YOU, then the wall of pipelines. The attention strip is
// ownership-scoped, and says out loud whose failures it is NOT showing.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, ago } = PK.fmt;
  const { st } = PK.status;
  const D = () => window.DATA;

  // ---------- Home ----------------------------------------------------------
  VIEWS.home = function () {
    const { items, notShown } = PK.attention();
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
      const s = PK.model.primaryStatus(pl);
      const isPR = pl.primaryContext.kind === 'lineages';
      const counts = isPR ? PK.model.secondaryCounts(pl) : null;
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
    const pls = PK.model.pipelines();
    // all-teams at company scale: group the wall by team (dropdown scopes it)
    const cards = (!PK.model.team() && pls.length > 9)
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
})(window.PK);
