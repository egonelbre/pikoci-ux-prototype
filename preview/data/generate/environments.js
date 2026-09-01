// ~20 deploy targets: mostly quietly green, a couple demanding attention.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, PIPELINES, ENVIRONMENTS } = D;

  // ---------- synthetic environments: ~20 deploy targets --------------------
  // Stress the Environments page the way real installs look: many per-service
  // staging/prod targets, most quietly green, a couple demanding attention.
  (function genEnvs() {
    const targets = ['checkout-staging', 'checkout-prod', 'billing-staging', 'billing-prod',
      'ledger-staging', 'ledger-prod', 'storefront-staging', 'storefront-prod',
      'admin-staging', 'admin-prod', 'etl-events', 'warehouse-sync', 'ios-app', 'android-app',
      'docker-images', 'base-ami', 'k8s-upgrade', 'examples'];
    const actors = ['anna', 'kris', 'liis', 'marko', 'jt', 'tanel', 'sam', 'maria'];
    targets.forEach((pn, k) => {
      const pl = PIPELINES.find(p => p.name === pn);
      if (!pl || !pl.resources[0].versions[0]) return;
      const ref = pl.resources[0].versions[0].id.ref;
      const prevRef = (parseInt(ref, 16) - 0x101).toString(16).slice(0, 7);
      const at = now - (2 + k * 5) * hr;
      const bn = '#' + (18 + (k * 7) % 60);
      ENVIRONMENTS.push({
        name: pn, pipeline: pl.team + '/' + pn, job: 'deploy',
        version: ref, deployedAt: at, byBuild: bn, by: actors[k % actors.length],
        verified: k !== 3, // billing-prod still verifying
        drift: k === 9,    // admin-prod: live version not deployed by CI
        history: [
          { version: ref, at, build: bn, ok: k !== 9 },
          { version: prevRef, at: at - (20 + k * 3) * hr, build: '#' + (parseInt(bn.slice(1)) - 1), ok: true },
        ],
      });
    });
  })();
})();
