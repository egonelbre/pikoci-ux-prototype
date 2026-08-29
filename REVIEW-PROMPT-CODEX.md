# Prompt for the codex 5.6 sol (xhigh) review — round 5, second seat

Copy everything below the line into codex, run from the repo root that
contains both `pikoci/` and `pikoci-ux/`.

---

You are the second seat of review round 5 for the PikoCI UX plan. The
first seat (a Claude reviewer) has already filed
`pikoci-ux/PLAN-REVIEW-5.md`. The corpus has absorbed 108 findings over
eight rounds; round 5 seat 1 added 5 more (a 14-defect patch-scar batch,
ghost-v3 acceptance baselines, a redundant K8a result envelope, an
unscheduled K9 implementation, an unnamed scale-dataset carrier) plus a
pre-mortem recommending a Phase-1a swap (K9 transport + on_trigger port
in, K20-CAS out). Read ALL of `pikoci-ux/PLAN-REVIEW*.md` first —
repeating anything in them, including seat 1's findings, scores
negative. Honest "no finding" per area beats invention.

Target: `pikoci-ux/UX-PLAN.md` (v4.1), with `pikoci-ux/REQUIREMENTS.md`
and `pikoci-ux/SCENARIOS.md` for cross-checks, and the PikoCI source in
`pikoci/` for verification (READ ONLY).

Your differentiated mandate — areas seat 1 did NOT cover:

1. **Verify seat 1.** Its five findings and five mechanism-check
   verdicts (PLAN-REVIEW-5.md) are themselves unreviewed. Source-check
   at least: the claim that put steps already return a structured
   result on stdout (`implicitGetAfterPut`), the K18 middleware
   insertion point claim (named routes + uniform encodeResponse), the
   V30 migration precedent for column widening, and the `--db-file`
   ~10-line claim. Where seat 1 is wrong, that is a finding.
2. **The Phase-1a swap recommendation.** Seat 1 proposes moving K9
   transport implementation and the on_trigger→work-item port INTO
   Phase 1a and K20-CAS out. Argue it both ways against the source and
   the plan's own dependency rules; give a verdict. The work-item port
   was sized "2–3 days" in §10.3 — is that consistent with landing it
   in 1a alongside the rest?
3. **The pre-mortem's factual basis.** Seat 1 leans on #652/#655/#528
   and #656 as demand signal. Check the tracker/CHANGELOG yourself: is
   the "felt pain is latency/liveness, not diagnosis depth" reading
   fair, or selection bias?
4. **Anything structurally new.** One pass of your own choosing over
   whatever the eight rounds have systematically neglected. If you find
   nothing, say "nothing new" in one line.

Output: write `pikoci-ux/PLAN-REVIEW-5B.md` with: a verdict paragraph
(including agree/disagree with seat 1's stop-now recommendation and the
swap), findings numbered CX5-1..N with [SEV] · Where · Problem ·
Evidence · Fix, a seat-1 verification table (claim → confirmed/refuted →
evidence), and a two-line closing on whether the corpus is done.
