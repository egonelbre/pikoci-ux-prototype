// Capacity: named pools (the stable object) and the worker instances
// registered against them (cattle — they disappear on idle).
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day } = D;

  // Ephemeral capacity: the POOL is the stable, named object; instances are
  // cattle that register with the pool's worker token and disappear on idle.
  const POOLS = [
    { name: 'gcp-ci', provider: 'GCP MIG · e2-standard-8', team: null, tags: ['linux', 'docker'], min: 0, max: 8, idleTtl: '10m', bootSecs: 75, terminatedToday: 14, buildsToday: 132 },
    { name: 'aws-arm', provider: 'AWS ASG · c7g.2xlarge', team: null, tags: ['linux', 'arm64'], min: 0, max: 4, idleTtl: '5m', bootSecs: 95, terminatedToday: 3, buildsToday: 11 },
  ];
  const WORKERS = [
    { name: 'helsinki-1', status: 'online', team: null, tags: ['linux', 'docker', 'exec'], version: 'v0.9.4', running: 0, disk: 0.34, cpu: 0.06, concurrency: 4 },
    { name: 'helsinki-2', status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 2, disk: 0.91, cpu: 0.71, concurrency: 4 },
    { name: 'mac-mini', status: 'online', team: 'main', tags: ['darwin', 'exec'], version: 'v0.9.3', running: 0, disk: 0.58, cpu: 0.11, concurrency: 2 },
    { name: 'builder-gpu', status: 'stale', team: 'platform', tags: ['linux', 'gpu', 'terraform'], version: 'v0.9.1', lastSeen: now - 3 * hr, running: 0, disk: 0.12, cpu: null, concurrency: 2 },
    // gcp-ci pool: two live instances + one still booting
    { name: 'gcp-ci-7f3a', pool: 'gcp-ci', ephemeral: true, status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 3, concurrency: 4, disk: 0.22, cpu: 0.93, up: 38 * min },
    { name: 'gcp-ci-9c21', pool: 'gcp-ci', ephemeral: true, status: 'online', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 1, concurrency: 4, disk: 0.15, cpu: 0.42, up: 12 * min },
    { name: 'gcp-ci-b04d', pool: 'gcp-ci', ephemeral: true, status: 'provisioning', team: null, tags: ['linux', 'docker'], version: 'v0.9.4', running: 0, concurrency: 4, disk: 0, cpu: null, up: 40e3 },
    // aws-arm pool: scaled to zero right now — no instance rows at all
  ];

  D.POOLS = POOLS;
  D.WORKERS = WORKERS;
})();
