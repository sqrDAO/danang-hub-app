# Notify members when their booking is cancelled for them
**Phase**: — · **Deps**: hub-closure-dates

## Goal
Cancelling a booking notifies nobody: the only `bookings/{id}` update trigger is
`notifyBookingApproval`, which returns early unless the new status is `approved`.
Ten bookings were cancelled for the Aug–Sep 2026 Hub closure and four members
were never told. Notify a member when someone else cancels their booking.

## Files
- `functions/index.js` (edited) — extend the existing `notifyBookingApproval` trigger to also handle `→ cancelled`; add `notifyBookingCancelled` helper beside `notifyBookingApproved`.
- `src/components/NotificationBell.jsx` (edited) — `booking_cancelled` copy factory, fallback path, and `rejected` tone.
- `src/pages/admin/Bookings.jsx` (edited) — admin cancellation sets `cancelledReason: 'admin'`.
- `firestore.rules` (edited) — owners may not write `cancelledReason`, so its presence reliably means "cancelled by someone else".
- `src/locales/en.json`, `src/locales/vi.json` (edited) — cancellation title/body, plus a fixed-desk body variant.
- `functions/scripts/backfill-closure-cancellation-notices.cjs` (new) — one-off backfill for the 10 bookings already cancelled with `cancelledReason: 'hub-closure-independence-day-2026'`. Lives under `functions/` so `firebase-admin` resolves without a `NODE_PATH` override.
- `test/bookingCancellationNotice.test.js` (new) — pure-helper coverage for the notify/skip decision.

## Acceptance
- [ ] A booking going `approved → cancelled` with `cancelledReason` set creates one `booking_cancelled` notification for its `memberId`.
- [ ] A member cancelling their own booking (no `cancelledReason`) creates no notification.
- [ ] Cancelling three days of one fixed-desk plan creates exactly one notification, keyed on `planGroupId`.
- [ ] The notification body names the Hub closure when `cancelledReason` starts with `hub-closure`, and is generic otherwise.
- [ ] `NotificationBell` renders the new type with real copy, not `notifications.defaultTitle`.
- [ ] Tapping the notification lands on `/member/bookings`.
- [ ] A member push is sent for the cancellation, mirroring `booking_approved`.
- [ ] The backfill script is idempotent — re-running creates no duplicate notifications.
- [ ] Both `en.json` and `vi.json` carry every new key.
- [ ] A member cannot write `cancelledReason` to their own booking (rules test).
- [ ] NOT: no new Cloud Function is exported.
- [ ] NOT: `notifyBookingApproval` is not renamed.
- [ ] NOT: Event Hall bookings cancelled by `editOwnEvent` / `reviewEvent` do not notify — the organizer already acted.

## Verify
- `npm run lint` → passes with zero warnings.
- `cd functions && npm run lint` → passes.
- `npm run build` → succeeds.
- `npm test` → all pass, including the new test file.
- `firebase emulators:start` → flip an `approved` booking to `cancelled` with a `cancelledReason` in the Firestore emulator; one notification doc appears with id `booking_cancelled_<uid>_<subjectId>`.
- repeat the flip on two more days of the same `planGroupId` → still exactly one notification doc.
- flip a booking to `cancelled` with no `cancelledReason` → no notification doc.
- regression: approve a pending booking and confirm `booking_approved` still fires exactly once.

## Notes
- **Do not add a new exported function.** A first-of-kind deploy fails in CI —
  the SA cannot set the Cloud Run invoker policy, which is how `editOwnEvent`
  and `reviewEvent` shipped dead on 2026-08-14 and stayed unreachable until
  fixed by hand on 2026-08-19. Extending `notifyBookingApproval` keeps this an
  update-only deploy. Renaming it would also be a delete+create — hence the NOT.
- `createNotificationIfAbsent` builds its doc id as `${type}_${userId}_${subjectId}`
  and uses `.create()`, swallowing already-exists. `getBookingSubjectId` returns
  `planGroupId` when present, so per-plan collapsing and backfill idempotency
  both come free — do not hand-roll either.
- `cancelledReason` is the actor signal, but **today it is spoofable**: the
  owner update rule constrains only `status` and `planGroupId`, so a member can
  set any other field on their own booking. Hence the `firestore.rules` change —
  add `cancelledReason` to the owner's forbidden `affectedKeys` alongside
  `planGroupId`. Without it a crafted write makes a member notify themselves;
  low impact, but the signal should mean what it claims. The admin page must
  start setting the field or admin cancellations stay silent.
- Keep the extended trigger under the `src/**` clean-code caps by branching into
  two helpers rather than growing the existing handler.
