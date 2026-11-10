# Let email/password members verify their email for event emails
**Phase**: — · **Deps**: email-pref-unverified

## Goal
Event emails go only to a Firebase-verified address, and the app never sends a verification
email, so 32 of 35 email/password members (prod, 2026-11-10) can't get them. Let them verify
from Profile, and send the verification email on sign-up.

## Files
- `src/services/emailVerification.js` (new) — `sendVerificationEmail(language, continuePath)`, `reloadEmailVerified()`, `setAuthEmailLanguage()`
- `src/utils/emailVerification.js` (edited) — cooldown and error-key helpers, last-send time in `sessionStorage`
- `src/contexts/AuthContext.jsx` (edited) — sign-up sends the verification email (best effort); password reset uses the app language
- `test/emailVerification.test.js` (edited) — cooldown and error-key cases
- `README.md` (edited) — feature list; who gets the event status email
- `src/pages/member/Profile.jsx` (edited) — verify prompt with cooldown; reload on mount; read-only label
- `src/pages/member/Profile.css` (edited) — verify prompt spacing
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `profile.verifyEmail*`, `profile.emailNotificationsVerifyToEnable`

## Acceptance
- [ ] Under the disabled switch, an unverified member sees a prompt naming their Auth email.
- [ ] The prompt has a "Send verification link" button.
- [ ] The read-only Profile view shows the same prompt.
- [ ] The read-only label reads "Verify your email to turn on" for unverified members.
- [ ] After sending, the button waits 60 s before it can resend.
- [ ] Switching between edit and read-only view, or leaving Profile, keeps the cooldown.
- [ ] Profile right after sign-up shows the cooldown for the sign-up email.
- [ ] A Firebase `auth/too-many-requests` shows its own "try again later" message.
- [ ] The verification email is in the app's current language (EN or VI).
- [ ] The link's Continue button opens the Profile page it was sent from (`/member/profile` or `/admin/profile`).
- [ ] Opening Profile after verifying shows the switch enabled without signing out.
- [ ] An open Profile tab enables the switch when the window regains focus after verifying.
- [ ] A verification seen for one account never enables the switch for another.
- [ ] A password-reset email is in the app's current language.
- [ ] Signing up with email/password sends the verification email once.
- [ ] A failed send on sign-up does not fail the sign-up.
- [ ] NOT: blocking sign-in for unverified accounts.
- [ ] NOT: any change for wallet members (see `todo.email-pref-unverified.md`).
- [ ] NOT: changes to Cloud Functions or to who receives event emails.

## Verify
- `npm run lint && npm run build` → green
- `npm test` → all pass
- `npm run dev`, sign up with a new email → verification email arrives, Profile shows the prompt
- click the link → Continue → `/member/profile` shows the switch enabled
- switch app to VI, press Send → email is in Vietnamese; button shows the countdown
- regression: wallet member still sees the PR 1 help line; Google member unchanged

## Notes
**Nudge, not gate.** youAI #250 refuses unverified password sign-ins. Not copied: it locks out
32 members until they verify, and its reviews found several auth-listener races. The gate's
other benefit (Google silently replacing an unverified password login) shrinks as members
verify; a follow-up can add the gate if wanted.

Firebase restores `emailVerified` from cache; `reloadEmailVerified()` (`user.reload()`) on
Profile mount picks up a click made in another tab. `reload()` mutates the shared Auth user, so
later renders see `verified` too. The continue URL's domain must be in Authentication → Settings
→ Authorized domains, or sending fails with `auth/unauthorized-continue-uri`.
