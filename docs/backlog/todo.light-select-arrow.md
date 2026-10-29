# Light theme select arrow
**Phase**: — · **Deps**: —

## Goal
In the light theme every `select.form-field` drew its dropdown arrow in the top-left corner, over the text, instead of on the right. The light `.form-field` rules used the `background` shorthand, which outranks `select.form-field` and resets its arrow position.

## Files
- `src/styles/globals.css` (edited) — light `.form-field` and `.form-field:focus` set `background-color` instead of `background`

## Acceptance
- [ ] In the light theme, select arrows sit right-aligned and vertically centred
- [ ] In the light theme, a focused select keeps its orange arrow on the right
- [ ] Light-theme inputs and textareas keep the same background colours
- [ ] NOT: no change to the dark theme

## Verify
- `npm run lint && npm run build` → green
- `npm run dev`, light theme, `/admin/members` Partner organizations at 375px wide → desk picker arrow on the right
- regression: light theme selects on `/member/bookings`, `/admin/bookings`, `/member/profile`, the event form
