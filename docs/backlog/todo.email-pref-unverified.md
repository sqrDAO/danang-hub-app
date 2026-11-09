# Explain the email switch to members who can't get event emails
**Phase**: — · **Deps**: event-email-escape

## Goal
After `event-email-escape`, event emails go only to a verified Firebase Auth email, so wallet
and email/password members never get them, yet Profile still shows them a working "Email
notifications" switch. Disable that switch for them and say where their updates arrive instead.

## Files
- `src/pages/member/Profile.jsx` (edited) — disable the `emailNotifications` checkbox and show a
  help line when `currentUser.emailVerified` is false
- `src/locales/en.json` (edited) — `profile.emailNotificationsUnverified` help text
- `src/locales/vi.json` (edited) — same key in Vietnamese

## Acceptance
- [ ] A Google-signed-in member sees the switch enabled, as today.
- [ ] A wallet-signed-in member sees the switch disabled.
- [ ] An email/password member sees the switch disabled.
- [ ] Under a disabled switch, a help line says event updates arrive in the bell and as push notifications.
- [ ] The help line shows in English and Vietnamese.
- [ ] Saving the profile with a disabled switch leaves the stored `preferences.emailNotifications` unchanged.
- [ ] NOT: no change to how or where event emails are sent.
- [ ] NOT: no change to the profile email field or the profile-complete check.
- [ ] NOT: no email verification flow for password accounts (separate spec if wanted).

## Verify
- `npm run lint && npm run build` → green
- `npm test` → all pass
- `npm run dev`, sign in with Google → Profile switch enabled, no help line
- `npm run dev`, sign in with a wallet → switch disabled, help line in EN; switch language → VI
- save the wallet member's profile → Firestore `members/{uid}.preferences.emailNotifications` unchanged
- regression: push and event-reminder switches behave as before

## Notes
A disabled `<input>` is left out of `FormData`, so `buildProfileUpdateData` would read it as
off and write `false`. Keep the existing value when the switch is disabled.

Unconfirmed (#165 review): a wallet account (`eth_<addr>`) that linked Google may have its verified
address only in `providerData[google.com]`, not in the top-level `email`/`emailVerified`. Check with
a real linked account before deciding whether `getVerifiedEmail` or this switch should account for it.
