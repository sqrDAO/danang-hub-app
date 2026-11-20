# Push logout and Off lifecycle follow-ups
**Phase**: — · **Deps**: —

## Goal
Resolve [#229](https://github.com/sqrDAO/danang-hub-app/issues/229): keep Off truthful after cleanup failures and prevent late registrations from surviving logout or revoking the next account's subscription. Show localized failure messages.

## Files
- `src/services/pushNotifications.js` (edited) — wire guarded registration and remove other-account branch.
- `src/services/pushTokenLifecycle.js` (edited) — bounded cleanup and structured errors.
- `src/services/pushRegistrationLifecycle.js` (new) — serialized registration, uid/generation guards and stale cleanup.
- `src/utils/pushErrors.js` (new) — localized push error presentation.
- `src/utils/profilePushSync.js` (new) — preserve unrelated edits after successful revocation.
- `test/profilePushSync.test.js` (new) — save continuation and permission state on failure.
- `src/locales/en.json` (edited) — cleanup warning.
- `src/locales/vi.json` (edited) — translated cleanup warning.
- `src/pages/member/Profile.jsx` (edited) — map push errors to translated fallback.
- `src/components/PushOptInBanner.jsx` (edited) — translated registration failures.
- `test/pushTokenLifecycle.test.js` (edited) — truthful Off outcomes and revoke failures.
- `test/pushRegistrationLifecycle.test.js` (new) — deferred getToken/save/account-switch integration.
- `test/pushErrors.test.js` (new) — EN/VI fallbacks.
- `README.md` (edited) — single-user browser lifecycle.
- `docs/knowledge/data-flow.md` (edited) — registration ordering and Off semantics.

## Acceptance
- [ ] Successful revocation leaves Off when document cleanup fails.
- [ ] Successful revocation leaves Off when document cleanup times out.
- [ ] Permission prompts have no registration deadline.
- [ ] Logout during a permission prompt prevents later registration.
- [ ] Denying permission refreshes Profile help text.
- [ ] A revoked subscription with failed document cleanup warns without discarding profile edits.
- [ ] A failed revoke can restore On only for the same current operation/account.
- [ ] Logout/Off invalidates registrations before asynchronous work.
- [ ] A stale registration cannot begin a device write or set its opt-in marker.
- [ ] A late write's subscription is revoked before the next registration starts.
- [ ] Stale A cleanup cannot revoke a subscription subsequently issued to B.
- [ ] Logout cleanup returns within five seconds if SDK registration or deletes hang.
- [ ] Timed-out registrations cannot silently finish enabling push later.
- [ ] Push failures use existing EN/VI translations rather than raw English errors.
- [ ] NOT: change another phone's device documents or account-wide opt-out preferences.

## Verify
- `npm run lint` → zero warnings/errors.
- `npm --prefix functions run lint` → zero errors.
- `npm test` → all unit tests pass (rules tests skip without emulator).
- `npm run build` → production build succeeds.
- `node --test test/pushRegistrationLifecycle.test.js test/profilePushSync.test.js test/pushErrors.test.js` → permission delay, logout races, cleanup warnings and both locales pass.
- Real phone: Android Chrome and iOS home-screen app, failed device deletion during logout followed by account B; verify no A pushes and second-phone delivery remains intact.

## Notes
Firebase getToken and writes cannot be cancelled. After permission, the caller has a 30-second deadline including queue wait, but the underlying registration retains queue ownership until it settles and stale cleanup completes. A new registration fails on its own deadline instead of bypassing an unfinished operation. A hung SDK keeps later registration blocked until it settles or the page reloads. Generation ordering is per tab; simultaneous tabs can still race. Real push-service invalidation/offline unsubscribe requires device verification.
