// Shared runtime for all PikoCI UX prototypes: status metadata, data queries,
// a tiny hash router with scroll preservation, DAG layout + mini-graph SVG,
// simulated actions, live-build simulation, and renderers for the secondary
// screens (teams, workers, audit, settings, editor) that all variations share.
(function () {
  'use strict';
  const D = () => window.DATA;

  // ---------- status metadata ---------------------------------------------
  const STATUS = {
    succeeded: { color: '#00A83A', sym: '✓', label: 'succeeded' },
    failed: { color: '#FF004D', sym: '✕', label: 'failed' },
    started: { color: '#FFA300', sym: '●', label: 'running' },
    pending: { color: '#83769C', sym: '○', label: 'pending' },
    cancelled: { color: '#AB5236', sym: '⊘', label: 'cancelled' },
    errored: { color: '#FA8072', sym: '!', label: 'errored' },
    waiting_for_approval: { color: '#8e44ad', sym: '⧖', label: 'needs approval' },
    paused: { color: '#29ADFF', sym: '❚❚', label: 'paused' },
    none: { color: '#c8c2bc', sym: '·', label: 'no builds' },
  };
  const st = s => STATUS[s] || STATUS.none;

  // ---------- misc helpers -------------------------------------------------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function fmtDur(sec) {
    if (sec == null) return '–';
    sec = Math.round(sec);
    if (sec < 60) return sec + 's';
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m < 60) return m + 'm ' + (s ? s + 's' : '').trim();
    return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  }
  function ago(ts) {
    if (!ts) return '–';
    let d = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (d < 60) return d + 's ago';
    d = Math.round(d / 60); if (d < 60) return d + 'm ago';
    d = Math.round(d / 60); if (d < 24) return d + 'h ago';
    return Math.round(d / 24) + 'd ago';
  }
  function buildDur(b) {
    if (!b) return null;
    if (b.end) return (b.end - b.start) / 1000;
    if (b.status === 'started') return (Date.now() - b.start) / 1000;
    return null;
  }

  // ---------- data queries -------------------------------------------------
  const pipelines = () => D().pipelines;
  const getPipeline = (team, name) => D().pipelines.find(p => p.team === team && p.name === name);
  const getBuild = id => D().builds.find(b => b.id === id);
  const teamPipelines = team => D().pipelines.filter(p => p.team === team);

  function jobKey(name) { return name.split('/')[0]; } // matrix instance -> job
  function jobBuilds(pl, job) {
    return D().builds.filter(b => b.team === pl.team && b.pipeline === pl.name && jobKey(b.job) === job)
      .sort((a, b) => b.start - a.start || (b.job > a.job ? 1 : -1));
  }
  function pipelineBuilds(pl) {
    return D().builds.filter(b => b.team === pl.team && b.pipeline === pl.name).sort((a, b) => b.start - a.start);
  }
  function latestBuild(pl, job) { return jobBuilds(pl, job)[0] || null; }
  const RANK = { failed: 0, errored: 1, waiting_for_approval: 2, started: 3, pending: 4, cancelled: 5, succeeded: 6, none: 7 };
  function jobStatus(pl, job) {
    const j = pl.jobs.find(x => x.name === job);
    if (j && j.paused) return 'paused';
    // matrix: worst of latest instance builds
    if (j && j.matrix) {
      const latest = {};
      for (const b of jobBuilds(pl, job)) if (!latest[b.job] || b.n > latest[b.job].n) latest[b.job] = b;
      const sts = Object.values(latest).filter(b => b.n === Math.max(...Object.values(latest).map(x => x.n))).map(b => b.status);
      if (!sts.length) return 'none';
      return sts.sort((a, b) => RANK[a] - RANK[b])[0];
    }
    const b = latestBuild(pl, job);
    return b ? b.status : 'none';
  }
  function pipelineStatus(pl) {
    if (pl.paused) return 'paused';
    const sts = pl.jobs.map(j => jobStatus(pl, j.name)).filter(s => s !== 'none');
    if (!sts.length) return 'none';
    return sts.sort((a, b) => RANK[a] - RANK[b])[0];
  }
  function pipelineAttention(pl) { // things a human should look at
    const out = [];
    for (const j of pl.jobs) {
      const s = jobStatus(pl, j.name);
      if (s === 'failed' || s === 'errored') out.push({ kind: s, job: j.name });
      if (s === 'waiting_for_approval') out.push({ kind: 'approval', job: j.name });
    }
    for (const r of pl.resources) if (r.checkError) out.push({ kind: 'check-error', res: r.name });
    return out;
  }
  function runningBuilds() { return D().builds.filter(b => b.status === 'started'); }
  function needsApproval() { return D().builds.filter(b => b.status === 'waiting_for_approval'); }
  function pendingBuilds() { return D().builds.filter(b => b.status === 'pending'); }

  // ---------- DAG layout ---------------------------------------------------
  // Returns { layers: [ [ {kind:'resource'|'job', name} ] ], edges: [{from,to,passed}] }
  function dag(pl) {
    const depth = {};
    function jobDepth(name) {
      if (depth[name] != null) return depth[name];
      depth[name] = 0; // cycle guard
      const j = pl.jobs.find(x => x.name === name);
      let d = 0;
      for (const inp of (j.inputs || []))
        for (const p of (inp.passed || [])) d = Math.max(d, jobDepth(p) + 1);
      depth[name] = d;
      return d;
    }
    pl.jobs.forEach(j => jobDepth(j.name));
    const maxD = Math.max(0, ...Object.values(depth));
    const layers = [];
    // layer 0: trigger resources feeding depth-0 jobs
    layers.push(pl.resources.map(r => ({ kind: 'resource', name: r.name })));
    for (let d = 0; d <= maxD; d++)
      layers.push(pl.jobs.filter(j => depth[j.name] === d).map(j => ({ kind: 'job', name: j.name })));
    const edges = [];
    for (const j of pl.jobs) {
      for (const inp of (j.inputs || [])) {
        if ((inp.passed || []).length)
          for (const p of inp.passed) edges.push({ from: p, to: j.name, passed: true, res: inp.res });
        else edges.push({ from: inp.res, to: j.name, passed: false, trigger: inp.trigger });
      }
      for (const o of (j.outputs || [])) edges.push({ from: j.name, to: o, put: true });
    }
    return { layers, edges, depth };
  }

  // positioned graph for SVG: returns {w,h,nodes:{name:{x,y,w,h,kind}},edges}
  function layoutGraph(pl, opt) {
    const o = Object.assign({ nodeW: 132, nodeH: 34, resW: 108, resH: 24, gapX: 70, gapY: 18, pad: 16 }, opt);
    const g = dag(pl);
    const nodes = {}; let w = o.pad;
    g.layers.forEach((layer, li) => {
      const nw = li === 0 ? o.resW : o.nodeW, nh = li === 0 ? o.resH : o.nodeH;
      let y = o.pad;
      layer.forEach(n => {
        nodes[n.name] = { x: w, y, w: nw, h: nh, kind: n.kind, layer: li };
        y += nh + o.gapY;
      });
      w += nw + o.gapX;
    });
    // include put-target resources not already placed (outputs)
    const h = Math.max(...Object.values(nodes).map(n => n.y + n.h)) + o.pad;
    // center each layer vertically
    const maxH = h;
    for (let li = 0; li < g.layers.length; li++) {
      const ns = g.layers[li].map(n => nodes[n.name]);
      if (!ns.length) continue;
      const used = ns[ns.length - 1].y + ns[ns.length - 1].h - o.pad;
      const off = (maxH - 2 * o.pad - used) / 2;
      ns.forEach(n => n.y += off);
    }
    return { w: w - o.gapX + o.pad, h, nodes, edges: g.edges };
  }

  // small status-graph SVG for cards / thumbnails
  function miniGraphSVG(pl, W, H) {
    const g = layoutGraph(pl, { nodeW: 26, nodeH: 10, resW: 8, resH: 8, gapX: 22, gapY: 7, pad: 4 });
    const sx = W / g.w, sy = H / g.h, s = Math.min(sx, sy, 1.6);
    let out = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block">`;
    out += `<g transform="translate(${(W - g.w * s) / 2},${(H - g.h * s) / 2}) scale(${s})">`;
    for (const e of g.edges) {
      const a = g.nodes[e.from], b = g.nodes[e.to];
      if (!a || !b) continue;
      out += `<line x1="${a.x + a.w}" y1="${a.y + a.h / 2}" x2="${b.x}" y2="${b.y + b.h / 2}" stroke="#d5cfc9" stroke-width="1"/>`;
    }
    for (const [name, n] of Object.entries(g.nodes)) {
      if (n.kind === 'resource') {
        const r = pl.resources.find(r => r.name === name);
        const c = r && r.checkError ? '#FA8072' : (r && r.pinned ? '#FFA300' : '#b9b2ab');
        out += `<circle cx="${n.x + n.w / 2}" cy="${n.y + n.h / 2}" r="${n.w / 2}" fill="${c}"/>`;
      } else {
        const c = st(jobStatus(pl, name)).color;
        out += `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="2" fill="${c}"/>`;
      }
    }
    return out + '</g></svg>';
  }

  // history strip: last N builds of a job as squares
  function historyStrip(pl, job, n) {
    const bs = jobBuilds(pl, job).filter(b => b.job === job || true).slice(0, n || 8).reverse();
    return `<span class="hstrip">` + bs.map(b =>
      `<a href="#/b/${b.id}" title="#${b.n} ${st(b.status).label}" class="hcell" style="background:${st(b.status).color}"></a>`
    ).join('') + `</span>`;
  }

  // ---------- actions (simulated) -----------------------------------------
  function toast(msg) {
    let t = document.getElementById('piko-toast');
    if (!t) {
      t = document.createElement('div'); t.id = 'piko-toast'; document.body.appendChild(t);
    }
    t.textContent = msg; t.className = 'show';
    clearTimeout(t._h); t._h = setTimeout(() => t.className = '', 2600);
  }
  const ACT = {
    approve(id) {
      const b = getBuild(id); if (!b) return;
      b.status = 'started'; b.start = Date.now();
      const ap = b.steps.find(s => s.type === 'approve');
      if (ap) { ap.status = 'succeeded'; ap.log.push('approved by egon just now', 'gate passed (2/2)'); }
      b.steps.filter(s => s.status === 'pending' && s.type !== 'approve').forEach(s => s.status = 'started');
      toast('Approved — build started'); App.refresh();
      setTimeout(() => {
        b.status = 'succeeded'; b.end = Date.now();
        b.steps.forEach(s => { if (s.status === 'started') { s.status = 'succeeded'; if (!s.log.length) s.log.push('...done'); } });
        App.refresh();
      }, 9000);
    },
    reject(id) {
      const b = getBuild(id); if (!b) return;
      b.status = 'failed'; b.end = Date.now();
      const ap = b.steps.find(s => s.type === 'approve');
      if (ap) { ap.status = 'failed'; ap.log.push('rejected by egon just now'); }
      toast('Rejected — build failed'); App.refresh();
    },
    trigger(team, pipeline, job) {
      const pl = getPipeline(team, pipeline);
      const prev = jobBuilds(pl, job)[0];
      const n = prev ? prev.n + 1 : 1;
      const b = {
        id: 'b' + Math.floor(Math.random() * 1e9), team, pipeline, job, n,
        status: 'started', start: Date.now(), end: null, worker: 'helsinki-1',
        versions: prev ? prev.versions : {}, trigger: { kind: 'manual', user: 'egon' },
        steps: [{ name: 'running…', type: 'task', status: 'started', dur: 0, log: ['$ (simulated build)', 'working…'] }],
      };
      D().builds.push(b);
      toast(`Triggered ${job} #${n}`); App.refresh();
      const iv = setInterval(() => { b.steps[0].log.push('… ' + new Date().toLocaleTimeString()); App.refresh(); }, 1800);
      setTimeout(() => {
        clearInterval(iv);
        b.status = 'succeeded'; b.end = Date.now();
        b.steps[0].status = 'succeeded'; b.steps[0].dur = (b.end - b.start) / 1000;
        b.steps[0].log.push('done: OK'); App.refresh();
      }, 11000);
      return b;
    },
    retry(id) { const b = getBuild(id); if (b) ACT.trigger(b.team, b.pipeline, b.job.split('/')[0]); },
    cancel(id) {
      const b = getBuild(id); if (!b) return;
      b.status = 'cancelled'; b.end = Date.now();
      b.steps.forEach(s => { if (s.status === 'started' || s.status === 'pending') s.status = 'cancelled'; });
      toast('Build cancelled'); App.refresh();
    },
    pausePipeline(team, name) {
      const pl = getPipeline(team, name); pl.paused = !pl.paused;
      pl.jobs.forEach(j => j.paused = pl.paused);
      toast((pl.paused ? 'Paused ' : 'Unpaused ') + name); App.refresh();
    },
    pauseJob(team, name, job) {
      const pl = getPipeline(team, name); const j = pl.jobs.find(x => x.name === job);
      j.paused = !j.paused; toast((j.paused ? 'Paused ' : 'Unpaused ') + job); App.refresh();
    },
    pin(team, name, res, ref) {
      const pl = getPipeline(team, name); const r = pl.resources.find(x => x.name === res);
      r.pinned = (r.pinned === ref) ? null : ref;
      toast(r.pinned ? `Pinned ${res} @ ${ref}` : `Unpinned ${res}`); App.refresh();
    },
    check(team, name, res) { toast(`Checking ${res}…`); },
  };

  // ---------- live-build simulation ---------------------------------------
  function startLiveSim() {
    const b = getBuild(D().liveBuildId); if (!b) return;
    const step = b.steps[b.steps.length - 1];
    let i = 24;
    const iv = setInterval(() => {
      if (b.status !== 'started') { clearInterval(iv); return; }
      i++;
      step.log.push(`  ✓ spec ${String(i).padStart(2, '0')} (${(Math.random() * 2 + 0.1).toFixed(2)}s)`);
      if (i >= 48) {
        step.log.push('', '48 passed, 0 failed (78.0s)');
        step.status = 'succeeded'; step.dur = 78;
        b.status = 'succeeded'; b.end = Date.now();
        clearInterval(iv);
      }
      App.refresh();
    }, 2500);
  }

  // ---------- router / app shell ------------------------------------------
  const App = {
    _render: null,
    route() {
      const h = location.hash.replace(/^#\/?/, '');
      return h ? h.split('/').map(decodeURIComponent) : [];
    },
    go(path) { location.hash = path; },
    refresh() {
      if (!App._render) return;
      // preserve scroll of marked containers + window
      const saves = [];
      document.querySelectorAll('[data-keep-scroll]').forEach(el => {
        if (el.id) saves.push([el.id, el.scrollTop, el.scrollLeft]);
      });
      const wy = window.scrollY;
      App._render(App.route());
      for (const [id, t, l] of saves) { const el = document.getElementById(id); if (el) { el.scrollTop = t; el.scrollLeft = l; } }
      window.scrollTo(0, wy);
      // auto-follow logs marked as following
      document.querySelectorAll('[data-follow]').forEach(el => { el.scrollTop = el.scrollHeight; });
    },
    start(render) {
      App._render = render;
      window.addEventListener('hashchange', () => App.refresh());
      App.refresh();
      startLiveSim();
      setInterval(() => { if (document.querySelector('[data-live-times]')) App.refresh(); }, 5000);
    },
  };
  // delegate clicks on [data-act]
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    e.preventDefault();
    const [fn, ...args] = el.getAttribute('data-act').split('|');
    if (ACT[fn]) ACT[fn](...args);
  });

  // ---------- shared secondary screens ------------------------------------
  const Pages = {};
  Pages.teams = function () {
    return `<div class="pg"><h1>Teams</h1>` + D().teams.map(t => `
      <section class="card">
        <div class="cardhead"><b>${esc(t.name)}</b> <span class="mut">${esc(t.desc)}</span>
          <span class="sp"></span><button class="btn" data-act="noop">Invite member</button></div>
        <table class="tbl"><thead><tr><th>Member</th><th>Role</th><th>Last seen</th><th></th></tr></thead><tbody>
        ${t.members.map(m => {
      const u = D().users.find(u => u.username === m.user) || {};
      return `<tr><td><b>${esc(m.user)}</b> <span class="mut">${esc(u.name || '')}</span></td>
          <td><span class="role role-${m.role}">${m.role}</span></td>
          <td class="mut">${ago(u.lastSeen)}</td>
          <td class="r"><button class="btn sm">Change role</button> <button class="btn sm danger">Remove</button></td></tr>`;
    }).join('')}
        </tbody></table>
        <div class="mut pad">Pipelines: ${teamPipelines(t.name).map(p => `<a href="#/p/${t.name}/${p.name}">${esc(p.name)}</a>`).join(', ') || '—'}</div>
      </section>`).join('') + `</div>`;
  };
  Pages.workers = function () {
    const pend = pendingBuilds();
    return `<div class="pg"><h1>Workers</h1>
      ${pend.length ? `<div class="warnbox">⚠ ${pend.length} build(s) pending with no matching worker:
        ${pend.map(b => `<a href="#/b/${b.id}">${esc(b.pipeline)} / ${esc(b.job)} #${b.n}</a>
        <span class="mut">— needs tag <code>terraform</code>; only <b>builder-gpu</b> (stale) has it</span>`).join('; ')}</div>` : ''}
      <table class="tbl"><thead><tr><th>Worker</th><th>State</th><th>Team</th><th>Tags</th><th>Version</th><th>Running</th><th>Builds</th><th>Up</th></tr></thead><tbody>
      ${D().workers.map(w => `<tr>
        <td><b>${esc(w.name)}</b></td>
        <td><span class="dot" style="background:${w.status === 'online' ? '#00A83A' : '#FA8072'}"></span> ${w.status}${w.status === 'stale' ? ` <span class="mut">(last seen ${ago(w.lastSeen)})</span>` : ''}</td>
        <td>${w.team ? esc(w.team) : '<span class="mut">shared</span>'}</td>
        <td>${w.tags.map(t => `<code class="tag">${t}</code>`).join(' ')}</td>
        <td class="mut">${w.version}</td>
        <td>${w.running.length ? w.running.map(esc).join('<br>') : '<span class="mut">idle</span>'}</td>
        <td class="mut">${w.builds}</td><td class="mut">${ago(w.since)}</td></tr>`).join('')}
      </tbody></table>
      <div class="mut pad">Add a worker: <code>pikoci worker --pikoci-url … --worker-token …</code> — <button class="btn sm">Generate worker token</button></div></div>`;
  };
  Pages.audit = function (filter) {
    const f = filter || {};
    const rows = D().audit.filter(a => (!f.user || a.user === f.user) && (!f.q || (a.action + a.target).includes(f.q)));
    return `<div class="pg"><h1>Audit log</h1>
      <div class="filters">
        ${['', 'egon', 'maria', 'sam', 'system'].map(u => `<a class="chip ${((f.user || '') === u) ? 'on' : ''}" href="#/audit${u ? '/' + u : ''}">${u || 'all users'}</a>`).join('')}
      </div>
      <table class="tbl"><thead><tr><th>When</th><th>User</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead><tbody>
      ${rows.map(a => `<tr><td class="mut nowrap">${ago(a.at)}</td><td><b>${esc(a.user)}</b></td>
        <td><code>${esc(a.action)}</code></td><td>${esc(a.target)}</td><td class="mut">${esc(a.detail)}</td></tr>`).join('')}
      </tbody></table></div>`;
  };
  Pages.settings = function () {
    return `<div class="pg"><h1>Settings</h1>
      <section class="card"><div class="cardhead"><b>Profile</b></div>
        <div class="pad">Signed in as <b>egon</b> (via GitHub) · <button class="btn sm">Change password</button> · Theme: <button class="btn sm">light</button></div></section>
      <section class="card"><div class="cardhead"><b>API tokens</b><span class="sp"></span><button class="btn">New token</button></div>
        <table class="tbl"><thead><tr><th>Name</th><th>Scope</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>
        ${D().tokens.map(t => `<tr><td><b>${esc(t.name)}</b></td><td><code>${esc(t.scope)}</code></td>
          <td class="mut">${ago(t.created)}</td><td class="mut">${ago(t.lastUsed)}</td>
          <td class="r"><button class="btn sm danger">Revoke</button></td></tr>`).join('')}
        </tbody></table></section>
      <section class="card"><div class="cardhead"><b>Users</b> <span class="mut">(instance admin)</span></div>
        <table class="tbl"><thead><tr><th>User</th><th>Email</th><th>Auth</th><th>Last seen</th></tr></thead><tbody>
        ${D().users.map(u => `<tr><td><b>${esc(u.username)}</b> ${esc(u.name)}</td><td class="mut">${esc(u.email)}</td>
          <td><code>${esc(u.provider)}</code></td><td class="mut">${ago(u.lastSeen)}</td></tr>`).join('')}
        </tbody></table></section></div>`;
  };
  Pages.editor = function (team, name) {
    const hcl = D().hcl[`${team}/${name}`] || `# no config stored for ${team}/${name} in this prototype\n# (see main/pikoci for the full example)`;
    return `<div class="pg"><h1>Config · ${esc(team)}/${esc(name)}</h1>
      <div class="filters"><button class="btn">Validate</button> <button class="btn primary">Set pipeline</button>
        <span class="mut">rev 12 · last set by maria ${ago(Date.now() - 9 * 3600 * 1000)}</span></div>
      <div class="editorwrap"><pre class="editor" contenteditable="true" spellcheck="false">${esc(hcl)}</pre></div>
      <div class="okbox">✓ configuration valid — 6 jobs, 3 resources, 1 approval gate</div></div>`;
  };
  ACT.noop = () => toast('Not wired in this prototype');

  // ---------- log rendering ------------------------------------------------
  function renderLog(lines, opts) {
    const o = opts || {};
    return `<pre class="log">${lines.map((l, i) =>
      `<span class="ln" id="${o.id || 'L'}-${i + 1}"><span class="lno">${i + 1}</span>${colorLine(esc(l))}</span>`
    ).join('\n')}</pre>`;
  }
  function colorLine(l) {
    if (/FAIL|ERROR|Error |error:/.test(l)) return `<span class="l-err">${l}</span>`;
    if (/^ok\s|PASS|✓| OK$|: OK/.test(l)) return `<span class="l-ok">${l}</span>`;
    if (/^WARNING|⚠/.test(l)) return `<span class="l-warn">${l}</span>`;
    if (/^\$ /.test(l)) return `<span class="l-cmd">${l}</span>`;
    return l;
  }
  function firstFailStep(b) { return b.steps.findIndex(s => s.status === 'failed' || s.status === 'errored'); }

  // build meta line used by many variations
  function buildMeta(b) {
    const vs = Object.entries(b.versions).map(([r, v]) => `<code title="${esc(r)}">${esc(r.split('.')[0])}:${esc(String(v).slice(0, 7))}</code>`).join(' ');
    const trig = b.trigger.kind === 'manual' ? `manual by <b>${esc(b.trigger.user)}</b>` :
      b.trigger.kind === 'passed' ? `after <b>${esc(b.trigger.detail)}</b>` : `by <b>${esc(b.trigger.detail || 'resource')}</b>`;
    return `<span class="mut" data-live-times>${st(b.status).label} · started ${ago(b.start)} · ${fmtDur(buildDur(b))} · ${trig} · worker <b>${esc(b.worker)}</b> · ${vs}</span>`;
  }
  function buildActions(b) {
    const a = [];
    if (b.status === 'waiting_for_approval')
      a.push(`<button class="btn primary" data-act="approve|${b.id}">✓ Approve</button>`,
        `<button class="btn danger" data-act="reject|${b.id}">✕ Reject</button>`);
    if (b.status === 'started' || b.status === 'pending')
      a.push(`<button class="btn" data-act="cancel|${b.id}">Cancel</button>`);
    if (['failed', 'errored', 'cancelled', 'succeeded'].includes(b.status))
      a.push(`<button class="btn" data-act="retry|${b.id}">↻ Retry</button>`);
    return a.join(' ');
  }

  window.P = {
    STATUS, st, esc, fmtDur, ago, buildDur, RANK,
    pipelines, getPipeline, getBuild, teamPipelines, jobBuilds, pipelineBuilds,
    latestBuild, jobStatus, pipelineStatus, pipelineAttention,
    runningBuilds, needsApproval, pendingBuilds,
    dag, layoutGraph, miniGraphSVG, historyStrip,
    ACT, App, Pages, renderLog, colorLine, firstFailStep, buildMeta, buildActions, toast,
  };
})();
