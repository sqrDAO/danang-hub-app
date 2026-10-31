# Remove partner via a server callable
**Phase**: — · **Deps**: partner-remove-hardening

## Goal
Move partner removal from the browser to a `removePartner` callable that reuses the hourly sync's rules. This leaves one copy of "which days to cancel and why", and the job finishes even if the admin's tab closes.

## Files
- `functions/index.js` (edited) — `removePartner` callable
- `functions/partnerDesks.js` (edited) — export `bookingsToCancel`
- `src/services/functions.js` (edited) — `removePartner` wrapper
- `src/services/partners.js` (edited) — `deletePartner` calls the callable; client cancel helpers removed

## Acceptance
- [ ] A non-admin caller gets `permission-denied` and nothing changes
- [ ] The partner is deleted, its desk released and its members detached in one transaction
- [ ] Members are detached before any of their days are cancelled
- [ ] Only days the sync owns (`isSyncedPartnerDay`) that have not started are cancelled, with reason `partner-removed`
- [ ] A day changed after it was read is not written (`lastUpdateTime` precondition)
- [ ] If cancelling days fails, the callable returns `{ daysPending: true }` instead of an error
- [ ] `src/services/partners.js` no longer defines `isUpcomingSyncedDay` or `PARTNER_REMOVED_REASON`
- [ ] NOT: no change to the hourly sync, `firestore.rules` or `PartnersPanel.jsx`
- [ ] NOT: `deleteLocalPartner` keeps its own copy (local dev never calls functions)

## Verify
- `npm run lint && npm run build && npm test` → green
- `cd functions && npm run lint` → green
- `firebase emulators:start`, remove a partner with one attached member and a synced future day → member's `partnerId` is null, day is `cancelled` with `partner-removed`
- regression: `test/partnerDesks.test.js`

## Notes
First-of-kind function: the CI service account can't deploy it, so the owner runs `firebase deploy --only functions:removePartner` before the client change ships. Closes https://github.com/sqrDAO/danang-hub-app/issues/128.
