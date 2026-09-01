// Deploy targets (K11) for the handwritten pipelines.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // ---------- environments (K11) -------------------------------------------
  const ENVIRONMENTS = [
    {
      name: 'prod', pipeline: 'main/pikoci', job: 'deploy',
      version: '5f8c771', deployedAt: now - 8 * hr + 500e3, byBuild: '#141', by: 'auto (gate: maria, egon)',
      verified: true, drift: false,
      history: [
        { version: '5f8c771', at: now - 8 * hr + 500e3, build: '#141', ok: true },
        { version: 'f0b6d15', at: now - 3 * day + 500e3, build: '#139', ok: true },
      ],
    },
    {
      name: 'ci-infra', pipeline: 'platform/infra', job: 'terraform-apply',
      version: 'aa10c3d', deployedAt: now - 8 * hr, byBuild: '#41', by: 'egon',
      verified: true, drift: false, history: [{ version: 'aa10c3d', at: now - 8 * hr, build: '#41', ok: true }],
    },
  ];

  D.ENVIRONMENTS = ENVIRONMENTS;
})();
