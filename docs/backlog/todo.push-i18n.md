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

### Verified 2026-07-26
22 assertions run against the **real** `resolvePushLocale`, `pickPushMessage` and
`sendPushToMembers` bodies (extracted from `functions/index.js` and executed with
stubbed collaborators), all green:
- `vi` / `en` / `vi-VN` / `en_US` / `VI` all resolve correctly; missing, `null`,
  non-string and unknown (`fr`) values fall back to `en`
- `preferences.locale` is honoured; a top-level `locale` wins over it
- recipients are grouped one send per distinct locale, with unset-locale members
  landing in the English group
- `link` / `type` / `subjectId` / `tag` survive the grouping unchanged
- a payload with flat `title`/`body` and no `messages` map still sends

**Known gap (matches this spec's scope, not a defect):** the member doc's `locale` is
only written when the switcher is used. Anyone who picked VI before this ships and never
toggles again keeps `locale` unset and so receives English push until their next toggle.
Closing it means syncing i18n → member doc at login in `AuthContext`, which is outside
this spec's Files list.

## Notes
Functions cannot read browser localStorage, so a member-doc locale is required first.
