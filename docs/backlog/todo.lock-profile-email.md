# Lock the profile email to the sign-in email; optional verify and add-email
**Phase**: — · **Deps**: email-verification

## Goal
`members.email` is member-editable, so it can differ from the sign-in (Auth) email and name any
address, which admins and attendees then see as a contact. Make it mirror the Auth email, and give
the Email field one optional row to verify it, add one (wallet) or replace a mistyped one by link;
verifying only unlocks event emails.

## Files
- `src/contexts/AuthContext.jsx` (edited) — `isProfileComplete` checks name, company and role only; whenever the profile loads (login, session restore, `refreshUserProfile`), copy the Auth email into `members.email` when they differ
- `src/services/emailVerification.js` (edited) — `sendEmailChangeLink(email, language, continuePath)` via `verifyBeforeUpdateEmail`; both senders reload first, send nothing if already verified, and record where the link went; `reloadEmailVerified` refreshes the ID token once verified
- `src/utils/emailVerification.js` (edited) — `readVerifySentTo`; error keys for `auth/email-already-in-use`, `auth/invalid-email`, `auth/requires-recent-login`
- `src/pages/member/Profile.jsx` (edited) — Email field: read-only Auth email, no required mark, one verify / add / change row in both views; banner names only the missing fields; email dropped from form validation and save; recheck on focus, then `refreshUserProfile` to sync
- `src/pages/member/Profile.css` (edited) — email row layout
- `src/pages/admin/Members.jsx` (edited) — email input dropped from the edit form and its submit data
- `firestore.rules` (edited) — owners may set `members.email` only to `''` or their token email
- `test/firestore-member-email.rules.test.js` (new) — owner email rules
- `test/emailVerification.test.js` (edited) — new error keys, sent-to address
- `src/locales/en.json`, `src/locales/vi.json` (edited) — email row strings, banner with `{{fields}}`; drop `emailNotificationsUnavailable`, `emailNotificationsNotAvailable`, `validation.emailRequired`
- `README.md` (edited) — feature list, `notifyEventStatusChange` row, `members` collection
- `docs/knowledge/data-flow.md` (edited) — what `isProfileComplete` checks; `members.email` sync

## Acceptance
- [ ] A profile with name, company and role is complete whether or not its email is verified.
- [ ] A wallet member with no email can complete their profile.
- [ ] Profile shows the email as read-only text with no required mark, in both views.
- [ ] The completion banner names only the missing fields among name, company and role.
- [ ] An unverified email's row has a "Verify" button and a "Change" link.
- [ ] A verified email's row shows "Verified" and no buttons.
- [ ] A wallet member with no email sees "No email" and an "Add email" button.
- [ ] "Add email" and "Change" open an email input with "Send link" and "Cancel".
- [ ] After a send, the row names the address the link went to, also after switching views.
- [ ] Right after email sign-up, the row names the sign-up address as already sent.
- [ ] Sends share one 60 s cooldown, shown on the button.
- [ ] Sending when the account is already verified sends no email and shows it verified.
- [ ] Returning to the tab after clicking a link shows the email verified.
- [ ] An address used by another account shows its own "belongs to another account" message.
- [ ] After login, `members.email` equals the Auth email when the account has one.
- [ ] An owner write setting `members.email` to another address is denied by the rules.
- [ ] An owner create with `email: ''` (wallet sign-up) is allowed.
- [ ] Owner writes that leave `email` unchanged are allowed, including legacy mismatched values.
- [ ] The admin member edit form has no email input.
- [ ] NOT: requiring a verified email, or any email, to complete a profile.
- [ ] NOT: changing who receives event emails (`getVerifiedEmail` stays as is).
- [ ] NOT: constraining admin writes to `members.email` in the rules.
- [ ] NOT: removing wallet sign-in.

## Verify
- `npm run lint && npm run build` → green
- `cd functions && npm run lint` → green (no function changes)
- `npm test` → green
- `npm run test:rules` → green, including `firestore-member-email.rules.test.js`
- `firebase emulators:start --project demo-danang-hub` + `VITE_USE_EMULATORS=true npm run dev`
  (links: `curl -s localhost:9099/emulator/v1/projects/demo-danang-hub/oobCodes`):
  - email sign-up → profile completes unverified → row names the address as sent → open link → return → Verified
  - "Change" → new address → open link → return → new address, Verified
  - wallet sign-in → profile completes with "No email" → "Add email" → open link → return → Verified; `members/eth_…` has the email
  - Google sign-in → Verified, no buttons
- regression: `firestore-member-partner.rules.test.js`, admin member edit, Profile save of the other fields

## Notes
- No one is gated. Prod (2026-11-11, 175 accounts): 32 unverified email/password and 11 wallet
  accounts will see the Verify / Add email row; Google accounts are all verified.
- A mistyped address is fixed with "Change": the account moves to an address the member proves
  they own. Never delete or replace the old account (YouAI #242 dropped that for security).
- Until verified, Firebase treats a password account as untrusted: a Google sign-in on the same
  Gmail silently removes the password provider (YouAI #250). This spec doesn't change that.
- Unchecked in prod: Google sign-in on a Gmail attached to a wallet account. Low risk: no wallet
  account has signed in for 90+ days.
- Rules read `request.auth.token.email`, which only updates on a new ID token: call
  `getIdToken(true)` after `reload()` and before writing `members.email`.
- Changing an account's email may revoke its refresh token and sign the member out; they sign in
  again and the login sync writes the email.
- `verifyBeforeUpdateEmail` (not `updateEmail`) still works with email enumeration protection on.
