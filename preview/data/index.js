// Assembles window.DATA from everything data/factory.js, data/scenarios/* and
// data/generate/* built up. Loads last of the data tier.
//
// The load order in index.html is not cosmetic:
//
//   factory                 the clock, the log generators, b()/S()
//   scenarios/versions      trunk commit history
//   scenarios/prs           LINEAGES (pipelines/ reads it for pikoci-pr)
//   scenarios/trunk         the six trunk runs — first builds created
//   scenarios/pr-builds     PR builds and their K23 checks
//   scenarios/other-builds  website / infra / hello-world
//   scenarios/decisions     why things did NOT run
//   scenarios/pipelines     PIPELINES (needs trunkVersions + LINEAGES)
//   scenarios/environments  ENVIRONMENTS
//   generate/*              scale: ~40 pipelines, branches, delivery, packaging
//   scenarios/org           teams and users
//   scenarios/workers       pools and worker instances
//   generate/worker-week    telemetry (needs WORKERS and every build)
//   generate/branches       the 5,866-branch index
//   scenarios/audit         the audit log
//
// b() hands out ids from a counter, so reordering the files that create builds
// renames every build after the change — and the deep links in ../index.html
// that address builds by coordinate would still work, but #/b/b1042 would not.
(function () {
  'use strict';
  const D = window.PK.data;

  window.DATA = {
    now: D.now,
    me: { username: 'egon', role: 'admin', gitAuthors: ['egon'] },
    teams: D.TEAMS, users: D.USERS, pipelines: D.PIPELINES, builds: D.BUILDS,
    lineages: D.LINEAGES, decisions: D.DECISIONS, environments: D.ENVIRONMENTS, branches: D.BRANCHES,
    workers: D.WORKERS, pools: D.POOLS, audit: D.AUDIT,
    liveBuildId: D.LIVE ? D.LIVE.id : null,
    capabilities: { insightsShipped: false, notificationsShipped: false },
    soloMode: false,
  };
})();
