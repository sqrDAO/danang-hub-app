# Member dashboard layout
**Phase**: — · **Deps**: —

## Goal
Restructure `/member` so upcoming bookings and events sit first, without duplicate count cards or a hidden calendar. The month grid stays always visible, compact, and one card.

## Files
- `docs/backlog/todo.dashboard-layout.md` (new) — this spec.
- `src/pages/member/Dashboard.jsx`, `Dashboard.css` (edited) — lists first; drop Show/Hide and count cards.
- `src/components/UnifiedCalendar.jsx`, `UnifiedCalendar.css` (edited) — title inside the card; compact cells; arrow month nav; amenity-type filter only.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — drop unused show/hide and count-card keys; calendar chrome strings.
- `src/services/localDevFixtures.js` (edited) — skipauth bookings/events; Event Hall only as a linked event booking; office bookings on weekdays.
- `test/localDevFixtures.test.js` (new) — office-day walk and weekday fixture coverage.
- `README.md` (edited) — amenity-type filter; no bookings/events-only filter.

## Acceptance
- [ ] `/member` renders upcoming bookings and upcoming events above `UnifiedCalendar`.
- [ ] `/member` has no Show Calendar / Hide Calendar control and no `showCalendar` state.
- [ ] The Unified Calendar heading lives inside `.unified-calendar`, not a wrapping dashboard section.
- [ ] Month cells are shorter than the previous 120px desktop / 80px tablet / 70px phone rows.
- [ ] Prev / Next show only arrows; `aria-label` uses `calendar.prevMonth` / `calendar.nextMonth` (no glyph).
- [ ] At `max-width: 480px` a day cell shows at most one chip plus `+N more` when there are two or more items.
- [ ] Prev / Next (and Today) shrink under `max-width: 768px` and again under `480px`.
- [ ] The calendar has no All / Bookings Only / Events Only select.
- [ ] The amenity-type select remains, filters bookings only, and its `aria-label` says it filters bookings.
- [ ] Weekday headers, legend, amenity-type options, `+N more`, and chip tooltips go through i18n in both locales.
- [ ] `/member` does not render Upcoming Bookings / Upcoming Events / Available Amenities count cards.
- [ ] Skipauth Event Hall bookings set `eventId` on an approved event; pending events have no hall booking.
- [ ] Skipauth desk and meeting-room bookings fall on weekdays (Mon–Fri).
- [ ] Both locales drop `showCalendar`, `hideCalendar`, and unused count-card keys.
- [ ] NOT: do not change `BookingCalendar` or `/member/bookings` slot grid.
- [ ] NOT: do not add occupancy icons, a two-week grid, or a tap/hover day sheet.
- [ ] NOT: do not remove the admin dashboard stats row.

## Verify
- `npm run lint` → zero warnings.
- `npm test` → pass, including `test/localDevFixtures.test.js`.
- `npm run build` → succeeds.
- `npm run dev:skipauth` → `/member`: lists first, calendar below and visible; arrow month nav; amenity filter only; no count cards; gold/event days match approved events; no lone Event Hall booking without an event.
- regression: Book Now and Create Event headers still work; `/admin` stats row unchanged; `/member/bookings` slot grid unchanged.

## Notes
- Event Hall occupancy is the event (plus its linked booking). Do not seed a standalone `event-space` booking.
