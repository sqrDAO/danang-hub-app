# Drop the dead emailNotifications preference and the booking-trigger PII log
**Phase**: — · **Deps**: —

Issue: https://github.com/sqrDAO/danang-hub-app/issues/205

## Goal
#199 removed the email-notifications switch, but new profiles still seed
`preferences.emailNotifications` and `sendBookingConfirmation` still reads it and calls
`getVerifiedEmail` (one Auth `getUser` per booking) only to log the email. Remove the dead
field and slim the log-only trigger so it makes no Auth call, no member read, and logs no PII.

## Files
- `src/contexts/AuthContext.jsx` (edited) — drop `emailNotifications` from the new-profile `preferences` seed
- `src/services/localDevFixtures.js` (edited) — drop `emailNotifications` from the three fixture members
- `src/utils/localDevMode.js` (edited) — drop `emailNotifications` from the local dev profile
- `functions/index.js` (edited) — `sendBookingConfirmation`: remove the member read, preference read and `getVerifiedEmail` call; log `bookingId`, `memberId`, amenity name, start/end only. `getVerifiedEmail`: failure log tag `[event-status-email]` → `[verified-email]`
- `docs/knowledge/data-flow.md` (edited) — booking step 3 no longer says the trigger reads `preferences.emailNotifications`

## Acceptance
- [ ] `grep -rn emailNotifications src functions/index.js docs/knowledge` prints nothing
- [ ] `sendBookingConfirmation` makes no Firebase Auth call
- [ ] `sendBookingConfirmation` does not read `members/{memberId}`
- [ ] `sendBookingConfirmation` logs no email address
- [ ] `sendBookingConfirmation` logs no phone number
- [ ] `sendBookingConfirmation`'s TODO still names `getVerifiedEmail` as the only allowed recipient source
- [ ] `getVerifiedEmail`'s failure log reads `[verified-email] recipient lookup failed:`
- [ ] NOT: `sendBookingConfirmation` is not deleted or renamed (it stays the email placeholder)
- [ ] NOT: no change to `eventReminders` or `pushNotifications` handling
- [ ] NOT: no backfill or migration of existing `members` docs
- [ ] NOT: the `[event-status-email] send failed` log in `notifyEventStatusChange` is unchanged

## Verify
- `grep -rn emailNotifications src functions/index.js docs/knowledge` → no output
- `cd functions && npm run lint` → exit 0
- `npm run lint && npm run build && npm test` → all pass
- `firebase emulators:start`, create a booking via `npm run dev` (`VITE_USE_EMULATORS=true`) → functions log shows one `Booking confirmation:` line with `bookingId`, `memberId`, amenity name, times, and no email or phone
- regression: new sign-in creates `members/{uid}` with `preferences.eventReminders: true`, `pushNotifications: false`, and no `emailNotifications`
- regression: approving/rejecting an event still emails the organizer (`notifyEventStatusChange` → `getVerifiedEmail`)

## Notes
Existing member docs keep a stale `preferences.emailNotifications`; nothing reads it, so it is
harmless. `firestore.rules` treats `preferences` as an opaque object, so no rules change.
