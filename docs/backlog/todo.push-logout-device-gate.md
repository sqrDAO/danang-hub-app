# Skip push cleanup on logout from a device that never opted in
**Phase**: — · **Deps**: —

## Goal
Logout runs push cleanup whenever the account preference is on, which deletes
`push_tokens/{uid}` and sets `preferences.pushNotifications = false`, even on a phone
that never enabled push, so push stops on the member's real phone (issue #141).
Run the cleanup only on a device that opted in.

## Files
- `src/services/pushNotifications.js` (edited) — `disablePushNotificationsOnLogout`
  returns early unless `isDeviceOptedIn(uid)`.

## Acceptance
- [ ] Logout on a phone that never opted in leaves `push_tokens/{uid}` unchanged.
- [ ] Logout on a phone that never opted in leaves `preferences.pushNotifications` true.
- [ ] Logout on an opted-in phone still deletes the token and sets the preference false.
- [ ] NOT: no per-device token storage, rules, or Cloud Functions change (rest of #141).

## Verify
- `npm run lint && npm run build && npm test` → all green
- phone A (installed PWA, prod build): sign in, enable push in Profile → Firestore has
  `push_tokens/{uid}` and `pushNotifications: true`
- phone B: sign in, don't enable push, log out → token doc and preference unchanged;
  trigger a notification (e.g. admin approves A's booking) → A receives the push
- phone A: log out → token doc deleted, `pushNotifications: false`
- regression: Profile push toggle on/off still works on A

## Notes
Push is phone-only and prod-only (`isPushSupported`), so this can't be checked in
`npm run dev`. Logging out of an opted-in phone still turns push off for the member's
other phones; that, and one token per member, stay open on #141. A pre-marker device
(opt-in state unknown) gets marked by the launch-time refresh, so it is only skipped
if it logs out before ever relaunching.
