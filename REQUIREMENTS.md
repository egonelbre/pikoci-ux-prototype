# PikoCI UX Requirements

This document captures what the PikoCI frontend must do, who uses it, and what each
role's daily workflow looks like. It is the yardstick for evaluating the UX prototypes
in `prototypes/`.

PikoCI's domain model (from the backend):

```
Team ─┬─ Members (role: read / write / maintain / admin)
      ├─ Pipelines ─┬─ Resources (instances of resource types, with versions, pinnable)
      │             ├─ Jobs ─┬─ Steps (get / task / put / in_parallel, services)
      │             │        ├─ Approval gate (optional, N approvals)
      │             │        └─ Builds (history; statuses below)
      │             ├─ Variables / Secrets
      │             └─ Notifications, Triggers (webhooks, cron)
      ├─ Workers (host / docker runners; can be team-scoped)
      ├─ Audit log (append-only, filterable)
      └─ API tokens (personal or team-scoped)
```

Build statuses (actual backend enum): `pending`, `started`, `succeeded`,
`failed`, `cancelled`, `waiting_for_approval`, `warning` (allow_failure
failed), `skipped`. An infra-failure status (`errored`) does **not** exist
yet and is a required backend addition (see UX-PLAN §5). Pipelines and jobs
can be `paused`. Resources can be `pinned` to a version.

## 1. Functional requirements

### 1.1 Orientation ("what is the state of my world?")

- R1. A user must see the health of all pipelines they care about in one glance —
  without clicking into each one. Red must be findable in under 2 seconds.
- R2. Running builds must be visibly *alive* (animation / progress / elapsed time).
- R3. Builds waiting for approval must be impossible to miss — they represent a
  human bottleneck, not a machine one.
- R4. Paused pipelines/jobs and pinned resources must be visually distinct so nobody
  wonders "why isn't this triggering?"
- R5. The answer to "what changed?" must be one step away: which resource version
  (commit) triggered a build, and what its metadata is.

### 1.2 Pipeline comprehension

- R6. The structure of a pipeline — which resources feed which jobs, which jobs gate
  which (`passed` constraints) — must be understandable from the UI, not only from HCL.
- R7. Both small (2 jobs) and large (30+ jobs, matrix/for_each fan-out) pipelines must
  stay legible. Fan-out instances should group, not explode the view.
- R8. Job state and its latest builds must be visible in the context of the structure
  (a graph node / stage cell is also a status indicator and a link).

### 1.3 Build investigation ("why is it red?")

- R9. From "pipeline is red" to "the failing log line" must take at most 3 clicks.
- R10. Build detail must show: steps in execution order, per-step status + duration,
  per-step logs (streaming for running builds), the resource versions used, services
  started, and worker that ran it.
- R11. Long logs (100k+ lines) must stay usable: collapse per step, search/filter,
  jump-to-failure, tail-follow for running builds, timestamps toggle.
- R12. Comparing a failed build with the previous succeeded one (what versions
  changed) should be supported, at minimum by making both reachable side by side.
- R13. Secrets must never appear in logs (backend masks; UI must not undo that).

### 1.4 Actions

- R14. Trigger job, re-run (retry) build, cancel running build — one click from
  wherever the build is seen, with permission-gating (write+).
- R15. Approve / reject an approval gate (maintain+), showing who already approved
  and how many approvals remain.
- R16. Pause/unpause pipeline and individual jobs (write+); pin/unpin resource
  versions and "trigger with version" (write+).
- R17. Destructive or irreversible actions (delete pipeline, reject build) need
  confirmation; routine ones (retry, trigger) must not nag.
- R18. Pipeline create/update via HCL upload or editor (maintain+), with validation
  feedback before applying.

### 1.5 Administration & operations

- R19. Team management: members, roles, invites (admin). Every team needs ≥1 admin.
- R20. Worker fleet: which workers exist, online/stale, what they're running,
  team-scoped tokens. (Role reality: PikoCI has read/write/maintain/admin +
  a global-admin flag — no "operator" role; worker routes are global-admin
  today, and any wider visibility is the deliberate, sanitized policy change
  UX-PLAN K16 contracts.)
- R21. Audit log: filterable by user / action / pipeline; answers "who triggered
  this deploy?" and "who changed this pipeline?" (read+ visibility).
- R22. API tokens: create/revoke personal and team tokens (self / admin).
- R23. Server-level: users list, OAuth providers (instance admin).

### 1.6 Public / anonymous

- R24. Public pipelines must be viewable with zero login friction: status, graph,
  builds, logs. No dead-end "sign in" walls; hide actions instead.
- R25. Status badge / embeddable SVG discoverable from the pipeline page.

### 1.7 Non-functional

- R26. UI must work well at 3 scales: 1 pipeline hobby project, ~10 pipelines team,
  ~100 pipelines org. Navigation cost must not grow linearly with pipeline count.
- R27. Live-updating everywhere without manual refresh (SSE/polling); a build page
  left open overnight must show the truth in the morning.
- R28. Fast: initial paint under 1s on the single-binary server; no heavy frontend
  build chain (current stack is Preact + no bundler — keep that spirit).
- R29. Keyboard-friendly for daily drivers: at minimum, search/jump (`/` or `cmd+k`),
  next-failure, follow-logs.
- R30. Deep-linkable: every pipeline, job, build, step, even log line has a URL.
- R31. Works on a phone at "glance and approve" level (check status, read tail of a
  log, approve a gate) — full editing can be desktop-only.
- R32. Light/dark themes; status must be distinguishable without color alone
  (icons/shapes for color-blind users).

### 1.8 Added in the v4.1 audit (R33–R37)

Six review rounds revealed that the original list under-spans what the
plan actually builds; these close the gap (UX-PLAN Appendix B keys on
them):

- R33. **Non-run transparency**: every job that *could* have run for a
  change but didn't must expose a recorded reason (blocked, skipped,
  deferred, held, paused, pinned-mismatch, no version, superseded) with
  the unblocking action. R1–R12 cover only things that ran; the absence
  of a build is a first-class fact.
- R34. **Outputs on the build page**: what a build produced — artifact
  manifest, sizes, checksums, destination links — and structured test
  results, one click from the build. (The original R10/S4 omitted
  artifacts entirely.)
- R35. **Ownership & attention with honest degradation**: attention
  routing by ownership where owner data exists; an explicit unclaimed
  lane where it doesn't; "mine" only when the identity join exists;
  never silent misattribution.
- R36. **CLI parity**: every mutating verb the UI offers exists in the
  API and CLI in the same release.
- R37. **Meta-record honesty**: history features state their persistence
  preconditions (the in-memory backend loses everything on restart);
  meta-records (decision records, receipts, config history) have visible
  retention.

**Authority order** (so the documents can't argue in a circle): the
SCENARIOS importance matrix calibrates *priority*; this document states
*capability*; UX-PLAN decides *design and sequence*. Where they
conflict, fix the upstream document — don't reinterpret it.

## 2. Roles and their journeys

### 2.1 Anonymous visitor (Public, level 0)

Who: an open-source user checking whether `master` is green, or a contributor
checking their PR build.

Journey: lands on a pipeline URL from a README badge → sees graph + latest builds
→ opens the failing job's log → leaves. Never logs in.

Needs: instant load, zero chrome that assumes membership, obvious status,
readable logs. Nothing else.

### 2.2 Developer (Read → Write, levels 1–2)

Who: the largest group. Pushes commits, watches builds, fixes failures.

Daily loop: push → glance "did CI pick it up?" → wait/watch → if red: open failing
build → find failing step → read log → fix → push → retry.

Needs: R1–R14 dominate. Wants the *shortest possible* path from notification to log
line. Wants to retry flaky builds without ceremony. Wants to trigger a job manually
when testing pipeline behavior. Rarely cares about teams/workers/audit pages.

### 2.3 Release manager / lead (Write → Maintain, levels 2–3)

Who: coordinates deployments, owns "is main releasable?".

Journeys:
- Deploy day: watches the deploy pipeline end-to-end; approves the production gate
  (R15); pins the release resource to a known-good version during an incident (R16).
- Incident: pauses the deploy job, pins the last good version, unpauses after fix.
- Wants history: "when did we last deploy, what version, who approved?" (R21, R5).

Needs: approval UX, pin/pause visibility, version-centric views, audit answers.

### 2.4 Pipeline author (Maintain, level 3)

Who: the person who writes the HCL.

Journeys: create pipeline → iterate on config (edit → set → watch first build fail →
read error → edit again) → manage resources (webhook tokens, check intervals) →
occasionally rename/delete.

Needs: R18 (editor with validation), fast feedback loop between config change and
build result, resource check status/errors surfaced (a broken `check` is invisible
in many CI tools), graph view to verify the DAG they think they wrote is the DAG
they got.

### 2.5 Team admin (Admin, level 4)

Who: manages people and settings for a team.

Journeys: add member with role → change roles → review audit log → manage team API
tokens and worker tokens → team settings (name, public defaults) → delete team.

Needs: R19–R22. Infrequent visits; clarity beats efficiency. Must be prevented from
removing the last admin.

### 2.6 Platform operator (instance admin)

Who: runs the PikoCI server itself (often the same person as 2.5 in small setups).

Journeys: monitor worker fleet health (R20) → investigate "builds stuck pending"
(no worker with matching tags?) → manage users and OAuth providers (R23) → watch
resource check errors across pipelines.

Needs: fleet dashboard, stuck-work diagnostics, cross-team visibility.

### 2.7 The scale spectrum (cuts across roles)

- **Solo / hobby**: 1 team, 1–3 pipelines. The dashboard *is* the pipeline page.
  Ceremony (teams, roles) must stay out of the way.
- **Small team**: ~10 pipelines. Dashboard = wall of pipelines; daily use centers on
  2–3 hot ones. Favorites/pinning of pipelines matters.
- **Org**: many teams, ~100 pipelines. Search, grouping, and "my stuff" filtering
  become primary navigation; a flat wall stops working.

## 3. Screen inventory (full app surface)

Every prototype variation must make these reachable (even if minimally):

| # | Screen | Primary roles | Core content |
|---|--------|---------------|--------------|
| S1 | Dashboard / pipelines overview | all | all pipelines + health, running now, needs-attention |
| S2 | Pipeline detail | all | structure (jobs+resources), status, actions (pause, trigger) |
| S3 | Job detail / build history | dev | builds over time, durations, pause job |
| S4 | Build detail + logs | dev | steps, logs, versions, retry/cancel, approval gate |
| S5 | Resource detail | author, lead | versions, pin/unpin, trigger-with-version, check status |
| S6 | Pipeline config / editor | author | HCL view/edit, validation, set |
| S7 | Team & members | admin | members, roles, invites |
| S8 | Workers | operator | fleet, status, running builds, tokens |
| S9 | Audit log | lead, admin | filterable event list |
| S10 | Settings / tokens / profile | all | API tokens, password, theme |

## 4. What "nice to use" means here (evaluation criteria)

When comparing prototypes, score each 1–5 on:

1. **Time-to-red**: how fast do you find the thing that's broken? (R1, R9)
2. **Time-to-log-line**: clicks + scrolling from dashboard to failing log line. (R9–R11)
3. **Structure legibility**: can a newcomer explain the pipeline after 30 seconds? (R6–R8)
4. **Action proximity**: is retry/approve/pause where your eyes already are? (R14–R16)
5. **Scale behavior**: does it survive 100 pipelines / 30-job DAGs / 100k-line logs? (R7, R11, R26)
6. **Liveness**: does watching a running build feel calm or chaotic? (R2, R27)
7. **Ceremony cost**: how much chrome does a solo user pay for org features? (R26)
8. **Deep-linkability**: does every interesting thing have a URL? (R30)
