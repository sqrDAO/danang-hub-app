# Member email verification labels
**Phase**: — · **Deps**: —

## Goal
Resolve [#233](https://github.com/sqrDAO/danang-hub-app/issues/233) by distinguishing verified addresses from legacy and wallet-entered contact emails. Bind verification to the exact address and validate the claim against Firebase Auth.

## Files
- `src/utils/memberEmail.js` (new) — Auth sync fields and address-bound verification predicate.
- `src/components/MemberEmail.jsx` (new) — shared email and translated status display.
- `src/components/MemberEmail.css` (new) — scoped wrapping and status presentation.
- `src/contexts/AuthContext.jsx` (edited) — sync verifiedEmail when creating/loading profiles.
- `src/services/members.js` (edited) — refresh Auth proof before background profile sync.
- `src/services/emailVerification.js` (edited) — sync after successful verification reload.
- `firestore.rules` (edited) — only the owner's verified Auth token can assert a verified address.
- `src/pages/admin/Members.jsx` (edited) — label desktop/mobile roster and member details.
- `src/pages/admin/Events.jsx` (edited) — label host contact email.
- `src/pages/member/Events.jsx` (edited) — label host contact email.
- `src/components/event/EventRegistrantsModal.jsx` (edited) — label registrant email links.
- `src/components/MemberCombobox.jsx` (edited) — label booking member suggestions.
- `src/locales/en.json` (edited) — verification labels.
- `src/locales/vi.json` (edited) — verification translations.
- `src/services/localDevFixtures.js` (edited) — verified and unverified sample contacts.
- `README.md` (edited) — describe member verification field and conservative legacy display.
- `docs/knowledge/data-flow.md` (edited) — document the verification trust boundary.
- `test/memberEmail.test.js` (new) — verified, mismatched, legacy and wallet states.
- `test/firestore-member-email.rules.test.js` (edited) — reject forged verification claims.

## Acceptance
- [ ] Verification is displayed only when verifiedEmail exactly matches the displayed non-empty email.
- [ ] Missing verification data displays as unverified.
- [ ] Wallet contact email stays unverified without Auth proof.
- [ ] Verification sync refreshes the ID token before writing.
- [ ] A successful verification reload updates the shared member record.
- [ ] Owners cannot assert verification for an unverified or different Auth email.
- [ ] Admin edits cannot forge another member's verification.
- [ ] All affected contact displays expose status text in EN and VI.
- [ ] Email links and member selection remain usable.
- [ ] NOT: broaden member read access or change system email recipients.
- [ ] NOT: perform a production backfill; legacy records gain proof on profile sync.

## Verify
- `node --test test/memberEmail.test.js` → all status/sync cases pass.
- `npm run test:rules` → forged claims rejected, legitimate sync and unrelated edits allowed.
- `npm run lint` → no warnings or errors.
- `npm test` → no failures.
- `npm run build` → production build succeeds.
- `cd functions && npm run lint` → no errors.
- Manual fixture browser: inspect verified/unverified desktop/mobile Members, booking picker, host contact and registrants in EN/VI; confirm email link targets and selection.

## Notes
- verifiedEmail is address-bound Auth evidence, not a user-editable boolean. Unchanged claims may survive unrelated edits; changing email makes old proof ineffective.
