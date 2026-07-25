# Localize the admin Amenities toasts
**Phase**: — · **Deps**: —

## Goal
`src/pages/admin/Amenities.jsx` raises 11 `showToast` calls with hardcoded English
strings while every other page routes toast copy through `t('toast.*')`. Move them onto
i18n keys so the admin surface is consistent in VI.

## Files
- `src/pages/admin/Amenities.jsx` (edited) — replace the literals at lines 89, 97, 154,
  597, 609, 612, 622, 625, 633, 641, 710 with `t('toast.*')` calls; `useAmenityPhotos`
  (line ~52) needs `t` passed in or its own `useTranslation`. Two of these interpolate
  (`file.name` at 89, `error.message` at 89 and 597) — those keys take variables.
- `src/locales/en.json` (edited) — add the `toast.*` keys.
- `src/locales/vi.json` (edited) — same keys, Vietnamese copy.

## Acceptance
- [ ] No `showToast` call in `src/pages/admin/Amenities.jsx` takes a string literal.
- [ ] `en.json` and `vi.json` have identical key sets after the change.
- [ ] Creating, updating, deleting and toggling an amenity shows a translated toast in VI.
- [ ] Both photo-upload failure toasts are translated.
- [ ] NOT: no change to toast timing, type (`success`/`error`) or trigger conditions.
- [ ] NOT: no other admin page touched.

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → as admin with VI active, create then delete an amenity; both toasts render Vietnamese
- `npm run dev` → toggle availability; toast is translated
- regression: create an amenity while a photo upload is in flight → the "wait for photos"
  guard still blocks submit and shows its (now translated) toast

## Notes
`useAmenityPhotos` (line ~52) is a plain hook, so calling `useTranslation()` inside it is
fine and avoids threading `t` through the options object.

Line numbers were refreshed against `main` after PR #31 (`4688bbd`, `a084c3b`) shifted
them; the original draft also missed two calls, hence 11 rather than 9. Grep for
`showToast(` rather than trusting the list if this sits unstarted much longer.
