# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Member portal for the Da Nang Blockchain Hub coworking space. React 18 + Vite (plain JS, no TS) + Firebase (Auth, Firestore, Storage, Cloud Functions Node.js 22), PWA, EN/VI i18n. Members book amenities and run events; admins approve and manage.

`README.md` = source of truth for the **feature list**, **Cloud Functions table**, **project structure**, **Firestore collections**, and **setup/env vars**. Read it before changing those; don't duplicate its tables.

## Commands

- `npm run dev` — Vite dev server at :3000
- `npm run build` — production build
- `npm run lint` — eslint (see Clean-code caps below for the warning ratchet)
- `npm run preview` — preview production build
- `firebase deploy --only functions|firestore:rules|storage` — partial deploys
- `firebase emulators:start` — local emulators (client opts in via `VITE_USE_EMULATORS=true`)
- `firebase functions:log` — live function logs
- No test suite. Verify via dev server or emulators; for functions, `cd functions && npm run serve`.

## Architecture (non-obvious)

> Deep reference: `docs/knowledge/data-flow.md` traces auth → booking lifecycle → event lifecycle → Cloud Functions wiring → security rules. The bullets below are the load-bearing invariants; read the doc for the trace.

- **Service layer only.** Never call Firestore/Auth/Storage from components — go through `src/services/*`. Pages own server state via React Query (keys `['collection', optionalId]`, `refetchOnWindowFocus: false`, `retry: 1`).
- **Region pin, two places.** Functions are pinned to `us-central1` in `functions/index.js` (`REGION`) **and** `src/services/firebase.js` (`getFunctions(app, 'us-central1')`). They must move together — an asia-southeast1 attempt was rolled back over an IAM gap.
- **Conflict checking is advisory.** `checkBookingConflicts` is a callable; its client wrapper (`src/services/functions.js`) returns `{hasConflicts: false}` on error, and `firestore.rules` does NOT enforce overlap/hours/capacity. Don't assume the DB protects you.
- **Booking status is rules-enforced for members.** `pending → approved → checked-in → completed | cancelled`. Owners can only set `cancelled` (and delete only while `pending`); all other transitions are admin or scheduler (`autoCheckoutExpiredBookings`, hourly).
- **Desks are the only shared amenity.** `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ["desk"]` — overlap allowed up to `capacity`; every other type is single-occupancy.
- **Everything is Asia/Ho_Chi_Minh.** Client: `src/utils/timezone.js` (`parseHubDateTime` treats `datetime-local` strings as +07:00). Functions: `Intl`-based hub-day math. Office amenities default 9–18 Mon–Fri; event space 18–22 weekdays / 9–22 weekends (`EVENT_SPACE_AVAILABILITY` in `src/services/amenities.js`). Amenity availability fields are **top-level** (`startHour`, `endHour`, `availableDays`), not nested.
- **Wallet auth = custom tokens.** `generateWalletNonce` (5-min single-use nonce in `nonces/{address}`) → wallet signs → `verifyWalletSignature` (atomic nonce consume, ethers/nacl verify) → uid `eth_<addr>`/`sol_<addr>`. Flow lives in `src/services/walletAuth.js`.
- **Notifications are function-written only.** Clients can read their own and update only the `read` field (`firestore.rules`); `notifyEventStatusChange` writes them and sends the nodemailer email (`EMAIL_*` env, `EMAIL_PASS` secret).
- **Member profile auto-creates** in `members/{uid}` on first login (`AuthContext.createUserProfile`, `membershipType: 'member'`). Admin = `membershipType === 'admin'`; owners cannot change their own `membershipType` (rules).
- **Fixed desk plans** = one independent booking doc per working day sharing a `planGroupId`; cancel via `cancelFixedDeskPlan`, never by editing docs individually.

## Conventions

- All theme colors via CSS custom properties in `src/styles/globals.css`; dark variants under `[data-theme="dark"]`. Glassmorphism (backdrop-filter, translucent backgrounds), `'Outfit'` font, 12px border-radius.
- User-visible strings go through react-i18next keys (`src/locales/en.json` + `vi.json`) — both locales updated in the same change.
- Routes are lazy-loaded in `App.jsx` except `/`; new routes follow the `ProtectedRoute` + `requireAdmin`/`requireProfileComplete` pattern.
- Firestore writes set `createdAt`/`updatedAt` ISO strings; date fields use `Timestamp.fromDate` at the service boundary and `.toDate()` on read.

## Checks (green before marking work done)

- `npm run lint` — eslint (warning ratchet, see below)
- `npm run build` — vite production build (catches import/JSX errors; closest thing to CI)
- `cd functions && npm run lint` — functions are linted separately (Google style, build-blocking on deploy)
- No test suite. Verify behavior in `npm run dev` or `firebase emulators:start`.

### Clean-code caps (`.eslintrc.cjs`, scoped to `src/**`)

`complexity` ≤ 10, `max-statements` ≤ 30, `max-params` ≤ 5, `max-depth` ≤ 4, `max-nested-callbacks` ≤ 4 — all **`error`**, and the `lint` script runs `--max-warnings 0`, so any violation or new warning fails the build. Keep functions under the caps by extracting helpers/subcomponents; never add `eslint-disable` for these rules.

## Backlog workflow (STRICT)

No work without a spec. Every task = `docs/backlog/todo.<slug>.md`. Rename to `done.<slug>.md` **only after explicit human approval** — that rename is the completion source of truth.

Loop: **Plan** (write spec) → **Do** (implement; update spec first if scope changes) → **Check** (`npm run lint && npm run build` green) → **Verify** (walk the spec's `## Verify`) → **Act** (present outputs; await approval; rename `todo.*` → `done.*`).

Phase gate: for specs tagged `Phase: 1–4`, the rename IS the phase gate — don't start the next phase's spec until the prior phase's is renamed `done.*` after approval.

## Git workflow

Branch off `main` per spec. Never commit to `main`; human merges PRs. Spec rename ships in the same PR as the implementation. Prefixes: `feat/` · `fix/` · `ref/` · `chore/`

## Spec format

`docs/backlog/todo.<slug>.md` — agent-readable, ≤ 80 lines, drop empty sections (don't pad). Required: **Goal · Files · Acceptance · Verify**. Notes optional.

```
# <title>
**Phase**: <1–4|—> · **Deps**: <slugs|—>

## Goal
<2 sentences: what + why>

## Files
- `path/to/file.ext` (new|edited|deleted|renamed) — <purpose>

## Acceptance
- [ ] <testable claim>
- [ ] NOT: <forbidden behavior or scope boundary>

## Verify
- `<exact command>` → <expected outcome>
- regression: <adjacent items to re-run>

## Notes
<optional — invariants, gotchas, non-obvious order, hidden constraints>
```

- Exact paths and commands; no `<placeholder>` left in finished specs
- One testable claim per Acceptance bullet, no compound clauses
- `NOT:` prefix encodes negative criteria / scope boundaries (replaces a separate "Out of scope")
- Skip Notes entirely if obvious from Files + Acceptance
