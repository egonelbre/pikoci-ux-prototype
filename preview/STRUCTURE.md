# preview/ — code structure

How `preview/` is put together, and the conventions that keep it that way.

It was six files and 3,877 lines; it is now 91 files and 5,139 (the growth is
comments and file headers, not logic — the largest file is 207 lines and the
average is 56). Nothing about what the app does or how it looks changed:
every step was verified against the previous one, and the receipts are in the
commit messages.

## 1. Constraints

- **No tooling.** No node, no bundler, no package.json anywhere in this path.
- **`file://` must keep working.** Verified on Chrome 141: `<script type="module">`
  importing a sibling file is blocked — *"Access to script at 'file:///…' from
  origin 'null' has been blocked by CORS policy"*. So: classic scripts, ordered
  `<script>` tags, no `import`.
- **`prototypes/` is frozen.** Out of scope, untouched.

## 2. The four conventions

These do the job a module system would.

### 2.1 One namespace, one file, dependencies at the top

```js
// preview/views/queue.js
(function (PK) {
  'use strict';
  window.VIEWS = window.VIEWS || {};
  const { esc, fmtDur, ago, bDur } = PK.fmt;
  const { dataTable }              = PK.ui;

  VIEWS.queue = function () { … };
})(window.PK);
```

The destructure at the top is the import list *and* the load-order check: get
the order wrong and you get an immediate `TypeError: Cannot destructure
property 'dataTable' of undefined` naming the file, rather than an `undefined`
surfacing three clicks later. It earned its keep during the migration —
`routes.js` once took the `PK` parameter but not the argument, and every route
failed loudly and identically instead of subtly.

**The rule that keeps it honest:** destructure pure leaves (`PK.fmt`,
`PK.status`, `PK.model`, `PK.ui`, `PK.graph`). Capture the *namespace* for
anything stateful — `lib/actions.js` calls `app.refresh()` through the object,
`app.start()` calls `PK.live.start()` at boot — so nothing captures a function
that does not exist yet.

### 2.2 Three attribute families, one listener each

No inline JavaScript anywhere. Every interactive element declares intent.

| Attribute | Meaning | Owner |
|---|---|---|
| `data-act="verb" data-arg="…"` | run an action | `lib/actions.js` |
| `data-state="key" data-value="…"` | set view state | `lib/state.js` |
| `data-nav="#/…"` | navigate | `lib/navigate.js` |
| `data-toggle` / `-next` / `data-reveal` / `data-scroll` / `data-open-step` / `data-hilite` | show, hide, jump, light up | `lib/disclosure.js` |

`data-nav` carries one rule so no call site has to: a click that *started*
inside a link, button, input or `[data-act]` belongs to that thing, not to the
row. That removes twelve `onclick="location.hash=…"` attributes, every
defensive `stopPropagation()`, and the bug class where a row swallows its own
button's click.

### 2.3 State is registered, not global

```js
const filter = PK.state.use('changes.filter', '');
filter.get();  filter.set('flaky');    // set() re-renders
```

Backed by one `Map`, so `PK.state.dump()` prints everything the UI is holding.
Views bind declaratively (`<input data-state="changes.filter">`) and write no
handlers. `PK.state.define(key, {get, set})` covers state owned elsewhere with
its own setter — the team scope lives in `app.session` and announces itself.

Fold and `<details>` state deliberately stayed out: `app.refresh()` already
restores both from the DOM correctly, and moving them would add registry keys
without removing any code.

### 2.4 Script order is a dependency tier list

`index.html` loads in tiers, commented as such: **data → lib → model →
behaviour → ui → graph → views → boot**. A file may only destructure from a
tier above it. `<link>` order is the same idea for CSS: **tokens → base →
status → components → views → lab → responsive**, and that order *is* the
cascade.

## 3. The layout

```
preview/
  index.html              the script/link manifest, and a three-line boot
  routes.js               the route table — shared with tools/selftest.html
  STRUCTURE.md            this file

  data/                   21 files
    factory.js            the clock, log generators, b()/S(), the collections
    scenarios/            handwritten stories: trunk, prs, pr-builds,
                          other-builds, decisions, pipelines, environments,
                          versions, org, workers, audit
    generate/             scale: pipelines, release-branches, delivery,
                          packaging, environments, worker-week, branches,
                          queued-arm
    index.js              assembles window.DATA — and documents the load order,
                          because b() hands out ids from a counter

  lib/                    9 files, no domain knowledge
    fmt.js  toast.js  state.js  app.js  actions.js  navigate.js
    disclosure.js  keys.js  live.js

  model/                  8 files, read-only queries over window.DATA
    status.js  pipelines.js  lineages.js  branches.js  checks.js
    builds.js  attention.js  capability.js

  ui/                     presentational primitives
    table.js              dataTable() — §4
    filter.js             filterBar(): query + chips + count

  graph/
    layout.js             pure geometry: pipeline → {W,H,pos,flat,wraps}
    render.js             geometry → SVG
    debug.html            the layout inspector — §5

  views/                  19 files, one per page, ~90 lines each
    shell  chips  home  changes  branch-feed  pr-detail  run-graph
    pipeline  pipelines  build  checks  environments  queue  workers
    worker-detail  audit  teams  settings  gated

  styles/                 27 files
    tokens.css base.css status.css lab.css responsive.css
    components/           18 files: table, filter, buttons, header, panel,
                          card, strip, dots, context, reason, graph,
                          waterfall, verdict, log, box, palette, toast, rowlink
    views/                build, changes, pipelines, workers

  tools/
    selftest.html         §6
```

## 4. `dataTable()`

25 tables, one convention, and it used to live only in a CSS comment — so every
table re-derived it and three got it wrong.

```js
dataTable({
  cols: [
    { width: 'icon' },
    { label: 'build',        width: 'content' },
    { label: 'why it waits', width: 'fill', measure: '22ch' },
    { label: 'waiting',      width: 'content', align: 'right' },
    { width: 'action' },
  ],
  rows: pend.map(b => ({ nav: `#/b/${b.id}`, cells: [ … ] })),
})
```

**Every column hugs its content except exactly one, which absorbs the slack** —
and the helper asserts it, logging a warning that names the offending table's
own headers instead of leaving you to wonder why "waiting" is 159px wide to
hold "25m ago".

- `fill` — the one column that takes the leftover width. `measure` is a
  readable-prose minimum attached to *this column*, never to a font-size class,
  which is exactly what `.ctbl td.small { min-width: 22ch }` got wrong.
- `title` — fill, but truncating via the `.ctt` / `.shrink` wrapper.
- `content` — nowrap plus the `width:1px` floor.
- `action` — nowrap, right-aligned; buttons never wrap.
- `icon` — the fixed status-glyph column.
- `layout: 'fixed'` emits a `<colgroup>` and suppresses the `width:1px` floor.

Cells are strings or `{h, cls, title, attrs, colspan}`. Rows are
`{cells, nav?, cls?, attrs?}`, `{group}` for a full-width subheading (a team, a
pool, a repo), or `{raw}` for a row that is not a grid of cells at all — the
source excerpt under a failed check.

## 5. `graph/debug.html`

`graphSVG` used to do layer assignment, row wrapping, lane allocation,
invisible-node fan-out, port distribution *and* path emission in one 172-line
function returning a string. It is now `layout.js` (pure numbers, with every
eye-tuned constant a named option carrying its rationale) and `render.js`
(geometry → SVG, in small pieces).

Three rules keep the lines readable, all of them in `layout.js`:

- **Fan-out** — one source feeding several jobs in the next row splits once at
  an invisible node *in that row*, not at the wrap point.
- **Fan-in** — several sources feeding the same job merge once at an invisible
  node *in their own row*, so one trunk crosses the canvas instead of three.
  Fan-in wins any edge both groupings would claim, because it saves more.
  `delivery`'s 17 cross-row edges come out as 4 trunks.
- **Detours** — an edge spanning several layers would otherwise pass behind
  every node in between (a cron resource triggering a late job did exactly
  that: the line vanished under two boxes and reappeared). It is routed
  orthogonally along a horizontal channel that is clear in every column it
  crosses, picked nearest to where the line wanted to be. Alleys between node
  rows hold one or two lines, so assignment is capacity-aware; anything that
  does not fit gets a bus lane under the row, and the canvas grows to hold it.

The inspector is the payoff. Open it, pick any pipeline, and it draws the
layout on top of the real graph: lane `k`/`kIn` with their `xR`/`cy` channels,
every port attachment point, the invisible fan-out nodes, and row bands. The
last several rounds of graph tuning each cost a screenshot round-trip to work
out why two lines crossed; that question is now answered by looking.

## 6. `tools/selftest.html`

Opens by double-clicking. No node, no playwright — it works because every view
is a pure function returning a string, so it can render all 28 routes into a
measured off-screen container in its own document.

Checks, all of which have caught something real: render throws and console
errors; tables overflowing their container; headers wrapping to two lines;
inline action buttons wrapping (`.step-head` rows are exempt — those are block
buttons meant to be tall); exactly one fill column per table; any inline `on*`
handler; every `#/` link on the page resolving; and the docs-fidelity
assertions — gate lifecycle, `--concurrency`, global-vs-team dispatch,
worker-side drain, cron-as-resource, past-tense audit actions.

`SELFTEST.snapshot()` returns a normalised `innerHTML` dump per route. Steps
1–3 of the migration were pure moves, so the proof was a zero-diff comparison
against it.

## 7. What changed against the original plan

- **`lib/navigate.js` landed with step 4, not step 6.** `dataTable` emits
  `data-nav`, so writing it any other way would have meant writing it twice.
- **`model/` is eight files, not seven** — `branches.js` and `builds.js` split
  out of what the plan called `pipelines.js`.
- **`styles/` is 27 files, not the ~12 sketched** — components got one file
  each rather than being grouped.
- **Fold/`<details>` state stayed in the DOM.** See §2.3.
- **Dead CSS removed:** `.chg*` (the PR card layout the dense Changes table
  replaced), `.changes-table .row-link b`, and `.ct-title` (now the
  `.ctt`/`.shrink` wrapper). Verified: no element in any route carries them.

## 8. How each step was proven

| Step | Proof |
|---|---|
| 1–3 file moves | DOM snapshot byte-identical across all 28 routes |
| 2 `P` → `PK` | identical after applying the same rename to the baseline |
| graph split | byte-identical SVG |
| 4 tables | column widths measured before/after; 17 screenshots within 1% |
| 5–6 state/events | interaction suite grown to 16 tests |
| 7 CSS | computed-style fingerprint: 31 properties × 35,010 elements × 46 route/theme pairs, identical |

The CSS fingerprint caught four cascade-order regressions that were invisible
by reading — status colors falling back to `--fg`, `--spark` reverting in dark
theme, `.inline-det` losing to `.b2-det`, and the all-caps tracking rule losing
to per-component values. That is the argument for keeping it: a stylesheet
split cannot be reviewed by eye.
