# Share one app-locale helper
**Phase**: — · **Deps**: —

## Goal
The `vi-VN`/`en-US` locale lookup is copied in 8 files; export one `appLocale(language)` helper from `src/utils/` and import it everywhere. Pure refactor (issue #166), no behavior change.

## Files
- `src/utils/appLocale.js` (new) — `appLocale(language)` → `'vi-VN'` for `vi*`, else `'en-US'`
- `test/appLocale.test.js` (new) — unit test for the helper
- `src/components/BookingCalendar.jsx` (edited) — use helper
- `src/components/BookingCard.jsx` (edited) — use helper, drop local `appLocale`
- `src/components/Footer.jsx` (edited) — use helper
- `src/components/NotificationBell.jsx` (edited) — use helper
- `src/components/UnifiedCalendar.jsx` (edited) — use helper
- `src/pages/admin/Bookings.jsx` (edited) — use helper
- `src/pages/admin/Dashboard.jsx` (edited) — use helper
- `src/pages/member/Bookings.jsx` (edited) — use helper, drop local `getLocale`

## Acceptance
- [ ] `appLocale` returns `'vi-VN'` for any language starting with `vi`
- [ ] `appLocale` returns `'en-US'` for any other language, including `undefined`
- [ ] `grep -rn "'vi-VN' : 'en-US'" src/` matches only `src/utils/appLocale.js`
- [ ] Dates and times render identically in EN and VI before and after
- [ ] NOT: changing the `'vi'`/`'en'` lookups in `Header.jsx`, `BookingPass.jsx` or `src/services/emailVerification.js`

## Verify
- `npm test` → `appLocale` tests pass, suite green
- `npm run lint && npm run build` → green
- `grep -rn "'vi-VN' : 'en-US'" src/` → one hit, in `src/utils/appLocale.js`
- regression: `npm run dev`, toggle EN/VI; check member Bookings, booking calendar, unified calendar, admin Dashboard + Bookings tables, notification bell times, footer version tooltip

## Notes
Takes the language string, not `i18n`, so plain helpers in `Footer.jsx` and `NotificationBell.jsx` can call it (a hook would not work there).
