# Desktop notification-bell sound
**Phase**: — · **Deps**: —

## Goal
Play a short, two-note in-page chime in an open desktop browser tab when the
existing notification-bell poll observes one or more newly unread
notifications. Keep the bell's data flow and phone-only push policy unchanged.

## Files
- `src/components/NotificationBell.jsx` (edited) — compare unread IDs after
  successful poll results and invoke the sound once for newly observed IDs.
- `src/utils/desktopNotificationSound.js` (added) — guard desktop sessions and
  safely play the bundled sound without surfacing audio-policy failures.
- `src/utils/mobilePushEligibility.js` (edited) — share a phone/tablet device
  predicate, including the iPadOS desktop-UA case.
- `public/assets/notification-ding.wav` (added) — compact, original two-note
  notification chime.
- `test/desktopNotificationSound.test.js` (added) — cover desktop, phone,
  tablet, iPadOS, and non-browser eligibility.

## Acceptance
- [x] The existing `['notifications', userId]` query and its
  `refetchInterval: 30000` remain unchanged.
- [x] The first successful result after mount, user change, or reload is
  silent, including when it already contains unread notifications.
- [x] A later successful result containing one or more previously unseen
  unread IDs plays the chime exactly once.
- [x] Unchanged or shrinking unread lists, and query errors, do not play a
  sound.
- [x] Phone and tablet sessions return before the audio asset is created or
  played.
- [x] Audio construction and `HTMLAudioElement.play()` failures are ignored so
  browser autoplay policy cannot break the bell.
- [x] NOT: add a Firestore realtime listener, change polling frequency,
  request a permission, add desktop push, or change mobile push behavior.

## Verify
- [x] `npm run lint` → exits successfully with zero warnings.
- [x] `npm test` → exits successfully (32 tests).
- [x] `npm run build` → production build completes successfully.
- [ ] manual regression: refresh desktop with existing unread notifications —
  the badge/list render with no chime.
- [ ] manual regression: add one or more notifications while desktop tab stays
  open — the following poll updates the bell and plays one two-note chime.
- [ ] manual regression: phone and tablet sessions remain silent while their
  existing browser-push behavior is unaffected.

## Notes
This is intentionally a polling-layer cue, not realtime delivery. A new
notification can therefore take up to the existing 30-second interval to be
observed, and longer when a browser throttles a background tab.
