// A week of hourly cpu/disk telemetry per worker, with the runs that
// produced it — so "what filled the disk" has an answer on the page.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, BUILDS, WORKERS } = D;

  // last-week telemetry per worker: hourly cpu/disk samples + the runs that
  // produced them (each run carries its disk delta → "what fills the disk")
  (function genWorkerWeek() {
    const jobsBy = { // [pipeline, job, diskDeltaFraction]
      'helsinki-1': [['pikoci', 'lint', 0.001], ['pikoci', 'build', 0.004], ['website', 'build-site', 0.002]],
      'helsinki-2': [['docker-images', 'build', 0.032], ['pikoci', 'test-unit', 0.002], ['pikoci-pr', 'test-unit', 0.001]],
      'mac-mini': [['pikoci', 'test-matrix--macos', 0.003], ['pikoci-pr', 'test-matrix--macos', 0.002]],
      'builder-gpu': [['infra', 'terraform-plan', 0.001]],
      'gcp-ci-7f3a': [['delivery', 'unit--linux-go1.24', 0.004], ['checkout-staging', 'test', 0.003]],
      'gcp-ci-9c21': [['delivery', 'itest--postgres', 0.005], ['etl-orders', 'test', 0.002]],
    };
    for (const w of WORKERS) {
      const specs = jobsBy[w.name];
      if (!specs) continue;
      const seed = [...w.name].reduce((s, c) => s + c.charCodeAt(0), 0);
      const rand = k => (((seed * 9301 + k * 49297) % 233280) + 233280) % 233280 / 233280;
      // ephemeral instances only exist for their uptime; pets get the full week
      const hours = w.ephemeral ? Math.max(1, Math.round((w.up || 0) / hr)) : 168;
      const samples = [], runs = [];
      let disk = 0, n = 300 + seed % 90;
      for (let k = hours; k >= 0; k--) {
        let cpu = 0.04 + rand(k) * 0.09;
        if (k > 0 && rand(k * 5) > (w.ephemeral ? 0.45 : 0.8)) {
          const sp = specs[Math.floor(rand(k * 7) * specs.length)];
          const durM = 6 + Math.round(rand(k * 13) * 28);
          // bind to a real build record of this pipeline/job so the run is navigable
          const real = BUILDS.filter(x => x.pipeline === sp[0] && x.job === sp[1]);
          const rb = real.length ? real[(n + k) % real.length] : null;
          runs.push({ agoH: k, pipeline: sp[0], job: sp[1], n: rb ? rb.n : n++, bid: rb ? rb.id : null, durM, dDisk: sp[2] });
          disk += sp[2];
          cpu = 0.55 + rand(k * 3) * 0.42;
        }
        if (w.name === 'helsinki-2' && k === 118) { // one retention prune mid-week
          runs.push({ agoH: k, pipeline: '(retention)', job: 'docker image prune', n: null, durM: 4, dDisk: -0.11 });
          disk -= 0.11; cpu = 0.18;
        }
        samples.push({ agoH: k, cpu: Math.min(0.97, cpu), disk });
      }
      // pin the trajectory so it ENDS at today's gauge value (never fabricate now)
      const rawEnd = samples[samples.length - 1].disk;
      const target = w.disk == null ? 0.1 : w.disk;
      let scale = 1, s0 = target - rawEnd;
      if (s0 < 0.04) { scale = Math.max(0, (target - 0.04) / Math.max(rawEnd, 0.001)); s0 = target - rawEnd * scale; }
      samples.forEach(s => { s.disk = s0 + s.disk * scale; });
      runs.forEach(r => { r.dDisk *= scale; });
      w.week = { hours, samples, runs };
    }
  })();
})();
