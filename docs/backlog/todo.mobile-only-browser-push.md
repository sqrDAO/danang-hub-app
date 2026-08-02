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
- [x] Desktop, iPad, and Android-tablet Profile screens cannot enable push notifications.
- [x] Desktop, iPad, and Android-tablet Profile screens cannot see phone device push status.
- [x] A non-phone session where push is already enabled shows an explicit opt-out control for the active singleton registration.
- [x] Saving a Profile from a non-phone session preserves the existing push preference.
- [x] Automatic logout cleanup on non-phone sessions does not delete `push_tokens/{uid}` or clear the account push preference.
- [x] Explicit opt-out from a non-phone session does delete the active singleton registration on `push_tokens/{uid}`.
- [x] UA Client Hints and the user-agent fallback must both identify a phone before destructive logout cleanup runs.
- [x] The push service owns the logout cleanup policy so every caller receives the same protection.
- [x] NOT: reset or delete existing push tokens on automatic logout from any session type.
- [x] NOT: change the single-token `push_tokens/{uid}` data model.

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [x] `npm test` - exit 0
- [ ] manual regression: mobile browser can still enable push from Profile and post-success prompt
