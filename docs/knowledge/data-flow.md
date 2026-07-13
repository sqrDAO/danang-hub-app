# Data flow & lifecycle

How a member signs in, books a desk, and runs an event — from the UI click, through the
service layer and Firestore, to the Cloud Functions that approve, notify, and clean up.

Every path here is traced from code. Paths are relative to repo root. The **canonical
feature list, Cloud Functions table, project structure, and Firestore collection overview
live in the root [`README.md`](../../README.md)** — this doc explains the *flow* and the
non-obvious mechanics rather than copying those tables.

## Topology

```
        CLIENT (React + Vite)                       FIREBASE
 ┌──────────────────────────────┐      ┌────────────────────────────────────┐
 │ pages/* (React Query)        │      │ Firestore                          │
 │   │                          │      │  members / amenities / bookings    │
 │   ▼                          │ SDK  │  events / projects / notifications │
 │ src/services/* ──────────────┼─────▶│  nonces                            │
 │  (thin Firebase wrappers)    │      └───────┬────────────────────────────┘
 │   │                          │              │ triggers (onCreate/onUpdate)
 │   │ httpsCallable            │      ┌───────▼────────────────────────────┐
 │   └──────────────────────────┼─────▶│ Cloud Functions (us-central1)      │
 │                              │      │  callables · triggers · schedulers │
 └──────────────────────────────┘      └────────────────────────────────────┘
```

Clients talk to Firestore directly through `src/services/*` (guarded by `firestore.rules`);
Cloud Functions handle what clients can't be trusted with (conflict checks, wallet auth,
notifications, scheduled cleanup). Everything time-related is `Asia/Ho_Chi_Minh`.

---

## 1. Auth & profile

### Four sign-in methods — `src/contexts/AuthContext.jsx`

Google popup, email+password (sign-up / sign-in / reset), EVM wallet, Solana wallet — all
exposed from one context. Every method funnels through `createUserProfile()`, which
auto-creates `members/{uid}` on first login with `membershipType: 'member'`.

### Wallet auth = custom-token flow — `src/services/walletAuth.js` + `functions/index.js`

1. `discoverEIP6963Wallets()` / `discoverSolanaWallets()` enumerate installed wallets
   (EIP-6963 events; Wallet Standard with legacy `window.solana` fallback).
2. `generateWalletNonce` callable validates the address format and writes a one-time nonce
   to `nonces/{address}` with a **5-minute expiry**.
3. The wallet signs `"Sign in to Da Nang Blockchain Hub\nNonce: <nonce>"`
   (`personal_sign` for EVM, `solana:signMessage` for Solana).
4. `verifyWalletSignature` callable **atomically consumes the nonce in a transaction**
   (replay protection), verifies via `ethers.verifyMessage` or `nacl.sign.detached.verify`,
   and mints a custom token with uid `eth_<lowercased addr>` / `sol_<addr>`.
5. Client calls `signInWithCustomToken`; `createUserProfile` persists `walletAddress`
   (with a race guard — `onAuthStateChanged` may create the doc first).

### Guards — `src/components/ProtectedRoute.jsx` via `App.jsx`

`requireAdmin` → `isAdmin()` (`userProfile.membershipType === 'admin'`).
`requireProfileComplete` → `isProfileComplete()` (displayName + email + company + jobTitle
all non-empty). These are UX guards only — the real enforcement is `firestore.rules` (§5).

---

## 2. Booking lifecycle

```
pending ──admin──▶ approved ──member/admin──▶ checked-in ──member/cron──▶ completed
   │ member (cancel)                                 ▲
   └────────▶ cancelled        autoCheckoutExpiredBookings (hourly) ─────┘
```

### Create — member `src/pages/member/Bookings.jsx`

1. `checkBookingConflicts(amenityId, start, end)` (`src/services/functions.js`) calls the
   callable of the same name. **Graceful degradation: if the function errors, the wrapper
   returns `{hasConflicts: false}`** — conflict checking is advisory, not enforced by rules.
2. `createBooking()` (`src/services/bookings.js`) writes the doc with `status: 'pending'`
   and `Timestamp`-converted times.
3. `sendBookingConfirmation` fires `onCreate` — currently **logs only** (email TODO),
   reading `members/{memberId}.preferences.emailNotifications`.

### Conflict semantics — `functions/index.js › checkBookingConflicts`

- `availableDays` (top-level amenity field, default Mon–Fri `[1..5]`) is enforced for
  **every** amenity type.
- Amenity hours (`startHour`/`endHour`, default 9–18) are enforced only for
  `AMENITY_TYPES_WITH_BUSINESS_HOURS` = desk, meeting-room, podcast-room.
- Overlap is checked against bookings with status `pending|approved|checked-in`.
- **Desks allow concurrency**: `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ["desk"]` —
  overlaps conflict only when `overlapCount >= capacity`. All other types are
  single-occupancy.
- `checkSlotAvailability` is the same check minus auth (public availability views), but
  uses the fixed `isWithinBusinessHours` (Mon–Fri 9–18) instead of per-amenity hours.

### Status transitions

- **Members** can only flip their own booking to `cancelled` — `firestore.rules` rejects
  any other status change by the owner. Delete is allowed only while `pending`.
- **Admins** approve/edit anything via `src/pages/admin/Bookings.jsx` → `updateBooking()`.
- **Notification routing** — `autoApproveDeskBooking` approves available ad-hoc desk bookings; every other pending booking notifies admins for review. `notifyBookingApproval` notifies the member when a booking becomes approved. Fixed-desk bookings use their shared `planGroupId` as the notification key, so one plan produces one review or approval message rather than a message per working day.
- **Check-in / check-out** (`checkIn`/`checkOut` in `src/services/bookings.js`) are
  client-side and same-calendar-day only.
- **`autoCheckoutExpiredBookings`** (hourly schedule) sweeps three cases into `completed`:
  checked-in past `endTime`+1h, any pending/approved past `endTime`, and checked-in
  bookings from a previous hub-timezone day (`getStartOfTodayHubTimezone`, UTC+7 math).
- **`cleanupOldBookings`** (daily) only *logs* completed bookings older than 30 days —
  it does not delete.

### Fixed desk plans — `src/services/bookings.js`

`createFixedDeskPlan({period: 'weekly'|'monthly'})` generates one **independent booking
doc per working day** (Mon–Fri, 9–18) via `createRecurringBooking`, linked by a shared
`planGroupId` (`crypto.randomUUID()`). Admin-created plans are born `approved`; member
plans `pending`. Conflicting days are silently skipped. `cancelFixedDeskPlan(planGroupId)`
cancels every pending/approved booking in the group.

---

## 3. Event review notifications

```
pending ──admin review──▶ approved / rejected
```

- **Create** — `createEvent()` (`src/services/events.js`) writes `status: 'pending'` and
  **denormalizes `organizerDisplayName`/`organizerPhotoURL`** from the members collection
  so list views don't fan out; `notifyEventPendingReview` writes an in-app notification for each admin; `updateEvent()` re-fetches them when `organizerId` changes.
- **Admin review** — event approval/rejection stays in the product, but this task only keeps the admin review notification on create. Organizer approval/rejection, cancellation, reminders, and waitlist notifications are out of scope here.
- **Event-space hours** are validated client-side by `validateEventSpaceTime()`
  (`src/services/amenities.js`): weekdays from 18:00, weekends from 9:00, all days end
  22:00 (`EVENT_SPACE_AVAILABILITY`).

---

## 4. Cloud Functions wiring — `functions/index.js`

All pinned to `REGION = "us-central1"` (a move to asia-southeast1 was rolled back over an
IAM gap — see the comment at the top of the file and in `src/services/firebase.js`; the
client's `getFunctions(app, 'us-central1')` **must stay in sync**).

| Function | Trigger | Effect |
|---|---|---|
| `checkBookingConflicts` | callable (auth required) | Day/hours + overlap check, desk capacity-aware |
| `checkSlotAvailability` | callable (public) | Same check for public availability views |
| `generateWalletNonce` | callable (public) | One-time nonce in `nonces/{address}`, 5-min TTL |
| `verifyWalletSignature` | callable (public) | Verify sig, consume nonce, mint custom token |
| `sendBookingConfirmation` | `bookings` onCreate | Log only (email TODO) |
| `autoApproveDeskBooking` | `bookings` onCreate | Auto-approve desk or notify admins for manual review |
| `notifyBookingApproval` | `bookings` onUpdate | Member in-app notification on approval, grouped by fixed-desk plan |
| `notifyEventPendingReview` | `events` onCreate | Admin in-app notification for new pending event |
| `autoCheckoutExpiredBookings` | schedule, hourly | Auto-complete expired/past-day bookings |
| `cleanupOldBookings` | schedule, daily | Log 30-day-old completed bookings (no delete) |

---

## 5. Security rules

### `firestore.rules`

| Collection | Read | Write |
|---|---|---|
| `members` | owner or admin | owner create/update (**cannot change `membershipType`**); admin anything |
| `amenities` | public | admin only |
| `bookings` | owner or admin | owner create; owner update **only to keep status or set `cancelled`**; owner delete only while `pending`; admin anything |
| `events` | public | organizer create/update/delete own; admin anything |
| `projects` | public | admin only |
| `notifications` | owner | owner may update **only the `read` field**; create/delete only via Admin SDK (Cloud Functions) |

`isAdmin()` does a `get()` on `members/{uid}` — every admin-gated rule costs an extra read.
Note what the rules do **not** enforce: booking overlap, amenity hours, event capacity —
those live in the callable / client and are advisory.

### `storage.rules`

- `amenities/{id}/**` — public read; admin write, image/*, ≤ 5 MB.
- `members/{uid}/avatar/*` — public read; owner write, image/*, ≤ 10 MB.
- `events/banners/*` — public read; any authenticated write, image/* **or
  `application/octet-stream`** (generated images may lack a content type), ≤ 5 MB; admin
  delete.
- Everything else denied.

---

## Key collections touched

| Collection | Written by | Read by |
|---|---|---|
| `members` | AuthContext auto-create (§1), Profile page, admin Members page | rules `isAdmin()`, everywhere |
| `amenities` | admin Amenities page (`src/services/amenities.js`) | booking pages, Home, callables |
| `bookings` | booking create/update (§2), schedulers (§2) | member/admin dashboards, conflict checks |
| `events` | event create/approve (§3), waitlist triggers | Home, Events pages, reminder cron |
| `notifications` | Cloud Functions only (§3) | `src/services/notifications.js` (unread, mark-read) |
| `nonces` | wallet callables (§1) — single-use | `verifyWalletSignature` |
| `projects` | admin (rules allow; no write service yet) | Home page showcase |

Field-level details are in [`README.md` § Firestore Collections](../../README.md#firestore-collections).
