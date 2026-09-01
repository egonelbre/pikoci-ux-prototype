// A LONG sequential train: 19 stages with two matrix fan-outs. The DAG
// view has to wrap this like text rather than scroll off into the void.
(function () {
  'use strict';
  const D = window.PK.data;
  const { now, min, hr, day, b, S, PIPELINES } = D;

  // ---------- packaging: a LONG sequential train (graph-wrap stress test) ---
  // 19 sequential stages with two matrix fan-outs (compile ×3, installer ×3):
  // the DAG view must wrap this like text, not scroll off into the void.
  (function genPackaging() {
    const res = 'git.packaging';
    const ref = 'beefc0d';
    const J = (name, needs, group) => ({ name, group, inputs: [{ res, trigger: true, passed: needs || [] }] });
    const OS = ['linux', 'darwin', 'windows'];
    const PK = ['msi', 'dmg', 'deb'];
    const chain = []; // helper: sequential unless needs given
    const seq = (name, needs, group) => { chain.push(J(name, needs, group)); return name; };
    let prev = seq('fetch-sources');
    prev = seq('vendor-deps', [prev]);
    prev = seq('codegen', [prev]);
    OS.forEach(o => seq('compile--' + o, [prev], 'compile'));
    prev = seq('link-check', OS.map(o => 'compile--' + o));
    prev = seq('unit-smoke', [prev]);
    prev = seq('containerize', [prev]);
    prev = seq('scan-images', [prev]);
    prev = seq('push-images', [prev]);
    prev = seq('publish-images', [prev]);
    PK.forEach(p => seq('installer--' + p, [prev], 'installer'));
    prev = seq('sign-installers', PK.map(p => 'installer--' + p));
    prev = seq('notarize', [prev]);
    prev = seq('checksums', [prev]);
    prev = seq('generate-sbom', [prev]);
    prev = seq('upload-cdn', [prev]);
    prev = seq('publish-github', [prev]);
    prev = seq('announce', [prev]);
    prev = seq('cleanup', [prev]);
    PIPELINES.push({
      team: 'main', name: 'packaging', public: false,
      desc: 'Nightly packaging train: 19 sequential stages, compile ×3 and installer ×3 matrices',
      primaryContext: { kind: 'branch', label: 'main', resource: res },
      paused: false, pausedMeta: null, configRev: 3,
      configHistory: [{ rev: 3, by: 'egon', at: now - 6 * day, note: 'add notarize stage' }],
      resources: [{ name: res, type: 'git', pinned: null, checkEvery: '5m', lastCheck: now - 90e3, checkError: null,
        versions: [{ id: { ref }, meta: { msg: 'nightly: cut 0.9.5-nightly.812', author: 'cron', at: now - 40 * min } }] }],
      jobs: chain,
    });
    // one live run: green up to the CDN upload, which is running; the rest queued
    const depth = {};
    const dOf = nm => {
      if (depth[nm] != null) return depth[nm];
      const j = chain.find(x => x.name === nm);
      let d = 0;
      for (const p of j.inputs[0].passed) d = Math.max(d, dOf(p) + 1);
      return (depth[nm] = d);
    };
    chain.forEach(j => dOf(j.name));
    const doneUpTo = depth['upload-cdn'];
    for (const j of chain) {
      const d = depth[j.name];
      if (d > doneUpTo) continue; // downstream builds don't exist yet — honest gray nodes
      const status = d < doneUpTo ? 'succeeded' : 'started';
      const dur = 30 + (j.name.length * 17) % 160;
      const arts = j.name === 'push-images'
        ? [{ name: 'image digest', size: '—', sha: '9e4a11d0', dest: 'ghcr.io/pikoci/agent:nightly.812' }]
        : j.name === 'sign-installers' ? [{ name: 'signature bundle', size: '6 KB', sha: '3fa7b2c9' }] : null;
      b('packaging', j.name, 812, status, ref, (40 - d) * min, dur,
        [S(res, 'get', 'succeeded', 4, ['ref: ' + ref]),
          S(j.name, 'task', status, dur - 4, status === 'started' ? ['$ make ' + j.name.replace(/--.*/, ''), 'uploading…'] : ['$ make ' + j.name.replace(/--.*/, ''), 'OK'])],
        { res, cause: { kind: 'cron', detail: 'nightly tick', runId: 'run-nightly-812' }, configRev: 3, artifacts: arts });
    }
  })();
})();
