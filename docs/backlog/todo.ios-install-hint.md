# Show iPhone members how to install the app for notifications
**Phase**: — · **Deps**: —

## Goal
On iPhone, web push only works once the app is added to the Home Screen, so a member in a Safari tab never sees the push pop-up and Profile wrongly says the phone can't do notifications (#142). Reuse the existing post-success push pop-up to show install steps instead, and fix the Profile text.

## Files
- `src/utils/iosInstallHint.js` (new) — pure "iPhone tab that must install first?" check plus a browser wrapper
- `test/iosInstallHint.test.js` (new) — covers the pure check
- `src/services/pushNotifications.js` (edited) — `getPushOptInPromptMode` replaces `canShowPushOptInPrompt`, returns `'enable' | 'install' | null`
- `src/utils/pushOptInPrompt.js` (edited) — carries the mode into the banner state
- `src/components/PushOptInBanner.jsx` (edited) — install mode: tap reveals the steps and stops the auto-close
- `src/components/PushOptInBanner.css` (edited) — steps list styling
- `src/pages/member/Profile.jsx` (edited) — install steps replace the "not supported" help on an iPhone tab
- `src/locales/en.json`, `src/locales/vi.json` (edited) — install copy

## Acceptance
- [ ] iPhone browser tab, iOS ≥ 16.4, not installed: after a booking/event success the pop-up shows "Enable notifications on this phone" with "Add the app to your Home Screen first"
- [ ] Tapping it in install mode shows the steps: Share (or ··· → Share), Add to Home Screen, open from the Home Screen and sign in, then turn on notifications in Profile
- [ ] Once the steps are open, the pop-up stays until × is tapped
- [ ] × in install mode counts toward the existing 3-dismiss limit
- [ ] Profile → Notifications on an iPhone tab shows the install steps instead of "Notifications are not supported on this phone"
- [ ] Android, and an iPhone running the installed app, behave exactly as before (tap enables push)
- [ ] EN and VI strings ship together
- [ ] NOT: Android `beforeinstallprompt` Install button
- [ ] NOT: iPad (push stays phone-only, matching `mobilePushEligibility.js`)
- [ ] NOT: any Firestore, rules or Cloud Functions change

## Verify
- `npm test` → `iosInstallHint` tests pass (iPhone tab ≥ 16.4 → true; installed, iPad, Android, iOS 16.3 → false)
- `npm run lint && npm run build` → green
- `VITE_FIREBASE_VAPID_KEY=placeholder npm run dev:skipauth`, devtools device "iPhone 15" (iOS 17.5 UA; "iPhone 12 Pro" reports iOS 14 and correctly gets no hint), create a booking → install pop-up appears; tap → steps stay past the 7 s countdown; × closes and bumps `pushOptInDismissCount:<uid>`
- same device → `/member/profile` → Edit → Notifications help shows the install steps, in EN and VI
- regression: devtools "Pixel 7" and "iPhone 12 Pro" → Profile shows "Notifications are not supported on this phone" (dev has no push), no install text
- human, real iPhone on a deployed build: Safari steps match the UI; after installing, the pop-up and Profile offer to enable push and it works

## Notes
- The install check skips `isPushSupported()`'s production-only gate so the hint can be checked in dev; the enable path keeps that gate. Both still need `VITE_FIREBASE_VAPID_KEY`, since push can't work after install without it.
- Recent iOS Safari freezes the UA OS version at 18.x, which still passes the ≥ 16.4 check.
- An installed iPhone web app has its own storage, separate from Safari: a fresh login, dismiss counter and device opt-in marker. That's why the steps say to sign in again.
