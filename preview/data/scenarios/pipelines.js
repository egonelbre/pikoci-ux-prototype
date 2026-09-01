// The six handwritten pipelines. Everything the UX has to explain about
// pipeline shape lives here: approval gates, pinned resources, a paused
// pipeline with an expired hold, a resource whose check is erroring, and a
// cron job scheduled by its RESOURCE rather than a job attribute.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, tickAt, trunkVersions, LINEAGES } = D;

  // ---------- pipelines -----------------------------------------------------
  const PIPELINES = [
    {
      team: 'main', name: 'pikoci', public: true, desc: 'Build, test and deploy PikoCI itself',
      primaryContext: { kind: 'branch', label: 'master', resource: 'git.pikoci' },
      paused: false, pausedMeta: null, configRev: 13,
      configHistory: [
        { rev: 13, by: 'egon', at: now - 2 * day, note: 'add nightly-e2e cron job' },
        { rev: 12, by: 'maria', at: now - 9 * day, note: 'approval gate 1→2 approvals' },
        { rev: 11, by: 'egon', at: now - 20 * day, note: 'matrix: add macos leg' },
      ],
      resources: [
        { name: 'git.pikoci', type: 'git', pinned: null, checkEvery: '1m', lastCheck: now - 40e3, checkError: null, versions: trunkVersions },
        { name: 'cron.nightly', type: 'cron', pinned: null, checkEvery: '@daily', lastCheck: now - 5 * hr, checkError: null, versions: [{ id: { ref: '2026-08-28' }, meta: { at: now - 5 * hr } }] },
        {
          name: 'docker.image', type: 'registry-image', pinned: null, checkEvery: '10m', lastCheck: now - 3 * min,
          checkError: 'GET ghcr.io/v2/: 401 Unauthorized (token expired?)',
          versions: [{ id: { ref: 'v0.9.3' }, meta: { at: now - 6 * day } }],
        },
      ],
      jobs: [
        { name: 'lint', tier: 'cheap', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-unit', tier: 'cheap', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-matrix--linux', group: 'test-matrix', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-matrix--macos', group: 'test-matrix', inputs: [{ res: 'git.pikoci', trigger: true, passed: [] }] },
        { name: 'test-integration', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['lint', 'test-unit'] }] },
        { name: 'build', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['test-integration'] }, { res: 'cron.nightly', trigger: false, passed: [] }] },
        { name: 'deploy', approve: { name: 'deploy to production', need: 2 }, env: 'prod', inputs: [{ res: 'git.pikoci', trigger: true, passed: ['build'] }] },
        // scheduled purely by its cron trigger — cron is a RESOURCE with
        // check_interval (Cron.md), never a job attribute
        { name: 'nightly-e2e', inputs: [{ res: 'cron.nightly', trigger: true, passed: [] }], lastSuccess: now - 40 * hr },
      ],
    },
    {
      team: 'main', name: 'pikoci-pr', public: false, desc: 'PR checks for pikoci', prHold: 'forks',
      primaryContext: { kind: 'lineages', label: 'open PRs', resource: 'git.pikoci-pr' },
      paused: false, pausedMeta: null, configRev: 7,
      configHistory: [{ rev: 7, by: 'egon', at: now - 5 * day, note: 'pr_hold = "forks"' }],
      resources: [{ name: 'git.pikoci-pr', type: 'git', params: { pr: true }, pinned: null, checkEvery: '1m', lastCheck: now - 30e3, checkError: null, versions: LINEAGES.flatMap(l => l.changes) }],
      jobs: [
        { name: 'lint', tier: 'cheap', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-unit', tier: 'cheap', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-matrix--linux', group: 'test-matrix', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-matrix--macos', group: 'test-matrix', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: [] }] },
        { name: 'test-integration', inputs: [{ res: 'git.pikoci-pr', trigger: true, passed: ['lint', 'test-unit'] }] },
      ],
    },
    {
      team: 'main', name: 'website', public: true, desc: 'docs.pikoci.com',
      primaryContext: { kind: 'branch', label: 'main', resource: 'git.website' },
      paused: false, pausedMeta: null, configRev: 4, configHistory: [{ rev: 4, by: 'sam', at: now - 12 * day, note: 'strict mode' }],
      resources: [{
        name: 'git.website', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 80e3, checkError: null,
        versions: [
          { id: { ref: '1d97e35' }, meta: { msg: 'restructure scaling docs', author: 'sam', at: now - 5 * hr } },
          { id: { ref: '8c22b41' }, meta: { msg: 'add secret-types page', author: 'maria', at: now - 26 * hr } },
        ],
      }],
      jobs: [
        { name: 'build-site', inputs: [{ res: 'git.website', trigger: true, passed: [] }] },
        { name: 'publish', inputs: [{ res: 'git.website', trigger: true, passed: ['build-site'] }] },
      ],
    },
    {
      team: 'main', name: 'release', public: false, desc: 'Tag + package releases',
      primaryContext: { kind: 'branch', label: 'master', resource: 'git.pikoci' },
      paused: true,
      pausedMeta: { actor: 'egon', reason: 'hold during v0.9.3 investigation', at: now - 5 * hr, until: now - 1 * hr }, // expired → attention
      configRev: 9, configHistory: [{ rev: 9, by: 'egon', at: now - 30 * day, note: 'goreleaser v2' }],
      resources: [{
        name: 'git.pikoci', type: 'git', pinned: { ref: 'f0b6d15', actor: 'egon', reason: 'last known-good for v0.9.3', at: now - 5 * hr },
        checkEvery: '5m', lastCheck: now - 2 * min, checkError: null, versions: trunkVersions.slice(0, 4),
      }],
      jobs: [{ name: 'tag-release', inputs: [{ res: 'git.pikoci', trigger: false, passed: [] }] }],
    },
    {
      team: 'platform', name: 'infra', public: false, desc: 'Terraform for ci.pikoci.com',
      primaryContext: { kind: 'branch', label: 'main', resource: 'git.infra' },
      paused: false, pausedMeta: null, configRev: 12, configHistory: [{ rev: 12, by: 'maria', at: now - 9 * hr, note: 'add worker node pool' }],
      resources: [{
        name: 'git.infra', type: 'git', pinned: null, checkEvery: '2m', lastCheck: now - 30e3, checkError: null,
        versions: [
          { id: { ref: 'bb42e1f' }, meta: { msg: 'add worker node pool', author: 'maria', at: now - 40 * min } },
          { id: { ref: 'aa10c3d' }, meta: { msg: 'bump instance size', author: 'maria', at: now - 10 * hr } },
        ],
      }],
      jobs: [
        { name: 'terraform-plan', inputs: [{ res: 'git.infra', trigger: true, passed: [] }] },
        { name: 'terraform-apply', approve: { name: 'apply infra', need: 1 }, env: 'ci-infra', inputs: [{ res: 'git.infra', trigger: false, passed: ['terraform-plan'] }] },
      ],
    },
    {
      team: 'oss', name: 'hello-world', public: true, desc: 'Demo pipeline from the README',
      primaryContext: { kind: 'trigger', label: 'every-10m', resource: 'cron.every-10m' },
      paused: false, pausedMeta: null, configRev: 1, configHistory: [{ rev: 1, by: 'egon', at: now - 60 * day, note: 'initial' }],
      resources: [{
        name: 'cron.every-10m', type: 'cron', pinned: null, checkEvery: '@every 10m', lastCheck: now - 4 * min, checkError: null,
        versions: [{ id: { ref: tickAt(10) }, meta: { at: now - 10 * min } }, { id: { ref: tickAt(20) }, meta: { at: now - 20 * min } }],
      }],
      jobs: [{ name: 'gen', inputs: [{ res: 'cron.every-10m', trigger: true, passed: [] }] }],
    },
  ];

  D.PIPELINES = PIPELINES;
})();
