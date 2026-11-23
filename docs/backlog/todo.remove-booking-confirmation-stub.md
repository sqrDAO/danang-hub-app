# Remove the sendBookingConfirmation stub trigger
**Phase**: — · **Deps**: — · **Issue**: #272

## Goal
`sendBookingConfirmation` fires on every booking create, reads the amenity and only logs,
so every booking (and every day of a desk plan) pays a function run and a Firestore read
for nothing members see. Members already get in-app and push notices on approval and
cancellation (`notifyBookingApproval`), so delete the stub rather than build an email.

## Files
- `functions/index.js` (edited) — remove the `sendBookingConfirmation` export
- `README.md` (edited) — remove its Cloud Functions table row
- `docs/knowledge/data-flow.md` (edited) — drop booking-create step 3 and its table row
- `.github/copilot-instructions.md` (edited) — drop its function-list line

## Acceptance
- [ ] `functions/index.js` exports no `sendBookingConfirmation`
- [ ] `README.md` has no `sendBookingConfirmation` row
- [ ] `docs/knowledge/data-flow.md` does not mention `sendBookingConfirmation`
- [ ] `.github/copilot-instructions.md` does not mention `sendBookingConfirmation`
- [ ] NOT: no booking confirmation email is added
- [ ] NOT: `autoApproveDeskBooking` and `notifyBookingApproval` are unchanged
- [ ] NOT: `--force` is not added to the CI functions deploy
- [ ] NOT: `done.*` specs that mention the function are not edited (historical record)

## Verify
- `grep -rn "sendBookingConfirmation" functions/index.js README.md docs/knowledge .github` → no output
- `cd functions && npm run lint` → exit 0
- `npm test` → all pass
- post-merge (owner): `firebase functions:list --project danang-hub-app` → no `sendBookingConfirmation`
- regression: create a desk booking in prod → `firebase functions:log --only autoApproveDeskBooking` shows it fired and the booking is approved

## Notes
- **Deploy order:** the merge workflow runs `firebase deploy --only functions --non-interactive`
  without `--force`; firebase-tools aborts that deploy when a live function is missing from
  the source, which also holds back Hosting. Before merging, the owner runs
  `firebase functions:delete sendBookingConfirmation --region us-central1 --project danang-hub-app`
  (safe: the function only logs).
