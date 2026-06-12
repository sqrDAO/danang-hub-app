# Knowledge base

Deep-reference docs for the Da Nang Blockchain Hub member portal. This is where **detail
lives** so the always-loaded files stay lean:

- **`CLAUDE.md`** (repo root) — agent rules + a terse architecture index. Loaded into every
  agent session, so it stays short and points *here* for depth.
- **`README.md`** (repo root) — human front door + the **canonical** tables (features,
  Cloud Functions, project structure, Firestore collections, setup). Those tables live
  there and nowhere else.
- **`docs/knowledge/`** (this folder) — long-form narrative: how data actually flows, why
  the system is shaped the way it is. Read on demand, never loaded wholesale.
- **`docs/backlog/`** — work specs (`todo.*` / `done.*`), governed by the backlog workflow
  in `CLAUDE.md`.
- **`docs/product-vision.md`** — what this app is for and who it serves.

## Contents

| Doc | Status | What it covers |
|---|---|---|
| [`data-flow.md`](./data-flow.md) | complete | End-to-end trace: auth (incl. wallet custom-token flow) → booking lifecycle → event lifecycle → Cloud Functions wiring → security rules, with real file paths |
| [`architecture.md`](./architecture.md) | stub | System shape: service layer, route protection, region pin, timezone strategy, theming, i18n, PWA, emulators |

## Conventions

- **One source of truth.** Canonical feature/function/collection/setup tables stay in the
  root `README.md`. Docs here **link** to them — they never copy a table (copies drift).
- **Narrative + paths.** These docs explain flow and reasoning and cite real `file:func`
  references; they don't restate the rules already in `CLAUDE.md`.
- **Versioning = git.** No freshness headers or changelogs — `git log` / `git blame` on
  the file is the history.
- **Keep file paths honest.** If you move or rename code a doc cites, update the doc in
  the same change.
