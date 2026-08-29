# Preview ↔ pikoci docs — fidelity audit

How well does `preview/` represent the product that `pikoci/docs` describes?
Two independent passes (core model; platform/ops) against all 25 doc pages,
consolidated. The preview deliberately implements **UX-PLAN v4.1**, which
extends the product — so findings are bucketed by what they mean, not just
whether they match.

**Verdict: the spine is faithful, the edges drift.** Everything the docs
treat as central — resources/jobs/`passed`/`trigger`, matrix jobs, approval
gates with N approvers, pinning, pause, roles, team scoping, tag-based worker
routing, the audit log's shape, even the exact `pikoci run -p … -j …
--resource git.x=./` CLI syntax — is represented correctly, several down to
the documented hex colors (`--pause: #29ADFF`). The drift concentrates in
four places: lifecycle details the preview simplified, docs-promised UI the
preview never picked up, plan-features that read as if they exist today, and
terminology.

## A. Fidelity bugs — preview is wrong about today's product (fix in preview)

1. **Gate lifecycle.** Docs: a gated build waits consuming *no worker
   resources*, then Approved → Pending → Started. Preview runs the `get`
   step to success before the gate and jumps straight to `started` on
   approval (data.js #142; core.js `ACT.approve`).
2. **Reject requires a reason** (Approval-Gates.md); preview's reject
   records none and never asks (core.js `ACT.reject`).
3. **Job cadence doesn't exist.** Scheduling is only cron *resources* with
   `check_interval`; the preview's `cadence: '@daily'` job attribute and
   overdue-alerting on it model a field the product doesn't have
   (data.js nightly-e2e; core.js attention).
4. **Worker concurrency.** `--concurrency N` registers N workers named
   `name-1…name-N`; the preview's single row with `slots: 4` / `2/4 busy`
   is a different model (data.js WORKERS).
5. **Dispatch preference.** Docs: global workers *skip* a team's builds once
   that team has an online team worker; preview says and shows the opposite
   ("shared workers serve every team").
6. **Workers dashboard is admin-only** (Workers.md); the preview claims
   read-role users get a sanitized summary.
7. **Services shape.** Services start *before* any get/task step and get an
   unconditional `stop`; the preview renders `services` as a mid-run task
   step with no stop (data.js test-integration).
8. **API tokens can't rotate** — delete + recreate only (team *worker*
   tokens regenerate); Settings offers "rotate" and an undocumented
   "last used".
9. **Drain is worker-side** (`SIGQUIT` on the worker; the server sends
   nothing) — a server-UI drain button needs K21 worker addressing and
   should say so, or go.
10. **Audit action tense**: docs record `build.approved` / `pipeline.paused`
    / `resource.pinned`; preview writes `build.approve` / `pipeline.pause` /
    `resource.pin`.

## B. Docs-promised UI the preview lacks (adopt — the docs are ahead here)

- Versions tab actions: per-version **Play ▶ (trigger-with-version)** and
  **Pin 📌** buttons (Resource-Pinning.md) — preview's versions tab is
  read-only, even though its own rollback flow *is* trigger-with-version+pin.
- Manual-trigger **input forms** (`input` blocks → generated form with
  dropdowns/required fields) (Pipeline.md).
- Graph **share** button (SVG/PNG/Markdown export, hide_intermediates /
  group_parallel options) (Public-Pipelines.md).
- **Serial groups** — no representation anywhere (Pipeline.md).
- Job-level **pause** and blue paused job nodes in the graph (Pause.md).
- Workers dashboard columns: **Platform (OS/arch/Go), Uptime, Last Seen**,
  exclusive-tags marker; **delete stale worker**; the global **"no healthy
  workers" banner** on every page (Workers.md).
- **Audit filters** (user/action/pipeline include/exclude) (Audit-Log.md).
- Team Settings → **worker-token generation**; Profile → **API token
  creation flow** (role cap, one-time plaintext banner); auth-provider
  admin (Workers.md, API-Tokens.md, Authentication.md).
- Step hooks, `in_parallel`, if/else branches — the preview defines
  `skipped`/"branch not taken" but no data or view ever exercises it.

## C. Plan-extensions — fine, but label them as future in the preview

These implement UX-PLAN contracts, not current docs. They're the point of
the preview; the risk is only that a viewer can't tell future from present.
Consider a "planned" affordance (chip or footnote) on: fork-PR hold /
release-without-secrets (K7 — docs' PR mode triggers immediately, no fork
distinction, no per-build secret granting), decision records incl.
path-rules/`not-affected`, draft deferral, tiers (K5/K13), lineage
supersession-by-default (docs only have opt-in `interruptible`), version
metadata enrichment + forge links (K3 — docs' git check emits bare
`{ref}`/`{ref,pr}`), config revisions with CAS/diff/restore (K14),
Environments/drift/rollback (K11), ephemeral pools & autoscaling +
worker telemetry (K21+ — Scaling.md scales by *manually starting workers*),
provenance intent/resolved (K1), storage/retention classes (K8), per-user
notifications (K15 — note: Slack/Discord/github-check notifications *are*
shipped per Notifications.md; only per-user channels are future — the
Settings copy currently over-claims absence).

## D. Terminology to align (cheap, do in preview)

| Preview says | Docs say |
| --- | --- |
| running | Started |
| needs approval | Waiting for Approval |
| online (worker) | healthy |
| shared (worker team) | Global |
| revoke (token) | delete |
| `git (pr)` resource type | `git` type with `pr` param |
| cron version `ref: tick-210` | cron version field `date` |
| build.approve (audit) | build.approved |

Cross-check note: the run-locally block was independently verified **exactly
right** against CLI.md (`-p`, `-j`, `--resource type.name=path`) — worth
protecting with a test when ported.

*Sources: pikoci/docs @ audit time; preview @ commit 8f5ef6d. Bucket A+D are
preview fixes; B feeds REQUIREMENTS/UX-PLAN as adopted doc-features; C feeds
the "planned" labeling decision.*
