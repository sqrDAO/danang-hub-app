# Refresh the push token on launch and stop push self-disabling silently
**Phase**: — · **Deps**: —

## Goal
Browser push on a phone dies permanently the first time its FCM token goes stale: the
token is issued once at opt-in and never re-issued, while the server clears
`preferences.pushNotifications` on the first failed send. Re-issue the token on every
authenticated launch of a device that opted in, and make the server's cleanup and
logging honest so the dead state is both recoverable and visible.

## Files
- `src/utils/pushDeviceOptIn.js` (new) — pure `shouldRefreshPushToken` predicate plus the per-uid localStorage opt-in marker.
- `test/pushDeviceOptIn.test.js` (new) — cover the predicate's permission / marker / eligibility matrix.
- `src/services/pushNotifications.js` (edited) — add `refreshPushToken(uid)`; set the device marker on enable, clear it on disable.
- `src/contexts/AuthContext.jsx` (edited) — call `refreshPushToken` on authenticated launch, independent of the stored preference.
- `functions/index.js` (edited) — clear the preference unconditionally in `deleteStalePushToken`; log push send outcomes in `sendPushToRecipients`.

## Acceptance
- [x] `refreshPushToken(uid)` re-issues via `getToken` and rewrites `push_tokens/{uid}` when the device is push-eligible, `Notification.permission === 'granted'`, and the device marker is set.
- [x] `refreshPushToken` never calls `Notification.requestPermission`.
- [x] `refreshPushToken` returns false without touching Firestore when the device marker is absent.
- [x] `refreshPushToken` returns false without touching Firestore when permission is `denied` or `default`.
- [x] A successful refresh sets `preferences.pushNotifications = true`, so a server-side auto-disable heals on next launch.
- [x] A successful refresh that changed the preference calls `refreshUserProfile` so the foreground listener effect re-runs.
- [x] `enablePushNotifications` sets the device marker; `disablePushNotifications` clears it.
- [x] A member who explicitly turns push off in Profile is not re-enabled by a later launch.
- [x] Every `refreshPushToken` failure is caught and logged; login and app boot never fail because of it.
- [x] `deleteStalePushToken` sets `preferences.pushNotifications = false` even when `push_tokens/{uid}` is already absent.
- [x] `sendPushToRecipients` logs one line per batch with attempted, succeeded, and failed counts.
- [x] `sendPushToMembers` logs when a payload resolves to zero recipients, naming the type and subjectId.
- [x] NOT: change the single-token `push_tokens/{uid}` data model.
- [x] NOT: change logout push cleanup (`disablePushNotificationsOnLogout`).
- [x] NOT: add push to notification types that lack it today (`event_revision`, waitlist promotion).
- [x] NOT: prompt for notification permission anywhere outside the existing Profile toggle and opt-in banner.

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [x] `cd functions && npm run lint` → exit 0
- [x] `npm test` → exit 0, including the new `test/pushDeviceOptIn.test.js`
- [ ] manual, Android phone, installed PWA, production build: enable push from Profile → confirm `push_tokens/{uid}` written → force-close and relaunch the PWA → confirm `updatedAt` on `push_tokens/{uid}` advanced.
- [ ] manual, same device: set `preferences.pushNotifications = false` in Firestore by hand → relaunch → confirm it returns to `true` and a booking approval reaches the lock screen.
- [ ] manual, same device: turn push off in Profile → relaunch → confirm no token is written and the preference stays `false`.
- [ ] manual, desktop browser: relaunch while signed in → confirm no `push_tokens` write (blocked by `isMobilePushEligible`).
- [ ] regression: post-booking opt-in banner still appears for a member who has never opted in; Profile toggle still enables and disables push.

## Notes
- Gate the refresh on a device-local marker, not on `Notification.permission` alone: `disablePushNotifications` leaves permission granted, so a permission-only gate would resurrect an explicit opt-out.
- The AuthContext push effect currently early-returns when `preferences.pushNotifications` is falsy (`AuthContext.jsx:214`). The refresh must run outside that gate — that gate is exactly what makes the server's auto-disable unrecoverable.
- With one token per member, two phones that both opted in will overwrite each other on launch (last launch wins). That is today's behavior and stays out of scope.
- Logging is the point of the last two acceptance bullets: production logs for `notifyBookingApproval`, `notifyEventStatusChange`, and `sendEventReminders` currently contain no push line at all, success or failure, so a silent no-send is indistinguishable from a delivered push.
