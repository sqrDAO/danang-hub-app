# Partner company aliases
**Phase**: — · **Deps**: partner-desk-auto-assign

## Goal
Let the bulk partner-assign script match members whose profile names a partner by another name. DiiD members often enter its legal name ("Công ty TNHH Phát triển Trí tuệ số"), which the script missed.

## Files
- `functions/partners.js` (edited) — `PARTNER_ALIASES`; `matchPartnerForCompany` matches a partner's name or aliases
- `test/deskPlans.test.js` (edited) — alias cases
- `README.md` (edited) — where aliases live

## Acceptance
- [ ] "Công ty Trí tuệ số", "Công ty TNHH Phát triển Trí tuệ số" and "Công ty Phát triển Trí tuệ số" match DiiD
- [ ] "Công ty Trí tuệ nhân tạo" matches no partner
- [ ] Existing name matches, the 3-character floor and longest-match-wins are unchanged
- [ ] NOT: no change to the hourly sync, rules, or any automatic assignment; the script stays dry-run by default

## Verify
- `npm test` → all pass, including "a partner's aliases match too"
- `cd functions && npm run lint` → clean
- `node functions/scripts/assign-partners-by-company.cjs` → dry run lists only the detached duplicate "Huỳnh Tấn Dĩnh"; the 3 Trí tuệ số members are already attached
