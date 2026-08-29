# PikoCI UX Plan (v4 — final document round)

The synthesis document, fourth revision (v4.1 line-edit state). Inputs:
`RESEARCH.md`, `REQUIREMENTS.md` (R1–R37), `SCENARIOS.md` (81 scenarios,
G1 split), prototypes V01–V14, and eight adversarial review rounds:
CR-1..22 + CX-1..12, R2-1..16 + CX2-1..12, R3-1..13 + CX3-1..11,
R4-1..12 + CX4-1..10 — **108 findings total**, every one dispositioned
in this document. Appendix A holds the round-3/4 dispositions; the
round 1–4 review files were retired after their findings were fully
folded in (round 5's file, `PLAN-REVIEW-5.md`, remains — its fix batch
is still pending).

**This is the last document round by design.** Rounds 3 and 4 both
measured convergence and reached the same verdict: the residual risk
lives in protocol/storage details only code contact can falsify. §10
replaces "review again" with six spikes, one memo, and four today-bugs,
under a hard stopping rule; review reconvenes at the Phase-1a exit,
against running software.

**What v4 changes**: run identity is an opaque `run_id` minted at the
causal root (CX3-1); non-runs are a separate decision-record entity, not
builds (CX3-2); K7-crude implements the identity-subset dedup slice of K3
so the security release cannot re-mint versions at upgrade (R3-1/CX3-3),
enumerates its dispatch semantics (R3-6), ships a CLI release verb
(R3-11), and reports to forges via a worker-executed notify work item
(R3-3); K19 is split into a Phase-1a fallback and an honestly-sized log
store (R3-4); the ★ doctrine now states its persistence preconditions —
including the `mem` default — with retention classes for all meta-records
(R3-5); secret-backed values are non-recordable *by construction* and new
HCL attributes are strictly parsed (CX3-4/R3-7); card roll-ups use one
visible primary context per pipeline (CX3-5); K15's minimum channel is a
generic per-user webhook (CX3-6); generic resume-from-step is replaced by
safe alternatives (CX3-7); worker addressing/control gets its own
contract (R3-2/CX3-8); Phase 1a is slimmed again with a large-log fixture
in its exit (R3-8/CX3-9); K10 is scoped to mutable-ref lineages (R3-9);
snooze gets storage and identity (R3-10); the graph engine is a named
decision (R3-12); the decision checklist is single-sourced in §10
(CX3-11); and the round-3 **deletion list is adopted** — the change-source
ontology layer, the parallel sub-state vocabulary, the A12 tier matrix,
the reserved merge-queue slot, late-phase nav budgets, tracked TV mode,
and the up-front scale generator are all gone. Vocabulary is unified: one
"waiting" family derived from reason codes; one "superseded".

**Scope**: UX plan. Visual design later. Prototypes are frozen proposals.
**Breadth**: model covers solo → org 🏢 / monorepo 📦 / OSS 🌍 /
regulated 📋; the shell is capability-gated; solo pays no org ceremony —
including thesis-#5 ceremony: on solo installs, reason prompts on
pause/pin are optional and prefilled.

---

## 1. Design thesis

**The UI is a truthful, attention-scoped window onto the scheduler.**

1. **Two axes, never conflated**: structure (team → pipeline →
   job/resource) vs. change (immutable run → its builds). Composites are
   always visibly labeled; unlabeled mixture is banned.
2. **Attention scoped by ownership, degrading honestly**: unclaimed lane
   when there's no owner data; "mine" absent until the identity join
   exists; secondary-lineage failures never masquerade as pipeline
   health (§3.2).
3. **Every non-event explains itself** via recorded decision reasons
   (K5) — today scheduler non-runs leave no stored form at all.
4. **The log is the destination; everything else indexes into it.**
5. **Actions are safe, attributable, reversible-or-loud**: idempotent
   (K18); destructive = previewed; hatches carry actor/reason/expiry
   (K17) and expire or nag; snooze is a stored, audited hatch with
   defined identity (K17b). Every new mutating verb lands **API + CLI +
   UI in the same phase** (Phase-0 verbs: API + CLI) — R3-11.

**Strategic frame** (round-3 assessment, adopted): the thesis runs
entirely on forge-neutral primitives — reasons, provenance, config
history, trigger diagnostics, run-locally. Forge work is scoped to
**GitHub as the reference integration** with the generic contract
published (webhook poke + check-report notify type) for GitLab/Gitea;
`pikoci run` and `pikoci validate` are treated as flagship surfaces, not
afterthoughts. Where a choice arises between deepening a differentiator
and cloning a forge feature, the differentiator wins.

---

## 2. The object model

### 2.1 Identity (CX3-1; simplified per round-3 coherence audit)

Two identity concepts. (The v3 "change-source" ontology layer is
deleted; its job is done by a per-pipeline display setting.)

- **Run**: a **derived, many-to-many mapping**, not a propagated token
  (R4-1: the scheduler creates downstream builds by 10-second state
  polling with no causal event to carry an id — a pending build
  coalesces several upstream pushes, and a fan-in consumes several
  inputs). A run is minted per root event (detected version, manual
  trigger with its params, cron tick, put); builds link to runs
  **through their input versions** — creation-time intent must record
  *all* candidate inputs, not just the first. A coalesced build belongs
  to every run whose version it consumes; display picks the newest as
  primary with a "covers N changes" label (the same idea A11 uses for
  trunk batching). Two identical-parameter manual triggers are separate
  root events, hence separate runs — and since their input versions are
  identical, version-linking alone cannot tell their builds apart: **the
  root event records a direct root-event→root-build association**, and
  downstream membership requires the version link *and* reachability
  from a root build (CX4-1; the K2 spike tests this double-trigger
  case). Retries are attempts **within** the run of the build they retry
  (`retry-of` link) — they mint no new run. Builds carry **provenance**
  — intended inputs at creation, resolved inputs + worker at execution
  (K1) — as facts, not identity.
- **Lineage**: the ordered sequence of runs a *mutable ref* points
  through — a PR, a branch. **Supersession is (lineage, job)-scoped and
  exists only for mutable-ref lineages** (K10). Refless triggers (cron,
  upstream versions) are one run per version, no supersession — overlap
  there is D5 policy (K13d), a deliberately separate, configurable
  behavior (R3-9).
- **Primary context** (display setting, per pipeline): which lineage or
  trigger the pipeline's card and default views reflect — default
  branch for git pipelines, the trigger resource for cron/upstream
  ones. **Card color comes only from the primary context; other
  lineages (PRs) contribute counts and attention items, never the
  card's color** — one failing community PR cannot turn the pipeline
  red (CX3-5).
- PR metadata (title, draft, base) is mutable and lives outside
  identity (K3). The fork flag is immutable per PR; K7 stores it via
  the identity-subset dedup rule so it can exist *before* K3's full
  channel (R3-1).

### 2.2 Operational overlays

Attention item (class, **canonical subject key**, owner, staleness,
snooze state — K17b) · Environment · Finding · Worker/Queue · Audit
event (team-scoped today; instance-scope stream — K16).

### 2.3 Status vocabulary (unified per round-3 coherence audit)

- **Backend statuses**: pending · started · succeeded · failed ·
  cancelled · waiting_for_approval · warning · skipped. `skipped` = a
  runtime conditional branch not selected (step-level; the build ran;
  keeps full build identity). `warning` = pass-with-flag: amber tick,
  never reddens a card, no attention item by default. `errored` (infra ≠
  code) is new work (K6).
- **Presentation derived from K5 reason codes — not a parallel sub-state
  taxonomy** (round 3), in **two families** (CX4-2), because some
  non-runs are terminal, not pending: `waiting: <derived text>` for
  outcomes that may still run (approval · maintainer/held fork ·
  lock · capacity · upstream · pause · pin mismatch · no satisfying
  version · draft deferral 📦) and `won't run: <derived text>` for
  terminal outcomes (not affected 📦 · superseded · overlap-skipped).
  The family is a render-time property of the reason code — no new
  stored state. Started builds may show `stalled(last-output-age)` and
  phase markers (verifying, rolling-out %) in later phases.
- **Non-runs are decision records, not builds** (CX3-2): a separate
  entity — (pipeline, job, version/run, reason_code, params, config-rev,
  observed-at), deduplicated on transition, with its own lifecycle and
  retention class. It is intended to consume no build numbers and never
  distort histories, success rates, or retry semantics — a promise the
  K5 prototype must verify against when numbers are actually allocated
  (CX4-9). When a speculative build
  is deleted today, K5 replaces the deletion with a decision record the
  (removed) build id links to.
- **One word: superseded** — used identically for lineage collapse and
  for a gate build overtaken while waiting. Other freshness flags:
  drifted · results-incomplete.
- **Entity flags** (K17 data): paused/pinned (actor, reason?, until?) ·
  frozen (Ph5) · cordoned/draining (K21, Ph5) · archived · public.
- Matrix/for_each: instances are `job--slug` jobs; `passed` may target
  one instance; grouped edges must split (graph-engine acceptance test,
  K22).
- Encoding: color + symbol + text; disclosures focusable; no
  hover-only.

---

## 3. Information architecture

### 3.1 Shell — capability-gated navigation

Gating affects prominence, never reachability: gated-off URLs resolve to
teaching empty states; Settings always present (uncounted) and is the
permanent path to Workers and Audit for small installs; Ops pins once
shown. Nav: Home · Pipelines always; Changes when K3 lands (Versions tab
until then); Environments with ≥1 deploy target; Insights when shipped
+ data; Ops with ≥2 workers or **global admin** (the "operator" role is
not a thing in PikoCI's model — R3-13); Audit with ≥2 members. **Exit
criterion (Phase 1b only)**: fresh solo install ≤4 items + Settings.
Modes: public 🌍 (read-only; masking rules per K20), mobile-glance (Home
entry until K15). TV mode exists as CSS when someone wants it — no
longer a tracked commitment.

### 3.2 Home

Attention strip with the behavior spec: classes gated on their data
contracts; rollup rules; **snooze with stored identity** (K17b:
class + canonical subject key, actor, until, audited; per-class wake
rules — new evidence wakes, rollup snooze covers members); staleness
policy; hard cap; first-run review screen. **On `mem` installs the
strip and all history banner "since server start"** (R3-5). Status
wall: cards colored by primary context only (§2.1); PR/secondary
failures appear as counts + strip items.

### 3.3 Changes / Versions

Versions tab (bare, Ph1b) → Changes top-level when K3 lands: Mine
[K4] · Open PRs · Trunk · Scheduled · Upstream; rows with per-job dots
and focusable reasons; lineage collapse. Change detail: context banner,
per-ref graph, waterfall, fork gate (§3.8). Deleted per round 3: the
per-commit tier-coverage matrix (A12 keeps its *policy* and its
"waiting: draft deferral" reason; the display matrix goes); the reserved
merge-queue slot (feature and slot deferred together, §9).

### 3.4 Pipeline

Graph (default; engine decision K22 — viz.js lazy-loaded off the
first-paint path is the recommendation, with instance-edge-split and
ref-annotation as acceptance tests) · Versions/Runs · Table (Ph2) ·
Config. Context selector: specific run/change | primary-latest (per-node
ref annotations + spanning label when refs diverge). Trigger dialog
(A7): declared inputs; **values recorded only if declared recordable —
see K20's by-construction rule**. Config: editor + append-only history
with diff; CAS in Ph1a; restore-as-new-rev in Ph1b; `pipelines set`
consequence preview (incl. for_each history deletion). **All new HCL
attributes are strictly parsed** — moved out of `,remain`, unknown
attributes in known blocks are errors with closest-match suggestions,
`pikoci validate` knows them, version skew is an error not a shrug
(R3-7). Resource detail: versions, pin/unpin, trigger-with-version,
check state, trigger diagnostics (receipt log Ph1b, check history,
decision trace). New-pipeline flow (A9): Ph2, honest version.

### 3.5 Build

Header (identity, status, cause, provenance, config rev, worker, history
strip, actions incl. guided Rollback) · compare-with-last-green ·
error-first zone · approval card · steps with follow/reconnect +
last-output-age. **Logs (R3-4)**: Phase 1a ships the *fallback* —
last-N-lines + download-full — validated against a **fixed 100k-line
fixture in the Phase-1a exit** (CX3-9); the **log store** (K19b: append
path persisting the LogChunks the protocol already delivers, new
storage keyed build/step/offset, migration note) lands as its own item
in Ph1b–2 and unlocks range/tail/search/permalinks. The MySQL `TEXT`
64KB cap on `builds.steps` is **filed as a today-bug independent of the
plan**. Tabs: Log · Results (JUnit-only Ph2) · Artifacts (Ph2, K8a) ·
Environment · Run locally — which per the strategic frame also appears
as a copyable command on every failed *step*, not just the page.

### 3.6 Environments

Ph3: card → panel (verification, drift, env locks — K11), guided
rollback. Rollout % 🏢 Ph5.

### 3.7 Insights (Ph4)

Trends, flake board (pass-after-retry linked), queue-time, stale
hatches, quarantine debt, storage summary — **including meta-record
storage** (K5 decisions, receipts, config history — R3-5).

### 3.8 Approval card

Bound provenance · votes · superseded banner · why you can/can't act ·
delegation (Ph5) · fork variant: release verb (maintain+, audited,
**API+CLI from Phase 0**, UI Ph2), secret-scope choice with K7-full.
Minimum context bar in Ph1a.

### 3.9 Ops

Workers always reachable via Settings. Queue: honest pull-based wording;
read-role sees the K16 sanitized summary. **Cordon/drain require worker
addressing & control (K21) — scheduled with them in Ph5, not implied
earlier** (R3-2). Storage view covers artifacts *and* meta-records.

### 3.10 Governance

Teams/offboard/last-admin · access requests · Audit (+instance stream,
export schema — folded into K16 per round-3 deletion) · Admin (auth
test-before-enforce, lockout, server/backup state) · Settings
(notifications when K15 lands; tokens; themes) · secrets rescoped to
collectible truth; H5 runbook with gaps named · lifecycle ops with
blast-radius · badges. E4 (migration from another CI) = docs-track
config-translation cookbook.

### 3.11 Migration from the current UI

URL map · parity checklist · transport decision (K9) · first-run review
· old UI behind a flag one release. **Phase-1a components are built
shell-agnostic and remount in 1b** — defined testably (R4-10), since in
the current codebase "component" means "module wired to app singletons":
(1) 1a components receive `api` + session via props/context, importing
no module singletons; (2) navigation is emitted as callbacks, never a
direct `route()` call; (3) nothing imports from `Layout`. The Ph1a exit
script checks all three.

---

## 4. Interaction model

Deep links everywhere; liveness via K9; keyboard layer with every
surface; focusable disclosures; K18 idempotent action API with defined
conflict answers; denied → why → who can help; notification discipline
from K15 on (until then: strip + forge checks, stated). Performance:
first paint <1s; the K19a fallback keeps logs inside the budget until
the store lands. i18n stance: reason codes + UTC make translation
possible later; full i18n deferred.

---

## 5. Backend contracts (K1–K22)

**Persistence doctrine** (R3-5): ★ guarantees hold on persistent
backends. The server's default backend is `mem` — all data lost on
restart — so: the UI on mem installs banners "history since server
start"; the §10 memo decides whether the default flips to sqlite
(recommended — it makes the record-now story true for the quickstart
install); every meta-record class (K5 decisions, K14a receipts, K20
config history, K17b snoozes) carries a **retention class** (count/age
caps + GC) and joins the export path. **Retention never breaks
provenance (CX4-7)**: records referenced by retained builds, decision
evidence, or audit entries (a config revision a kept build ran under,
above all) are preserved or replaced by durable tombstones — blanket
age/count GC may not orphan a reference. And **export ≠ backup
(CX4-8)**: the export path is data export; E15's restore contract is a
DB snapshot plus secrets material plus a post-restore reconciliation
report — stated in the §10.5 memo.

★ = record/decide now. **D** = decision. Lands vs. needed-by; co-lands
carry fallbacks.

| K | Contract | Lands | Fallback if slipped |
|---|---|---|---|
| K1 ★ | Provenance on every build: creation-time intent + execution-time resolution + worker + `run_id` + cause; runner provenance best-effort via optional worker report | min Ph0 · full Ph1a | — |
| K2 ★D | Identity: run = derived version→run many-to-many mapping per §2.1 (root-event table + build-input links; coalesced builds belong to all covered runs); lineage for mutable refs; primary-context display setting. **Ratified via the §10 checklist only after the K2 spike (§10.0)** — paper-only ratification is retracted (R4-1) | Ph0 (spike + paper) | — |
| K3 ★ | Version identity/metadata protocol split: check output `{version, metadata}`, bare-map back-compat; metadata outside the unique key; migration; custom-type rule. K7 implements the **identity-subset dedup slice** early (dedup compares the `{ref, pr}` projection; side columns for extras) so Phase 0 cannot re-mint versions (R3-1) | slice Ph0 · full Ph2 | Versions tab stays bare; Changes never promotes |
| K4 | Commit-author ↔ user join (opt-in) | Ph2 | Mine/H4/K15-routing hidden |
| K5 | Decision records: separate **non-run entity** (CX3-2) with dedup key + lifecycle + retention; written at the real decision points (server tick, worker constraint/availability checks, check-trigger, K7 hold); replaces silent deleteBuild; (reason_code, params), display derived. **Open question the prototype must answer (CX4-9)**: whether today's speculative build consumes a visible build number before deletion — the "consumes no build numbers" promise requires deciding before allocation, accepting gaps, or separating internal IDs from visible numbering | prototype Ph0 · lands Ph1a | "no record" rendered honestly for prior history |
| K6 | `errored` classification + bounded auto-retry | Ph2 | no infra lane |
| K7 | Untrusted-change gating. **Crude (Ph0)**: fork flag via K3-slice dedup (upgrade with open PRs produces **zero** new builds — exit criterion); `pr_hold=forks` default; held builds: excluded from FindOldestPending / StartPendingBuild / concurrency & serial-group accounting / stuck-classification (own strip class), re-enqueued on release (R3-6); release verb = API + **CLI** (`pikoci client builds release`), audited. **Ph1b**: forge "awaiting maintainer" status via a **notify work item** — a new work-item type executed by any tag-matching worker through the existing notify path with worker-side secrets (R3-3); GitHub builtin first; gitlab-check/gitea-check builtins or an explicit GitHub-only scope note on A2/F3. **Full (Ph3)**: first-contributor policy, per-run secret scoping, bulk release, trusted list. Additional K7 rules (R4-4, R4-9): **held is derived from the version's fork column at every build-creation path** — retry, manual trigger, trigger-with-version included (downstream evaluation is covered by construction: a held root never becomes ready); release is per-build; a retry of a fork build re-derives the hold (retry by maintain+ implies release, audited); the fork-strip at insert is a *type-aware special case* (only the builtin git type's `fork` key is stripped — custom types emitting `fork` are untouched), i.e. Phase 0 knowingly implements K3's first type-discrimination; the side-column **read joins** (API version lists, fork badges, K7-full scoping) are budgeted UI/API surface, not free | crude Ph0 · report Ph1b · full Ph3 | `pr_hold="all"`/`"off"` explicit; forge silence only in Ph0–1a, stated |
| K8 | Artifacts, re-graded per R4-8 (SCENARIOS G1 split into G1a/G1b): **(a) = G1a "see and reach the outputs" (P1)**: manifest + sha256 + size recorded at put (the retrofit-hard fields, from Ph2 — CX3-10) **plus links/coordinates to where each put step sent its output** (registry, release, package repo) — satisfiable with *no server-side byte storage*, which is also what the dogfood's own pattern shows users do. **Producer protocol (CX4-5)**: the smallest standard result envelope — a put step may write `result.json` (files: name/size/sha256; destination: url/coordinate) to a declared output path; builtin types emit it; a put without one renders an honest "output metadata unavailable" line, never fake data · **(b) = G1b "CI-hosted store" (P2, Ph4)**: if the §10.5 memo decides for it — upload via the **worker process's existing authenticated HTTP client** (not the HCL script, which has no credentials — R4-3), a new worker-token endpoint with a server-side per-team size cap, and the storage decision (DB blob vs the product's **first data directory**, with an explicit statement that artifacts are outside the DB export/backup path) plus retention/GC | a Ph2 · b Ph4 (memo-gated) | (a) is complete without (b); G4's checksum ideal rides the recorded sha256 either way |
| K9 D | Transport (SSE vs etag-polling) | decide Ph0 · land Ph1a | polling floor |
| K10 | Supersession (lineage, job), **mutable-ref lineages only** (R3-9); superseded-by links; `interruptible` documented as unsafe for PR pipelines | Ph2 | shown-not-cancelled |
| K11 | Environment registry + env locks + verification/drift events | Ph3 | card-only from convention |
| K12 | Findings: JUnit-only (a, Ph2) → unified after scanner spike (b, Ph4); ingestion-status; quarantine w/ owner+expiry | a Ph2 · b Ph4 | log-only + "unparsed" flag |
| K13 | Policy pack: (a) check tiers + incident approval policy — Ph2–3 · (b) delegation/escalation/expiry — Ph5 · (c) author≠approver 📋 — Ph5 · (d) log-access/redaction (H5), overlap/catch-up (D5/D6), priorities (E8) — Ph5. **Generic resume-from-failed-step is deleted (CX3-7)**: the safe equivalents are per-leg matrix retry (exists with attempt semantics) and an explicit continuation-job pattern documented for release trains (C6) | as listed | hotfix drill runs on full checks |
| K14 | (a) webhook receipt log — **Ph1b** (R3-8) · (b) `owner` attr + claim/assign + unclaimed lane — Ph2. (Audit-export schema folded into K16) | as listed | — |
| K15 | User notifications: server-side event emission + **minimum channel = generic per-user webhook** (CX3-6 — a forge comment cannot carry a production-deploy approval); forge-comment/others additional; delivery via notify work items; matrix + delivery log Ph5. Needs K4 for "my PRs". **Premise update (R4-2)**: the codebase has since shipped `on_trigger` (#528), which executes author-defined notification commands *in the server process* with secret placeholders unresolved — two today-bugs filed (control-plane exec crossing team isolation; broken secret resolution). The notify **work item** (R4-5: the system's first real queue table — claim/ack, fire-once dedup per event, old-worker skew gating via a capability field, tag-matching rule decided) is the corrective mechanism: **porting `on_trigger` onto it is the spike's first deliverable**, fixing both bugs and serving K7's held-build report with one mechanism | v1 Ph3 · matrix Ph5 | strip + forge checks remain the entry |
| K16 | AuthZ & audit: sanitized worker summary for read-role; role map for new verbs (snooze/claim: write · assign/release/restore/freeze: maintain+ · cordon/drain: **global admin**); instance-scope audit stream; export schema | summary Ph1b · rest Ph2 | queue answers admin-only, stated |
| K17 ★ | Hatch metadata on pause/pin (actor; reason/expiry **optional and prefilled on solo installs**); freeze entity Ph5. **K17b**: attention-item identity schema (class + canonical subject key), snooze rows, per-class wake rules (R3-10) | K17 Ph0 · K17b Ph1b | — |
| K18 | Action idempotency/conflict API for all mutating verbs. Split (CX4-3): **K18-minimal lands Ph1a** — server-side idempotency keys on exactly the verbs Ph1a exposes (retry, cancel, approve/reject, pause/pin), since UI guards cannot handle stale tabs, concurrent users, or re-auth; full conflict-answer API Ph1b | minimal Ph1a · full Ph1b | without minimal, the Ph1a exit must not claim ideal #9 |
| K19 | Logs, split (R3-4): **(a)** fallback — last-N + download-full, Ph1a, validated on the 100k fixture. **Honesty rule (CX4-4): "download full" is only promised where storage holds the full log — on MySQL the TEXT cap truncates at 64KB, so widening that column is a Ph1a *prerequisite* (it is the today-bug fix), or the Ph1a UI states "log truncated by storage" until K19b** · **(b)** log store: persist LogChunks, append-only storage keyed build/step/offset, range/tail/search/permalinks, migration from blob history | a Ph1a · b Ph1b–2 | (a) is the floor |
| K20 | Config & record safety: append-only history Ph0 · CAS Ph1a · restore Ph1b · **strict schema for all new attributes + validate/skew rules (R3-7)** · sensitivity **by construction (CX3-4)**: secret-backed values are never recordable anywhere (intent, params, decision evidence, config-history rendering) regardless of flags; plain inputs recorded only when declared recordable; new record fields non-public by default **and** carry authenticated-access rules (team-scoped) + retention | Ph0–1b | — |
| K21 | Worker addressing & control v1 (R3-2): worker identity on polls/streams; drain/cordon verbs expressible in dispatch; (fetch RPC only if a future need survives K8a's push-at-put) | Ph5 | drain = stop process (today's behavior), stated |
| K22 D | Graph layout engine (R3-12): recommend viz.js lazy-loaded off the first-paint path; acceptance: `job--slug` instance rendering, per-instance edge splits, per-node ref annotations. **Licensing note (R4-11)**: the viz.js bundle embeds Graphviz (EPL-1.0) in object form and the repo ships no third-party notices — a THIRD-PARTY-NOTICES file is a today-task regardless of this decision; keeping viz.js keeps the EPL attribution obligation, an owned layout engine would shed it | decide Ph1b | prototype hand-layout only as a stopgap |

---

## 6. Acceptance journeys

As v3's table, with round-3 corrections: **A2/F3** — held forks see
forge status from Ph1b (not 1a), GitHub first; GitLab/Gitea either get
check builtins in the same phase or the promise is explicitly
GitHub-only. **B1** split targets unchanged. **C2** entry = Home card
until K15. **C3/C4** drills unchanged. **E2** honest wording via K16
summary (Ph1b). **G1a** = manifest + sha256 + destination links on the
build page (no server byte-store needed — R4-8); G1b (hosted store) is
P2, memo-gated. **H1** = fork code cannot auto-run with secrets from
Ph0 — *through every build-creation path, retry and trigger-with-version
included* (R4-4) — and *upgrading to Ph0 creates zero spurious builds*
(the R3-1 test). Named gaps unchanged (B13, H5 tooling, merge queues) — plus one
addition: **C6 release trains use the continuation-job pattern, not
generic resume** (CX3-7).

---

## 7. Phased roadmap

Decisions land a phase ahead; implementations may co-land with a named
fallback. Every phase has a cut line.

**Phase 0 — Decisions, minimal records, the security fix.** Ratify (via
§10 checklist): K2, §9.1/K3 design, K9, default-backend + retention
memo. Land: K1-minimal, K17, K20a config history, **K7-crude complete
with the K3-slice dedup, dispatch exclusions, and CLI release verb**.
Prototype K5 (worker decision points).
*Exit*: fork PRs can't auto-run with secrets; **upgrade with open PRs
mints zero versions/builds**; `pikoci client builds release` works;
intent inputs + config rev recorded; K5 prototype explains one real
non-run.
*Cut line*: K7-crude + K17.

**Phase 1a — Daily-loop wins inside the existing UI** (slimmed again,
R3-8). Build page v2 (error-first, cause, compare-with-last-green,
run-locally, K19a fallback log view) · inline reasons (K5 lands) ·
K20-CAS · Home strip v1 (approvals, trunk failures, check errors —
classes whose data exists; items dismissible per-session until K17b's
snooze storage lands in 1b) · approval context bar. Components built
shell-agnostic (explicit deliverable).
*Exit*: A3/A4/A5/B11 targets; B1 diff-arm; C2 context bar; ideal-#8/#9
scripts on new components (#9 against K18-minimal's server-side keys —
CX4-3); API+CLI parity check for every verb shipped this phase (R36 —
repeated at every later phase exit); **100k-line fixture renders within
budget on the fallback viewer** (CX3-9).
*Cut line*: build page v2 + inline reasons.

**Phase 1b — Shell, structure, migration, and the deferred 1a
contracts.** Gated nav (§3.1 semantics) · graph (K22 decided) · Versions
tab · config history UI + restore · trigger dialog · K18 action API ·
K16 worker summary + stuck-pending strip class · K14a receipt log ·
K7 forge reporting via notify work items · K19b log store · K17b snooze
storage · public-mode sanitization audit · themes · migration track.
*Exit*: solo ≤4 nav items + Settings; redirect map + parity checklist;
first paint <1s; held forks visible on GitHub; log permalinks live.
*Cut line*: graph + Versions tab in a minimal shell; migration map;
K19b may slip to Ph2 (fallback stays).

**Phase 2 — Change axis + evidence v0.** K3 full → Changes promotes ·
K10 supersession · K6 errored · K4 join → Mine · fork-gating UI ·
trigger diagnostics full · bot scoping · not-affected 📦 · **K8a
artifacts (push-at-put) + K12a JUnit results** · A9 flow · K13a tiers ·
K14b ownership · ⌘K · table view.
*Exit*: no unlabeled mixture; fork held→released→run E2E with forge
statuses; B1 culprit-arm; G1a + G2 v0; drafts show "waiting: draft
deferral" from real metadata.
*Cut line*: K3 + Changes + supersession.

**Phase 3 — Delivery.** Environments (K11) · rollback + hotfix drills ·
verification phase · full approval card · **K15 v1 (generic per-user
webhook)** · K7-full · K12b spike.
*Exit*: C3 ≤5 min, C4 ≤1 min, executed; supersession correct under
concurrent push; phone approve via K15.
*Cut line*: Environments card + rollback.

**Phase 4 — Evidence in full.** K12b findings · nightly diff · K8b
retention/GC · provenance 📋 · Insights (incl. meta-record storage
view).
*Exit*: G2 full; seeded flake ranked; release-tagged artifact survives
retention sweep.
*Cut line*: findings unification.

**Phase 5 — Scale + governance.** K21 addressing → cordon/drain · Ops
nav · priorities 🏢 · freeze · D5/D6 · K15 matrix · K13b–d · tokens ·
auth/lockout · offboarding · blast-radius · badges · secrets view ·
audit export · rollout % 🏢.
*Exit*: named drills (E1 drain via K21, E7, E9, **E15 restore from a
real DB snapshot + secrets material with a post-restore reconciliation
report — the export path is not backup (CX4-8)**, F7,
H5-runbook-with-gaps); E12 preview on rename.
*Cut line*: drills + freeze + notification matrix.

**Dogfood track (R4-6)**: `deploy/pipeline.hcl` today has no approval
gate, no artifact resource, no cron, no for_each — so "dogfooded" would
be vacuous for C2, G-family, D-family, and the matrix rendering rules.
Extending it is a deliverable, each addition one phase before the exit
that needs it: an approval gate on `deploy` (Ph1 — also just good ops
for a self-restarting prod server, and today's ungated auto-deploy is a
live counter-example to thesis #5), an artifact put for release
binaries (Ph1b), a nightly cron job and a small for_each leg (Ph2).
Where extension is unnatural, the exit names its synthetic fixture
instead of claiming "dogfooded".

**Continuous**: ideal-#8/#9 scripts; mobile-glance checked at phase
exits; prototypes frozen; scenario catalog updated on divergence;
**premise re-diff (R4-2): before each phase starts, re-check the plan's
backend premises against CHANGELOG/Unreleased and the issue tracker —
the codebase moves under this document, and the tracker doubles as the
community wishlist (recent demand clusters on forge immediacy and
job-control knobs, independently supporting the strategic frame).**
(Deleted from tracking: TV mode; the 1/10/100 generator — the fixed
large-log fixture plus dogfood data cover Phases 1–2; build a generator
when a scale complaint arrives.)

---

## 8. Validation

Journey tests per §6 on dogfood data + the large-log fixture + **a
checked-in static scale dataset** (generated once, committed: ~100
pipelines, one 30-job fan-out) exercised at the Ph1b exit — R7/R26 are
requirements, and waiting for a scale complaint would contradict them
(CX4-6; this replaces the deleted *maintained* generator, not the
validation) · outside
usability sessions (3–5/phase from the OSS community) + scripted
admin/regulated walkthroughs · metrics: clicks-to-log-line,
pass-after-retry (linked), approval wait, queue time · drills as phase
exits · **baseline first**: run the §6 journeys against the *current*
UI before Phase 1a, so wins are measured, not asserted.

---

## 9. Open design questions

(Decisions themselves live in §10's checklist — single source, CX3-11.)

1. K3 protocol detail: metadata channel shape, migration, custom-type
   guidance (decision Ph0; the K7 slice constrains it).
2. Merge queues 🏢: display-only, post-Ph3; no reserved UI.
3. K12 schema: JUnit-first; unify only after the spike.
4. Environment identity: HCL block (recommended) vs convention (Ph2
   prototype, Ph3 need).
5. Config-from-change security (H1-full): deferred with in-repo config,
   base-config-runs default if it ever lands.
6. K6 heuristics: infra-failure corpus review (Ph1).
7. K15 channel v1 details: per-user webhook payload/auth shape.
8. K22 graph engine: viz.js-lazy vs owned layout (Ph1b).

---

## 10. Next steps — spikes, not reviews (round-3 process verdict, adopted)

The authoritative decision checklist, amended per round 4. No further
document review rounds **under any outcome** (round-4 stopping rule):
review reconvenes only against a spike that fails its acceptance test,
or the Phase-1a exit on running software; a v5 proposal requires a
named, source-checked SEV-1 in hand.

**Today-tasks (bugs to file now, independent of the plan):** MySQL
`TEXT` cap on `builds.steps` (R3-4) · `on_trigger` executes
author-defined commands in the server process, crossing team isolation
(R4-2) · `on_trigger` passes secret placeholders unresolved (R4-2) ·
missing THIRD-PARTY-NOTICES for the embedded Graphviz/EPL-1.0 in viz.js
(R4-11).

0. **K2 run-identity spike (1 day — the gap round 4 found, R4-1).**
   Trace one multi-job dogfood run through `triggerResourceJobs`, the
   scheduler tick, and `EvaluateDownstreamJobs`; write the version→run
   mapping by hand, covering one coalesced pending build and one
   fan-in; keep the full `candidates` list at creation (this is also
   K1-minimal's intent data). K2 is ratified only after this.
1. **K7-crude spike (2–3 days).** Fork flag + hold + K3-slice dedup on
   a branch, run through the existing `make test-backends` harness so
   all three SQL dialects are covered for free (R4-9). Acceptance:
   *upgrade a server with 5 open PRs (2 forks) → zero new builds, zero
   held items, byte-identical stored serialization of pre-existing PR
   versions*; **retry of a fork build and trigger-with-version on a
   fork head are held** (R4-4); release via CLI works; dispatch
   exclusions hold under a queued non-fork PR. Ship the security
   release only after this passes.
2. **K19 decision spike (~½ day).** CHANGELOG #652 already quantifies
   part of the answer (≈16MB of steps blobs per 50-build list); write
   the one-page store design (table vs files).
3. **Notify-work-item prototype (2–3 days, re-framed per R4-2/R4-5).**
   Build the system's first real queue table (claim/ack, fire-once
   dedup per hold event); **first deliverable: port the shipped
   `on_trigger` path onto it**, fixing the control-plane-exec and
   secret-placeholder bugs in the same motion. Acceptance: claim +
   fire-once under two concurrent workers; both transports; an
   *old-version* worker polling while a notify item is queued skips it
   (capability-gated), never misparses it; tag-matching rule decided.
4. **K5 prototype**: instrument the worker constraint/availability
   checks on one dogfood pipeline; only then commit the decision-record
   schema. Acceptance additions (CX4-9): determine whether speculative
   builds consume visible build numbers before deletion, and pick the
   numbering strategy (decide-before-allocate / accept gaps / separate
   internal IDs from visible numbers).
5. **Default-backend + retention + artifact-storage memo (1 page).**
   mem → sqlite default? Retention classes for K5/K14a/K20/K17b —
   **and the K8b tarball-storage decision (DB blob vs the product's
   first data directory, with backup/export implications stated), the
   largest objects the doctrine must cover** (R4-3).
6. **Ratify the K3 design on paper** (one page), then start Phase 0.

---

## Appendix A — Review traceability

**Framing (corrected per R4-12): this appendix is a delta.** Round-3
dispositions are below; round-4 dispositions follow them. Round-1/2
findings were dispositioned in v2/v3 and their fixes are all present in
this text; the detailed round 1–4 review files were retired once fully
folded in, so this document plus `PLAN-REVIEW-5.md` (pending batch) is
now the record going forward.

Round 3 (delta from v3):

| Round-3 finding | Resolution in v4 |
|---|---|
| R3-1 / CX3-3 | K7 implements K3's identity-subset dedup slice in Ph0; zero-new-builds upgrade exit; §2.1 note |
| R3-2 / CX3-8 | K8a → push-at-put (no addressing needed); K21 worker addressing & control for cordon/drain, Ph5; E15 drill via export path |
| R3-3 | Notify work item mechanism named in K7/K15 (worker-executed, worker-side secrets); GitHub-first with gitlab/gitea builtins or explicit scope note; forge report moved to Ph1b |
| R3-4 | K19 split (a fallback Ph1a / b store Ph1b–2); LogChunk persistence named; MySQL TEXT cap filed as today-bug |
| R3-5 | §5 persistence doctrine: mem caveat + "since server start" banner + sqlite-default memo (§10.5) + retention classes + export path |
| R3-6 | K7 dispatch exclusions enumerated (FindOldestPending, StartPendingBuild, concurrency/serial, stuck-classification, re-enqueue) |
| R3-7 | K20 strict schema, validate awareness, version-skew = error |
| R3-8 | Ph1a re-slimmed (K18/K16/K14a/K7-report → Ph1b); shell-agnostic components an explicit deliverable |
| R3-9 | K10 scoped to mutable-ref lineages; refless = one run per version, overlap = D5/K13d; §2.1 |
| R3-10 | K17b: attention-item identity, snooze rows, wake rules |
| R3-11 | Thesis #5 API+CLI+UI rule; `pikoci client builds release` in Ph0 exit |
| R3-12 | K22 graph-engine decision with acceptance tests |
| R3-13 | SCENARIOS drift pass applied (C11, E2, B13, E6, A12, "operator"→global admin in this plan) |
| CX3-1 | §2.1: opaque run_id at causal root; inputs = provenance |
| CX3-2 | §2.3/K5: non-run decision-record entity, dedup key, lifecycle |
| CX3-4 | K20: secret-backed values non-recordable by construction; recordable-by-declaration for plain inputs; authenticated-access + retention rules |
| CX3-5 | §2.1/§3.2: primary context colors the card; other lineages = counts + attention |
| CX3-6 | K15 minimum = generic per-user webhook |
| CX3-7 | Generic resume deleted; per-leg retry + continuation-job pattern (K13, §6 C6) |
| CX3-9 | 100k-line fixture + R11 perf check in the Ph1a exit |
| CX3-10 | K8a names its retrofit-hard fields (sha256 + size from Ph2); Ph4 cut line consistent |
| CX3-11 | §10 is the single decision checklist; §9 reworded to open *design* questions |
| Round-3 coherence | Deletions adopted (§ throughout): change-source layer, sub-state taxonomy (derived from reason codes instead), A12 tier matrix, merge-queue slot, Ph4/5 nav budgets, K14c (folded into K16), tracked TV mode, up-front generator. Vocabulary unified: one waiting family, one superseded. Solo reason-prompt ceremony removed |
| Round-3 strategy | §1 strategic frame: GitHub as reference forge + published generic contract; run-locally/validate as flagship; differentiator-first rule |

Round 4 (v4.1 line-edits):

| Finding | Resolution |
|---|---|
| R4-1 | §2.1 run = derived many-to-many mapping; retry contradiction deleted; K2 spike added (§10.0); K1 intent records all candidates |
| R4-2 | Two `on_trigger` today-bugs filed (§10); K15/spike-3 re-framed around porting `on_trigger` onto the work item; standing premise re-diff rule (§7 Continuous) |
| R4-3 | K8 rewritten: upload via worker HTTP client if G1b happens; storage decision + export-path statement in the §10.5 memo |
| R4-4 | K7: hold derived at every creation path; per-build release; retry re-derivation rules; spike-1 acceptance extended |
| R4-5 | K15: queue-table substrate, claim/ack, fire-once, skew capability-gating, tag rule — in contract and spike acceptance |
| R4-6 | Dogfood track added to §7 (gate, artifact put, cron, for_each — each one phase ahead of its exit) |
| R4-7 | REQUIREMENTS.md amended: R33–R37 added, R20 role fixed, authority order stated |
| R4-8 | SCENARIOS G1 split G1a (P1) / G1b (P2); K8 and Phase-2 exit re-pointed at G1a |
| R4-9 | K7: type-aware strip + read-join sentences; spike 1 uses `make test-backends` |
| R4-10 | §3.11: three testable shell-agnostic rules, checked at the Ph1a exit |
| R4-11 | THIRD-PARTY-NOTICES today-task; K22 licensing note |
| R4-12 | Appendix A re-framed as a delta; README claim corrected |

External round 4 (CX4, v4.1 second pass):

| Finding | Resolution |
|---|---|
| CX4-1 | §2.1: root-event→root-build association; double-trigger case in the K2 spike |
| CX4-2 | §2.3: two render-time families (waiting / won't run) derived from reason codes |
| CX4-3 | K18 split — minimal server-side keys in Ph1a; ideal-#9 claim now backed; R36 parity check at every phase exit |
| CX4-4 | K19a honesty rule: full-log download only where stored; MySQL column widening = Ph1a prerequisite, or a truncation banner |
| CX4-5 | K8a producer envelope (`result.json`) + "metadata unavailable" fallback |
| CX4-6 | §8: checked-in static scale dataset at the Ph1b exit (restores R7/R26 validation without a maintained generator) |
| CX4-7 | Persistence doctrine: retention preserves referenced records or leaves tombstones |
| CX4-8 | Doctrine + Phase-5 exit + §10.5 memo: export ≠ backup; E15 = snapshot + secrets + reconciliation |
| CX4-9 | K5/§2.3/§10.4: build-number allocation question added to prototype acceptance |
| CX4-10 | Intro counts corrected (R1–R37, 108 findings); Appendix B extended with R33–R37 |

## Appendix B — Requirements coverage

As v3, with: R11 → §3.5 + K19a/K19b (+ fixture in Ph1a exit, honesty
rule CX4-4) · R18 → §3.4 + K20 strict schema · R20 → §3.9 + K16/K21 ·
R27 → K9 · R31 → §3.1 + K15 + phase exits. New rows (CX4-10):
R33 → §2.3 non-run records + K5 · R34 → §3.5 tabs + K8a/K12 ·
R35 → thesis #2 + §3.2 + K4/K14b · R36 → thesis #5 rule + parity check
at every phase exit (§7) · R37 → §5 persistence doctrine + the Insights
meta-record storage view (§3.7).
