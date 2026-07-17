# Localize browser push notification copy
**Phase**: — · **Deps**: —

## Goal
Send booking review/approval push titles and bodies in EN/VI, matching in-app
notification copy. Deferred from the booking notifications PR.

## Files
- `src/services/members.js` / profile or language switcher (edited) — store
  `locale` (`en`|`vi`) on the member doc (i18n is localStorage-only today).
- `functions/index.js` (edited) — choose push strings from recipient locale;
  fallback `en`.

## Acceptance
- [ ] Member doc has `locale` of `en` | `vi` (or under `preferences`).
- [ ] Language switch updates that field when signed in.
- [ ] Booking review/approval push uses VI when recipient locale is `vi`.
- [ ] Missing/unknown locale falls back to English.
- [ ] NOT: rework in-app notification i18n (already done).

## Verify
- `npm run lint` → exit 0
- `cd functions && npm run lint` → exit 0
- regression: member with `locale: "vi"` gets Vietnamese booking-approval push

## Notes
Functions cannot read browser localStorage, so a member-doc locale is required first.
