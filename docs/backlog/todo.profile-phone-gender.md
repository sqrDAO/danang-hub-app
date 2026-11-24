# Profile: country-code phone (E.164) and optional gender
**Phase**: — · **Deps**: — · **Issue**: #297

## Goal
Phone is free text, so numbers can't be compared, searched or dialed reliably from abroad; store it as E.164 behind a dial-code picker. Add an optional, self-reported gender so the hub can report gender balance against UN SDG 5, visible only to the member and admins.

## Files
- `src/utils/phone.js` (new) — dial-code list, `normalizePhone`, `splitPhone` (legacy values too), `formatPhone`, `phoneHref`, `phoneSearchText`
- `test/phone.test.js` (new) — normalize, split, format and href cases, legacy inputs
- `src/utils/profileFields.js` (edited) — `GENDER_OPTIONS`
- `src/pages/member/Profile.jsx` (edited) — `PhoneFormField` (picker + national number), gender select, read-only rows for both
- `src/pages/member/Profile.css` (edited) — picker + input on one row
- `src/pages/admin/Members.jsx` (edited) — formatted phone, gender row
- `src/pages/admin/Events.jsx`, `src/pages/member/Events.jsx`, `src/components/event/EventRegistrantsModal.jsx` (edited) — formatted phone, E.164 `tel:` link
- `src/components/event/registrants.js` (edited) — phone search matches `+84 905…`, `0905…` and `905…`
- `firestore.rules` (edited) — owner `phone`: E.164, empty or unchanged; owner `gender`: allowed value, empty or unchanged
- `test/firestore-member-profile-fields.rules.test.js` (new) — those rules
- `src/locales/en.json`, `src/locales/vi.json` (edited) — labels, help, validation
- `README.md`, `docs/knowledge/data-flow.md` (edited) — members fields and rules

## Acceptance
- [x] Phone edit shows a dial-code select (default Vietnam +84) and a national-number input
- [x] Saving `0905 123 456` with +84 stores `+84905123456`
- [x] Pasting `+65 8123 4567` into the number input stores `+6581234567` whatever the select says
- [x] A number outside 8–15 E.164 digits, or with letters, is rejected with a toast
- [x] A legacy `0905123456` opens in the edit form as +84 / `905123456`
- [x] E.164 numbers display grouped (`+84 905 123 456`); legacy values display unchanged
- [x] Gender select offers Female / Male / Other / Prefer not to say, blank by default
- [x] Gender shows on Profile and admin member detail only
- [x] Rules reject an owner writing a non-E.164 phone or an unknown gender
- [x] Rules still accept owner writes that leave a legacy phone untouched
- [x] NOT: gender in registrant lists, event pages, MCP or any member-visible view of others
- [x] NOT: gender or phone required for profile completion
- [x] NOT: a new phone-number library dependency

## Verify
- `npm test` → phone tests pass
- `npm run test:rules` → member profile field rules pass
- `npm run lint && npm run build` → green
- `npm run dev` (local dev mode) → edit Profile: +84 / `0905 123 456` saves and shows `+84 905 123 456`; gender saves and shows
- regression: `test/registrants.test.js`, `test/profileFields.test.js`, `test/firestore-member-email.rules.test.js`

## Notes
- Gender exists for aggregate SDG 5 reporting; member docs are already owner/admin-only reads (`firestore.rules`).
- Rules compare to the stored value so legacy free-text phones don't block unrelated owner writes (locale, email sync, preferences).
