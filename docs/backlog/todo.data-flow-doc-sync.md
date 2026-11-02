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
- [ ] NOT: any change outside `docs/knowledge/data-flow.md`

## Verify
- `grep -c -i "partner" docs/knowledge/data-flow.md` → a number greater than 0
- `grep -c "removePartner" docs/knowledge/data-flow.md` → a number greater than 0
- `grep -c "getAmenityBookingRanges" docs/knowledge/data-flow.md` → a number greater than 0
- regression: compare the new text against `firestore.rules` and the README Cloud Functions table
