// A deep, wide release train — 8 layers, 16 jobs. The graph stress test.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, PIPELINES } = D;

  // ---------- delivery: a deep, wide release train (graph stress test) ------
  // build → {lint, vet, sec-scan} → unit matrix ×5 → itest matrix ×3 → e2e
  // → signing → push ×2 → deploy: 8 layers, 16 jobs, two complete runs.
  (function genDelivery() {
    const res = 'git.delivery';
    const refs = [
      { ref: 'e4d5c6b', msg: 'release train: cut 0.9.5-rc2', author: 'maria', at: now - 50 * min },
      { ref: 'a1b2c3d', msg: 'release train: cut 0.9.5-rc1', author: 'egon', at: now - 26 * hr },
    ];
    const J = (name, needs, group) => ({ name, group, inputs: [{ res, trigger: true, passed: needs || [] }] });
    const U = ['linux-go1.24', 'linux-go1.25', 'macos-go1.24', 'macos-go1.25', 'windows-go1.25'];
    const I = ['postgres', 'mysql', 'sqlite'];
    const jobs = [
      J('build'),
      J('lint', ['build']), J('vet', ['build']), J('sec-scan', ['build']),
      ...U.map(u => J('unit--' + u, ['lint', 'vet', 'sec-scan'], 'unit')),
      ...I.map(x => J('itest--' + x, U.map(u => 'unit--' + u), 'itest')),
      J('e2e', I.map(x => 'itest--' + x)),
      J('signing', ['e2e']),
      J('push--amd64', ['signing'], 'push'), J('push--arm64', ['signing'], 'push'),
      J('deploy', ['push--amd64', 'push--arm64']),
    ];
    PIPELINES.push({
      team: 'main', name: 'delivery', public: false,
      desc: 'Release train: build → static checks → unit matrix → itest matrix → e2e → signing → push → deploy',
      primaryContext: { kind: 'branch', label: 'release/0.9.5', resource: res },
      paused: false, pausedMeta: null, configRev: 6,
      configHistory: [{ rev: 6, by: 'maria', at: now - 4 * day, note: 'add windows lane' }, { rev: 5, by: 'egon', at: now - 20 * day, note: 'split itest by db' }],
      resources: [{
        name: res, type: 'git', pinned: null, checkEvery: '1m', lastCheck: now - 40e3, checkError: null,
        versions: refs.map(r => ({ id: { ref: r.ref }, meta: { msg: r.msg, author: r.author, at: r.at } })),
      }],
      jobs,
    });
    const durOf = { build: 190, lint: 44, vet: 38, 'sec-scan': 81, e2e: 364, signing: 26, deploy: 47 };
    const durFor = nm => durOf[nm] || (nm.startsWith('unit--') ? 120 + (nm.length * 7) % 90
      : nm.startsWith('itest--') ? 240 + (nm.length * 13) % 70 : nm.startsWith('push--') ? 88 : 60);
    const depth = {};
    const dOf = nm => {
      if (depth[nm] != null) return depth[nm];
      const j = jobs.find(x => x.name === nm);
      let d = 0;
      for (const p of j.inputs[0].passed) d = Math.max(d, dOf(p) + 1);
      return (depth[nm] = d);
    };
    jobs.forEach(j => dOf(j.name));
    const maxD = Math.max(...Object.values(depth));
    const layerStart = [0];
    for (let d = 1; d <= maxD; d++) {
      layerStart[d] = layerStart[d - 1] + 8 +
        Math.max(...jobs.filter(j => depth[j.name] === d - 1).map(j => durFor(j.name)));
    }
    refs.forEach((r, ri) => {
      const base = ri === 0 ? 50 * min : 26 * hr;
      for (const j of jobs) {
        const status = ri === 0 && j.name === 'sec-scan' ? 'warning' : 'succeeded';
        const dur = durFor(j.name);
        const arts = j.name.startsWith('push--')
          ? [{ name: 'image digest', size: '—', sha: r.ref === 'e4d5c6b' ? 'c1a9e77d' : '5d20b3f1', dest: `ghcr.io/pikoci/pikoci:${ri === 0 ? '0.9.5-rc2' : '0.9.5-rc1'}-${j.name.slice(6)}` }]
          : j.name === 'signing' ? [{ name: 'cosign bundle', size: '4 KB', sha: '77ab01ce' }] : null;
        b('delivery', j.name, 8 - ri, status, r.ref, base - layerStart[depth[j.name]] * 1e3, dur,
          [S(res, 'get', 'succeeded', 5, ['ref: ' + r.ref]),
           S(j.name, 'task', status, dur - 5, status === 'warning'
             ? ['$ make sec-scan', 'WARN: 2 medium CVEs in base image (allowlisted until 0.9.6)', 'exit 0 (warning)']
             : ['$ make ' + j.name.replace(/--.*/, ''), 'OK'])],
          { res, cause: { kind: 'version', detail: res + ' ' + r.ref, runId: 'run-' + r.ref }, configRev: 6, artifacts: arts });
      }
    });
  })();
})();
