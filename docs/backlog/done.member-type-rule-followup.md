# Tighten membershipType rules on member profiles
**Phase**: — · **Deps**: member-profile-create-validation

## Goal
Follow-up to #118 from its post-merge review. Owners must create their profile with `membershipType: 'member'` and can never change or remove it. Admins may set it only to `'member'` or `'admin'`.

## Files
- `firestore.rules` (edited) — create requires `membershipType == 'member'`; owner update compares `membershipType` with a null default, as `partnerId` already does; admin update accepts only `member`/`admin` (missing reads as `member`)
- `test/firestore-member-partner.rules.test.js` (edited) — owner create/update/delete-field cases, admin values, legacy profiles; no test mutates a shared fixture

## Acceptance
- [ ] Owner create with `membershipType` `'admin'`, `'Admin'`, `null` or missing is denied
- [ ] Owner create with `membershipType: 'member'` is allowed
- [ ] Owners cannot change or delete their `membershipType`, and can still edit other fields
- [ ] A legacy profile with no `membershipType` cannot be promoted by its owner, and its owner can still edit other fields
- [ ] Admins can set `membershipType` to `'member'` or `'admin'` only
- [ ] Admins can still edit a legacy profile with no `membershipType`
- [ ] NOT: no change to `createUserProfile` (`src/contexts/AuthContext.jsx` already writes `'member'`)
- [ ] NOT: no field allow-list on profiles (follow-up if wanted)

## Verify
- `firebase emulators:exec --only firestore --project demo-danang "node --test --test-concurrency=1 test/firestore-member-partner.rules.test.js test/firestore-booking-cancel.rules.test.js test/firestore-booking-renewal.rules.test.js test/firestore-event-edit.rules.test.js"` → all pass
- `npm run lint && npm run build && npm test` → green
- regression: first sign-in through `npm run dev` creates `members/{uid}` with `membershipType: 'member'`; profile edit and language switch still save

## Notes
- CI does not run the emulator rules tests (no workflow starts the emulator), so these only guard changes when run locally.
