# Restrict browser push to mobile phones
**Phase**: — · **Deps**: —

## Goal
Only supported phone browsers may register for browser push notifications. Desktop,
iPad, and Android-tablet sessions must neither be prompted nor able to enable it.

## Files
- `src/services/pushNotifications.js` (edited) — establish the mobile-phone eligibility guard.
- `src/pages/member/Profile.jsx` (edited) — keep all push controls and status off non-phone profiles.
- `src/locales/en.json` (edited) — make phone-scoped push copy clear in English.
- `src/locales/vi.json` (edited) — make phone-scoped push copy clear in Vietnamese.

## Acceptance
- [x] Phone browsers remain eligible for the existing push flow.
- [x] Desktop, iPad, and Android-tablet sessions cannot register a push token.
- [x] Desktop, iPad, and Android-tablet Profile screens show no push UI or status.
- [x] Saving a Profile from a non-phone session preserves the existing push preference.
- [x] NOT: reset or delete existing push tokens.
- [x] NOT: change the single-token `push_tokens/{uid}` data model.

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [ ] manual regression: mobile browser can still enable push from Profile and post-success prompt
