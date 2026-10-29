# Partner company aliases
**Phase**: — · **Deps**: partner-desk-auto-assign

## Goal
Let the bulk partner-assign script match members whose profile names a partner by another name. DiiD members often enter its legal name ("Công ty TNHH Phát triển Trí tuệ số"), which the script missed.

## Files
- `functions/partners.js` (edited) — `PARTNER_ALIASES`; `matchPartnerForCompany` matches a partner's name or aliases
- `functions/scripts/assign-partners-by-company.cjs` (edited) — warns when an alias key names no partner
- `src/utils/deskPlans.js` (edited) — client `normalizePartnerName` mirrors the "đ" → "d" fold
- `test/deskPlans.test.js` (edited) — alias, tie, unused-key and "đ" cases
- `README.md` (edited) — where aliases live

## Acceptance
- [ ] "Công ty Trí tuệ số", "Công ty TNHH Phát triển Trí tuệ số" and "Công ty Phát triển Trí tuệ số" match DiiD
- [ ] "Công ty Trí tuệ nhân tạo" matches no partner
- [ ] Aliases match whole words only: "Trí tuệ sống" matches no partner
- [ ] On a tie, a partner's own name beats another partner's alias, whatever the partner order
- [ ] The script prints a warning when a `PARTNER_ALIASES` key names no partner
- [ ] "Đ"/"đ" fold to "d" in both `normalizePartnerName` copies
- [ ] Existing partner-name matches are unchanged
- [ ] Partner names under 3 characters still never match
- [ ] NOT: no change to the hourly sync
- [ ] NOT: no change to `firestore.rules`
- [ ] NOT: the script stays dry-run unless `--apply` is passed

## Verify
- `npm test` → all pass, including "a partner's aliases match too" and the tie, unused-key and "đ" cases
- `cd functions && npm run lint` → clean
- `node functions/scripts/assign-partners-by-company.cjs` → dry run lists only the detached duplicate "Huỳnh Tấn Dĩnh"; the 3 Trí tuệ số members are already attached
