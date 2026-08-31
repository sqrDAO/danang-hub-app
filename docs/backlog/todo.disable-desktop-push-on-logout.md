# Disable push on logout regardless of device eligibility
**Phase**: — · **Deps**: —

## Goal
`disablePushNotificationsOnLogout` skips cleanup entirely on non-mobile devices, so a
member who opted into browser push before PR #54 restricted push to mobile keeps a live
FCM subscription on that desktop browser after logging out — a real leak on shared/kiosk
machines in the Hub. Logout cleanup must run regardless of current mobile-push eligibility.

## Files
- `src/services/pushNotifications.js` (edited) — `disablePushNotificationsOnLogout`
  (currently lines 347-351): drop the `isMobilePushEligible()` early return; always attempt
  `disablePushNotifications(uid)` on logout so any existing token for this browser is
  deleted, whether or not the browser is currently eligible to register a new one.

## Acceptance
- [ ] A member who has a push token registered (regardless of current device type) has that token deleted from `push_tokens/{uid}` on logout.
- [ ] `disablePushNotifications` itself already handles "no token exists" gracefully (confirm this stays true) so logging out on a device with no token is a no-op, not an error.
- [ ] The mobile-only *registration* gate (`isMobilePushEligible` at `src/services/pushNotifications.js:46`, governing whether a new token gets requested) is unchanged — this spec only removes the gate on *cleanup*.
- [ ] NOT: does not change the account-level `preferences.pushNotifications` toggle (already correctly untouched by cleanup per PR #77).

## Verify
- `npm run lint && npm run build` → green.
- `npm test` → green.
- `firebase emulators:start`: simulate a desktop-registered token (write a `push_tokens/{uid}` doc directly in the emulator UI to stand in for a pre-#54 opt-in), log out through the app, confirm the token doc is deleted.
- regression: log out on an actual mobile-eligible device path (or with `isMobilePushEligible` mocked true) still deletes its token as before.

## Notes
This closes the gap for *existing* stale desktop tokens going forward (every future
logout cleans up whatever token exists). It does not retroactively sweep tokens already
orphaned by a logout that happened before this fix ships — those age out naturally via
the existing stale-token cleanup path, or a one-off cleanup script could be run
separately if that's judged worth doing.
