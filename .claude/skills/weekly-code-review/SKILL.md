---
name: weekly-code-review
description: Run the weekly code review for danang-hub-app — establish a baseline, review the week's merged diff, sweep the codebase invariants, then write docs/reviews/<date>-weekly.md plus a docs/backlog/todo.*.md spec per actionable finding. Use when asked for a weekly review, a code health check, or when a weekly-review routine fires.
---

# Weekly code review

Produce a review report plus one backlog spec per actionable finding. **Review and plan
only — do not fix anything you find.** Fixes go through the normal backlog loop after a
human approves the spec (see `CLAUDE.md` → Backlog workflow).

Read `CLAUDE.md` first — the architecture invariants there are the checklist for step 4,
and the spec format in it is binding on step 6.

## 1. Scope the window

```bash
ls docs/reviews/                                    # last review = start of window
git log --pretty=format:'%h %ad %s' --date=short -30
git log --since=<last-review-date> --no-merges --pretty=format:'%h %ad %s' --date=short
```

The window runs from the last review doc's date to today. If `docs/reviews/` is empty,
use the last 7 days. Record the base and head SHAs — the report cites them.

## 2. Baseline

`node_modules` is absent in a fresh clone and the repo pins **eslint 8** with a legacy
`.eslintrc.cjs`. A globally-installed eslint 9+ fails with "couldn't find
eslint.config.js" — that is a missing `npm install`, not a real lint error.

```bash
npm install && cd functions && npm install && cd ..
npm run lint            # must be clean: --max-warnings 0
npm run build           # closest thing to CI
cd functions && npm run lint && cd ..
```

i18n key parity (`en.json` / `vi.json` must stay identical — repo convention):

```bash
node -e "const en=require('./src/locales/en.json'),vi=require('./src/locales/vi.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>v&&typeof v==='object'&&!Array.isArray(v)?f(v,p+k+'.'):[p+k]);const e=new Set(f(en)),v=new Set(f(vi));console.log('en',e.size,'vi',v.size);console.log('missing in vi',[...e].filter(k=>!v.has(k)));console.log('missing in en',[...v].filter(k=>!e.has(k)))"
```

Then `npm audit` at the root and in `functions/`. Report severity counts, and name the
packages — note when they are transitive (they usually are, via firebase-admin).

Restore any lockfile churn `npm install` caused before committing:
`git checkout -- package-lock.json functions/package-lock.json`.

## 3. Review the week's diff

```bash
git diff --stat <base>..HEAD
git diff <base>..HEAD -- src/ functions/ firestore.rules storage.rules .eslintrc.cjs
```

Read the whole source diff, not just the stat. For each merged PR, say whether it is
correct and why. Say so plainly when the week's work is clean — that is a real finding,
and it keeps the report honest about which problems are new versus pre-existing.

## 4. Sweep the invariants

Most findings come from here, not the diff. Walk the `CLAUDE.md` invariants and check the
code still honors them. High-yield targets, in rough order:

- **`firestore.rules`** — for every collection, trace each client write in
  `src/services/*` and confirm a rule permits it, and that no rule permits more than
  intended. Cross-check the rules table in `docs/knowledge/data-flow.md`. Ask on every
  `allow update`: which fields does this let the writer change that it shouldn't?
- **`functions/index.js`** — read every `exports.*`. Look for: triggers that only
  `console.log` (deployed cost, no effect), read-then-write sequences that need
  `runTransaction`, self-retriggering writes, and validation present in one callable but
  missing in its sibling.
- **Service layer** (`src/services/*.js`) — docstrings that no longer describe the code,
  functions whose name overpromises, non-atomic array rewrites, and per-caller
  reimplementation of the same filter.
- **Public vs member surfaces** — anything `src/pages/Home.jsx`, `src/pages/Events.jsx`
  or `src/pages/Amenities.jsx` renders is visible to anonymous visitors. Check what
  status/ownership filtering they apply, and whether they call `useTranslation`.
- **Timezone** — `src/utils/timezone.js` and the `Intl`-based hub-day math in functions
  must agree; everything is Asia/Ho_Chi_Minh.
- **React Query** — key shape `['collection', optionalId]`, object-form
  `invalidateQueries({ queryKey: [...] })`, and whether a mutation invalidates the keys
  its write actually affects (both too few and too many are findings).

Verify before writing anything down. Read the code path end to end, and prefer an
emulator check for a rules or trigger claim. A wrong high-severity finding costs more
than a missed low one. If a claim can't be fully verified from the repo (deployed rules,
prod data), say so in the finding and make the spec's first step "verify against live".

## 5. Write the report

`docs/reviews/YYYY-MM-DD-weekly.md`, using today's date. Sections:

1. **Header** — window dates, base→head SHAs, merged PR numbers, diff stat.
2. **Baseline** — table of the step-2 results.
3. **Review of the week's changes** — per-PR assessment.
4. **Findings** — severity-ordered. `H` = data integrity or access control, `M` =
   user-visible defect or ongoing cost, `L` = quality with no user impact. Each finding:
   what is wrong, the `file:line` anchors, the concrete consequence, and a link to its
   spec. Fence code blocks with a language (`text` for rules snippets) — markdownlint
   MD040 is enforced by review tooling.
5. **Recommended order** — what to do first and why.
6. **Process notes** — backlog hygiene, open specs still valid, testing gaps.

State impact concretely ("a concurrent waitlist join is silently erased"), not
abstractly ("possible race condition").

## 6. Write one spec per actionable finding

`docs/backlog/todo.<slug>.md`, in the exact format `CLAUDE.md` → Spec format defines:
**Goal · Files · Acceptance · Verify**, ≤ 80 lines, Notes optional.

Rules that reviewers will hold you to:

- **No placeholders.** Every command must be runnable as written — no `…`, no
  `<placeholder>`. If a step needs a fixture, supply a concrete one.
- **One testable claim per Acceptance bullet.** No compound clauses.
- **`NOT:` bullets** encode scope boundaries and forbidden behavior.
- **Acceptance must match what the fix can actually enforce.** If a mechanism can't
  guarantee something (Firestore rules can't diff array contents, for instance), write
  the criteria to the enforceable boundary and state the residual gap in Notes. Never
  let Acceptance promise what Notes admits is impossible.
- **A finding needing a human decision gets a `## Decision required` section** at the
  top, and the spec is written for one option. Don't leave Acceptance asserting a
  behavior that Notes calls undecided.
- Merge findings that must be fixed together into one spec (same file, same PR).

## 7. Ship it

Commit the report and specs together on a `claude/`-prefixed branch and push with
`git push -u origin <branch>`. **Do not open a PR unless asked** — and if the branch's
previous PR is already merged, restart from the default branch rather than stacking:

```bash
git fetch origin main && git checkout -B <branch> origin/main
```

Do not rename any `todo.*` spec to `done.*` — that rename requires explicit human
approval and is the completion source of truth.

Report back: baseline results, finding counts by severity, the spec list, and any
decision you need from a human.
