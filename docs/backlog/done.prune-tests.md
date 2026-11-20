# Prune tests that guard no behavior
**Phase**: — · **Deps**: —

Issue: #211

## Goal
Some tests guard nothing: a data constant, copies of other tests, a flaky timing check, and tests of internal helpers exported only for them. Remove them so every test left fails on a regression and only on one.

## Files
- `test/hubClosures.test.js` (edited) — drop the test that restates the Independence Day closure's dates
- `test/emailHtml.test.js` (edited) — drop the injected-link test, a copy of the five-character escape test
- `test/timezone.test.js` (edited) — drop the formatter-reuse timing test
- `test/deskPlans.test.js` (edited) — drop the client line of "đ folds to d", covered by the parity test
- `test/firestore-booking-fields.rules.test.js` (edited) — drop "owners can still cancel a desk plan day", a copy of the booking-cancel test
- `test/firestore-booking-cancel.rules.test.js` (edited) — drop "members cannot create a partner-desk booking", covered by three other rules tests
- `test/localDevStore.test.js` (edited) — rewrite the filter and overlap tests against `listLocalBookings` and `checkLocalBookingConflicts`
- `src/services/localDevStore.js` (edited) — stop exporting `filterLocalBookings` and `overlappingLocalBookings`

## Acceptance
- [ ] No test file imports `filterLocalBookings` or `overlappingLocalBookings`
- [ ] The meeting-room conflict test fails if adjacent slots are treated as overlapping
- [ ] The booking-list test fails if the newest-first order is reversed
- [ ] NOT: any change to app behavior

## Verify
- `npm test` → all pass
- `npm run test:rules` → all pass
- `npm run lint && npm run build` → green
