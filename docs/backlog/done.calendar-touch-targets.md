# Hold 44px calendar controls and stop CSS leaks
**Phase**: — · **Deps**: dashboard-layout

## Goal
Unified Calendar nav must keep the app-wide 44px touch target. Its unscoped
`.calendar-nav` / `.calendar-title` / `.filter-select` rules must not restyle
BookingCalendar or admin filters after `/member` stays loaded.

## Files
- `docs/backlog/todo.calendar-touch-targets.md` (new) — this spec.
- `docs/backlog/todo.dashboard-layout.md` (edited) — nav stays 44px; no mobile shrink.
- `src/components/UnifiedCalendar.css` (edited) — scope shared selectors; drop
  dead `.filter-select` overrides; chips are not a pointer affordance.
- `src/services/localDevFixtures.js` (edited) — sequential `local-booking-*` ids.

## Acceptance
- [x] `.unified-calendar .calendar-nav .btn-sm` is `min-height: 44px` at every breakpoint.
- [x] `.unified-calendar .calendar-nav-arrow` is `min-width: 44px` at every breakpoint.
- [x] UnifiedCalendar.css has no unscoped `.calendar-nav`, `.calendar-title`, or `.filter-select`.
- [x] UnifiedCalendar.css does not set `.filter-select` `height` or `min-width`.
- [x] `.day-item` has no `cursor: pointer`.
- [x] Skipauth office booking ids are `local-booking-1` through `local-booking-7` with no gap.
- [x] NOT: do not shrink month-grid row heights below 68 / 56 / 48.
- [x] NOT: do not change `BookingCalendar.css` or `/member/bookings` slot grid.
- [x] NOT: do not add a day-cell click sheet.

## Verify
- `npm run lint` → zero warnings.
- `npm test` → pass, including `test/localDevFixtures.test.js`.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → `/member` at 480px: Prev/Today/Next are ≥44px; amenity
  filter matches other `.filter-select` chrome (chevron not clipped).
- regression: visit `/member` then `/member/bookings`: compact slot-grid nav
  stays at its own 36px. `/admin/bookings` filters keep their own padding.

## Notes
- `min-height: 44px` on `.form-field` / `.filter-select` already clamps the local
  `height: 36px` / `32px` rules. Drop them rather than fighting `min-height`.
- Vite does not unload Dashboard CSS. Unscoped `.filter-select` / `.calendar-title`
  would restyle admin filters and BookingCalendar labels after `/member`.
  Compact slot-grid nav is already 36px via `.booking-calendar--compact` (leave it).
