# CI Platform UX Survey

How existing CI platforms present their information and lay out content, and what
each teaches us. Ordered roughly by paradigm. Each entry ends with the prototype
variation(s) it inspired.

## 1. Concourse — the graph is the product

- **Dashboard**: a wall of pipeline cards grouped by team, each card a miniature
  graph thumbnail whose color = health. HD view turns the whole screen into an
  airport-style status board.
- **Pipeline page**: a full-screen, pannable/zoomable DAG. Resources on the left
  edge, jobs as boxes, `passed` constraints as edges. Color = last build status;
  animation = running. Paused = blue, pinned = amber.
- **Build page**: horizontal strip of recent builds as numbered tabs; below, the
  step tree (get/task/put) with collapsible logs per step.
- **Strengths**: unbeatable structure legibility; status wall scales visually;
  the graph doubles as navigation.
- **Weaknesses**: graph is nearly the *only* navigation (list lovers suffer); big
  graphs need lots of panning; job history is secondary; actions hidden behind
  hover; no good cross-pipeline "what needs me?" view.
- → Variations: **01 graph-first**, **05 wallboard**.

## 2. GitHub Actions — the run list is the product

- **Entry**: repo → Actions tab → left sidebar lists workflows; main pane is a
  reverse-chron run list (branch, commit, actor, duration) with filters.
- **Run page**: left sidebar tree of jobs (grouped by matrix), main pane = selected
  job's log, split into collapsible steps with per-step durations and inline
  search. A summary view shows the job DAG as a horizontal flow of rounded nodes.
- **Strengths**: familiar to nearly every developer; run-centric model maps to
  "my commit" thinking; excellent log stepper; deep links to log lines.
- **Weaknesses**: no cross-repo/workflow health overview at all; DAG view is an
  afterthought; two clicks to see *why* the run happened; log sidebar + steps +
  annotations can feel nested.
- → Variation: **02 runs-first**.

## 3. GitLab CI — stages as columns, everything in the MR

- **Pipeline graph**: vertical columns per stage, jobs as pills stacked in each
  column, dependency lines between columns; needs-based DAG view optional.
- **Pipeline list**: table of pipelines (status, commit, stages as mini-dot-strip,
  duration). The mini-stage-dots row is a great glanceable summary.
- **Job page**: full-page terminal-style log with a right sidebar (metadata, retry,
  artifacts, related jobs).
- **Strengths**: stage columns are instantly readable for mostly-linear pipelines;
  mini pipeline dots pack lots of state into a row; job page focuses on the log.
- **Weaknesses**: columns waste space for deep DAGs; heavy chrome; navigation depth
  (project → pipelines → pipeline → job → log).
- → Variation: **03 stage-columns**.

## 4. Buildkite — three views over one build, resizable panes

- **Build page** (2024 redesign): collapsible sidebar of steps (group by pipeline
  order or state, searchable, `f` cycles failures), center content switchable
  between **Canvas** (DAG), **Table** (sortable jobs), and **Waterfall** (timing
  bars); selecting a step opens a resizable/dockable panel with logs, artifacts,
  env tabs. Follow-mode (`j`) auto-focuses the running step.
- **Strengths**: acknowledges no single view wins — structure, list, and timing are
  all one keystroke away; waterfall makes wasted wall-clock visible; keyboard-first;
  panel docking respects user preference.
- **Weaknesses**: complexity budget is high; first-time users see a lot of UI.
- → Variations: **04 waterfall**, and the dockable log panel idea reused in others.

## 5. Jenkins (classic + Blue Ocean) — tables, weather, and a cautionary tale

- **Classic**: folder/job tables with "weather" icons (trend), build history in a
  left column widget, log as raw page. Ancient but *dense* and deep-linkable.
- **Blue Ocean**: horizontal stage graph with big round nodes, per-stage log
  drawer. Beautiful, but it hid information density and was abandoned.
- **Lesson**: pretty node-graphs that cap information density lose to dense tables
  for daily drivers; trend/weather indicators (last N builds) are cheap and useful.
- → Variation: **10 dense-table** (weather column), history strips everywhere.

## 6. TeamCity — projects tree + investigation workflow

- Sidebar tree of projects/build configs; per-config a build list with rich rows
  (tests failed count, changes, agent); "investigations" assign a failure to a
  person; changes view correlates VCS commits with builds.
- **Strengths**: scales to hundreds of configs via the tree; change-centric
  correlation ("your commit broke it") is first-class.
- **Weaknesses**: enterprise-heavy chrome; many clicks.
- → Variations: **06 miller-columns** (tree → list → detail), change-correlation
  ideas in **09 activity-feed**.

## 7. CircleCI / Semaphore / Azure DevOps — workflow runs with step timelines

- CircleCI: projects → pipelines list → workflow DAG (compact left-to-right
  pills) → job page with step list + timing + tests tab.
- Semaphore: block/task grid per pipeline run.
- Azure DevOps: stages → jobs → steps drill-down list with per-step log pane.
- **Lesson**: the "compact horizontal DAG above, run list below" hybrid is the
  most common industry compromise.
- → Folded into **02 runs-first** and **03 stage-columns**.

## 8. Drone / Woodpecker — radical minimalism

- Repo list → build list → build page: left column list of steps, right pane log.
  Almost no other UI. Single accent color per status.
- **Strengths**: nothing to learn; fast; the 90% case (read the log) is optimal.
- **Weaknesses**: no DAG comprehension; no fleet/ops story; scales poorly past
  ~20 repos.
- → Baseline spirit for **07 terminal** and the overall "minimal design" mandate.

## 9. Dagger Cloud v3 — CI runs as traces

- Every run is an OpenTelemetry-style **trace**: hierarchical spans with a timeline,
  breadcrumb navigation into span subtrees, a dedicated error section that surfaces
  the failing span + log tail instead of burying it, incremental log rendering
  (last 1000 lines first).
- **Strengths**: treats "why slow" and "why failed" as the same question; hierarchy
  matches how build tools actually nest; error surfacing is the best in class.
- **Weaknesses**: traces are unfamiliar to non-observability people; structure
  (DAG) view is weak.
- → Variation: **08 trace-log**.

## 10. Vercel / Netlify — deployments as an activity feed

- One reverse-chron feed of deployments across the whole project/org: who, what
  branch, status, preview link. Click → build log. Filters by project/author.
- **Strengths**: matches the "what happened while I was away" question; zero
  structure to learn; great on mobile.
- **Weaknesses**: no DAG; poor for many-jobs pipelines; feed noise at org scale.
- → Variation: **09 activity-feed**.

## 11. CCTray / build wallboards (CCMenu, Nevergreen)

- The oldest CI UX: a grid of colored tiles, one per pipeline/job, designed for a
  TV on the wall. No navigation, only state.
- → Variation: **05 wallboard** (tiles drill down instead of dead-ending).

## 12. Terminal UIs (k9s, lazygit, gh run watch, tig)

- Not CI products, but the interaction model many developers prefer: single dense
  screen, panes, every action a keystroke, `/` to filter, breadcrumb state line.
- → Variation: **07 terminal** (keyboard-first web UI, command palette).

---

## Cross-cutting observations

1. **Nobody wins with one view.** Structure (graph), history (list), and timing
   (waterfall) answer different questions; the best modern pages (Buildkite) make
   them toggles over the same data rather than separate pages.
2. **The log is the destination.** Every journey ends in a log. Platforms that
   optimize log ergonomics (step collapse, jump-to-failure, follow, permalinks)
   feel good regardless of their information architecture.
3. **Status must travel upward.** Roll-ups (repo card → pipeline card → mini-stage
   dots → weather trend) are what make dashboards work; PikoCI's mini-graph SVG
   export is already this instinct.
4. **Fan-out needs grouping.** Matrix builds explode naive lists; GitHub groups
   matrix jobs under a parent node — PikoCI's `for_each`/`matrix` needs the same.
5. **Waiting-for-human is a special state.** Approval gates deserve louder UI than
   machine states; purple badges buried in a graph are not enough (Concourse has
   no approval concept; GitLab's "manual" jobs are famously easy to miss).
6. **Live-follow is emotional.** The difference between "calm" (Buildkite follow
   mode, smooth log tail) and "chaotic" (full-page refresh flicker) determines
   whether people keep the tab open — and a kept-open tab is the real dashboard.
7. **Ops surface is always bolted on.** Workers/agents pages are uniformly an
   afterthought table; a stuck-pending-build diagnostic ("no worker matches tags
   X") would beat every incumbent.

## Sources

- [Buildkite build page docs](https://buildkite.com/docs/pipelines/build-page),
  [waterfall view](https://buildkite.com/docs/pipelines/insights/waterfall),
  [new build page changelog](https://buildkite.com/resources/changelog/266-introducing-the-new-build-page-engineered-for-scale-and-flexibility/)
- [Dagger Cloud v3 announcement](https://dagger.io/blog/dagger-cloud-v3/),
  [Dagger observability docs](https://docs.dagger.io/features/observability/)
- Concourse, GitHub Actions, GitLab, Jenkins, TeamCity, CircleCI, Drone/Woodpecker,
  Vercel: product knowledge as of early 2026 (their layouts described above are
  long-stable).
