// Capability-gated navigation (§3.1): a nav slot appears when the install has
// something to put in it. Gated-off URLs stay reachable and teach instead of
// 404ing, so a deep link never dies because of gating.
(function (PK) {
  'use strict';
  const app = PK.app;
  const D = () => window.DATA;

  function navItems() {
    const d = D();
    const items = [{ id: 'home', label: 'Home', href: '#/' }, { id: 'pipelines', label: 'Pipelines', href: '#/pipelines' }];
    const gates = {
      changes: !d.soloMode && d.lineages.length > 0, // metadata exists (K3)
      environments: !d.soloMode && d.environments.length > 0,
      insights: d.capabilities.insightsShipped,
      ops: !d.soloMode && (d.workers.length >= 2 || app.session.opsPinned), // gates Queue + Workers together
      audit: !d.soloMode && d.teams.some(t => t.members.length >= 2),
    };
    if (gates.changes) items.push({ id: 'changes', label: 'Changes', href: '#/changes' });
    if (gates.environments) items.push({ id: 'environments', label: 'Environments', href: '#/environments' });
    if (gates.insights) items.push({ id: 'insights', label: 'Insights', href: '#/insights' });
    if (gates.ops) { // two tabs, one gate: different questions over related data
      items.push({ id: 'queue', label: 'Queue', href: '#/queue' });
      items.push({ id: 'workers', label: 'Workers', href: '#/workers' });
      app.session.opsPinned = true;
    }
    if (gates.audit) items.push({ id: 'audit', label: 'Audit', href: '#/audit' });
    return items; // Settings rendered separately, always present, uncounted
  }
  const gatedEmpty = { // teaching empty states for gated-off URLs (R2-13)
    insights: ['Insights is not built yet.', 'When it ships (Phase 4) and this install has ~200 builds, this page will show duration trends, the flake board (pass-after-retry), queue times, and stale escape hatches. Until then this URL stays reachable — deep links never 404 because of gating.'],
    changes: ['No change metadata yet.', 'The Changes view appears when version metadata enrichment provides commit messages, authors, and PR fields. Until then, each pipeline has a Versions tab.'],
    environments: ['No deploy targets declared.', 'Declare an environment on a deploy job and this page will show what version is live where, with verification state and guided rollback.'],
    queue: ['Single-worker install.', 'Queue appears with a second worker (or any stuck build) — on one worker, jobs either run or wait for that worker. It answers "when does my job start, and how big is the workload?" honestly: matching capacity per tag, no fake ETAs.'],
    workers: ['Single-worker install.', 'Workers appears with a second worker (or any stuck build). The one worker is always reachable from Settings — a solo operator still needs drain, upgrade, and registration.'],
    audit: ['Solo install.', 'The audit log gains a nav slot with a second team member. It is reachable from Settings meanwhile.'],
  };

  PK.nav = { navItems, gatedEmpty };
})(window.PK = window.PK || {});
