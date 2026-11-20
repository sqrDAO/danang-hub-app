# Per-device push cleanup
**Phase**: — · **Deps**: —

## Goal
Resolve [#182](https://github.com/sqrDAO/danang-hub-app/issues/182), preserving per-phone opt-out and revocation on logout. Address the [#220 review](https://github.com/sqrDAO/danang-hub-app/pull/220#issuecomment-7037812103).

## Files
- `src/services/pushNotifications.js` (edited) — revocation and listener lifecycle.
- `src/services/pushForegroundListener.js` (new) — generation-aware listener ownership.
- `src/services/pushTokenLifecycle.js` (new) — testable cleanup orchestration.
- `src/utils/pushDeviceOptIn.js` (edited) — storage subscription and device ID lookup.
- `src/contexts/AuthContext.jsx` (edited) — own listener lifecycle.
- `functions/index.js` (edited) — use extracted token reader.
- `functions/pushTokens.js` (edited) — best-effort legacy migration.
- `firestore.rules` (edited) — legacy token documents are delete-only.
- `test/pushDeviceOptIn.test.js` (edited) — marker events and ID checks.
- `test/pushForegroundListener.test.js` (new) — stale and current listener generations.
- `test/pushTokenLifecycle.test.js` (new) — cleanup failure and account-switch tests.
- `test/pushTokens.test.js` (edited) — legacy migration failure regression.
- `test/firestore-push-tokens.rules.test.js` (edited) — deny legacy writes.
- `README.md` (edited) — token lifecycle and migration marker.
- `docs/knowledge/data-flow.md` (edited) — logout and migration flow.

## Acceptance
- [ ] Off/logout removes this phone's token documents.
- [ ] Off/logout revokes its subscription when no other signed-in account needs it.
- [ ] Failed document cleanup still revokes the subscription.
- [ ] Offline document cleanup times out after five seconds so logout can finish.
- [ ] Logged-out accounts' markers never suppress revocation.
- [ ] A signed-in account awaiting legacy adoption is recognized as opted in.
- [ ] Revocation never calls getToken or creates a subscription.
- [ ] Registration waits for outstanding revocation.
- [ ] Existing markers preserve next-login intent.
- [ ] Cross-tab marker changes update listener lifecycle.
- [ ] A stopped in-flight listener cannot suppress a new generation.
- [ ] Migration bookkeeping failures cannot fail token delivery.
- [ ] Clients cannot recreate legacy token documents after migration.
- [ ] NOT: change account-wide preferences on Off/logout.

## Verify
- `npm run lint` → zero warnings/errors.
- `npm run build` → production build succeeds.
- `npm test` → all unit tests pass (emulator tests skip).
- `cd functions && npm run lint` → zero errors.
- `npm run test:rules` → all rules tests pass.
- Real phone: force device deletion failure at logout, then sign in as another account; the old account must receive no notifications there.
- Real phone: Off/On leaves a second phone enabled; re-login has no background-update shell; repeat on iOS home-screen app.

## Notes
Native PushSubscription.unsubscribe revokes the browser endpoint without minting an FCM token. Firebase compares the next subscription's endpoint and keys with its cached token and replaces a stale token. Real-phone delivery checks remain required; deterministic tests cover cleanup ordering and failures.
