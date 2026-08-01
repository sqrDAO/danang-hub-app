# Restrict browser push to mobile phones
**Phase**: — · **Deps**: —

## Goal
Only supported phone browsers may register for browser push notifications. Desktop,
iPad, and Android-tablet sessions must neither be prompted nor able to enable it.

## Files
- `src/services/pushNotifications.js` (edited) — establish the mobile-phone eligibility guard.
- `src/utils/mobilePushEligibility.js` (added) - keep the safety-critical phone predicate independently testable.
- `src/contexts/AuthContext.jsx` (edited) - request logout cleanup without owning push policy.
- `src/pages/member/Profile.jsx` (edited) - hide enable/status UI on non-phones while retaining an explicit account-level off switch.
- `src/locales/en.json` (edited) — make phone-scoped push copy clear in English.
- `src/locales/vi.json` (edited) — make phone-scoped push copy clear in Vietnamese.

## Acceptance
- [x] Phone browsers remain eligible for the existing push flow.
- [x] Desktop, iPad, and Android-tablet sessions cannot register a push token.
- [x] Desktop, iPad, and Android-tablet Profile screens cannot enable push or see device status; an active singleton registration exposes only an explicit off switch.
- [x] Saving a Profile from a non-phone session preserves the existing push preference.
- [x] Logging out on desktop or tablet preserves the registered phone token.
- [x] A non-phone session with push already enabled can explicitly turn off the singleton phone registration.
- [x] UA Client Hints and the user-agent fallback must both identify a phone before destructive logout cleanup runs.
- [x] The push service owns the logout cleanup policy so every caller receives the same protection.
- [x] NOT: reset or delete existing push tokens.
- [x] NOT: change the single-token `push_tokens/{uid}` data model.

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [x] `npm test` - exit 0
- [ ] manual regression: mobile browser can still enable push from Profile and post-success prompt
