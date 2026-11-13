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
 │ src/services/* ──────────────┼─────▶│  partners / nonces                 │
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
Every route → `isEmailVerificationPending()` first: a profile created with
`emailVerificationRequired: true` (new email/password sign-ups) is sent to the verify screen until
its Auth email is verified; older profiles lack the flag, so verifying stays optional for them.
`requireProfileComplete` → `isProfileComplete()` (displayName + company + jobTitle non-empty;
email isn't required). These are UX guards only — the real
enforcement is `firestore.rules` (§5). `members.email` mirrors the Auth email: AuthContext syncs
it on load (not awaited, so a dropped connection can't hold sign-in). The rules let an owner with
an Auth email set only that, or leave a legacy value unchanged, so an account that never loads its
profile can keep an old typed address. Wallet accounts have no Auth email and type their own.
System mail never reads this field (only `getVerifiedEmail`).

---

## 2. Booking lifecycle

```
pending ──admin──▶ approved ──member/admin──▶ checked-in ──member/cron──▶ completed
   │ member (cancel)                                 ▲
   └────────▶ cancelled        autoCheckoutExpiredBookings (hourly) ─────┘
```

### Create — member `src/pages/member/Bookings.jsx`

1. `checkBookingConflicts(amenityId, start, end)` (`src/services/functions.js`) calls the
   callable of the same name. **It fails closed: a transient error is retried once, then
   the wrapper throws and the page refuses to book** — the check is advisory, not enforced
   by rules. A slot the amenity refuses is `invalid-argument` with
   `details.reason: 'slot-unavailable'`; series skip only that day (`src/utils/conflictCheck.js`).
2. `createBooking()` (`src/services/bookings.js`) writes the doc with `status: 'pending'`
   and `Timestamp`-converted times.
3. `sendBookingConfirmation` fires `onCreate` — currently **logs only** (email TODO),
   reading `members/{memberId}.preferences.emailNotifications`.

### Conflict semantics — `functions/index.js › checkBookingConflicts`

- `availableDays` (top-level amenity field, default Mon–Fri `[1..5]`) is enforced for
  **every** amenity type.
- Amenity hours (`startHour`/`endHour`, default 9–18) are enforced only for
  `AMENITY_TYPES_WITH_BUSINESS_HOURS` = desk, meeting-room, podcast-room.
- Overlap is checked against bookings with status `pending|approved|checked-in`, except a
  **pending renewal day**, which holds no seat (`holdsSeat` in `functions/renewals.js`; see
  Fixed Desk renewals below).
- **Desks allow concurrency**: `AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ["desk"]` —
  overlaps conflict only when `overlapCount >= capacity`. All other types are
  single-occupancy.
- `checkSlotAvailability` is the same check minus auth (public availability views), but
  uses the fixed `isWithinBusinessHours` (Mon–Fri 9–18) instead of per-amenity hours.

### Monthly desk-hours limit — `functions/monthlyHours.js`

Ordinary desk bookings count toward **40 hours per hub calendar month**
(`MONTHLY_DESK_HOURS`). Counted: `pending|approved|checked-in|completed` bookings on a desk
that are not part of a desk plan — Fixed Desk and Partner Desk days are separate products and
sit outside the limit. Admin members are exempt. The logic is mirrored for the booking page
in `src/utils/monthlyHours.js`; the two must be edited together.

Two layers, because rules cannot add up hours and members write bookings straight to
Firestore: the booking page checks first (it shows hours used and blocks over-limit
bookings), and the server enforces. On a new pending desk booking, `autoApproveDeskBooking`
calls `enforceMonthlyHours`; a booking that would pass 40 h is cancelled with
`cancelledReason: 'monthly-hours-limit'` plus `limitHoursLeft`/`limitMonth`, the fields that
drive the member's notice. A booking created already `approved` never reaches the check. It
**fails open**: a read error leaves the booking to normal auto-approval or admin review
rather than stranded.

### Status transitions

- **Members** can only flip their own booking to `cancelled`, and only from `pending` — or
  from `approved` on a Fixed/Partner Desk day. An approved ordinary booking counts toward the
  monthly limit, so its owner can't cancel it (#150). `firestore.rules` rejects every other
  change by the owner: only `status` and `updatedAt` may be written (§5). Delete is allowed
  only while `pending`.
- **Admins** approve/edit anything via `src/pages/admin/Bookings.jsx` → `updateBooking()`.
- **Notification routing** — `autoApproveDeskBooking` approves available ad-hoc desk bookings; every other pending booking notifies admins for review. `notifyBookingApproval` notifies the member when a booking becomes approved, and when someone else cancels it (see below). Fixed-desk bookings use their shared `planGroupId` as the notification key, so one plan produces one review or approval message rather than a message per working day. Events: `notifyEventPendingReview` notifies admins; `notifyEventStatusChange` notifies the organizer (in-app + optional email). For opted-in users, browser push follows the same five high-signal paths (`booking_pending_review`, `booking_approved`, `booking_cancelled`, `event_pending_review`, `event_status`) via every phone's `push_tokens/{uid}/devices/{deviceId}` doc (on/off is per phone; logout removes only that phone), plus the legacy `push_tokens/{uid}` doc until a phone writes its device doc, turns off or logs out, which deletes it. Only members with `preferences.pushNotifications` on are read at all; turning a phone on sets it and the app never writes it false, so false is an opt-out from before per-phone tokens (launch turns such a phone off). A token stored in both is sent once. Dedupe markers stay per member: successful sends write `push_notifications` markers with `expiresAt`, kept when any phone succeeded and released only when all failed; `cleanupPushNotificationMarkers` deletes expired markers daily, and unrecoverable FCM token errors remove every doc holding that token.
- **Cancellation notifies only when `cancelledReason` is set.** `notifyBookingApproval`
  handles both the `approved` and `cancelled` transitions — it is one trigger, not
  two, because a new export cannot be deployed by CI (see the Cloud Functions
  notes). `cancelledReason` is the actor signal: `firestore.rules` forbids owners
  from writing it, so its presence means an admin or a script cancelled *for* the
  member, and a member cancelling their own booking is correctly silent. The
  admin page stamps `hub-closure-<id>` when the booking falls in a closure and
  `admin` otherwise. The notification is an upsert rather than create-if-absent, so a
  fixed-desk plan cancelled in two batches notifies twice while one batch still
  collapses to a single message.
- **Check-in / check-out** (`checkIn`/`checkOut` in `src/services/bookings.js`) are
  client-side and same-calendar-day only.
- **`autoCheckoutExpiredBookings`** (hourly schedule) sweeps three cases into `completed`:
  checked-in past `endTime`+1h, any pending/approved past `endTime`, and checked-in
  bookings from a previous hub-timezone day (`getStartOfTodayHubTimezone`, UTC+7 math).
  A pending renewal day that gets this far is cancelled `renewal-expired` instead of
  completed, since nobody approved it. The same run then syncs Partner Desk days and sends
  Fixed Desk ending reminders (below); they ride on this schedule because a new scheduled
  function is a first-of-kind deploy CI cannot do.

### Fixed desk plans — `src/services/bookings.js`

`createFixedDeskPlan({period: 'weekly'|'monthly'})` generates one **independent booking
doc per working day** (Mon–Fri, 9–18) via `createRecurringBooking`, linked by a shared
`planGroupId` (`crypto.randomUUID()`). Admin-created plans are born `approved`; member
plans `pending`. Conflicting days are silently skipped. `cancelFixedDeskPlan(planGroupId)`
cancels every pending/approved booking in the group.

### Fixed Desk renewals — `src/utils/renewals.js`, `functions/renewals.js`

A renewal is a **new** fixed-desk plan whose days carry `renewalOf: <old planGroupId>`.
`canRenewPlan` offers it from 7 days before the plan's last day until 7 days after
(`RENEW_WINDOW_DAYS`) while no live renewal exists; `renewFixedDeskPlan` starts it on the
first working day after the plan (or after today, if the plan has lapsed).

- **Pending renewal days hold no seat** (`isPendingRenewal` / `holdsSeat`). The conflict
  check, `getAmenityBookingRanges` and the Partner Desk sync all ignore them, so other
  members may book over them. Days already full at creation are skipped.
- **Admins resolve a renewal as one plan** in `RenewalsPanel`. `approveFixedDeskRenewal`
  re-checks each day with `checkBookingConflicts` and approves the free ones. A day taken or
  closed in the meantime is cancelled `renewal-day-unavailable` (silently — the approval is
  the member's one message), or `renewal-unavailable` when no day is left, which notifies
  once. `rejectFixedDeskRenewal` cancels every pending day `renewal-rejected`, with an
  optional `rejectionReason`.
- **Unapproved days expire.** The hourly sweep cancels a renewal day whose time has passed
  `renewal-expired` rather than completing it.
- **Ending reminder.** The same run sends one `fixed_desk_ending` notice (in-app + push)
  3 days before an approved plan's last day, unless it has been renewed.
- **Rules.** `renewalOf` may be set at create only on a `fixed-desk` day that has a
  `planGroupId`, and owners can't edit it afterwards (§5).

### Partner Desks — `functions/partnerDesks.js`, `src/services/partners.js`

A partner organization (e.g. 9AM Games, DiiD) is a `partners/{id}` doc (`name`,
`deskAmenityId`), managed by admins in `PartnersPanel`. Admins attach members through
`members.partnerId`; owners cannot set or change it (§5), so a member can't give themselves a
desk. Picking the partner's desk also sets `amenities.reservedForPartnerId`, which makes
`firestore.rules` refuse other members' bookings on it (`amenityOpenToCaller`, §5).

- **Hourly sync.** `syncPartnerDesks` runs inside `autoCheckoutExpiredBookings`. For every
  attached member it books the partner's desk for each open working day 28 days ahead
  (`PARTNER_DESK_DAYS_AHEAD`; 09:00–18:00 hub time, Hub closures skipped), written
  `approved` with no approval notice. A day is skipped when the member already holds a desk
  that day or the desk is full.
- **Server-owned documents.** Days use ids `pd_<uid>_<amenityId>_<YYYYMMDD>`,
  `planType: 'partner-desk'` and `planGroupId: 'partner_<uid>'`. Rules refuse a member
  creating any of those, so only the sync writes them.
- **Skipping a day.** A member may cancel an approved `partner-desk` day (§5). The sync
  leaves it cancelled: it only brings back days it cancelled itself (`partner-removed`,
  `partner-desk-moved`).
- **Detach or desk change.** When a member loses their partner, or the partner's desk is
  cleared, their unstarted days are cancelled `partner-removed` and the member is told. When
  the partner's desk changes, days on the old desk are cancelled `partner-desk-moved` and
  rebooked on the new one, without a notice.
- **`removePartner`** (admin callable). One transaction detaches the partner's members,
  releases its reserved desks and deletes the partner. Only then does it cancel the detached
  members' unstarted days (`partner-removed`): while a member was still attached, the sync
  would bring a cancelled day straight back. If cancelling fails the partner is gone anyway
  and the call returns `{daysPending: true}`; the next hourly run finishes the job.

---

## 3. Event lifecycle and notifications

```
pending ──admin reviewEvent(approve)──▶ approved      attendees[] ⇄ waitlist[]
   │                                      │                ▲
   └──admin reviewEvent(reject)──▶ rejected │    autoPromoteWaitlist (trigger)
            ▲                               │
            └──── organizer edits a future approved/rejected event ────┘
                      (new revision: pending)
```

- **Create** — `createEvent()` (`src/services/events.js`) writes `status: 'pending'` and
  **denormalizes `organizerDisplayName`/`organizerPhotoURL`** from the members collection
  so list views don't fan out; `notifyEventPendingReview` writes an in-app notification
  for each admin; `updateEvent()` re-fetches organizer details when `organizerId`
  changes.
- **Edit / resubmit** — organizers edit only their own future events through the
  authenticated `editOwnEvent` callable. The server accepts an allowlisted content payload
  and matching `expectedRevision`; each successful edit increments `revision`. A pending
  request stays pending without another review alert. An approved or rejected event becomes
  pending, retains registrations, and is re-notified to admins as a revision.
  `requestedAmenityId` is the venue; legacy `linkedAmenity*` fields are ignored. `everApproved` keeps
  previously live pending revisions from being deleted.
- **Approve / reject** — admin (`src/pages/admin/Events.jsx`) calls the admin-only
  `reviewEvent` callable with the expected revision. Review changes status only: events
  don't book the Event Hall (ops agrees each event with its organizer), so there is no
  availability check or booking. Hall hours and closures are checked in the form. The
  status flip fires
  **`notifyEventStatusChange`** (`functions/index.js`), which (1) writes a
  `notifications` doc for the organizer and (2) sends a styled HTML email via
  **nodemailer** (SMTP from `EMAIL_*` env, `EMAIL_PASS` from Secret Manager), always sent
  but only to the organizer's verified Auth email (`getVerifiedEmail`); no preference
  turns it off.
- **Register / waitlist** — `registerForEvent`/`unregisterFromEvent` use
  `arrayUnion`/`arrayRemove` on `attendees`; `addToWaitlist`/`removeFromWaitlist` likewise.
  These are bare client writes with no callable fallback, so `firestore.rules` carries a
  dedicated update path: any signed-in member may write an **approved** event whose diff
  touches **only** `attendees`/`waitlist`. Field scoping is all rules can do — there is no
  array-diff primitive, so a member can still write *another* member's uid into those
  arrays. Capacity is enforced client-side before registering, not by rules.
- **`autoPromoteWaitlist`** (onUpdate trigger) — when `attendees` shrinks below `capacity`
  and the waitlist is non-empty, promotes FIFO up to the free spots. Manual equivalent:
  `promoteFromWaitlist()` in the service.
- **`sendEventReminders`** (hourly) — finds **approved** events 24–25h out (status is
  filtered in memory; the range query would otherwise need a composite index CI cannot
  deploy), then notifies **every** member except those with
  `preferences.eventReminders === false`. Members are split into attendee / waitlisted /
  other and each segment gets its own copy, so non-attendees are invited to register or
  waitlist rather than "reminded" about something they never joined. In-app via
  `createNotificationIfAbsent` plus browser push via `sendPushToMembers`; both key their
  dedupe on `event_reminder` + uid + eventId, so reruns deliver nothing twice.
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
| `getAmenityBookingRanges` | callable (auth required) | Busy `startTime`/`endTime`/`status` ranges for an amenity over a window of at most 60 days, with no member identity. The booking calendar's only source for other members' bookings (§5) |
| `editOwnEvent` | callable (organizer) | Validate a future-event revision; resubmit approved/rejected content |
| `reviewEvent` | callable (admin) | Revision-aware approve/reject; status only |
| `removePartner` | callable (admin) | Detach the partner's members, release its desk and delete it in one transaction, then cancel their unstarted Partner Desk days (`partner-removed`); `{daysPending: true}` if that last step fails |
| `generateWalletNonce` | callable (public) | One-time nonce in `nonces/{address}`, 5-min TTL |
| `verifyWalletSignature` | callable (public) | Verify sig, consume nonce, mint custom token |
| `sendBookingConfirmation` | `bookings` onCreate | Log only (email TODO) |
| `autoApproveDeskBooking` | `bookings` onCreate | Cancel a desk booking that passes the 40-hour monthly limit (`monthly-hours-limit`); otherwise auto-approve desk or notify admins for manual review; browser push follows for opted-in admins |
| `notifyBookingApproval` | `bookings` onUpdate | Member in-app notification on approval, and on cancellation when `cancelledReason` is set; grouped by fixed-desk plan; browser push follows for opted-in members |
| `notifyEventPendingReview` | `events` onCreate | Admin in-app notification for new pending event; browser push for opted-in admins |
| `notifyEventResubmission` | `events` onUpdate | Admin review notification for a pending revision from approved/rejected |
| `notifyEventStatusChange` | `events` onUpdate | Organizer in-app notification + optional email + browser push on approve/reject |
| `notifyEventRevisionParticipants` | `events` onUpdate | In-app update for retained participants when a previously approved event's revision state changes |
| `autoPromoteWaitlist` | `events` onUpdate | FIFO waitlist → attendees when spots open |
| `autoCheckoutExpiredBookings` | schedule, hourly | Auto-complete expired/past-day bookings (unapproved renewal days are cancelled `renewal-expired` instead); then sync Partner Desk days 28 days ahead and send Fixed Desk ending reminders |
| `cleanupPushNotificationMarkers` | schedule, daily | Delete expired browser push dedupe markers |
| `sendEventReminders` | schedule, hourly | All-member reminder for approved events ~24h out (in-app + push, segmented copy) |

---

## 5. Security rules

### `firestore.rules`

| Collection | Read | Write |
|---|---|---|
| `members` | owner or admin | owner create/update (**cannot set or change `membershipType` or `partnerId`**); admin anything |
| `partners` | any signed-in user | admin only |
| `amenities` | public | admin only (`reservedForPartnerId` marks a partner's desk; see `bookings`) |
| `bookings` | owner or admin | owner create (status `pending`; **a desk reserved for a partner takes bookings only from that partner's members**; none of the admin/server-written fields, `pd_*` ids, `partner-desk` plans or `partner_*` plan groups; `renewalOf` only on a `fixed-desk` day with a `planGroupId`); owner update **only `status` and `updatedAt`**, with `status` either unchanged or `cancelled` from `pending` (or from `approved` on a `fixed-desk`/`partner-desk` day); owner delete only while `pending`; admin anything |
| `events` | public | organizer create own (**must be `pending`**); organizer content updates only through `editOwnEvent`; any member may update **only `attendees`/`waitlist`** while the stored and result status are `approved`; organizer delete only a never-approved pending event; admin anything |
| `projects` | public | admin only |
| `notifications` | owner | owner may update **only the `read` field**; create/delete only via Admin SDK (Cloud Functions) |

`isAdmin()` does a `get()` on `members/{uid}` — every admin-gated rule costs an extra read.
Members can read only their own bookings. Rules are evaluated against the query rather than
its results, so an amenity-wide list can never be allowed, and the booking calendar gets other
members' busy slots from the `getAmenityBookingRanges` callable instead (§4).
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
| `partners` | admin `PartnersPanel` (`src/services/partners.js`), `removePartner` (§2) | signed-in users (rules), hourly Partner Desk sync (§2) |
| `bookings` | booking create/update (§2), schedulers (§2) | member/admin dashboards, conflict checks |
| `events` | event create/edit/review (§3), waitlist triggers | Home, Events pages, reminder cron |
| `notifications` | Cloud Functions only (§3) | `src/services/notifications.js` (unread, mark-read) |
| `push_tokens` (+ `devices/{deviceId}`) | Profile page / opt-in banner, per phone (§6) | Cloud Functions only |
| `push_notifications` | Cloud Functions only (§6) | push dedupe markers for booking/event review and status |
| `nonces` | wallet callables (§1) — single-use | `verifyWalletSignature` |
| `projects` | admin (rules allow; no write service yet) | none yet (`src/services/projects.js` kept for planned project linking) |

Field-level details are in [`README.md` § Firestore Collections](../../README.md#firestore-collections).
