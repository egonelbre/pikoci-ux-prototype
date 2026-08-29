# Preview ↔ SCENARIOS.md — coverage audit

How well does `preview/` serve the 81 scenarios' ideal workflows? Three
independent passes (A+B, C+D+G, E+F+H), each judging whether the UI
*surfaces and affords* each ideal-workflow step over the fake data. All
routes driven headlessly; zero page errors.

## Scoreboard

| | P1 (17) | P2 (32) | P3 (32) | all 81 |
| --- | --- | --- | --- | --- |
| SERVED | 6 | 5 | 1 | 12 |
| PARTIAL | 10 | 22 | 9 | 41 |
| UNSERVED | 1 | 5 | 22 | 28 |

**Verdict: the preview holds the line exactly where the plan said to hold
it.** 16 of 17 P1 scenarios are at least partially served, and the ones
fully served are the thesis scenarios: A1/A2/A3 (push→verdict→diagnose),
B11 "why didn't this job run?" (the two-family reason system, judged the
centerpiece), C4 rollback, E2 "why is my build queued?" (honest capacity
answers incl. pool scale-from-zero), C11 approval staleness/races. The
UNSERVED mass sits in P3 admin long-tail (backup, badges, rename/delete,
auth admin) and in two clusters the plan already gates behind later
phases — but three P1/P2 clusters below deserve promotion.

## Section verdicts (scenario: verdict, gap in one clause)

**A. Inner loop** — A1 ✓ · A2 ✓ · A3 ✓ · A4 ◐ run-locally lacks the
environment recipe (image, env vars, services) · A5 ◐ no forward
retried-by link or flake feed · A6 ◐ validate/diff are noops · A7 ✗
parameterized one-off runs · A8 ✗ stacked changes · A9 ✗ **no setup/create
-pipeline flow at all** (adoption-deciding despite P2) · A10 ◐ no "4 of 30
ran" roll-up or run-everything override · A12 ◐ no force-full-tier action ·
A13 ◐ conflict UX is prose only.

**B. Diagnosis** — B1 ◐ names one from→to commit, not the multi-commit gap
or culprit-in-strip · B2 ◐ no environment block · B3 ◐ weather isn't
retry-aware; no flake board (Insights gated) · B4 ◐ no compare-two-runs ·
B5 ✗ no infra-failure (`errored`) representation — known backend contract
gap · B6 ✓ check errors loud everywhere · B7 ✗ cache · B8 ◐ refs not
digests · B9 ◐ **decision records answer causes piecemeal but there is no
single trigger-diagnostics panel** (webhook receipts, check runs, decision
trace) · B10 ◐ no cancel aftermath · B11 ✓ · B12 ◐ no dedup display ·
B13 ✗ broken-pin flow · B14 ◐ no owner metadata.

**C. Release & deploy** — C1 ✓ · C2 ◐ approval card's "diff since last
deploy" link is dead (cmpbox only renders on finished builds) and no
commits-since-deploy list · C3 ◐ no incident fast-path · C4 ✓ (bug found:
`ACT.rollback` pins pikoci's resource regardless of environment —
core.js:436) · C5 ◐ no version-at-stage on the graph · C6 ◐ no dry-run/
resume · C7 ◐ · C8 ✗ deploy locks/queue supersession · C9 ◐ **approvers
approve blind — plan output never embedded in the gate** · C10 ✗ · C11 ✓ ·
C12 ✗ who-can-approve/delegation/expiry · C13 ◐ verification not a build
phase · C14 ✗ canary.

**D. Scheduled** — D1 ◐ no new-vs-yesterday diff · D2 ◐ bots filter but no
aggregation/de-prioritization · D3 ✓ overdue-not-just-failed · D4 ◐ ·
D5 ◐ (bug found: tick-208's overlap-skipped decision is shadowed by a
build at the same ref, so it never displays) · D6 ✗ backfill.

**E. Operations** — E1 ◐ drain is a noop, no add-worker flow · E2 ✓ ·
E3 ◐ · E4 ✗ · E5 ◐ no filters/export · E6 ✗ **secrets inventory** · E7 ◐
drift+rollback strong, no degraded-mode banner · E8 ✗ · E9 ✗ **Settings
placeholder instead of a notification matrix + delivery log** · E10 ◐ ·
E11 ✗ · E12 ✗ · E13 ✗ · E14 ◐ "what moved the disk" is a strong seed ·
E15 ✗.

**F. Collaboration/OSS** — F1 ✓ teaching empty states praised · F2 ◐ one
-list triage works; **no bulk release or trusted-contributor allowlist** ·
F3 ◐ **everything renders as admin — no anonymous/public view** · F4 ◐ no
coverage delta · F5 ◐ Insights gated · F6 ✓ team dropdown scopes all ·
F7 ◐ · F8 ✗ badges · F9 ✗ access-denied page exists only as a footnote
sentence.

**G. Artifacts** — G1 ◐ artifacts on PR detail only; **build page itself
has none, no sha256/destination** (G1a is P1) · G2 ✗ **structured test
results — the only unserved P1**: failures are grepped log lines, not
objects with history · G3 ✗ preview envs · G4 ✗ · G5 ✗.

**H. Security** — H1 ◐ fork-hold strong; **no "config changed in this PR"
badge/diff, release is all-or-nothing on secrets** · H2 ◐ no provenance
chain artifact · H3 ◐ sec-scan warning only · H4 ✗ · H5 ✗ leak response.

## Consolidated backlog (deduped, ranked)

1. **G2 — tests as objects (P1, the one unserved P1).** "Tests" section on
   the build page: failed tests as rows (name, message, duration, last-8
   history), new-vs-known split; junit artifacts in data.js are fixtures.
2. **B9 — trigger diagnostics panel (P1).** Per-pipeline: webhook receipt
   log, recent check runs, per-version decision trace, forge-redeliver
   link — one page instead of four scattered surfaces.
3. **H1 — config-change surfacing + tiered release (P1).** "config
   changed" chip/diff on PR rows; release dialog offering
   none/job-scoped/full secret exposure.
4. **G1a — artifacts on the build page (P1, quick win).** Render
   b.artifacts on #/b/ with sha256 + put destination.
5. **F2/F3/F9 — OSS surface (P1).** Bulk release for held PRs +
   trusted-contributor chip; view-as-anonymous toggle; a real
   access-denied page ("why + who can help").
6. **C2/C9 — informed approvals (P1/P2).** Fix the dead diff link;
   commits-since-last-deploy on the gate card; embed plan output for
   plan-review-apply gates.
7. **A4/B2 — environment block (P1/P2).** Runner image, env var names,
   services, cache facts on the build page, feeding run-locally.
8. **B1 — multi-commit bisect list (P1).** All commits since last green on
   a red trunk build, with build-intermediate actions.
9. **B5 — `errored` infra-failure state (P2, needs backend contract).**
10. **E9/E6 — notification matrix + secrets inventory (P2 ops pair).**

## Bugs found by the audit (fix in preview)

- `ACT.rollback` always pins `pikoci`'s resource, whatever environment is
  rolled back (core.js:436).
- The overlap-skipped decision for tick-208 is shadowed by a build record
  at the same ref — the D5 demo never displays (data.js).
- Approval card's "diff since last deploy" link targets a cmpbox that
  doesn't render for waiting builds (views-b.js).

*Preview @ commit f1492c0. Companion report: DOCS-FIDELITY.md (docs
fidelity); this one measures scenario coverage. Together: A+D fidelity
fixes, docs-promised UI, and this backlog are the candidate work list for
the next preview round or Phase 1a scoping.*
