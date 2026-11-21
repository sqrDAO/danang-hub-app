# Email verification reminder
**Phase**: — · **Deps**: —

## Goal
Address #255 with a persistent reminder for signed-in users whose Auth email is unverified. Reuse the verification page without changing access gates or sending mail automatically.

## Files
- `src/components/EmailVerificationReminder.jsx` (new) — authenticated reminder and existing verification-status hook
- `src/components/Layout.jsx` (edited) — place reminder above signed-in page content
- `src/components/Layout.css` (edited) — scoped responsive reminder styling
- `src/services/emailVerification.js` (edited) — coalesce concurrent status reloads from Profile and reminder
- `src/locales/en.json`, `src/locales/vi.json` (edited) — reminder copy

- `docs/reviews/255-email-reminder.png` (new) — local Vietnamese mobile reminder screenshot

## Acceptance
- [x] Unverified Auth-email members/admins see a link to their verification screen.
- [x] Verified, signed-out and wallet-only users see no reminder.
- [x] Verification screen has no duplicate reminder.
- [x] Returning after verification removes the reminder.
- [x] Layout is keyboard accessible and usable on narrow screens in EN/VI.
- [x] NOT: new verification gates, automatic email/push, or contact-email verification claims.

## Verify
- `npm run lint`, `npm run build`, `npm test`, `npm --prefix functions run lint` pass.
- Browser fixture: optional/required unverified, verified, wallet-only, signed-out, verification-route states; focus refresh and admin/member targets.
- Check EN/VI at desktop and narrow viewport; no production records changed.

## Evidence
- Local Chrome fixture uses the real reminder, status hook and email-verification service with Auth/network stubs; no production writes or emails.
- EN/VI, 390px layout, keyboard activation, member/admin targets, verified/wallet/signed-out suppression, verification-route suppression and focus refresh passed. Concurrent refresh calls yielded one Auth reload.
- Required-route behavior is unchanged; this fixture does not replace a live signup/email-delivery test.
