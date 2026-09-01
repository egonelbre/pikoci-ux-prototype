// Settings, including the solo-install simulation that shows the nav gating.
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const D = () => window.DATA;

  VIEWS.settings = function () {
    return `<div class="page narrow"><h1>Settings</h1>
      <section class="panel"><div class="panel-head"><b>Preview controls</b></div><div class="pad">
        <button class="btn" data-act="theme">◐ Toggle light/dark</button>
        <button class="btn" data-act="solo">${D().soloMode ? 'Restore full install' : 'Simulate solo install'}</button>
        <span class="mut small">— solo drops the nav to Home · Pipelines (+ Settings, always present and uncounted); every gated URL still resolves to a teaching page.</span>
      </div></section>
      <section class="panel"><div class="panel-head"><b>Workers</b> <span class="mut small">(always reachable here, even on one-worker installs)</span></div>
        <div class="pad"><a href="#/workers">Open workers →</a> · <a href="#/queue">queue →</a></div></section>
      <section class="panel"><div class="panel-head"><b>Notifications</b></div>
        <div class="pad mut small">Pipeline-level notifiers ship today: Slack/Discord webhooks and forge status checks (Notifications.md) — configured in the pipeline, not here. <b>Per-user</b> channels land with K15 (Phase 3): a generic per-user webhook first — a forge comment can't carry a production-deploy approval. Until then, the Home strip and forge checks are the per-person entry points, and this page says so instead of showing a dead matrix.</div></section>
      <section class="panel"><div class="panel-head"><b>API tokens</b></div>
        <div class="pad mut small">cli-egon · personal — <button class="btn sm danger" data-act="noop">delete</button> <button class="btn sm" data-act="noop">create token…</button>
        <div>tokens never rotate in place: delete + recreate (API-Tokens.md); a new token is shown once, capped at your role. Team <i>worker</i> tokens are the exception — regenerate them in Team settings.</div></div></section>
      <section class="panel"><div class="panel-head"><b>Audit</b></div><div class="pad"><a href="#/audit">Open audit log →</a></div></section>
    </div>`;
  };
})(window.PK);
