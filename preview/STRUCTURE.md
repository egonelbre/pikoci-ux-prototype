# preview/ — code structure plan

How `preview/` gets taken apart and put back together. Written because the four
files have grown past the point where you can find things in them; nothing here
changes what the app does or how it looks.

## 1. Where it hurts today

Measured, not felt:

| | |
|---|---|
| `data.js` | 1007 lines — canonical fixtures and synthetic scale generators interleaved |
| `views-b.js` | 878 lines — names nothing; holds the DAG engine, the build page, and all of ops |
| `core.js` | 724 lines — formatting, domain queries, actions, router, keyboard, live sim |
| `views-a.js` | 641 lines — shell, home, changes, PRs, environments |
| `app.css` | 565 lines, 582 rules, 392 selectors, three append-only "batch" sections |

Five specific problems:

**The a/b split carries no meaning.** `views-a.js` and `views-b.js` are a
byte-count boundary. Nothing tells you the DAG layout engine is in b, or that
`runGraph` (mini graph, in a) and `graphSVG` (full graph, in b) are siblings.

**The longest functions are the hardest ones.** `graphSVG` 172 lines,
`VIEWS.build` 169, `VIEWS.changes` 152, the `ACT` table ~160, `attention()` 107.
In each case a genuinely intricate piece of logic — wrap-row lane assignment,
port distribution, attention-class ranking — is spelled out inline inside a
string template, so you cannot look at the algorithm without reading the markup
it is embedded in.

**Two event models, and they have already collided.** 38 inline handlers
(`onclick=`, `oninput=`, `onmouseenter=`) coexist with capture-phase
`data-act` delegation across 13 verbs. Twelve of the inline ones are
`onclick="location.hash=…"` row navigation, each needing a matching
`event.stopPropagation()` on every button inside the row — which is exactly the
bug that killed queue-Cancel and worker-drain until the delegate moved to the
capture phase.

**View state is twelve loose globals.** `window._chgF`, `_chgC`, `_chgB`,
`_brF`, `_brC`, `_pipF`, `_pipC`, `_envF`, `_envC`, `_wkR`, `_wkHi`, `_tq`, each
a hand-written setter over a module-scoped `let`, each ending in
`P.App.refresh()`. There is no list of what state the app holds and no way to
reset it.

**Repeated markup hides its own rules.** 27 `.tbl-scroll` tables, 21 chip
sites, 12 filter inputs, each written out longhand. The column-sizing
convention — nowrap columns pin to content, exactly one column carries
`width:100%`, `.fixed` tables use a colgroup instead — lives only in a CSS
comment, so every table re-derives it and three of them got it wrong. The
`.ctbl td.small { min-width: 22ch }` rule, written for the queue's "why it
waits" prose, silently put a 159px floor under every small cell in the app.
That is a whole bug class, not one bug.

## 2. Constraints

- **No tooling.** No node, no bundler, no package.json in the preview path.
- **`file://` must keep working.** Verified on Chrome 141: `<script type="module">`
  importing a sibling file is blocked — *"Access to script at 'file:///…' from
  origin 'null' has been blocked by CORS policy"*. So: classic scripts, ordered
  `<script>` tags, no `import`.
- **`app.css` and the logo are hand-edited.** Any change to them is a mechanical
  move proven not to alter rendering, never a rewrite.
- **`prototypes/` is frozen.** Out of scope entirely.

## 3. The conventions

Four rules replace what a module system would have enforced.

### 3.1 One namespace, one file, dependencies at the top

```js
// preview/views/queue.js
(function (PK) {
  'use strict';
  const { esc, ago }   = PK.fmt;
  const { dataTable }  = PK.ui;
  const { waiting }    = PK.model.queue;

  PK.views.queue = function () { … };
})(window.PK);
```

The destructure at the top is the import list *and* the dependency check: load
`queue.js` before `ui/table.js` and you get an immediate
`TypeError: Cannot destructure property 'dataTable' of undefined` naming the
file, instead of a silent `undefined` surfacing three clicks later.

The rule that makes this safe: **destructure only leaf modules** (`fmt`, `ui`,
`model`, `status`). Anything that can be re-entered or is created late — the
router, actions, state — is reached through the namespace at call time
(`PK.app.refresh()`), never captured at load time.

`window.P` and `window.VIEWS` go away; 134 `P.*` call sites and 59 `VIEWS.*`
sites move to `PK.*`. No compatibility shim — a half-migrated namespace is worse
than either end state.

### 3.2 Three attribute families, one listener each

Every interactive element declares intent in an attribute. No inline JavaScript
anywhere in the templates.

| Attribute | Meaning | Handled in |
|---|---|---|
| `data-act="verb" data-arg="…"` | run an action | `lib/actions.js` |
| `data-state="key" data-value="…"` | set view state | `lib/state.js` |
| `data-nav="#/…"` | navigate | `lib/nav.js` |

`data-nav` is the one that pays immediately: the delegate walks up from the
click target and ignores the navigation if the click originated inside an
`<a>`, `<button>`, `<input>` or anything carrying `data-act`. Twelve
`onclick="location.hash=…"` attributes and every defensive
`event.stopPropagation()` disappear, and the class of bug where a row swallows
its own button's click becomes unrepresentable.

### 3.3 State is registered, not global

```js
// lib/state.js
const filter = PK.state.use('changes.filter', '');
filter.get();          // read
filter.set('flaky');   // write + refresh
```

Backed by one `Map`, so `PK.state.dump()` prints everything the UI is holding.
Views bind to it declaratively — `<input data-state="changes.filter">`,
`<button data-state="changes.chip" data-value="failing">` — and `state.js` owns
the two delegated listeners. All twelve `window._*` globals go.

Fold and `<details>` state moves into the registry too, which shrinks
`App.refresh()`: it keeps restoring scroll positions and focus identity (both
genuinely DOM-only concerns) and stops reconstructing open/closed state from the
DOM it is about to destroy.

### 3.4 Script order is a dependency tier list

`index.html` loads in five tiers, commented as such: **lib → model → ui → views
→ boot**. Within a tier, alphabetical. A file may only destructure from a tier
above it. This is the one rule a reviewer has to hold in their head.

## 4. Target layout

```
preview/
  index.html              boot + the route table, nothing else
  STRUCTURE.md            this file

  lib/                    no domain knowledge, no markup
    fmt.js                esc, ago, fmtDur, bDur, lastOutputAge
    state.js              the registry + its two delegated listeners
    nav.js                data-nav delegate, route parse, hashchange, title/focus
    actions.js            ACT verbs, idempotency keys, conflict answers, toast
    keys.js               keyboard layer + ⌘K palette
    live.js               the live simulation ticker
    app.js                session, refresh + scroll/focus restoration, start()

  model/                  pure functions over window.DATA — no DOM, no strings
    status.js             STATUS, RANK, REASON, st, bStatus, reasonLabel
    pipelines.js          pipelines, getPipeline, vmeta, jobBuilds, jobCell,
                          primaryRef, primaryStatus, secondaryCounts, plHistory
    lineages.js           lineages, lineageHead, lineageStatus, mine, branchIndex
    checks.js             testStats, testRuns, testHistory, isNewFailure,
                          measurementDelta, compareWithLastGreen
    attention.js          attention() and its ranking classes
    capability.js         navItems, gatedEmpty
    ops.js                queue/worker/pool derivations

  ui/                     presentational primitives — markup, no domain knowledge
    table.js              dataTable() — §5
    panel.js              panel, section, empty state, allclear
    filter.js             filter bar: input + chip row, bound to a state key
    bits.js               chip, dot, statusDot, kbd, code, ctt/ellipsis wrapper
    charts.js             weather, sparkDur, gauge, dots, weekChart

  graph/
    layout.js             pure: pipeline → {rows, nodes, edges, lanes, ports}
    render.js             geometry → SVG
    debug.html            renders layouts with lane/port numbers visible

  views/                  one page each, orchestration only
    shell.js  home.js  changes.js  prDetail.js  branchFeed.js
    pipelines.js  pipeline.js  runGraph.js  runTimeline.js
    build.js  checks.js
    environments.js  envDetail.js
    queue.js  workers.js  workerDetail.js
    audit.js  teams.js  settings.js  gated.js

  data/
    factory.js            b(), S(), trunkRun(), prBuild(), the log generators
    scenarios/            handwritten canonical stories
      trunk.js  prs.js  delivery.js  packaging.js  decisions.js
      environments.js  org.js        (teams, users, workers, pools, audit)
    generate/             synthetic scale
      pipelines.js  environments.js  branches.js  releases.js
    index.js              assembles window.DATA

  styles/
    tokens.css            :root palette, themes, the WCAG text-contrast overrides
    base.css              reset, layout, typography
    components/           table.css chip.css button.css panel.css card.css
                          dots.css gauge.css waterfall.css graph.css
                          palette.css toast.css logs.css
    views/                build.css changes.css pipelines.css workers.css
    lab.css               data-skin / data-font style lab

  tools/
    selftest.html         §7
```

Roughly 55 files where there are 6. That sounds like a lot until you notice the
average is ~70 lines and every name answers "where does X live".

## 5. `dataTable()` — the primitive worth building first

27 tables, one convention, currently transcribed by hand each time. The helper
takes a column spec and emits the markup the convention requires:

```js
dataTable({
  className: 'ctbl',
  cols: [
    { width: 'icon' },
    { label: 'build',        width: 'content' },
    { label: 'needs',        width: 'content' },
    { label: 'why it waits', width: 'fill', measure: '22ch' },
    { label: 'waiting',      width: 'content', align: 'right' },
    { width: 'action' },
  ],
  rows: pend.map(b => ({ nav: `#/b/${b.id}`, cells: [ … ] })),
})
```

What the spec encodes, so no view has to remember it:

- `content` → `nowrap` + the `width:1px` floor
- `fill` → `width:100%`, and the optional `measure` becomes a `min-width` **on
  that column only** — the fix that the `.small { min-width:22ch }` rule got
  wrong by attaching a readable-measure rule to a font-size class
- `title` → the `.ctt` / `.shrink` ellipsis wrapper
- `action` → `nowrap`, so buttons never wrap (the four-line "Roll back to this")
- exactly one `fill` column, asserted — a table with none or two is a console
  warning, not a layout mystery
- `layout: 'fixed'` emits `table-layout:fixed` + a `<colgroup>` and suppresses
  the `width:1px` floor, which currently has to be remembered as
  `:not(.fixed)` in the stylesheet
- `rows[].nav` emits `data-nav`, so row navigation and inner buttons stop
  fighting

`filter.js` does the same job for the four filter bars (input + chips + result
count), all bound to a state key rather than a `window._` setter.

## 6. The graph engine

`graphSVG` is the single densest thing in the app and the part most likely to
be changed again — it currently does layer assignment, greedy row wrapping,
nested lane allocation, invisible-node junction fan-out, port distribution *and*
SVG path emission in one 172-line function that returns a string.

Split at the geometry boundary:

- `graph/layout.js` — `layout(pipeline, opts) → {rows, nodes[], edges[], lanes[]}`,
  pure numbers, no strings. Every constant that was tuned by eye this week
  (`MAXW`, `rowGap`, `wrapGutter`, `LX`, the lane stride, the port
  distribution) becomes a named option with its rationale next to it.
- `graph/render.js` — geometry → SVG, including the rounded-corner path builder.
- `graph/debug.html` — renders any pipeline's layout with lane indices, port
  order and junction points drawn on top. The next time a line overlaps, that
  page shows why in one look instead of requiring a screenshot round-trip.

`runGraph` (the per-commit mini graph, today in `views-a.js`) moves next to it.

## 7. Safety net: `tools/selftest.html`

The route checker, table checker and fidelity checker that have been catching
regressions all session live in `/tmp` and die with the session. They should be
in the repo — and they can be, with no tooling, because every view is a pure
function returning a string.

`tools/selftest.html` loads the same scripts as the app, renders each route into
a measured container, and prints a green/red list. It opens by double-clicking.
Checks, all of which have caught something real:

- every route and all 18 landing deep links render without throwing
- no console errors
- no table overflows its container horizontally
- no table header wraps to two lines
- every table has exactly one fill column
- no button wraps to more than one line
- the docs-fidelity assertions (gate lifecycle, reject reason, cron-as-resource,
  past-tense audit actions)

During the migration it gets one more mode, then loses it again: **DOM snapshot
diff**. Before a step, dump `innerHTML` for every route to a JS blob; after, diff.
Steps 1–3 below must produce a zero diff — that is what makes moving 3,800 lines
of code safe rather than hopeful.

## 8. Sequence

Each step lands as its own commit, green on `selftest.html`, and leaves the app
working. No step is longer than an afternoon.

| # | Step | Diff shape | Proof |
|---|---|---|---|
| 0 | `tools/selftest.html` against the code as it stands today | additive | catches the current state |
| 1 | Split `data.js` → `data/` | pure move | snapshot diff = 0 |
| 2 | Split `core.js` → `lib/` + `model/`, `P` → `PK` | move + rename | snapshot diff = 0 |
| 3 | Split `views-a/b.js` → `views/`, `graph/` extracted | pure move | snapshot diff = 0 |
| 4 | `ui/` primitives; migrate the 27 tables and 4 filter bars | markup changes | selftest green, screenshots reviewed |
| 5 | `lib/state.js`; kill the 12 `window._*` globals | behaviour-preserving | selftest green |
| 6 | `data-nav` + `data-state`; delete all 38 inline handlers | behaviour-preserving | selftest green |
| 7 | Split `app.css` → `styles/`, fold the three batch layers into components | pure move | computed-style diff = 0 |

Steps 1–3 are mechanical and could be done in one sitting; 4–6 are where the
code actually gets better; 7 is last because `app.css` is the file most likely
to have been edited on your side, and it needs its own before/after check
(sample every element in every route, diff `getComputedStyle`) rather than a
markup snapshot.

## 9. Out of scope

- `prototypes/` — frozen explorations, left alone.
- Any change to what the app shows or how it behaves. Fidelity work, scenario
  coverage and the deferred review batches continue against the new layout, not
  as part of the move.
- A framework, a build step, a package.json. If the real frontend adopts one,
  this preview stays as it is: the reference for *what* to build, readable by
  anyone with a browser.
