# Show iPhone members how to install the app for notifications
**Phase**: — · **Deps**: push-per-device

## Goal
On iPhone, web push only works once the app is added to the Home Screen, so a member in a Safari tab never sees the push pop-up and Profile wrongly says the phone can't do notifications (#142). Reuse the existing post-success push pop-up to show install steps instead, and fix the Profile text.

## Files
- `src/utils/iosInstallHint.js` (new) — pure `'install' | 'safari' | null` hint plus a browser wrapper; phone check comes from `mobilePushEligibility.js`
- `test/iosInstallHint.test.js` (new) — covers the pure hint and the browser wrapper
- `src/services/pushNotifications.js` (edited) — `getPushOptInPromptMode` replaces `canShowPushOptInPrompt`, returns `'enable' | 'install' | 'safari' | null`; `getPushInstallHint` adds the VAPID check
- `src/utils/pushOptInPrompt.js` (edited) — carries the mode into the banner state
- `src/components/PushInstallHelp.jsx`, `.css` (new) — install steps (or the open-in-Safari line), shared by banner and Profile
- `src/components/PushOptInBanner.jsx`, `.css` (edited) — install and safari modes
- `src/pages/member/Profile.jsx` (edited) — install help replaces the "not supported" help on an iPhone without push
- `src/locales/en.json`, `src/locales/vi.json` (edited) — install copy

## Acceptance
- [ ] iPhone Safari tab, iOS ≥ 16.4: after a booking/event success the pop-up says "Add the app to your Home Screen first"
- [ ] Tapping it shows the steps: "Share" (or ··· → Share), "Add to Home Screen", open from the Home Screen and sign in, turn on notifications in Profile
- [ ] The steps end with "Already added it? Open the app from your Home Screen."
- [ ] Tapping again hides the steps; the button's `aria-expanded` follows and `aria-controls` points at the steps
- [ ] While the steps are open the pop-up has no auto-close
- [ ] While the steps are open, × closes without counting toward the 3-dismiss limit
- [ ] While the steps are open, moving to another page closes the pop-up without counting a dismiss
- [ ] × before opening the steps still counts toward the limit
- [ ] iPhone in-app browser (Zalo, Facebook, Messenger, Instagram, LINE, Telegram, WeChat): the pop-up says "Open this page in Safari to turn on notifications." with no steps
- [ ] Profile → Edit on an iPhone without push shows the same steps (or the Safari line in an in-app browser) instead of "Notifications are not supported on this phone"
- [ ] Without `VITE_FIREBASE_VAPID_KEY`, neither the pop-up nor Profile shows install help
- [ ] A phone where push is supported always gets `'enable'`, even if it doesn't report itself as installed
- [ ] Android behaves as before (tap enables push)
- [ ] An installed iPhone app behaves as before (tap enables push)
- [ ] EN and VI strings ship together
- [ ] NOT: Android `beforeinstallprompt` Install button
- [ ] NOT: iPad (push stays phone-only, matching `mobilePushEligibility.js`)
- [ ] NOT: detecting from Safari that the app is already installed (storage is separate; the "Already added it?" line covers it)
- [ ] NOT: any Firestore, rules or Cloud Functions change

## Verify
- `npm test` → `iosInstallHint` tests pass (tab → install; in-app UAs → safari; installed, iPad, Android, iOS 16.3, non-phone → null; wrapper reads `navigator.standalone` and `display-mode`)
- `npm run lint && npm run build` → green
- `VITE_FIREBASE_VAPID_KEY=placeholder npm run dev:skipauth`, iPhone 15 emulation (iOS 17.5 UA), create a booking → install pop-up; tap → steps stay past the 7 s countdown; tap again → steps hide; × with steps open leaves `pushOptInDismissCount:<uid>` unchanged
- same, open the steps, then navigate to another page → pop-up closes
- same with a Zalo UA → pop-up shows the Safari line, no steps
- `/member/profile` → Edit → install steps in EN and VI; with a Zalo UA → the Safari line
- regression: Pixel 7 and iPhone 12 Pro (iOS 14) → Profile shows "Notifications are not supported on this phone", no install text
- human, real iPhone on a deployed build: Safari steps match the UI; after installing, the pop-up and Profile offer to enable push and it works

## Notes
- The hint is returned only when `isPushSupported()` is false, so dev (no push) shows it for checking and an installed app with push never gets stuck in install mode.
- An installed iPhone web app has its own storage, separate from Safari: a fresh login, dismiss counter and device opt-in marker. That's why the steps say to sign in again, and why Safari can't tell the app is installed.
- Recent iOS Safari freezes the UA OS version at 18.x, which still passes the ≥ 16.4 check.
