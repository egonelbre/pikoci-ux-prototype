// The remaining canonical pipelines: a failing trunk (website), a build
// stuck pending on a tag nothing serves (infra), and cron ticks whose
// version identity is a DATE, not a ref (hello-world).
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, gitLog, siteLog, tickAt } = D;

  // --- main/website: trunk failing ---
  b('website', 'build-site', 89, 'failed', '1d97e35', 5 * hr, 61,
    [S('git.website', 'get', 'succeeded', 4, gitLog('1d97e35')), S('mkdocs', 'task', 'failed', 55, siteLog(false))],
    { res: 'git.website', worker: 'helsinki-2', cause: { kind: 'version', detail: 'git.website 1d97e35', runId: 'run-1d97e35' } });
  b('website', 'build-site', 88, 'succeeded', '8c22b41', 26 * hr, 58,
    [S('git.website', 'get', 'succeeded', 4, gitLog('8c22b41')), S('mkdocs', 'task', 'succeeded', 52, siteLog(true))],
    { res: 'git.website', worker: 'helsinki-2', cause: { kind: 'version', detail: 'git.website 8c22b41', runId: 'run-8c22b41' } });
  b('website', 'publish', 88, 'succeeded', '8c22b41', 26 * hr - 70e3, 21,
    [S('git.website', 'get', 'succeeded', 4, gitLog('8c22b41')), S('rsync', 'task', 'succeeded', 16, ['rsync -az site/ docs.pikoci.com:/srv/docs', 'publish: OK'])],
    { res: 'git.website', cause: { kind: 'passed', detail: 'after build-site', runId: 'run-8c22b41' } });

  // --- platform/infra: stuck pending ---
  b('infra', 'terraform-plan', 54, 'succeeded', 'aa10c3d', 9 * hr, 63,
    [S('git.infra', 'get', 'succeeded', 4, gitLog('aa10c3d')), S('plan', 'task', 'succeeded', 58, ['terraform plan', 'Plan: 2 to add, 1 to change, 0 to destroy.'])],
    { team: 'platform', res: 'git.infra', cause: { kind: 'version', detail: 'git.infra aa10c3d', runId: 'run-aa10c3d' } });
  b('infra', 'terraform-apply', 42, 'pending', 'bb42e1f', 25 * min, 0, [],
    { team: 'platform', res: 'git.infra', cause: { kind: 'manual', detail: 'manual by maria', runId: 'run-manual-42' }, queue: { matching: 0, busy: false, ahead: 0, tag: 'terraform' } });

  // --- oss/hello-world: cron ---
  // ticks at -10/-20/-40min built (builds 210/209/207); the -30min tick
  // deliberately has NO build so its overlap-skipped decision record is what
  // renders (a build at the same version would shadow the decision in jobCell)
  for (const i of [0, 1, 3]) {
    b('hello-world', 'gen', 210 - i, 'succeeded', tickAt(10 + i * 10), (10 + i * 10) * min, 2,
      [S('cron.every-10m', 'get', 'succeeded', 0, ['version: date=' + tickAt(10 + i * 10)]), S('echo', 'task', 'succeeded', 1, ['$ echo IN', 'IN'])],
      { team: 'oss', res: 'cron.every-10m', cause: { kind: 'cron', detail: 'tick', runId: 'run-cron-' + (210 - i) } });
  }
})();
