# CI/CD Usage Scenarios & Ideal Workflows

A catalog of concrete situations in which people interact with a CI/CD system,
and what the *ideal* workflow looks like in each. This is the ground truth the
UX should be designed against: `REQUIREMENTS.md` says what the system must do,
this document says what a good day (and a bad day) actually looks like.

Format per scenario — **Who**: persona · **Trigger**: what starts it ·
**Ideal**: the workflow as it should be · **Pain today**: where existing tools
fail · **UX**: implications, with requirement refs (R#) and prototype refs (V#).

Frequency guides priority: scenarios marked ⚡ happen many times a day and
deserve zero-friction paths; 🔥 are rare but high-stakes (incidents, releases)
where clarity beats speed; 🔧 are occasional chores where guidance beats memory.

---

## A. The inner development loop

### A1. ⚡ Push to trunk, confirm CI picked it up
**Who**: developer. **Trigger**: `git push` to master.
**Ideal**: within seconds of pushing, the developer can glance somewhere (UI,
badge, editor status, notification) and see "your commit e4d0a11 → build #144
started". They do *not* wait around; they get notified only on failure.
**Pain today**: polling a runs page; uncertainty whether the webhook fired;
"is it my commit or the previous one being tested?"
**UX**: commit→build linkage visible everywhere (R5); "started" state with the
triggering version on the card/row (V13 home, V9 feed); silent success —
notify on state *change* (green→red, red→green), not on every build.

### A2. ⚡ Open a PR, get a verdict
**Who**: developer. **Trigger**: PR opened / commit pushed to PR branch.
**Ideal**: checks start within seconds; PR page (in the forge) shows live
status; a failing check links *directly to the failing step's log line*, not
to a CI homepage. Superseded commits auto-cancel. The developer never opens
the CI UI unless something is red.
**Pain today**: deep-link lands on a run summary needing 2-3 more clicks;
stale builds waste workers; "expected — waiting for status" limbo when a
webhook is lost.
**UX**: this is V14's whole reason to exist: per-commit scoping, auto-cancel,
error-first build page (R9-R11). GitHub Checks notification must carry the
deep link to the failing step.

### A3. ⚡ CI failed on my change — diagnose and fix
**Who**: developer. **Trigger**: red notification.
**Ideal**: one click from notification to the first failing log line, with the
error excerpted above the fold (V13/V14 error box). From there: what command
ran, in what environment, with which versions. Fix locally, push; the new
build replaces the old one in every view. Total CI-UI time: under a minute.
**Pain today**: scrolling 10k-line logs; the *first* error buried under
cascade errors; unclear which of 40 matrix legs actually differs.
**UX**: R9-R11; first-failure extraction; matrix legs grouped with only the
divergent leg highlighted (R7); "compare with last green" one click (R12).

### A4. ⚡ Reproduce a CI failure locally
**Who**: developer. **Trigger**: "works on my machine" — CI disagrees.
**Ideal**: the build page shows the exact recipe: task command, runner/image,
env var names, service containers, resource versions. One copyable command —
`pikoci run -p pipeline.hcl -j test --resource git.pikoci=./` — reruns the
same job locally against the working tree. Local run output looks identical
to the CI log, so diffs jump out.
**Pain today**: CI is a black box; recreating the environment takes longer
than the fix; act/dagger exist precisely because of this gap.
**UX**: a "run this locally" snippet on every build page (PikoCI already has
`pikoci run` — the UI just needs to advertise it); full environment metadata
on the build (R10). This is a genuine PikoCI differentiator; surface it.

### A5. Retry a flaky failure
**Who**: developer. **Trigger**: failure that smells unrelated to the change.
**Ideal**: retry is one click, never nags for confirmation (R17), and the
system *remembers*: the new build links to the retried one, and if the retry
passes, the pair is recorded as a flake signal (see B3). The developer is not
silently training themselves to retry everything.
**Pain today**: retries are invisible ("why did #88 run twice?"); flake data
is lost; retry retries the whole run when one leg would do.
**UX**: retry at job granularity; retried-from/retried-by links on builds;
flake counter fed by pass-after-retry (V10 weather is the display surface).

### A6. Iterate on the pipeline definition itself
**Who**: pipeline author (maintain). **Trigger**: editing `pipeline.hcl`.
**Ideal**: edit → validate (schema + graph rendered from the *proposed*
config, before applying) → set → the first build under the new config is
labeled "config rev 13". Errors point at HCL lines. A config change that
breaks checks/triggers is distinguishable from a code failure. Config history
is diffable: "what changed between rev 12 and 13, and who did it?"
**Pain today**: the commit-push-wait-fail loop on YAML; config errors surface
as cryptic runtime failures; no config history in most tools.
**UX**: R18; validation preview showing the would-be DAG (V01 graph reused);
config revision stamped on builds; audit already records `pipeline.set`.

### A7. Run a one-off job with parameters
**Who**: developer/lead. **Trigger**: "run the load test against staging with
50k users".
**Ideal**: trigger dialog exposes the job's declared variables with defaults;
the resulting build displays the parameter values it ran with; the exact run
is repeatable from its build page ("run again with same inputs").
**Pain today**: parameters via env-var conventions; no record of what values
a manual run used.
**UX**: variables (R18) surfaced in the trigger flow; parameters shown in
build metadata (R10); manual trigger attribution in audit (R21).

### A8. Stacked / dependent changes
**Who**: developer. **Trigger**: PR B builds on unmerged PR A.
**Ideal**: CI tests B *as it will land* (merged with A, or with trunk once A
merges), and re-tests the stack automatically when A changes. Status clearly
says which base the result applies to.
**Pain today**: green checks against a stale base; merge trains exist only in
high-end setups.
**UX**: the version-context banner (V14) must name the *merge base*, not just
the head SHA; re-test-on-base-change is scheduler work surfaced as "retested:
base moved".

### A9. 🔧 Set up CI for a brand-new project
**Who**: developer/author. **Trigger**: new repo, blank page.
**Ideal**: from zero to a first green build in minutes, through the whole
chain, not just the config: pick a starter template (Go service, static
site, container image) → get runnable commented HCL → connect the repo
(credentials/deploy key tested with a "check connection" button, webhook
registered with a verified test delivery) → validate → first build runs.
Setup errors are recoverable in place: a failing clone, a bad credential, or
a missed webhook each point at their own fix, and the setup state survives
partial completion ("webhook registered ✓, first check pending…"). Empty
states everywhere teach the next step instead of showing blank tables.
**Pain today**: cargo-culting YAML from another repo; setup failures
half-way (webhook silently wrong, credential valid-but-underscoped) that
only surface days later as B9.
**UX**: template gallery + guided connect flow in create-pipeline (R18);
test buttons for credentials and webhooks; setup checklist persisted on the
pipeline until first green build; every empty state is an instruction (F1).

### A12. Draft / WIP pull requests
**Who**: developer. **Trigger**: PR opened as draft, pushed to frequently.
**Ideal**: drafts run a cheap tier (lint, unit) on every push; expensive
jobs (matrix, integration, E2E) defer until "ready for review" — and the PR
row says so explicitly ("integration: deferred (draft)"), so omitted checks
read as intentional, never as missing or failed-to-trigger (B11). Marking
ready triggers the full set on the current head; the author can force the
full tier on a draft when they want it *(the force action is part of the
tier policy contract — UX-PLAN K13a — not a free-floating button)*.
**Pain today**: either drafts burn full CI on every WIP push, or teams
disable draft CI entirely and merge-readiness is a surprise.
**UX**: check tiers as policy (pairs with A10's affected-set logic); a
"deferred" display state distinct from skipped/not-run; V14 rows show tier
coverage per commit.

### A10. Monorepo: build only what changed
**Who**: developer in a large repo. **Trigger**: PR touches `services/api/`
only.
**Ideal**: the system computes affected targets (by path rules or build-graph
query) and runs only those jobs; skipped jobs report "skipped — not affected"
(distinct from "not run", so branch protection can treat them as satisfied).
The PR row shows 4 of 30 jobs ran and *why*. A "run everything anyway"
override exists for paranoia.
**Pain today**: 40-minute full builds for a README change, or hand-rolled
path filters that silently skip too much.
**UX**: a fourth job-state ("skipped/not-affected", grey-with-reason) in
every status roll-up; affected-set explanation on the run page. This also
changes V14's job-dots semantics — dots need a skipped rendering.

### A11. Busy trunk: batching and merge queues
**Who**: team with >20 merges/day. **Trigger**: commits land faster than CI
cycles.
**Ideal**: trunk builds batch (test the newest, mark intermediates
"superseded, covered by #148") with automatic bisect-on-failure to find the
culprit inside a failed batch (B1). For pre-merge protection, a merge queue
tests PRs against trunk+queue-ahead and lands them in order; the queue
position and ETA are visible on the PR row.
**Pain today**: either every commit builds (queue explodes) or only the
latest does (culprit-finding is manual).
**UX**: superseded-on-trunk mirrors V14's superseded commits; merge-queue
position joins the queue surfacing from E2; batch-failure UI needs "these N
commits are under suspicion" state on the change rows.

### A13. Config as shared state: conflicts and rollback
**Who**: two authors; later, whoever broke it. **Trigger**: concurrent edits
to the same pipeline config; or rev 14 breaks CI and rev 13 was fine.
**Ideal**: `set` is compare-and-swap on the config revision: a stale editor
gets a conflict with a three-way diff, never a silent overwrite. Config
revisions are a browsable history (who/when/diff — A6), and "restore rev 13"
is one audited action that creates rev 15 (a revert, not a rewrite), so the
history stays honest. Builds always name the rev they ran under.
**Pain today**: last-writer-wins config; recovery by finding the old YAML in
someone's terminal scrollback.
**UX**: revision guard in the editor (R18); config history page with diff +
restore; pairs with H1 (which rev ran) and B9 (config change as a "why did
behavior change" suspect).

---

## B. Failure diagnosis beyond the happy path

### B1. 🔥 Trunk is red — who broke it, and unblock everyone
**Who**: whole team; usually the last merger + a lead. **Trigger**: trunk CI
fails after a merge.
**Ideal**: the failure notification names the *change* (commit, author,
message), not just the job. The build page shows "first red at #142; last
green #141; changes in between: [one commit]" — usually that's the answer.
If several commits landed together, one click launches bisect-style builds on
the intermediate versions. The fix path (revert or fix-forward) is a normal
PR; trunk-red state is prominently visible to everyone until green.
**Pain today**: correlating builds↔commits by hand; bisecting manually;
nobody notices trunk is red for an hour.
**UX**: change↔build correlation as a first-class view (V10 Changes, V14
trunk tab; R5, R12); "changes since last green" on every red trunk build;
trunk-red banner scoped to trunk (V14's scoping keeps PR noise out of it).

### B2. Fails in CI, passes locally
**Who**: developer. **Trigger**: divergent results.
**Ideal**: the build page answers the standard suspects without digging:
which worker (OS/arch/tags), which runner image, cache state (cold/warm),
service versions, resource versions, timezone/locale, parallelism. A "rerun
with verbose logging" and a "rerun on a different worker" button. For the
hard cases: an ephemeral debug session into the same environment (or, in
PikoCI's model, `pikoci run` with the same pinned versions — see A4).
**Pain today**: env differences are invisible; SSH-to-runner is a premium
feature elsewhere.
**UX**: environment block on build page (R10); rerun variants; worker link
from build (V shared Pages.workers).

### B3. Flaky tests erode trust
**Who**: lead / whole team. **Trigger**: retries become a habit.
**Ideal**: the system computes flakiness (pass-after-retry, alternation) per
job/test and shows it: weather icons, a flake board sorted by cost (failures
× duration × frequency). Known-flaky tests can be quarantined (run but don't
fail the build) with an expiry date and an owner, so quarantine is a tracked
debt, not a rug.
**Pain today**: flakiness lives in team folklore; retry-until-green is
invisible policy; quarantine lists rot.
**UX**: V10 weather + trend sparklines are the seed; needs retry linkage (A5)
and a flake dashboard; quarantine state must be visible in build results
("passed, 2 quarantined") so green stays honest.

### B4. The build got slower
**Who**: lead/developer. **Trigger**: "CI takes 20 minutes now, it was 8."
**Ideal**: duration trend per job (sparkline → chart) with annotations at
config revs and cache changes; the run waterfall shows where wall-clock goes
(queue vs serial chains vs the slowest matrix leg); step-level timing shows
*which step* grew. Comparing the waterfall of a fast run vs a slow run is one
click.
**Pain today**: nobody notices gradual slowdowns; timing data exists but not
the comparison view.
**UX**: V04 waterfall + V10 sparklines (R7 eval criterion 5); "compare runs"
is the missing composite; queue time must be broken out separately (E2).

### B5. Infrastructure failure, not code failure
**Who**: developer first, operator second. **Trigger**: registry 500s, git
clone timeout, worker dies mid-build, disk full.
**Ideal**: the system classifies it: `errored` (orange, infra) ≠ `failed`
(red, your code). Errored builds auto-retry with backoff a bounded number of
times before notifying — the developer ideally never sees the blip. Repeat
errors roll up for the operator ("14 errored builds, all `git clone timeout`,
all on helsinki-2").
**Pain today**: infra failures paged to developers as "your build failed";
retry storms hide systemic issues.
**UX**: an infra-failure status must be *added* — PikoCI's real enum
(succeeded/failed/started/cancelled/pending/waiting_for_approval/warning/
skipped) has no infra-vs-code distinction today, so this scenario carries a
backend contract, not just UI; the UI must then keep the colors and
*filters* distinct everywhere; operator-side clustering of error causes
(V11 inbox item kind); auto-retry visible in build history.

### B6. Resource check broke — the silent failure
**Who**: pipeline author/operator. **Trigger**: token expiry, API change;
new versions stop being detected. Nothing turns red — builds just stop.
**Ideal**: check failures are loud: attention item ("docker.image check
failing 3h — builds won't trigger"), resource marked on the graph, and
"last checked / last new version" timestamps visible so staleness is
noticeable even before an error.
**Pain today**: the classic Concourse trap; discovered days later as "why
didn't the deploy run?"
**UX**: already modeled (R4; check-error in V01/V11/V13/V14); staleness
heuristic ("no new versions in 7d on a daily-commit repo") is the next step.

### B7. Cache trouble
**Who**: developer, then operator. **Trigger**: build fails (or passes!)
because of a stale, corrupted, or poisoned cache; or got slow because caches
went cold.
**Ideal**: every build states its cache facts: which caches, hit/miss, age,
size. "Retry without cache" is one click and the resulting build is labeled
so. Operators can inspect and evict caches per resource-type/job; a
cache-hit-rate trend catches silent regressions (B4).
**Pain today**: "clear the cache and pray" folklore, with no button for it;
cache poisoning is invisible.
**UX**: cache block in build metadata (R10); retry-variant actions (B2);
cache admin in the operator surface. PikoCI resource-type caching exists in
the model — the UI never mentions it yet.

### B8. 🔥 Rebuild an old release, months later
**Who**: release engineer. **Trigger**: CVE patch for v0.9.2 from last year;
or an auditor asks "prove this binary came from this source."
**Ideal**: the old build page still exists with its exact inputs: resource
versions, toolchain/runner image digests, config revision, variable values.
"Re-run with original inputs" reproduces it (hermetic enough to bit-match,
or at least to build); divergences are diffed against the original log.
**Pain today**: the runner image was `latest`, the toolchain is gone, the
config was overwritten — old releases are unreproducible in practice.
**UX**: builds must record *resolved* inputs (digests, not tags) — a data
model demand more than a screen; retention policy for release-tagged builds
differs from PR builds (G1); pairs with provenance (H2).

### B9. ⚡ The build that never started
**Who**: developer first ("I pushed, nothing happened"), operator second.
**Trigger**: a push/PR/tag produces no build — the most disorienting failure
mode because there is nothing red to click.
**Ideal**: a "why no build?" answer is reachable from the pipeline page:
recent webhook deliveries with status and payload (redeliverable), recent
resource check runs with what they saw ("checked 2m ago — HEAD unchanged"),
and the filter/branch rules that were evaluated. The common causes are
distinguished mechanically: webhook never arrived vs. check saw nothing new
vs. version detected but filtered out vs. pipeline/job paused vs. pinned
resource ignoring newer versions (each of these already has state in the
model — it needs one page that lines them up). Manual reconcile: "check now"
(exists); webhook *re*delivery is a forge-side action — PikoCI's webhook is
a payload-less poke, so the panel shows an inbound receipt log and links to
the forge's redeliver rather than pretending to own one.
**Pain today**: silence; developers retrigger by pushing empty commits;
operators grep server logs.
**UX**: a trigger-diagnostics panel per pipeline: webhook log + check log +
decision trace ("version e4d0a11 seen 09:14 → job lint: triggered #145; job
deploy: held, pinned to f0b6d15"). B6 is one cause; this scenario is the
front door to all of them.

### B10. Watch a live build; cancel a hung one
**Who**: developer. **Trigger**: a build runs long; output stopped.
**Ideal**: live logs stream with follow mode and survive reconnects (laptop
sleep, network blips) without losing position or duplicating lines. The UI
distinguishes "running and producing output" from "no output for 9m"
(stall indicator with last-output timestamp — often the real signal, R2).
Cancel works on both running and queued builds, takes effect fast, and shows
its aftermath: which steps were killed, services torn down, workspace
cleaned, worker freed. A cancel that *doesn't* complete (zombie build) is
itself surfaced to the operator.
**Pain today**: silent stalls eat an hour before anyone acts; cancel buttons
that "work" but leave the worker wedged; reconnects that reset the log view.
**UX**: last-output-age on running steps everywhere the pulse animation
appears; cancel confirmation shows cleanup status; follow-mode and scroll
preservation are already prototyped (V02/V13) — reconnect semantics are the
untested half (R27).

### B11. "Why didn't this job run?"
**Who**: developer/author. **Trigger**: a run completed but some job in the
graph shows nothing — was it skipped, blocked, deferred, paused, or broken?
**Ideal**: every non-run job can explain itself in one sentence, in place:
"waiting: upstream test-unit failed" (V14 already does this one) ·
"skipped: not affected by this change (A10)" · "deferred: draft tier (A12)"
· "held: approval gate upstream" · "paused by egon 5h ago" · "no version
satisfying `passed: [build]` yet" · "pinned resource excludes this version".
The explanation names the blocker *and* the unblocking action, gated by
role.
**Pain today**: grey boxes with no story; users retrigger things that were
correctly held, or wait forever on things that will never run.
**UX**: a `reason` on every non-run job node/dot, rendered as tooltip +
detail line; this is the scheduler exposing its decision, the single
highest-leverage transparency feature in the catalog — it serves A10, A12,
C5, C8, and R4 at once.

### B12. Duplicate and out-of-order triggers
**Who**: nobody, until the verdict is wrong. **Trigger**: webhook
redelivery, a retried check, or clock skew produces two builds for one
event — or an older commit's slow build finishes *after* a newer commit's
fast one.
**Ideal**: triggering is idempotent (event IDs deduplicated; a redelivery
attaches to the existing build rather than spawning a twin), and verdict
reporting is monotonic: a build result only ever updates the status of *its
own* version — a late finish for an old commit can never repaint a newer
commit's PR check. Where duplicates do occur, the UI shows them linked
("duplicate of #145, deduplicated") instead of as mystery builds.
**Pain today**: double builds burning workers; the classic race where an old
red overwrites a new green on the PR.
**UX**: mostly backend correctness, but it has a display contract: statuses
are keyed by (version, job), never "latest event wins" — V14's per-ref
scoping is the model that makes this safe.

### B13. A pinned version disappears upstream
**Who**: author/release manager. **Trigger**: the pinned image tag was
deleted from the registry, the artifact aged out, the commit was
force-pushed away.
**Ideal**: the check that discovers the vanished version marks it clearly on
the resource ("pinned f0b6d15 — no longer available upstream, last verified
3d ago"); dependent jobs fail early with that explanation (B11 reason:
"pinned version unavailable") rather than deep inside a pull step; the fix
path is guided — unpin, or pin to the nearest still-available version, shown
with their diffs. *(Per UX-PLAN: no detection mechanism exists — checks only
discover new versions. This ideal requires an optional `verify` command in
the resource-type protocol, which is an explicitly named, unscheduled gap.)*
**Pain today**: cryptic pull failures hours later; nobody connects them to
the pin.
**UX**: version availability as resource-page state; the pin badge gains a
broken variant; guided unpin/repin flow (R16).

### B14. Failure ownership and routing
**Who**: team at scale. **Trigger**: a red job in shared/monorepo CI — whose
red is it?
**Ideal**: jobs/components declare owners (CODEOWNERS-style mapping);
failures notify the owner first, not a shared channel; an unclaimed failure
escalates after a timeout; a failure can be explicitly assigned/reassigned
("investigating: maria"), and that state shows on the job everywhere, so two
people don't debug the same red or, worse, nobody does.
**Pain today**: diffusion of responsibility — trunk stays red because it's
everyone's job; TeamCity's "investigations" remain the only mainstream
attempt.
**UX**: owner metadata on jobs; assignment state on failures (V11 inbox
routes by it — "yours" vs "your team's" vs "unclaimed"); escalation is
notification discipline (ideal #1) applied to ownership.

---

## C. Release & deployment

### C1. Continuous deployment on green
**Who**: nobody, ideally. **Trigger**: trunk build passes.
**Ideal**: deploy job runs automatically; humans only hear about state
changes ("v0.9.4 live") and failures. The *current deployed version* is
always visible ("prod: f0b6d15, 2h ago") without archaeology.
**Pain today**: answering "what's actually running in prod right now?"
requires spelunking through job logs.
**UX**: an environment/version panel — "what's where" — is a missing screen
in ALL 14 variations; add to the next round. Deploy builds link to the diff
since the previous deploy (R5, R12).

### C2. ⚡ Gated production deploy
**Who**: release manager (maintain+). **Trigger**: build waiting for
approval.
**Ideal**: the approver gets a notification with *decision context inline*:
what's in this deploy (commits since last prod deploy), test summary, who
else approved (1/2), staging status. Approve/reject from wherever they are —
inbox, phone, chat. The gate records who/when/why; retries of an
approved-then-failed build don't re-ask (PikoCI already does this).
**Pain today**: "approve" buttons with zero context — approvers rubber-stamp
or context-switch to investigate; approvals buried in a job page nobody has
open.
**UX**: the strongest cross-variation lesson: waiting-for-human must be
globally visible (R3, R15; V11/V13/V14 inbox). Add the diff-since-last-deploy
to the approval card (R31 for the phone path).

### C3. 🔥 Hotfix during an incident
**Who**: on-call + lead. **Trigger**: prod is broken; a one-line fix exists.
**Ideal**: a documented fast path that stays safe: pin the deploy resource to
the known-good version (stops the bleeding / prevents accidental deploys of
unrelated trunk work), run the hotfix through a minimal required-checks
subset, deploy with the gate satisfied by incident policy (e.g. 1 approval
instead of 2), unpin afterward. Every step lands in the audit log; the UI
shows "incident mode" state (pinned + paused) prominently so it gets
cleaned up.
**Pain today**: people bypass CI entirely under pressure (SSH + hand-deploy),
then state drifts; or the "fast" path is 40 minutes of full matrix.
**UX**: pin/pause are PikoCI primitives (R16) — the UX gap is a *composed*
story: V11's "still paused — intentional?" nudge is the cleanup half; a
"required vs full checks" distinction per job would enable the fast half.

### C4. 🔥 Rollback
**Who**: on-call. **Trigger**: the new deploy is bad.
**Ideal**: from the deploy job's history, pick the previous good build →
"deploy this version again" → confirm. One minute, no HCL editing. The
version-pinning model makes it natural: trigger-with-version on the known
good ref (PikoCI has this), plus a pin so the scheduler doesn't immediately
roll forward again.
**Pain today**: rollback is a runbook, not a button; or re-runs rebuild from
scratch when the artifact still exists.
**UX**: "trigger with version" + pin as one guided action ("Rollback…") on
the deploy job (R14, R16); deployed-version panel (C1) is the entry point.

### C5. Promote through environments
**Who**: release manager. **Trigger**: build passed dev, promote to staging,
then prod.
**Ideal**: the same *artifact/version* flows through env stages —
promotion, not rebuild. The pipeline graph shows the version at each stage
("staging: 9f31c02, prod: f0b6d15"); promoting is approving the next gate.
**Pain today**: rebuild-per-environment (unrepeatable); or promotion state
scattered across pipelines.
**UX**: PikoCI's `passed` constraints model this exactly (R6); the graph
should annotate *which version* sits at each stage boundary — a small but
high-value addition to V01/V13 graphs.

### C6. Scheduled release train
**Who**: release manager. **Trigger**: cron (weekly release) or manual.
**Ideal**: a parameterized release job: cut tag, build artifacts for all
platforms, changelog from commits since last tag, publish packages, create
release page — as one visible run with an approval gate before publish.
Dry-run mode for rehearsal.
**Pain today**: releases as shell scripts on a maintainer's laptop; partial
failures (3 of 5 platforms published) with unclear resume.
**UX**: matrix fan-out with per-leg retry (R7, A5); "resume from failed
step" for multi-step publishes; cron resources are native to PikoCI.

### C7. Code freeze / deploy windows
**Who**: lead/admin. **Trigger**: big launch, holiday freeze, compliance
window.
**Ideal**: freeze = pause the deploy jobs (not the tests) with a reason and
an end date; the UI shows "frozen until Jan 2 (reason) by egon" wherever a
deploy would be triggered; unfreezing is one action and un-missable when the
date passes.
**Pain today**: freezes enforced by tribal knowledge and Slack pins; someone
deploys anyway.
**UX**: pause-with-reason-and-expiry is a small model extension with big UX
value; V11's "still paused — intentional?" becomes "freeze expired
yesterday — unfreeze?" (R4).

### C8. Deploy concurrency: locks and superseding
**Who**: team with frequent deploys. **Trigger**: a deploy is running and
another becomes ready; or two people trigger at once.
**Ideal**: deploys to one environment serialize on an explicit lock, visible
as a state: "queued behind deploy #87 (running 3m)". Queued deploys of the
*same* pipeline supersede each other — only the newest waits (deploying an
already-stale version is almost never right, but the superseded one is shown
struck-through, resurrectable). The lock holder is always identifiable, and
a stuck lock can be broken (maintain+, audited).
**Pain today**: double-deploys racing; or a global "one build at a time"
hammer that serializes unrelated work.
**UX**: lock/serialization state as a first-class build status annotation
(distinct from worker-queue pending, E2); supersede-in-queue mirrors V14;
"break lock" is an audited escape hatch (ideal #5).

### C9. Plan-review-apply (infrastructure pipelines)
**Who**: platform engineer + approver. **Trigger**: IaC change (terraform,
k8s manifests, DB migrations).
**Ideal**: the pipeline produces a *plan* (diff of what would change); the
approval gate presents that plan as its decision context — approve means
"apply exactly this plan", and the apply step fails if the world drifted
since planning. The plan artifact is retained with the approval record.
**Pain today**: approvers approve blind while the plan sits in a log 3
clicks away; plan and apply run against different states.
**UX**: this is C2's "context inline" made concrete: gate cards can embed a
designated step's output/artifact. The fake data's terraform pipeline is
exactly this shape — the UI should treat plan-output-on-the-gate as a
supported pattern, not a custom hack.

### C10. A change that spans repositories
**Who**: developers on two services. **Trigger**: API change in repo A,
client update in repo B — must test together, land coordinated.
**Ideal**: repo B's PR can declare "test against repo A's PR #481" (a
resource override, pin-for-this-run); CI runs the cross-product that
matters and labels results with both refs. Landing order is guided:
"A must merge first; B's build will retrigger when A's main moves."
**Pain today**: hand-edited dependency pins, force-merged pairs, broken
main in between.
**UX**: PikoCI resources make "test against version X of the other repo"
natural (trigger-with-version, R16) — the missing UX is declaring it from
the PR side and showing dual-ref context (V14's banner generalized to
multiple refs).

### C11. Approval integrity: staleness and races
**Who**: approvers. **Trigger**: after maria approved (1/2), a new commit
arrived — or two maintainers act on the gate at the same moment.
**Ideal**: an approval is bound to the exact inputs it was given for
(version, config rev, plan artifact — C9). *(Corrected per UX-PLAN v3/v4:
in PikoCI a build's inputs are fixed at creation, so "inputs changed under
an approval" cannot happen — what happens is a newer build/change
**supersedes** the waiting one, and the gate shows a superseded banner
rather than "invalidated" copy.)*
Concurrent decisions resolve deterministically: first write wins, the
second actor sees "already rejected by egon 4s ago" instead of a double
action; a single rejection ends the gate (PikoCI's rule) even if an approve
lands simultaneously.
**Pain today**: approve-then-push-then-deploy ships unreviewed code on a
stale blessing; racing clicks double-trigger deploys.
**UX**: approvals display *what* they approved, not just who/when; gate
cards show invalidation events; actions are idempotent server-side
(ideal #9).

### C12. Approver unavailable
**Who**: the person blocked; the absent approver's team. **Trigger**: the
deploy needs 2 approvals, one designated approver is on a plane.
**Ideal**: gates support policy-safe outs, all audited: delegation
(approver hands the duty to a peer of equal role, time-boxed), escalation
(after N hours waiting, the gate notifies the next tier), and expiry (a
build waiting >X days fails politely rather than haunting the queue). What
never exists: a quiet admin bypass — policy changes are loud, versioned
config changes (A13), not favors.
**Pain today**: releases blocked on one person's PTO; or the opposite —
admins override gates ad hoc and the gate becomes theater.
**UX**: waiting-gate cards show wait time, who *can* act (F7's "who can
help" pattern), and the escalation clock; delegation as a first-class
audited action (R15, R21).

### C13. Post-deploy verification
**Who**: on-call. **Trigger**: deploy succeeded; is the service actually
healthy?
**Ideal**: the deploy job's last steps are verification (smoke tests, health
probes, error-rate watch for N minutes), and the UI separates the phases:
"deployed ✓ · verifying… · verified ✓". A verification failure is its own
state — the deploy *mechanically* worked but the release is bad — which arms
the rollback path (C4) with one click and, in the log, shows the health
signal that tripped. Distinguishing "deploy step failed" from "app degraded
after deploy" changes who responds and how.
**Pain today**: green deploy jobs for broken releases; verification lives in
a separate monitoring tool with no link back to the deploy that caused it.
**UX**: verification steps as a marked phase in the build page; the
deployed-versions panel (C1) shows verification state per environment;
failed verification is a distinct attention item wired to rollback.

### C14. Canary / progressive rollout
**Who**: on-call/release manager. **Trigger**: deploys go to 5% → 25% → 100%.
**Ideal**: the rollout is one long-running, inspectable build: current
percentage, health comparison (canary vs. baseline), and three actions —
pause, promote, abort-and-rollback — with auto-rollback on threshold breach
recorded like any other action ("rolled back automatically: error rate
2.1% > 1%"). The pipeline graph shows the rollout as a stage with live
progress, not a black box between "deploy" and "done".
**Pain today**: progressive delivery lives in a separate tool (Argo
Rollouts, Flagger) and CI shows only "triggered ✓"; on-call flips between
dashboards during the most dangerous minutes.
**UX**: long-running-step progress UI (percentage + live metrics excerpt);
the approval-gate card pattern reused mid-flight ("promote to 100%?" —
C2/C9); this is the strongest case for R2's "visibly alive" applied beyond
logs. 🏢-leaning; single-binary shops may never use it.

---

## D. Scheduled & non-commit automation

### D1. Nightly heavy suite
**Who**: team, asynchronously. **Trigger**: cron (nightly).
**Ideal**: expensive tests (full matrix, fuzzing, benchmarks, E2E) run
off-peak; the morning view answers "did nightly pass, and if not, what's
new vs yesterday?" — a diff of failures, not a wall of red. Benchmarks
publish trend charts, alert on regression thresholds.
**Pain today**: nightly failures rot because nobody owns the morning check;
benchmark noise.
**UX**: "new failures vs previous run" as the default nightly presentation
(R12 generalized); scheduled runs must not pollute the PR/trunk attention
scoping (V14 lesson applies to cron too — a third context, "scheduled").

### D2. Dependency update bots
**Who**: nobody, then a reviewer. **Trigger**: renovate/dependabot opens 15
PRs at 06:00.
**Ideal**: bot PRs are visually grouped and de-prioritized in every list;
green bot PRs can auto-merge by policy; only the red ones surface, and they
surface as *one* attention item ("3 dependency PRs failing"), not 15 rows.
Worker capacity for bot storms is rate-limited so human PRs aren't starved.
**Pain today**: bot PRs drown the run list and the queue every morning.
**UX**: author-class (human/bot) as a filter dimension in V14's rows and the
queue scheduler; queue fairness surfaced (E2).

### D3. CI as a general scheduler
**Who**: operator/author. **Trigger**: cron — backups, cert renewal, data
jobs, cache warming, repo mirroring.
**Ideal**: these jobs are boring and invisible while green; their attention
behavior differs from tests — *missed or overdue runs* matter as much as
failures ("cert-renewal hasn't succeeded in 40 days; expiry in 5"). Last
success age is the health metric.
**Pain today**: CI UIs assume everything is commit-shaped; a failed backup
looks like any red build and gets ignored.
**UX**: per-job "expected cadence" with overdue detection — a natural
extension of PikoCI's check_interval; V11 inbox item kind "overdue".

### D4. Rebuild on upstream change
**Who**: nobody. **Trigger**: base image / upstream library / API spec
resource publishes a new version.
**Ideal**: the resource check detects it, dependent pipelines rebuild, and
failures say "triggered by docker.golang 1.25.2 (was 1.25.1)" — the *cause*
is a version bump, not a commit, and the UI says so.
**Pain today**: mystery builds ("nothing changed, why did it run and fail?").
**UX**: trigger attribution on every build (R5) — PikoCI's resource model
makes this natural; V14's change-centric rows generalize: a "change" can be
an upstream version, not just a PR.

### D5. Cron overlap: still running at the next tick
**Who**: operator/author. **Trigger**: the hourly job took 70 minutes.
**Ideal**: per-job overlap policy, declared and displayed: **skip** (default
— record "skipped: previous run still active" as a B11 reason), **queue**
(at most one waiting), or **cancel-previous** (for jobs where only latest
matters). The run history shows overlap events so a chronically-overrunning
job is diagnosable (B4).
**Pain today**: pile-ups of a slow cron job exhausting workers, or silent
skips nobody chose.
**UX**: policy field in HCL; overlap outcomes visible in build history; an
attention item when a job overruns its own cadence repeatedly (D3).

### D6. Missed schedules after downtime
**Who**: operator. **Trigger**: server or workers were down over the
weekend; 40 cron ticks never fired.
**Ideal**: on recovery, a deliberate catch-up policy per job: skip missed
runs (tests — the latest tick suffices), run once for the gap (backups,
reports), or replay each (data pipelines) — with a burst limiter so recovery
doesn't stampede the workers, and a visible reconciliation list ("missed 12
ticks → ran 1 catch-up") mirroring PikoCI's existing unpause behavior (no
build flood, only post-unpause versions trigger).
**Pain today**: either a thundering herd at boot, or silently missing
backups discovered much later (D3's overdue case, caused by the platform
itself).
**UX**: catch-up policy in HCL; post-recovery report joins E7's
reconciliation surface.

---

## E. Operating the platform

### E1. 🔧 Add / upgrade / drain a worker
**Who**: operator. **Trigger**: capacity need, worker version upgrade, OS
patching.
**Ideal**: generate token → start worker → it appears with tags and starts
taking builds. Drain mode: finish current builds, accept nothing new, then
safe to kill — visible countdown. Version skew (worker older than server) is
flagged before it bites.
**Pain today**: kill-and-hope; builds die with the worker; skew discovered
via weird failures.
**UX**: Pages.workers (all variations) is the surface; add drain state and
skew warnings (R20). Build pages already name their worker.

### E2. ⚡ "Why is my build queued?"
**Who**: developer asks, operator answers. **Trigger**: build pending
longer than usual.
**Ideal**: the pending build itself says why. *(Corrected per UX-PLAN:
with pull-based worker dispatch, position and ETA would be fabricated — the
honest answer is "1 matching worker for tag `darwin`, busy; M builds ahead
for this tag", no ETA.)* The operator view aggregates: queue depth per tag
over time → the capacity-planning answer.
**Pain today**: pending is a black hole; the #1 source of "CI is down"
pings.
**UX**: modeled in V14 (queue position + reason) and V11 (stuck-build
diagnosis); needs the per-tag queue chart for operators; distinguish
"no matching worker online" (config problem, alert now) from "busy"
(capacity, maybe fine) — the stuck-terraform scenario in the fake data.

### E3. 🔧 Upgrade the CI server
**Who**: operator. **Trigger**: new PikoCI release.
**Ideal**: single binary swap; running builds drain or survive; workers
reconnect; a post-upgrade banner shows version and any migration notes.
Rollback is keeping the old binary + the DB file (PikoCI's portability
story).
**UX**: version visible in the footer/settings; worker skew view (E1).

### E4. 🔧 Migrate from another CI
**Who**: author/operator. **Trigger**: adopting PikoCI.
**Ideal**: a translation guide per source system (Concourse doc exists);
run both in parallel on the same repo during transition; a config linter
that flags untranslatable constructs. First-run experience: example
pipelines runnable in-memory with zero setup (PikoCI's `--db-system mem`).
**UX**: docs concern mostly, but the editor's validation (A6) is where
migration errors will actually be experienced.

### E5. Audit & compliance evidence
**Who**: admin/lead; sometimes an external auditor. **Trigger**: "show me
who deployed to prod in Q3 and who approved each deploy."
**Ideal**: filterable, exportable audit answers in minutes: deploys ×
approvers × versions × timestamps. Immutability stated. Access reviews:
who has which role, when granted.
**Pain today**: screenshot archaeology.
**UX**: audit log exists (R21) with filters; add export + saved queries;
approval records rendered on the build permanently (C2).

### E6. Secrets lifecycle
**Who**: admin/author. **Trigger**: rotation policy, a leak scare, an
expired token (B6's usual cause).
**Ideal**: secrets have owners, creation dates, and last-used timestamps;
rotation is an update in one place; nothing ever appears in logs (masking —
PikoCI does this); a leak drill answers "which jobs could read this secret?"
*(Scoped per UX-PLAN: owners/last-used are uncollected data today — v1 of
the inventory shows only what config declares: secret types + secret-backed
variables per pipeline; the rest waits for a usage-recording contract.)*
**UX**: a secrets inventory page (missing from all variations — only
implied); last-used from build metadata; blast-radius listing per secret.

### E7. 🔥 CI itself is down — break glass
**Who**: on-call, at the worst moment. **Trigger**: the CI server or its
workers are the outage, and a critical deploy can't wait.
**Ideal**: a documented, rehearsed bypass: deploy manually using the same
scripts CI runs (possible because jobs are plain commands — `pikoci run`
against local checkouts covers even this), record the action, and
*reconcile afterward*: when CI returns, it detects the out-of-band deploy
(deployed version ≠ last CI deploy) and prompts to re-run verification
against what's live. DR for the server: restore = binary + DB file (PikoCI's
portability), with a documented RTO.
**Pain today**: bypasses happen anyway, unrecorded, and CI's picture of
"what's deployed" is silently wrong forever after.
**UX**: drift detection on the deployed-versions panel (C1) — "live version
was not deployed by CI"; a break-glass runbook page in docs; audit backfill
entry ("manual deploy recorded retroactively").
For a *degraded-but-up* platform incident, add the operator's comms loop: a
status banner in the UI ("workers degraded since 09:12 — builds queueing,
none lost"), the queued-vs-lost distinction made explicit after recovery
(builds that were running on a died worker are `errored` and auto-retried,
B5 — never silently missing), and a post-recovery reconciliation report:
what re-ran, what needs a human, what was deployed during the gap.

### E8. Priority: jump the queue
**Who**: on-call with a hotfix; operator setting policy. **Trigger**: the
hotfix build sits behind 15 bot builds (D2).
**Ideal**: builds have priority classes (hotfix > human > bot > nightly) set
by policy, plus a one-off "bump" action (write+, audited) that visibly
reorders the queue. The queue view shows classes, so starvation is
diagnosable.
**Pain today**: FIFO queues treat a production hotfix and a dependabot
rebuild identically; people "fix" it by cancelling strangers' builds.
**UX**: priority as a visible attribute in E2's queue view; bump action on
pending builds; fairness policy per team (F6).

### E9. 🔧 Configure — and trust — notifications
**Who**: every user (preferences), author (pipeline notifications).
**Trigger**: too much noise, or worse: a missed approval request.
**Ideal**: per-user event×channel matrix (state changes, approvals, my PRs
only) with per-pipeline mute/watch overrides; a "send test notification"
button per channel; and a delivery log — when a Discord webhook starts
failing, the *notification system's own failure* is surfaced (an attention
item, since a broken notifier silently breaks C2 and ideal #1). Muting is
visible and expiring, like every escape hatch (ideal #5).
**Pain today**: notification config scattered and untestable; failed
deliveries invisible; people mute everything and miss the one that
mattered.
**UX**: settings page gains the matrix + test buttons; notification
delivery status joins the resource-check pattern (B6) — fire-and-forget
still needs a visible failure count.

### E10. 🔧 API token lifecycle
**Who**: developer (personal), admin (team tokens). **Trigger**: new
integration; rotation policy; a token found in a log.
**Ideal**: create with explicit scope and expiry → the value is shown
exactly once, copy-button, never again → the list shows last-used (already
modeled) and *used-by-what* (source IP / user-agent hint) → rotate =
create-new + grace period + revoke-old, with a "what breaks if I revoke
this now?" answer from usage data. Expired-token failures identify
themselves clearly on the caller's side (401 with token name).
**Pain today**: mystery tokens nobody dares revoke; rotation breaks
integrations discovered by outage.
**UX**: Pages.settings token table gains scope/expiry/usage columns and the
copy-once creation flow; stale-token attention item ("unused 90d — revoke?").

### E11. 🔧 Auth providers, users, and lockout
**Who**: instance admin. **Trigger**: configuring SSO; an employee leaves;
the OAuth provider is down; the admin locks themselves out.
**Ideal**: add/test an OIDC provider before enforcing it; per-user view of
linked identities with account-linking conflicts resolved explicitly (same
email, two providers); disabling a user takes effect immediately including
open sessions and their personal tokens (E10). Local auth + SSO coexist
(PikoCI supports this) so a provider outage or misconfiguration never locks
out the admin — and the break-glass local login path is documented, audited,
and alarmed when used.
**Pain today**: SSO cutover bricking logins; offboarding that misses tokens;
"we'll fix auth via the DB" surgery.
**UX**: provider test button; user page shows identities + sessions +
tokens as one revocation surface; lockout-recovery documented in Deployment
docs and linked from the login error page.

### E12. 🔧 Rename, archive, delete — with the blast radius shown
**Who**: admin/maintain. **Trigger**: cleanup, reorg, project end-of-life.
**Ideal**: destructive/renaming actions present their consequences *before*
confirmation: renaming a pipeline lists what breaks (badge URLs, webhook
endpoints, deep links, API consumers by token usage) and offers redirects;
deleting shows dependents (pipelines consuming this one's outputs, C10),
build history retention ("47 builds, 12 release-tagged — archive instead?"),
and requires typing the name. Archive is the reversible default: hidden from
lists, history intact, badge frozen. Teams follow the same pattern, plus the
last-admin rule (R19).
**Pain today**: renames silently 404 badges and integrations; delete is
either scary-forbidden or one careless click.
**UX**: consequence preview as a standard confirmation pattern; archive
state joins the pipeline lifecycle (paused ≠ archived); redirects for
renamed public pipelines (F8).

### E13. Quarantine a faulty worker
**Who**: operator. **Trigger**: one worker fails builds that pass elsewhere
(bad disk, stale toolchain, flaky network) — B5's clustering points at it.
**Ideal**: cordon the worker (schedule nothing new; distinct from E1's
planned drain), re-run its recent suspect builds on other workers with one
action, and see the verdict ("14 re-runs: 13 passed elsewhere — worker
implicated"). The cordoned state names who/why/when and nags like every
escape hatch (ideal #5).
**Pain today**: killing the worker destroys the evidence; failures blamed on
code for days.
**UX**: cordon action + state in Pages.workers; "failed only on X" cluster
view; bulk re-run-elsewhere.

### E14. Storage pressure and retention
**Who**: operator. **Trigger**: the disk (or artifact store) is filling.
**Ideal**: a storage view answers what's consuming space — logs, artifacts,
caches — by pipeline/age, with retention policy visible next to reality;
cleanup is previewed before executed ("deleting PR logs >90d frees 41 GB;
12 release-tagged builds are exempt" — B8/G1 exemptions honored) and runs as
an ordinary audited job.
**Pain today**: disk-full at 3am; cleanup scripts that delete the one build
the auditor wanted.
**UX**: storage breakdown page; retention policy per class (PR / trunk /
release); dry-run preview as the confirmation (E12's pattern).

### E15. 🔥 Back up and restore the control plane
**Who**: operator. **Trigger**: DB corruption, bad migration, lost volume.
**Ideal**: backup is boring — for PikoCI, the DB (plus secrets material) is
the whole state, and the docs say exactly what a backup must include and
what restore *cannot* recover: builds running at snapshot time restart or
land as `errored` (B5), never vanish ambiguously; queued work is replayed or
reported. After restore, a reconciliation report (E7) lists the gap. Restore
is rehearsed — the portability story (`bundle + move`) doubles as the drill.
**Pain today**: backups that miss secrets or webhooks config; restores
discovered broken during the disaster.
**UX**: a documented backup contract + post-restore report; version/state
banner after restore ("restored from 04:00 snapshot — 2h gap, 7 builds
reconciled").

---

## F. Collaboration, teams, and open source

### F1. 🔧 Onboard a new team member
**Who**: new developer + admin. **Trigger**: first day.
**Ideal**: SSO login → team membership with read/write → the pipeline graph
*teaches* the pipeline (a newcomer explains the build after 30 seconds of
graph, R eval 3) → their first PR runs checks with zero setup on their part.
**UX**: V01/V13 graph legibility is the onboarding tool; empty states
("no builds yet — trigger one") must teach.

### F2. Open-source maintainer triage
**Who**: maintainer. **Trigger**: morning coffee; 8 community PRs.
**Ideal**: one list: which PRs are green (reviewable now), which awaiting CI
approval (fork gate — approve in bulk for trusted-looking docs changes),
which red (comment "CI says X"). Public pipeline means contributors see
their own logs without accounts (R24) and never email "what does this
failure mean?"
**UX**: V14 is this scenario; bulk CI-approval and a "trusted contributor"
allowlist are the missing conveniences.

### F3. Drive-by contributor
**Who**: outsider, zero context. **Trigger**: their PR failed.
**Ideal**: the check link opens the failing step publicly, no login wall
(R24); the error is comprehensible or links to CONTRIBUTING; they can run
the same check locally from the recipe (A4). They never need to learn the
CI system.
**UX**: public build pages must hide actions, not content; error-first
layout matters most for the least-context audience.

### F4. Reviewer deciding mergeability
**Who**: reviewer. **Trigger**: review requested.
**Ideal**: beside the diff: checks summary, coverage delta, artifact links
(built docs preview, binary size change, screenshots), flake context
("test-unit failed but it's the known-flaky one — retried green"). The
reviewer never opens the CI UI for a green PR.
**UX**: most of this renders in the forge via Checks; CI's job is rich
check summaries + artifact links (G1/G2); flake annotation from B3.

### F5. Lead's weekly health review
**Who**: tech lead. **Trigger**: recurring ritual.
**Ideal**: one page: success rate trend, duration trend, top flakes by cost,
queue-time trend, slowest jobs, oldest red pipeline, stale quarantines and
pauses. Each item links to its evidence and its fix path.
**Pain today**: assembled by hand from four tools, so it doesn't happen.
**UX**: an insights/health page — missing from all 14 variations by design
(daily-use focus); it composes data the prototypes already fake (durations,
statuses, weather). Next-round candidate.

### F6. Multi-team isolation on shared infra
**Who**: platform team + product teams. **Trigger**: org growth.
**Ideal**: teams see their own world by default (pipelines, workers if
team-scoped, audit); the operator sees across. Noisy-neighbor problems
(one team's matrix storm starving another's deploys) are visible and
tunable (per-team quotas / worker tags).
**UX**: PikoCI teams + team-scoped workers exist; the UX gap is default
scoping of every list to "my teams" (R26) and per-team queue views (E2).

### F7. 🔧 Membership lifecycle: role changes and offboarding
**Who**: team admin. **Trigger**: promotion, team switch, departure.
**Ideal**: invite → role assignment → later changes are one action with the
role's meaning shown inline (what write vs. maintain actually permits, R19);
offboarding is one page: remove memberships, revoke sessions and personal
tokens (E10/E11), reassign anything they own (notification targets,
investigation-style assignments), all recorded in audit. The last-admin rule
is enforced with a helpful error ("assign another admin first — candidates:
maria"). When a member hits a permission wall mid-task, the denial names the
missing role and *who can grant it*, turning dead-ends into requests.
**Pain today**: offboarding checklists in wikis; permission-denied as a bare
403; ghost accounts with live tokens.
**UX**: Pages.teams gains role tooltips and the offboard flow; permission
errors throughout the app follow the "denied → why → who can help" pattern.

### F8. 🔧 Status badge lifecycle
**Who**: maintainer. **Trigger**: adding the badge to the README; later, the
pipeline is renamed or made private.
**Ideal**: the badge page (V01 has the seed) offers the embed snippet with
scope choices — whole pipeline, one job, one branch — and a preview exactly
as anonymous visitors will see it (verify the R24 path *from* the badge
flow). Renames keep badges working via redirects (E12); making a pipeline
private turns its badge into an explicit "private" image rather than a 404,
so READMEs degrade gracefully.
**Pain today**: dead badges after renames; badges that leak status of
now-private projects, or break with no explanation.
**UX**: badge generator with scope + preview-as-anonymous; badge behavior on
rename/visibility change specified, not accidental.

### F9. "You don't have access" — done right
**Who**: a developer hitting a private pipeline link. **Trigger**: a shared
deep link (ideal #2 means links travel further than permissions).
**Ideal**: the denied page says what this is at a harmless level ("a private
pipeline in team `platform`"), why access is denied (not a member), and the
safe route in: request access (delivered to the team's admins with the
requester and the link they tried), or the F7 pattern's "who can help".
No dead-end 404-lying (which breaks the "does this even exist?" question
differently for public vs private — pick a policy and state it).
**Pain today**: bare 403/404s generate DM-the-admin folklore; or worse,
over-sharing to avoid the friction.
**UX**: request-access flow on denial pages; admin-side approval lands in
the inbox (V11); consistent existence-disclosure policy for private
resources.

---

## G. Artifacts and outputs

### G1. Fetch what the build produced
**Who**: developer/reviewer/release manager. **Trigger**: need the binary,
the coverage report, the E2E screenshots, the rendered docs.
**Ideal** *(split in the v4.1 audit — R4-8)*: **G1a (P1)** — the build
page shows what each put produced: manifest, sizes, sha256, and a link or
coordinate to where it went (registry, GitHub Release, package repo) —
in the resource model outputs normally *go somewhere* via a put, and the
dogfood itself works this way, so this needs no CI-hosted byte storage.
**G1b (P2)** — a CI-hosted artifact store with one-click download, stable
"latest green" URLs, and visible retention — a real subsystem, built only
if the storage decision memo says so.
**Pain today**: artifacts hidden three tabs deep; latest-green URLs
hand-rolled.
**UX**: artifacts tab on build page (R10); `latest` alias URLs; retention
shown. Missing from all prototypes — data model has no artifacts yet.

### G2. Structured test results
**Who**: developer/reviewer. **Trigger**: test step produced JUnit/TAP.
**Ideal**: failures rendered as *tests* (name, message, history) not log
text; new-vs-known failure split (D1); per-test flake and duration history
feeding B3/B4. The log remains one click away as ground truth.
**Pain today**: log-only tools make every failure archaeology; test-report
tools bury the log.
**UX**: a test-results layer on the build page; keep the log primary
(research lesson 2), results as an index into it.

### G3. Per-PR preview environments
**Who**: reviewer/designer/PM. **Trigger**: PR touches UI.
**Ideal**: PR build deploys an ephemeral environment; the link lives on the
PR row and build page; environments die on merge/close automatically;
capacity/TTL visible to the operator.
**UX**: composes C-scenarios with V14's PR rows ("preview ↗" chip); teardown
is a lifecycle question the model handles via serial jobs.

### G4. Artifact missing or corrupt downstream
**Who**: developer/release manager. **Trigger**: the deploy job can't fetch
(or gets a checksum mismatch on) the build job's supposedly-green output.
**Ideal**: artifacts carry checksums from the moment of upload and are
verified on every consume, so corruption is caught at the boundary with a
named culprit ("digest mismatch: stored ≠ uploaded — storage fault") rather
than as a weird downstream failure. A missing artifact states why (expired
by retention E14, cleanup, never uploaded because the step half-failed) as a
B11-style reason, and the fix is guided: re-run the producer, with the
consumer auto-retrying after.
**Pain today**: "green build, broken deploy" archaeology; retention silently
eating what a release still needs.
**UX**: artifact integrity state on the build page (G1); consume failures
name the producing build; retention exemptions for referenced artifacts.

### G5. Test-report ingestion fails
**Who**: developer. **Trigger**: tests ran, but the JUnit/TAP output is
malformed, truncated (OOM-killed reporter), or missing.
**Ideal**: report parsing failure is its own visible state on the build —
"tests ran; results could not be parsed (see raw log)" — never confused with
"no tests" or "tests passed", and configurable as to whether it fails the
build. The raw log remains the intact fallback (ideal #6), and the parse
error itself is shown so the reporter can be fixed.
**Pain today**: silently absent test tabs; or green builds whose failing
tests were in the unparsed half of a truncated file.
**UX**: ingestion status line in the results layer (G2); parse errors as
findings; "results incomplete" propagates to the roll-up as a warning, not
a pass.

---

## H. Security & supply chain

### H1. 🔥 Untrusted code meets the pipeline definition
**Who**: maintainer. **Trigger**: a PR modifies `pipeline.hcl` (or whatever
defines the checks) — possibly innocently, possibly to exfiltrate secrets or
subvert the build.
**Ideal**: config changes from untrusted sources run under the *base*
branch's config by default; the proposed config takes effect only after
merge (or explicit maintainer opt-in for that run). The PR view shows a
config diff prominently — "this PR changes what CI does" is never a
surprise. Secrets are scoped so even an approved fork run gets only what
that job class needs (F2's no-secrets default).
**Pain today**: the `pull_request_target` class of exploits; maintainers
approving CI on a PR without noticing it rewired the workflow.
**UX**: "config changed in this PR" badge on the PR row (V14) with a diff
link; the run page states *which config revision* it executed under (A6);
approval prompt escalates when config differs from base. The approval moment
itself is a decision-support surface: show the config diff, the secret
exposure choice (none / job-scoped / full) with the consequences of each,
and — after deciding — an explanation the *contributor* sees ("checks ran
without publish credentials; a maintainer will run the release step"), so
restrictions read as policy, not distrust.

### H2. Artifact provenance and signing
**Who**: release engineer; downstream consumers. **Trigger**: releases must
be verifiable (SLSA-style provenance, signed binaries/images, SBOM).
**Ideal**: the build produces and publishes provenance automatically: what
source, what inputs (digests), what steps, on what worker — signed by the CI
system. The release page links artifact → provenance → build page →
resolved inputs (B8). Verification is a one-command story for consumers.
**Pain today**: provenance bolted on with bespoke scripts; the chain breaks
at "which build made this file?"
**UX**: provenance as an auto-artifact on release builds (G1); the build
page *is* the human-readable provenance — its data model (resolved inputs,
worker, config rev) must be complete and immutable.

### H3. Security gates in the pipeline
**Who**: security engineer sets policy; developers live with it.
**Trigger**: dependency/container/secret scanning runs on every build.
**Ideal**: scan findings behave like test results (G2): new-vs-known split,
severity threshold gates ("fail on new critical"), suppressions with owner
and expiry (like quarantine, B3), and a trend view. A red security gate
explains the finding and the remediation path, not just "policy violation".
**Pain today**: scanners cry wolf; teams disable them; suppressions
accumulate silently forever.
**UX**: same machinery as flake quarantine and test results — one
"findings" abstraction serving tests, scans, and lint (G2, B3); expiring
suppressions surface in the attention inbox (ideal #5).

### H4. Segregation of duties
**Who**: admin/compliance. **Trigger**: SOC2/change-management: the person
who wrote a change may not solely approve its production deploy.
**Ideal**: gate policy can require approver ≠ author (and role ≥ X, N ≥ 2);
the UI grays the approve button for the commit author with the reason
stated; the audit trail proves the rule held for every deploy (E5).
**Pain today**: policy exists on paper, tooling can't enforce it, auditors
sample manually.
**UX**: small policy extension to PikoCI's approval gates (R15); approval
cards show *why you can't approve* rather than hiding the button.

### H5. 🔥 A secret leaked into build output
**Who**: security/admin, under time pressure. **Trigger**: masking missed it
— the secret was transformed (base64, split across lines) or printed before
it was registered.
**Ideal**: an incident flow, not just a scramble: retroactively redact the
value from stored logs (and know that already-downloaded copies are beyond
reach — say so), rotate the credential (E6) with the leak as the recorded
reason, enumerate exposure ("appeared in builds #141–#143; #142 is public;
log downloaded 3 times by 2 users"), and record the whole event in audit.
Prevention feedback: the miss becomes a masking rule improvement.
**Pain today**: grep-and-pray across log storage; no answer to "who saw
it?"; rotation and redaction done in different tools by different people.
**UX**: "redact from logs" as an admin action taking a value/pattern;
exposure report from access logs; the flow links redact → rotate → audit as
one guided incident path.

---

## I. Cross-cutting ideals (what "good" means everywhere)

1. **Notification discipline**: notify on state changes and human-needed
   states (approvals, questions), never on routine success; per-user channel
   choice; every notification deep-links to the acting surface (R3, R27).
2. **Everything has a URL** — build, step, log line, resource version, config
   revision, queue position (R30). If it can be discussed, it can be linked.
3. **Cause attribution**: every build names its trigger — commit, PR,
   upstream version, cron, human, retry-of (R5). "Why did this run?" is never
   a mystery.
4. **Separation of red**: your code (failed) ≠ infra (errored) ≠ waiting on
   a human (approval) ≠ stale/stuck (pending, overdue). Different colors,
   different filters, different inboxes (V11/V14 scoping).
5. **Escape hatches stay on the record**: pins, pauses, freezes, manual
   deploys, quarantines all carry who/why/when and nag on expiry — safety
   valves that don't become permanent leaks (C3, C7, B3).
6. **The log is sacred**: every higher-level view (tests, traces, summaries)
   is an index into the raw log, never a replacement (research lesson 2).
7. **Local ↔ CI symmetry**: any CI job is runnable locally with the same
   definition (`pikoci run`), and the UI teaches this at the moment of
   failure (A4) — PikoCI's single-binary story makes this a flagship UX, not
   an afterthought.
8. **The no-mouse, no-color acceptance journey**: the core loop — dashboard
   → find the failure → failing log line → retry — must be completable with
   keyboard alone and with status legible without color (symbols ✓✕●⧖
   already accompany every color in the prototypes; they must also be real
   text for screen readers, with live regions for streaming logs). R29/R32
   stop being checkboxes and become a test script run against every design.
9. **Action integrity under messy reality**: every action (retry, cancel,
   approve, pin) is idempotent and attributable — a double-click, a stale
   browser tab acting on outdated state, or a race between two users
   resolves to one recorded outcome, with the losing actor told what
   actually happened ("already cancelled by maria 4s ago") and their view
   refreshed. A session that expires mid-action preserves the intent
   through re-authentication and then reports definitively whether the
   action happened — "it may or may not have gone through" is never an
   acceptable answer (C11 and B12 are this ideal applied to approvals and
   triggers).

---

## Importance & likelihood matrix

Rough calibration for a typical active team (~5–10 developers, a few
pipelines, daily merges). **Frequency** = how often the scenario actually
occurs there; **Who** = which population hits it; **Stakes** = the cost when
the UX handles it badly (low = minutes lost · med = hours lost / builds
distrusted · high = team-wide loss of trust, blocked releases · critical =
outage, security incident, or lockout). **Priority** is frequency-weighted
stakes: **P1** = the core UX is designed around these — zero friction, no
learning curve; **P2** = must exist and be findable, may live one level
deep; **P3** = correctness and guidance matter more than polish — often
segment-dependent (marked: 🏢 org-scale, 📦 monorepo, 🌍 open source,
📋 regulated).

Frequencies are per-team, so "rare" scenarios are still common across an
install base — and several rare ones carry the highest stakes (C3, C4, E7,
E11): those are rehearsal scenarios, where the UX must work the *first* time
under stress.

| # | Scenario | Frequency | Who | Stakes | Priority |
|---|----------|-----------|-----|--------|----------|
| A1 | Push, confirm pickup | many×/day | every dev | med | **P1** |
| A2 | PR verdict | many×/day | every dev | high | **P1** |
| A3 | Diagnose red, fix | many×/day | every dev | high | **P1** |
| A4 | Reproduce locally | daily | every dev | high | **P1** |
| A5 | Retry flaky | daily | every dev | med | **P1** |
| A6 | Iterate on config | weekly | authors | med | P2 |
| A7 | Parameterized run | weekly | some devs | low-med | P3 |
| A8 | Stacked PRs | weekly | some devs | med | P3 |
| A9 | New-project setup | rare/team (once per repo) | authors | high — first impression decides adoption | P2 |
| A10 | Monorepo selective builds | many×/day 📦 (else n/a) | every dev 📦 | high | P2 📦 |
| A11 | Trunk batching, merge queue | many×/day 🏢 (else n/a) | every dev 🏢 | med-high | P3 🏢 |
| A12 | Draft PR tiers | daily | many devs | low-med | P2 |
| A13 | Config conflicts & rollback | monthly | authors | med-high | P2 |
| B1 | Trunk red — who broke it | weekly | whole team | high | **P1** |
| B2 | CI vs local divergence | weekly | every dev | med-high | P2 |
| B3 | Flakiness erosion | ambient, daily effects | whole team | high — trust | P2 |
| B4 | Build got slower | monthly (creeping) | lead | med | P2 |
| B5 | Infra failure, not code | weekly | devs + operator | med | P2 |
| B6 | Silent check breakage | monthly | author/operator | high — silent | P2 |
| B7 | Cache trouble | monthly | devs/operator | med | P3 |
| B8 | Rebuild old release | rare | release eng | high 📋 | P3 (but record inputs **now**) |
| B9 | Build never started | weekly (daily during setup) | every dev | high — zero-signal confusion | **P1** |
| B10 | Hung build, cancel | weekly | devs | med | P2 |
| B11 | Why didn't this job run | daily | every dev | high | **P1** |
| B12 | Duplicate/out-of-order triggers | weekly (invisible when right) | system | high — wrong verdict | P2 (backend) |
| B13 | Pinned version vanishes | rare | author/RM | med-high | P3 |
| B14 | Failure ownership/routing | daily 🏢 | team | med (diffusion: high) | P2 🏢 |
| C1 | CD on green / what's deployed | ambient, daily glances | team | med-high | P2 |
| C2 | Gated deploy approval | daily-weekly | lead | high | **P1** |
| C3 | Hotfix under incident | rare | on-call | critical | **P1** (stakes) |
| C4 | Rollback | rare-monthly | on-call | critical | **P1** (stakes) |
| C5 | Promote through envs | weekly | RM | med-high | P2 |
| C6 | Release train | weekly-monthly | RM | med | P2 |
| C7 | Code freeze | rare | lead | med | P3 |
| C8 | Deploy locks/serialization | daily 🏢 | teams | med-high | P2 |
| C9 | Plan-review-apply | weekly | platform eng | high | P2 |
| C10 | Cross-repo change | monthly | some devs | med | P3 |
| C11 | Approval staleness & races | weekly | approvers | high — stale blessing ships | P2 |
| C12 | Approver unavailable | monthly | lead | med-high — blocked release | P2 |
| C13 | Post-deploy verification | per deploy | on-call | high | P2 |
| C14 | Canary/progressive rollout | daily 🏢 (if adopted) | on-call | high | P2 🏢 |
| D1 | Nightly suite | daily (ambient) | team | med | P2 |
| D2 | Dependency bots | daily | reviewer/operator | med | P2 |
| D3 | CI as scheduler | ambient | operator | med (missed run: high) | P2 |
| D4 | Upstream-triggered rebuild | weekly | — | low-med | P3 |
| D5 | Cron overlap policy | monthly | operator | med | P3 |
| D6 | Missed-schedule backfill | rare | operator | med | P3 |
| E1 | Worker add/drain/upgrade | monthly | operator | med | P2 |
| E2 | Why is my build queued | daily | every dev asks | high — #1 support ping | **P1** |
| E3 | Server upgrade | quarterly | operator | med | P3 |
| E4 | Migration from other CI | once | operator | high — adoption | P3 (docs-heavy) |
| E5 | Audit/compliance evidence | quarterly 📋 | admin | high 📋 | P3 📋 |
| E6 | Secrets lifecycle | monthly | admin | high | P2 |
| E7 | CI down, break-glass | rare | on-call | critical | P2 (rehearsal) |
| E8 | Queue priority/bump | weekly 🏢 | on-call/operator | med | P3 |
| E9 | Notification config & delivery | setup + monthly | everyone | high — missed approvals | P2 |
| E10 | Token lifecycle | monthly | devs/admin | med | P3 |
| E11 | Auth providers, lockout | rare | admin | critical — lockout | P3 (rehearsal) |
| E12 | Rename/archive/delete | rare | admin | med-high | P3 |
| E13 | Quarantine faulty worker | monthly | operator | med-high | P3 |
| E14 | Storage pressure/retention | monthly-quarterly | operator | med (3am: high) | P3 |
| E15 | Backup & restore control plane | rare | operator | critical | P3 (rehearsal) |
| F1 | Onboard a member | monthly | new devs | med | P2 |
| F2 | OSS maintainer triage | daily 🌍 | maintainer | high 🌍 | **P1** 🌍 |
| F3 | Drive-by contributor | daily 🌍 | outsiders | high — adoption 🌍 | **P1** 🌍 |
| F4 | Reviewer mergeability | many×/day | reviewers | med-high | P2 |
| F5 | Weekly health review | weekly | lead | med | P2 |
| F6 | Multi-team isolation | ambient 🏢 | admin | med | P3 🏢 |
| F7 | Membership/offboarding | monthly | admin | med (ghost access: high) | P3 |
| F8 | Badge lifecycle | setup-once | maintainer | low-med | P3 |
| F9 | Access request on denial | monthly | devs | low-med | P3 |
| G1a | See/reach build outputs (manifest, shas, destination links) | daily | devs/RM | high | **P1** |
| G1b | CI-hosted artifact store + retention | weekly | devs/RM | med | P2 (memo-gated) |
| G2 | Structured test results | many×/day | devs | high | **P1** |
| G3 | Preview environments | daily (if adopted) | reviewers | med | P2 |
| G4 | Artifact missing/corrupt | monthly | devs/RM | high — green lies | P2 |
| G5 | Test-report ingestion failure | monthly | devs | med — can hide failures | P3 |
| H1 | Untrusted config change | weekly 🌍 | maintainer | critical — security | **P1** 🌍 |
| H2 | Provenance & signing | per release | release eng | high (rising) | P2 |
| H3 | Security scan gates | ambient | all | med-high | P2 |
| H4 | Segregation of duties | ambient 📋 | compliance | med 📋 | P3 📋 |
| H5 | Secret leaked into logs | rare | security/admin | critical | P2 (rehearsal) |

Reading the P1 set as a whole confirms the prototype direction: it is almost
exactly "the inner loop + the log + the queue + gated deploys + OSS PR flow"
— the territory V13/V14 already cover — plus two things no prototype models
yet (G1 artifacts, G2 test results) and two rehearsal scenarios (C3, C4)
that need designed paths rather than daily screens. The ⚡/🔥/🔧 markers on
individual scenario headings are impressions from when each was written; this
table is the calibrated source of truth where they disagree.

---

## Coverage map

Where the current prototypes serve each scenario group well (✓), partially
(~), or not yet (–):

| Group | Best served by | Status |
|-------|----------------|--------|
| A. Inner loop | V14 (PRs), V13 (trunk), V02 | ✓ core; – A4 local-recipe, A7 params, A8 stacks, A9 setup flow, A10 skipped-state, A11 batching/merge queue, A12 draft tiers |
| B. Diagnosis | V13/V14 error-first, V08 trace, V04 waterfall, V10 weather | ~ flake board, run comparison, errored clustering, B7 cache facts, B8 resolved-input records, B9 trigger diagnostics, B10 stall detection, B11 why-not-run reasons missing |
| C. Release/deploy | V11/V13 approvals, V01 graph+pin | ~ deployed-versions panel, rollback action, freeze-with-expiry, C8 deploy locks, C9 plan-on-gate, C10 cross-repo missing |
| D. Scheduled | V11 inbox | – overdue detection, bot grouping, nightly diff missing |
| E. Operations | Pages.workers, V11 stuck-build, V14 queue info, Pages.settings tokens | ~ drain, per-tag queue charts, secrets inventory, E7 drift+incident comms, E8 priority, E9 notification config/delivery log, E10 token lifecycle, E11 auth/lockout, E12 blast-radius confirms missing |
| F. Collaboration | V14 (OSS/fork), V01 (onboarding + badge page), Pages.teams | ~ health review page, F7 offboard flow + permission-denied pattern, F8 badge generator missing |
| G. Artifacts | — | – not modeled at all yet |
| H. Security | V14 fork gate (H1's edge) | – config-diff badge, secret-exposure decision UI, provenance, findings/suppressions, approver≠author all missing |

The `–` entries are the roadmap for the next prototype round, roughly in
value order: (1) **why-not-run reasons on every non-run job** (B11) — one
mechanism serving skipped (A10), deferred (A12), held, paused, and pinned
states, and the highest-leverage transparency feature in the catalog,
(2) artifacts + test results ("findings") on the build page — also carries
H3, (3) a deployed-versions / environments panel — also carries C4 rollback
and E7 drift, (4) trigger diagnostics ("why no build?", B9), (5)
approval-gate cards that embed context (C2/C9/H1/H4), (6) an insights &
health page (F5, B3, B4), (7) overdue/cadence awareness (D3), (8) the
local-repro recipe block (A4), (9) queue classes and locks (E8, C8),
(10) the admin-chore pass: notification matrix, token lifecycle, offboard
flow, blast-radius confirmations (E9-E12, F7), (11) deploy lifecycle depth:
verification phase, rollout progress, approval binding to inputs
(C11/C13/C14). Ideals #8 (keyboard/no-color journey) and #9 (action
integrity) are not screens but acceptance tests applied to whichever design
wins; B12's trigger idempotency is likewise a backend contract the UI
assumes.
