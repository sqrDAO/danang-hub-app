# Validate member profile fields on create
**Phase**: — · **Deps**: —

## Goal
The `members/{userId}` owner-create rule validates `partnerId` but not `membershipType`,
while the owner-update rule restricts both. Make create match: owners may only create a
profile with `membershipType` absent or `'member'`.

## Files
- `firestore.rules` (edited) — add the `membershipType` check to the owner `allow create`
  on `members/{userId}`; refresh the block comment (partner members are now booked by the
  hourly sync in `autoCheckoutExpiredBookings`, `functions/partnerDesks.js`).
- `test/firestore-member-partner.rules.test.js` (edited) — emulator tests for create
  validation and admin `membershipType` updates.

## Acceptance
- [ ] Owner create of `members/{uid}` with `membershipType: 'admin'` is denied.
- [ ] Owner create with `membershipType: 'member'` is allowed.
- [ ] Owner create without `membershipType` is allowed.
- [ ] Owner create with `partnerId` is still denied.
- [ ] Admins can still update another member's `membershipType`.
- [ ] The rules comment no longer references `autoApproveDeskBooking` for partner members.
- [ ] NOT: no change to `src/contexts/AuthContext.jsx` (`createUserProfile` already writes `membershipType: 'member'`).
- [ ] NOT: no change to owner-update, read, or delete rules.

## Verify
- `firebase emulators:exec --only firestore --project demo-danang "node --test test/firestore-member-partner.rules.test.js test/firestore-booking-cancel.rules.test.js test/firestore-booking-renewal.rules.test.js test/firestore-event-edit.rules.test.js"` → all pass
- `npm run lint && npm run build && npm test` → exit 0
- regression: first sign-in (Google, email, MetaMask, Phantom) through `npm run dev` still creates `members/{uid}` with `membershipType: 'member'`

## Notes
`createUserProfile` in `src/contexts/AuthContext.jsx` is the only client path that
creates `members/{uid}`; all four sign-in methods and `onAuthStateChanged` go through it.
`verifyWalletSignature` only mints a custom token and does not write `members`.
Production picks this up via the CI Firestore-rules deploy.
