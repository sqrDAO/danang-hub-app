# Select arrow position
**Phase**: — · **Deps**: —

## Goal
Keep every `select.form-field` arrow on the right, in both themes and on focus. Rules that outranked `select.form-field` used the `background` shorthand, which reset the arrow's image and position (top-left over the text in the light theme, missing on the admin Bookings filter).

## Files
- `src/styles/globals.css` (edited) — `.form-field` and `.form-field:focus` set `background-color`; the redundant light `.form-field` overrides are removed
- `src/pages/admin/Bookings.css` (edited) — `.page-filters .form-field` sets `background-color`

## Acceptance
- [ ] In the light theme, select arrows sit on the right, vertically centred
- [ ] In the dark theme, select arrows sit on the right, vertically centred
- [ ] A focused select keeps its orange arrow on the right
- [ ] The `/admin/bookings` status filter shows its arrow before focus
- [ ] Inputs and textareas keep the same background colours in both themes
- [ ] NOT: no change to any select's width

## Verify
- `npm run lint && npm run build` → green
- `npm run dev`, light and dark theme, 375px and desktop: `/admin/members` partner rows → arrow on the right
- `/admin/bookings` → status filter arrow visible before and after focus
- regression: selects on `/member/bookings`, `/member/profile` and the event form, both themes
