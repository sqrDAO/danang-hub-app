# Localized Hub times
**Phase**: — · **Deps**: —

## Goal
Resolve [#231](https://github.com/sqrDAO/danang-hub-app/issues/231): admin booking times must use Asia/Ho_Chi_Minh regardless of the device timezone. Shared event times must follow the selected app language.

## Files
- `src/utils/timezone.js` (edited) — accept a locale for event times.
- `src/pages/admin/Bookings.jsx` (edited) — format table and mobile card times in the Hub timezone.
- `src/pages/admin/Dashboard.jsx` (edited) — use Hub time for recent bookings.
- `src/components/event/eventFields.js` (edited) — localize both ends of event time ranges.
- `src/components/event/EventCard.jsx` (edited) — pass the active locale.
- `src/components/event/EventDetailModal.jsx` (edited) — pass the active locale.
- `test/timezone.test.js` (edited) — cover localized time near Hub midnight outside Vietnam.
- `test/eventFields.test.js` (edited) — cover localized event ranges and missing duration.

## Acceptance
- [ ] Admin booking table times use the Hub timezone.
- [ ] Admin mobile booking card times use the Hub timezone.
- [ ] Dashboard recent booking times use the Hub timezone.
- [ ] Event cards reflect the selected app language.
- [ ] Event detail time ranges reflect the selected app language.
- [ ] English event times retain their existing 12-hour display.
- [ ] Vietnamese event times use the locale's 24-hour display.
- [ ] NOT: alter stored dates, scheduling, or registration behavior.

## Verify
- `node --test test/timezone.test.js test/eventFields.test.js` → pass with the timezone suite running outside Vietnam.
- `npm run lint` → no warnings or errors.
- `npm test` → no failures.
- `npm run build` → production build succeeds.
- `cd functions && npm run lint` → no errors.
- Manual fixture browser: switch EN/VI on admin Dashboard and Bookings; inspect mobile booking cards and event cards/details, confirming Hub times and locale changes.

## Notes
- Keep existing Intl formatting; this is display-only and needs no scheduling API or polyfill.
