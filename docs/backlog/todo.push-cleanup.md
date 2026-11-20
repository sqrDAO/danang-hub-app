# Per-device push cleanup

## Goal
Resolve [#182](https://github.com/sqrDAO/danang-hub-app/issues/182) while preserving per-phone opt-out and automatic registration after login.

## Files
- `src/services/pushNotifications.js` — remove shared browser token revocation and duplicate listener starts.
- `src/utils/pushDeviceOptIn.js` — storage subscription and consolidated device ID lookup.
- `src/contexts/AuthContext.jsx` — own listener lifecycle via reactive device opt-in.
- `functions/index.js` — skip legacy reads after confirming legacy absence.
- `test/pushDeviceOptIn.test.js` — marker event and ID regression checks.
- `README.md` — token lifecycle and migration marker.

## Acceptance
- [ ] Logout/off delete account token documents without revoking another account's shared browser token.
- [ ] Existing markers preserve opt-in intent on next login.
- [ ] Cross-tab marker changes update subscribers and listener lifecycle.
- [ ] Device ID reads can avoid creating a new ID.
- [ ] A member with a confirmed absent legacy token skips subsequent legacy reads.

## Verify
- App lint, Functions lint, build and unit tests pass.
- Exercise marker subscription cleanup and storage changes in unit tests.
- Verify server migration behavior with existing and absent legacy docs.

## Results
- Unit tests pass with 296 passed and 8 emulator-dependent skips.
- Legacy-read matrix verified using the sender function with controlled database responses, covering migrated/unmigrated members and present/absent legacy tokens.
- AuthContext exclusively starts the listener, reacting to same-tab and storage marker events; stale effect imports are cancelled before starting.
- Browser subscriptions remain available after logout; account-specific token document deletion controls delivery. Markers retain login intent and no longer gate shared token revocation.
- Real phone push delivery and account-switching verification remain pending.
