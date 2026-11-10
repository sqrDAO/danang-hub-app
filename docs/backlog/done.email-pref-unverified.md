# Explain the email switch to members who can't get event emails
**Phase**: — · **Deps**: event-email-escape

## Goal
After `event-email-escape`, event emails go only to a verified Firebase Auth email, so wallet
and unverified email/password members never get them, yet Profile still shows them a working
"Email notifications" switch. Disable that switch for them and say where their updates arrive.

## Files
- `src/utils/emailVerification.js` (new) — `getEmailStatus(user)`: `verified` · `unverified` · `none`
- `src/pages/member/Profile.jsx` (edited) — disable the `emailNotifications` checkbox with a help
  line, and label the read-only row, unless the status is `verified`
- `src/locales/en.json` (edited) — `profile.emailNotificationsUnavailable`, `profile.emailNotificationsNotAvailable`
- `src/locales/vi.json` (edited) — same keys in Vietnamese
- `test/emailVerification.test.js` (new) — `getEmailStatus` cases

## Acceptance
- [ ] A Google-signed-in member sees the switch enabled, as today.
- [ ] A wallet-signed-in member sees the switch disabled and unchecked.
- [ ] An unverified email/password member sees the switch disabled and unchecked.
- [ ] Under a disabled switch, a help line says event updates arrive in the bell and as push notifications.
- [ ] The read-only Profile view shows "Not available" for those members instead of On/Off.
- [ ] The help line and label show in English and Vietnamese.
- [ ] Saving the profile with a disabled switch leaves the stored `preferences.emailNotifications` unchanged.
- [ ] NOT: no change to how or where event emails are sent.
- [ ] NOT: no change to the profile email field or the profile-complete check.
- [ ] NOT: no email verification flow (`todo.email-verification.md`).
- [ ] NOT: no email address for wallet accounts.

## Verify
- `npm run lint && npm run build` → green
- `npm test` → all pass, including `test/emailVerification.test.js`
- `npm run dev`, sign in with Google → Profile switch enabled, no help line
- `npm run dev`, sign in with a wallet → switch disabled, help line in EN; switch language → VI
- save the wallet member's profile → Firestore `members/{uid}.preferences.emailNotifications` unchanged
- regression: push and event-reminder switches behave as before

## Notes
A disabled `<input>` is left out of `FormData`, so `buildProfileUpdateData` would read it as
off and write `false`. Leave `emailNotifications` out of the update when the switch is disabled.

**Wallet members get no email path, on purpose.** Prod Auth on 2026-11-10: 11 wallet accounts of
175, none signed in within 30 days. A wallet account has no Auth email; giving it one
(`verifyBeforeUpdateEmail`) needs a fresh wallet re-sign, fails when a Google account owns the
address, and changes which account a later Google sign-in lands in: the identity-collision class
behind youAI #157's takeover. Bell and push already reach them. Revisit with a wallet-linking
design if wallet members become active or ask for email.

The app never calls `linkWith*`, so a wallet account with a linked Google provider (verified
address only in `providerData`) can't occur today.
