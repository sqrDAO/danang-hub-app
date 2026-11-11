# Lock the profile email to the sign-in email; verify on its own screen
**Phase**: — · **Deps**: email-verification

## Goal
`members.email` is member-editable, so it can differ from the sign-in (Auth) email and name any
address, which admins and attendees then see as a contact. Lock it to the Auth email for accounts
that have one, move the optional verify step to its own screen, and keep Profile looking as it did.

## Files
- `src/contexts/AuthContext.jsx` (edited) — `isProfileComplete` checks name, company and role only; new profiles start with email notifications on only for a verified email; copy the Auth email into `members.email` on every profile load; no verification email on sign-up
- `functions/scripts/sync-member-emails.cjs` (new) — one-off backfill of the same sync; dry run by default, `--apply` to write
- `src/pages/member/VerifyEmail.jsx` (new) — `/member/verify-email`: the Auth email, a send button with a 60 s cooldown, Verified once the link is clicked
- `src/App.jsx` (edited) — the `/member/verify-email` and `/admin/verify-email` routes
- `src/services/emailVerification.js` (edited) — `sendVerificationEmail` reloads first, sends nothing to a verified account, continues to the verify screen
- `src/utils/emailVerification.js` (edited) — comments for the three email states
- `src/utils/profileFields.js` (new) — the required profile fields, shared by `isProfileComplete`, the save check and the banner
- `test/profileFields.test.js` (new) — missing-field cases
- `src/pages/member/Profile.jsx` (edited) — Email: a disabled input (edit) or plain text (view) like the other fields, an optional input for wallets; an unverified account may turn on email notifications, and a save with them on opens the verify screen; banner names only the missing fields
- `src/pages/member/Profile.css` (edited) — disabled field look; verify screen layout
- `src/pages/admin/Members.jsx` (edited) — email input dropped from the edit form and its submit data
- `firestore.rules` (edited) — an owner with an Auth email may set `members.email` only to it; one without may set any value
- `test/firestore-member-email.rules.test.js` (new) — owner email rules
- `test/emailVerification.test.js` (edited) — cooldown storage
- `src/locales/en.json`, `src/locales/vi.json` (edited) — verify screen, wallet field and banner `{{fields}}` strings
- `README.md`, `docs/knowledge/data-flow.md` (edited) — feature list, `members` collection, `isProfileComplete`, email sync

## Acceptance
- [ ] A profile with name, company and role is complete whether or not its email is verified.
- [ ] A wallet member can complete their profile with no email.
- [ ] The completion banner names only the missing fields among name, company and role.
- [ ] The banner, the save check and `isProfileComplete` read one list (`src/utils/profileFields.js`).
- [ ] Email sign-up sends no verification email.
- [ ] A Google or password account's Email shows as a disabled input in the edit form.
- [ ] A Google or password account's Email shows as plain text in the read-only view.
- [ ] Profile shows no Verify button, Verified badge or "link sent" text.
- [ ] In the read-only view, an unverified account's email-notifications value links to `/member/verify-email`.
- [ ] In the edit form, an unverified account's email-notifications box is enabled, with no link or note.
- [ ] A new profile starts with email notifications on only when its email is verified.
- [ ] An unverified account's box starts ticked only if it was turned on before.
- [ ] Saving with that box ticked opens the verify screen.
- [ ] The verify screen opened that way says event emails need a verified email.
- [ ] The verify screen sends a link to the Auth email.
- [ ] Before a send, the verify screen reads "Verify your email" with a "Not verified" tag.
- [ ] After a send this session, it reads "Check your inbox" with a "Link sent" tag and an m:ss resend countdown.
- [ ] NOT: the verify screen offering to change the address.
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
- [ ] NOT: requiring a verified email, or any email, to complete a profile.
- [ ] NOT: changing who receives system mail (`getVerifiedEmail` stays the only recipient source).
- [ ] NOT: changing or adding a sign-in email from the app.

## Verify
- `npm run lint && npm run build && npm test` → green
- `cd functions && npm run lint && npx eslint scripts/sync-member-emails.cjs` → green (`eslint .` skips `.cjs`)
- `npm run test:rules` → green, including `firestore-member-email.rules.test.js`
- `node functions/scripts/sync-member-emails.cjs` (prod, after the rules deploy) → dry run lists the changes; `--apply`, then the dry run again → 0 to change
- `firebase emulators:start --project demo-danang-hub` + `VITE_USE_EMULATORS=true npm run dev`
  (links: `curl -s localhost:9099/emulator/v1/projects/demo-danang-hub/oobCodes`):
  - email sign-up → no link in `oobCodes` → fill profile, tick email notifications, save → verify screen with guide → send → open link → return → Verified
  - wallet sign-in → profile completes with no email → type one → save → shown in the read-only view
  - Google sign-in → plain email, email notifications on
- regression: `firestore-member-partner.rules.test.js`, admin member edit, Profile save of the other fields

## Notes
- System mail reads only a verified Auth email (`getVerifiedEmail`), never `members.email`; keep new mail on it.
- An admin fixes a mistyped sign-up address in the Firebase console; no account is deleted or replaced (YouAI #242).
