# Lock the profile email to the sign-in email; verify on its own screen
**Phase**: — · **Deps**: email-verification, email-pref-unverified · **Issue**: #200

## Goal
`members.email` is member-editable, so it can name any address, which admins and attendees see as a contact. Lock it to the Auth email where there is one, verify on its own screen (required for new email/password sign-ups, optional for older accounts), and keep Profile looking as it did.

## Files
- `src/contexts/AuthContext.jsx`, `LocalDevAuthProvider.jsx` (edited) — `isProfileComplete` checks name, company and role only; new profiles start with email notifications on only for a verified email; copy the Auth email into `members.email` on every profile load; no verification email on sign-up; new unverified-email profiles get `emailVerificationRequired: true`, read by `isEmailVerificationPending()`; the sync refreshes the ID token first when the Auth email differs from the profile's; the local-dev value defines `isEmailVerificationPending`
- `functions/scripts/sync-member-emails.cjs` (new) — one-off backfill of the same sync; dry run by default, `--apply` to write; prints the uids of profiles with no Auth account
- `src/hooks/useEmailStatus.js` (new) — the Auth email status, reloaded on mount and focus; used by Profile and the verify screen
- `src/pages/member/VerifyEmail.jsx` (new) — `/member/verify-email`: the Auth email, a send button with a 60 s cooldown, Verified once the link is clicked; "Wrong email? Change it" form
- `src/App.jsx` (edited) — the `/member/verify-email` and `/admin/verify-email` routes
- `src/components/ProtectedRoute.jsx` (edited) — a pending verification goes to the verify screen before the profile check
- `src/services/emailVerification.js` (edited) — `sendVerificationEmail` reloads first, sends nothing to a verified account, continues to the verify screen; `changeSignInEmail` sends a change link to a new address (`verifyBeforeUpdateEmail`)
- `src/utils/profileFields.js`, `test/profileFields.test.js` (new) — the required profile fields, shared by `isProfileComplete`, the save check and the banner; missing-field cases
- `src/pages/member/Profile.jsx` (edited) — Email: a disabled input (edit) or plain text (view) like the other fields, an optional input for wallets; an unverified account may turn on email notifications, and a save that turns them on opens the verify screen; banner names only the missing fields; `Profile.css`: disabled field look; verify screen layout
- `src/pages/admin/Members.jsx` (edited) — email input dropped from the edit form and its submit data
- `firestore.rules` (edited) — an owner with an Auth email may set `members.email` only to it; one without may set any value; tested in `test/firestore-member-email.rules.test.js` (new)
- `src/utils/emailVerification.js`, `test/emailVerification.test.js` (edited) — comments for the three email states; cooldown storage
- `src/locales/en.json`, `src/locales/vi.json` (edited) — verify screen, wallet field and banner `{{fields}}` strings
- `README.md`, `docs/knowledge/data-flow.md`, `functions/index.js` (edited) — feature list, `members` collection, `isProfileComplete`, email sync; `getVerifiedEmail` comment and booking stub

## Acceptance
- [ ] A profile with name, company and role is complete whether or not its email is verified.
- [ ] A wallet member can complete their profile with no email.
- [ ] The completion banner names only the missing fields among name, company and role.
- [ ] Email sign-up sends no verification email.
- [ ] A Google or password account's Email is a disabled input when editing and plain text when viewing.
- [ ] Profile shows no Verify button, Verified badge or "link sent" text.
- [ ] In the read-only view, an unverified account's email-notifications value shows On or Off and links to `/member/verify-email`.
- [ ] In the edit form, an unverified account's email-notifications box is enabled, with no link or note (reverses `done.email-pref-unverified.md`).
- [ ] A new profile starts with email notifications on only when its email is verified.
- [ ] A new email/password sign-up is sent to the verify screen from every protected page until it verifies.
- [ ] That verify screen says the email must be confirmed to start using the hub.
- [ ] Profiles created before this change, Google and wallet accounts are never held on the verify screen.
- [ ] An unverified account's box shows its stored setting (unset reads as on).
- [ ] Saving opens the verify screen only when that save turns the box on (stored value `false`).
- [ ] The verify screen opened that way says event emails need a verified email.
- [ ] The verify screen sends a link to the Auth email.
- [ ] Before a send, the verify screen reads "Verify your email" with a "Not verified" tag.
- [ ] After a send this session, it reads "Check your inbox" with a "Link sent" tag and an m:ss resend countdown.
- [ ] An unverified account's verify screen offers "Wrong email? Change it".
- [ ] Changing sends a link to the new address and leaves the sign-in email unchanged until it is clicked.
- [ ] After the link is clicked, the member signs in with the new address, which is verified.
- [ ] A change that needs a recent sign-in says to sign out and back in.
- [ ] After a send, the button counts down 60 s before it can resend, also after leaving and returning.
- [ ] Sending when the account is already verified sends no email and shows Verified.
- [ ] A verified screen with email notifications off says they can be turned on in Profile.
- [ ] Returning to the tab after clicking the link shows Verified on the verify screen.
- [ ] The link's Continue button opens the verify screen.
- [ ] A wallet account opening the verify screen is sent to Profile.
- [ ] An admin's verify flow stays in the admin area (`/admin/verify-email`, back to `/admin/profile`).
- [ ] A wallet account sees an optional email text input in the edit form, saved with the profile.
- [ ] A wallet account's email notifications read "Not available for wallet sign-ins".
- [ ] After login, `members.email` equals the Auth email when the account has one.
- [ ] The login sync and the backfill leave a wallet account's typed email alone.
- [ ] After the backfill's `--apply`, a re-run dry run reports 0 profiles to change.
- [ ] An owner with an Auth email cannot set `members.email` to another address (rules).
- [ ] An owner without an Auth email can set `members.email` to any value (rules).
- [ ] Owner writes that leave `email` unchanged are allowed, including legacy mismatched values.
- [ ] The admin member edit form has no email input.
- [ ] NOT: requiring a verified email, or any email, for profile completeness (`isProfileComplete`).
- [ ] NOT: changing who receives system mail (`getVerifiedEmail` stays the only recipient source).
- [ ] NOT: changing a verified sign-in email, or adding one to a wallet account, from the app.

## Verify
- `npm run lint && npm run build && npm test`; `cd functions && npm run lint && npx eslint scripts/sync-member-emails.cjs` → green (`eslint .` skips `.cjs`)
- `npm run test:rules` → green, including `firestore-member-email.rules.test.js`
- `node functions/scripts/sync-member-emails.cjs` (prod, after the rules deploy) → dry run lists the changes; `--apply`, then the dry run again → 0 to change
- `firebase emulators:start --project demo-danang-hub` + `VITE_USE_EMULATORS=true npm run dev` (links: `curl -s localhost:9099/emulator/v1/projects/demo-danang-hub/oobCodes`):
  - email sign-up → verify screen, other pages redirect back, no link in `oobCodes` → send → open link → return → Verified → profile
  - older unverified password account → not held; box shows stored setting → save ticked → stays on Profile; untick, save, tick, save → verify screen with guide
  - unverified account → Change it → new address → open link in `oobCodes` → sign in with the new address → verified
  - wallet sign-in → profile completes with no email → type one → save → shown in the read-only view
  - Google sign-in → plain email, email notifications on
- regression: `firestore-member-partner.rules.test.js`, admin member edit, Profile save of the other fields, `VITE_SKIP_AUTH=true npm run dev` loads protected pages

## Notes
- System mail reads only a verified Auth email (`getVerifiedEmail`), never `members.email`; keep new mail on it.
- The verification hold and profile completeness are UI-only (`ProtectedRoute`); rules don't check `email_verified`, and an owner can clear `emailVerificationRequired`.
