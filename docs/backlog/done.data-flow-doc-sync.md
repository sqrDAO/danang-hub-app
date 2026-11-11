# Sync data-flow.md with Partner Desks, renewals and the hours limit
**Phase**: — · **Deps**: —

## Goal
Update `docs/knowledge/data-flow.md` so it describes the booking rules and Cloud Functions
added in October. `CLAUDE.md` points to this doc as the deep reference, and it is
currently stale.

## Files
- `docs/knowledge/data-flow.md` (edited) — add the missing flows and fix the rules table

## Acceptance
- [ ] The rules table row for `bookings` states that owners may update only `status` and `updatedAt`
- [ ] The rules table lists the `partners` collection (read: authenticated, write: admin)
- [ ] The rules table notes that a partner-reserved desk is bookable only by that partner's members
- [ ] The Cloud Functions table lists `removePartner`
- [ ] The Cloud Functions table lists `getAmenityBookingRanges`
- [ ] The booking lifecycle section covers the 40-hour monthly desk limit
- [ ] The booking lifecycle section covers Fixed Desk renewals and the hourly Partner Desk sync
- [ ] The Cloud Functions table row for `autoCheckoutExpiredBookings` mentions the Partner Desk sync, renewal expiry and ending reminders
- [ ] The conflict semantics say a pending renewal day holds no seat
- [ ] The rules table `members` row notes owners cannot set or change `partnerId`
- [ ] The Key collections table lists `partners`
- [ ] NOT: any change outside `docs/knowledge/data-flow.md`

## Verify
- `grep -c -i "partner" docs/knowledge/data-flow.md` → a number greater than 0
- `grep -c "removePartner" docs/knowledge/data-flow.md` → a number greater than 0
- `grep -c "getAmenityBookingRanges" docs/knowledge/data-flow.md` → a number greater than 0
- `grep -c "monthly-hours-limit" docs/knowledge/data-flow.md` → a number greater than 0
- regression: compare the new text against `firestore.rules` and the README Cloud Functions table
- `npm run lint && npm run build` → both green (docs-only, so unchanged)

## Notes
The first four extra bullets cover sentences the new text would otherwise contradict. Facts come
from `firestore.rules`, `functions/{monthlyHours,renewals,partnerDesks}.js` and `functions/index.js`,
not from the review summary, which predates a partial fix to the `bookings` row.
