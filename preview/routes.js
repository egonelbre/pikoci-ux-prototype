// Route table. Shared by index.html (the app) and tools/selftest.html (the
// checks), so the two can never disagree about what a URL renders.
//
// A route is the hash split on "/": #/p/delivery/graph -> ['p','delivery','graph'].
// Views are pure functions of the route, which is what lets the self-test
// render every page into a detached container without touching the address bar.
(function () {
  'use strict';

  // Every page the app can show, with a route that reaches it. The self-test
  // walks this list; index.html's landing page links into it.
  const ALL = [
    ['', 'home'],
    ['pipelines', 'all pipelines'],
    ['p/delivery/graph', 'complex graph'],
    ['p/packaging/graph', 'wrapped long chain'],
    ['p/pikoci/graph', 'trunk pipeline'],
    ['changes/mine', 'changes: mine'],
    ['changes/open', 'changes: open PRs'],
    ['changes/repos', 'changes: repos'],
    ['changes/scheduled', 'changes: scheduled'],
    ['changes/pr/481', 'PR landing page'],
    ['changes/pr/472', 'draft PR, deferred tier'],
    ['changes/pr/489', 'held fork PR'],
    ['b/pikoci-pr/lint/201', 'lint failure'],
    ['b/pikoci-pr/test-unit/200', 'test failure'],
    ['b/pikoci-pr/test-matrix--macos/189', 'broken test report'],
    ['b/pikoci/build/142', 'artifacts & measurements'],
    ['b/pikoci/deploy/142', 'approval gate'],
    ['b/pikoci/test-integration/143', 'live build'],
    ['environments', 'environments'],
    ['environments/prod', 'environment detail'],
    ['queue', 'queue'],
    ['workers', 'workers'],
    ['workers/helsinki-1', 'worker telemetry'],
    ['audit', 'audit'],
    ['teams', 'teams'],
    ['settings', 'settings'],
    ['insights', 'gated: insights'],
    ['nope/nowhere', 'not found'],
  ];

  const parse = hash => {
    const h = String(hash || '').replace(/^#\/?/, '');
    return h ? h.split('/').map(decodeURIComponent) : [];
  };

  // #/b/<pipeline>/<job>/<n> is an alias that resolves by coordinates — stable
  // across data.js edits, unlike generated build ids (#/b/b1042).
  function buildId(b, c, d) {
    if (d === undefined) return b;
    const x = window.DATA.builds.find(y => y.pipeline === b && y.job === c && String(y.n) === String(d));
    return x ? x.id : b;
  }

  function main(route) {
    const [a, b, c, d] = route;
    const nav = P.navItems().map(i => i.id);
    const gate = id => nav.includes(id) ? null : VIEWS.gated(id);

    if (!a) return VIEWS.home();
    if (a === 'pipelines') return VIEWS.pipelines();
    if (a === 'p') return VIEWS.pipeline(b, c, d);
    if (a === 'b') return VIEWS.build(buildId(b, c, d));
    if (a === 'changes') return gate('changes') || VIEWS.changes(b, c);
    if (a === 'environments') return gate('environments') || VIEWS.environments(b);
    if (a === 'insights') return VIEWS.gated('insights');
    if (a === 'queue') return gate('queue') || VIEWS.queue();
    if (a === 'workers') return gate('workers') || VIEWS.workers(b);
    if (a === 'audit') return gate('audit') || VIEWS.audit();
    if (a === 'teams') return VIEWS.teams();
    if (a === 'settings') return VIEWS.settings();
    return '<div class="page">Not found — <a href="#/">home</a></div>';
  }

  window.ROUTES = { ALL, parse, main, shell: r => VIEWS.shell(r) };
})();
