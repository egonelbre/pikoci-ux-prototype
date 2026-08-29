# pikoci-ux

UX exploration for a new PikoCI frontend. Minimal visual design on purpose — the
goal is to compare information architecture and flows, then pick a direction.

- `preview/` — **the reference implementation**: open `preview/index.html`
  in a browser. A standalone app implementing UX-PLAN v4.1's semantics over
  fake data — two-family reason display (waiting / won't run), primary-context
  card roll-ups, capability-gated nav with teaching empty states (try
  "Simulate solo install" in Settings), the attention strip with all its
  classes, per-ref graph coloring with trunk-latest annotations, build page
  v2 (error-first, provenance, compare-with-last-green, run-locally, held/
  queue/stall sub-states), the bound approval card with
  superseded-while-waiting, lineage supersession, a held fork PR with
  maintainer release, Environments with guided rollback, idempotent actions
  with conflict answers, ⌘K palette, `f`/`/` keys, light/dark. This is what
  the real Phase 1a/1b/2 build ports.
- `UX-PLAN.md` — **the synthesis (v4 — final document round)**: design
  thesis with a differentiator-first strategic frame; opaque run_id +
  lineage identity; unified status vocabulary (non-runs are decision
  records, not builds); capability-gated IA; contracts K1–K22 with a
  persistence doctrine (the `mem` default named), lands columns, and
  fallbacks; Phase 0 → 1a → 1b → 2–5 with cut lines; §10 replaces further
  review with six code spikes + one memo, four today-bugs to file, and a
  hard stopping rule. Appendix A holds the round-3/4 disposition deltas
  (108 findings total across eight review rounds, all folded in; the
  retired round 1–4 review files measured convergence 22→16→13→12 and
  produced the stopping rule v4.1 adopts). Start here.
- `PLAN-REVIEW-5.md` — the fifth (latest) adversarial round; its fix
  batch (R5-1..R5-5) is deliberately deferred until the external
  round-5 pass returns (`REVIEW-PROMPT-CODEX.md` is that prompt).
  Rounds 1–4 were retired once every finding was dispositioned in
  UX-PLAN v4.1.
- `REQUIREMENTS.md` — system requirements, roles, user journeys, and the scoring
  criteria (§4) for judging prototypes.
- `SCENARIOS.md` — comprehensive catalog of 81 CI/CD usage scenarios, each
  with frequency / stakes / priority metrics in an importance matrix (inner
  loop incl. monorepo/merge queues, diagnosis incl. caches & reproducible
  rebuilds, release/deploy incl. locks & plan-review-apply, scheduled
  automation, operations incl. break-glass, collaboration, artifacts,
  security & supply chain), each with its ideal workflow, plus a coverage map
  showing which prototypes serve which scenarios and what's still missing.
- `RESEARCH.md` — survey of how existing CI platforms (Concourse, GitHub Actions,
  GitLab, Buildkite, Jenkins, TeamCity, Drone, Dagger, Vercel, …) lay out their
  information, and what each taught the prototypes.
- `prototypes/` — **open `prototypes/index.html` in a browser** (plain `file://`
  works, no server needed). Twelve interactive variations over one shared fake
  dataset (`prototypes/shared/data.js`); shared helpers in `shared/proto.js`.

Each variation covers the full app surface (dashboard, pipeline, jobs, builds +
logs, resources/pinning, approval gates, config editor, teams, workers, audit,
settings) in a different paradigm:

| # | Paradigm | Inspired by |
|---|----------|-------------|
| 01 | Graph-first | Concourse |
| 02 | Runs-first | GitHub Actions |
| 03 | Stage columns | GitLab CI |
| 04 | Waterfall + dockable panel | Buildkite |
| 05 | Wallboard / TV mode | CCTray, Concourse HD |
| 06 | Miller columns | Finder, TeamCity tree |
| 07 | Terminal, keyboard-first | k9s, lazygit |
| 08 | Trace of spans | Dagger Cloud |
| 09 | Activity feed | Vercel |
| 10 | Dense table + weather | TeamCity, Jenkins classic |
| 11 | Attention inbox (triage) | novel |
| 12 | Canvas map (spatial) | novel |
| 13 | **Synthesis** — attention strip + card wall home, graph/table/runs toggles, error-first build page, run waterfall, ⌘K palette | layers 11+01+10+02+04+08+07 |
| 14 | **Change-centric** — PR/commit as first-class axis: per-ref graph coloring, ownership-scoped inbox, superseded commits demoted, fork CI approval, queue surfacing (loads extra `shared/data-pr.js`) | fixes 13 for PR-triggered tests |

Built-in scenarios to test in every variation: a live running build (streams and
completes), a deploy waiting for approval (approve/reject actually works), a
failed docs build, a failing resource check, a pinned+paused release pipeline,
and a build stuck pending with no matching worker. Trigger/retry create real
simulated builds.
