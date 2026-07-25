# Weekly code review

Each `YYYY-MM-DD-weekly.md` in this directory is one week's review: baseline check
results, an assessment of that week's merged PRs, severity-ranked findings, and a pointer
to the `docs/backlog/todo.*.md` spec filed for each actionable finding.

The review **plans only**. Nothing found here gets fixed in the review PR — findings
become specs, and specs go through the normal backlog loop in `CLAUDE.md`.

## The procedure

`.claude/skills/weekly-code-review/SKILL.md` — a committed skill, so any Claude Code
session in this repo picks it up. Invoke it with `/weekly-code-review`.

It is committed deliberately: `.gitignore` excludes `.claude/*` (local session state) but
negates `.claude/skills/`, because a cloud routine clones the repo fresh on every run and
can only use skills that are in git.

## Running it weekly

Cloud routines are configured at [claude.ai/code/routines](https://claude.ai/code/routines).
`/schedule` in the CLI does the same thing, but it is unavailable from inside a Claude
Code on the web session, so create this one from the web UI.

| Field | Value |
| --- | --- |
| **Name** | Weekly code review — danang-hub-app |
| **Repositories** | `sqrDAO/danang-hub-app` |
| **Trigger** | Schedule → Weekly (Friday afternoon local; runs land a few minutes late by design) |
| **Environment** | Default (Trusted network is enough — npm registry only) |
| **Permissions** | Leave *Allow unrestricted branch pushes* **off** — the routine only needs `claude/`-prefixed branches |
| **Connectors** | Remove all except GitHub |

Prompt:

```text
Run the weekly code review for this repository using the /weekly-code-review skill
committed at .claude/skills/weekly-code-review/SKILL.md. Follow it exactly.

Work on the branch claude/weekly-code-review. If a previous PR from that branch is
already merged, reset the branch to the latest main before starting rather than
stacking new commits on merged history.

Commit the review doc and the backlog specs, push the branch, and open a pull request
titled "docs: weekly code review for <window>". Then stop — do not implement any fix
you find, and do not rename any todo.* spec to done.*.

If a finding needs a product or architecture decision from a human, say so explicitly
in the PR description under a "Decisions needed" heading rather than choosing silently.
```

The prompt tells the routine to open a PR; interactive runs default to push-only. That is
the one intentional difference — an unattended run with no PR leaves the work invisible.

## Reviewing the output

A green run status means the session exited cleanly, not that the review was any good.
Open the run and check:

- the baseline table reports real command output, not assumptions
- every finding cites `file:line` and a concrete consequence
- every spec's `Verify` commands are runnable as written (no `…`, no `<placeholder>`)
- no `todo.*` was renamed to `done.*`

Then approve the specs you want built, and let the backlog loop take them from there.
