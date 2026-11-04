# Entry pass for the building guard + date-tile booking card
**Phase**: — · **Deps**: —

## Goal
A walk-in guest must show the building's security guard, who only glances at the phone, that they booked the hub for today. Add an entry pass panel opened from today's approved bookings, and move both member booking lists to the date-tile card it opens from (design: canvas https://claude.ai/artifact/Ho3SrfSAGY3hysqQ45n97c, sqrDES `danang-hub/DESIGN.md` v1.2.0).

## Files
- `src/utils/bookingPass.js` (new) — `canShowPass`, `splitBookings` (today / upcoming / past), `formatDurationShort`.
- `test/bookingPass.test.js` (new) — the three helpers, including a 23:30 +07:00 start (different UTC day).
- `src/components/BookingCard.jsx`, `BookingCard.css` (new) — shared card: date tile, amenity, hub-time range + short duration, status pill, pass button, `children` for actions.
- `src/components/BookingPass.jsx`, `BookingPass.css` (new) — the pass inside the existing `Modal`, slide-up panel on phones.
- `src/pages/member/Bookings.jsx`, `Bookings.css` (edited) — Today section, shared card, pass state; drop the old card and its CSS.
- `src/pages/member/Dashboard.jsx`, `Dashboard.css` (edited) — shared card with the pass; hub-time "today"; drop the old item CSS.
- `src/styles/globals.css` (edited) — `.status-badge.approved` uses the success tokens.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `bookingPass.*`, `memberBookings.today`.

## Acceptance
- [ ] `canShowPass` is true only for `approved` / `checked-in` bookings whose start is on the current hub day.
- [ ] Dashboard "My Upcoming Bookings" and every My Bookings list render the shared card.
- [ ] The date tile reads Today / day / short month for the current hub day, weekday / day / month otherwise.
- [ ] The date tile has no border or background; only its text marks it.
- [ ] A dashed tear line with a notch at the top and bottom edge splits the date from the rest of the card.
- [ ] Card actions (Cancel, Delete, Cancel day) sit right of the tear line.
- [ ] The time line reads `HH:mm – HH:mm (9h)` or `(1h30)` in hub time, 24-hour in both languages.
- [ ] Status pill text comes from `t('status.<status>')` on cards without a pass.
- [ ] Approved pills are green.
- [ ] `.status-badge.approved` is green app-wide.
- [ ] Cancel, Delete and partner-desk "Cancel day" keep their current behavior.
- [ ] My Bookings shows a "Today" section above Available Amenities, hidden when empty.
- [ ] Today holds non-cancelled bookings on the current hub day for the whole day.
- [ ] Every booking appears in exactly one of Today, Upcoming, Past.
- [ ] Dashboard "today" uses hub midnight, not browser midnight.
- [ ] On a pass-eligible card the green status pill is the "Entry pass" button, with a check and a chevron.
- [ ] A card with the pass pill is the same height as one without.
- [ ] "Entry pass" opens the pass in place on both pages; the Telegram float hides while it is open.
- [ ] The pass shows "ĐÃ ĐẶT CHỖ" + `dd/mm/yyyy` (no date tile), avatar + name, company (2-line clamp) + job title, `HH:mm – HH:mm`, the Hub logo.
- [ ] Pass card text is Vietnamese in both app languages; English app adds small glosses.
- [ ] The pass card stays dark in light theme.
- [ ] On phones the pass slides up from the bottom; no animation under `prefers-reduced-motion`.
- [ ] NOT: no `endTime` check, server refetch, live clock, QR or booking code.
- [ ] NOT: no pass for event attendees and no offline cache.
- [ ] NOT: no change to Firestore data, `firestore.rules`, Cloud Functions or fixed-desk plan cards.

## Verify
- `npm run lint && npm run build && npm test` → all green, `bookingPass` tests included
- `npm run dev`, approved desk booking today → Dashboard and My Bookings › Today show the green "Entry pass" pill; tap → pass slides up; switch to VI → pass text unchanged, English glosses gone
- a pending booking today and an approved one tomorrow → neither has the pass pill
- light theme → date text and pass pill readable, pass card stays dark
- 390px viewport → no horizontal scroll
- regression: cancel/delete a pending booking, partner-desk cancel day, the booking modal, fixed-desk plans section, admin dashboard booking list

## Notes
- Data is guaranteed: member routes sit behind `requireProfileComplete`, which needs displayName, email, company and jobTitle; read them from `useAuth().userProfile`.
- Wolgen has no Vietnamese glyphs: use it only for numerals; pass text uses `var(--font-main)`.
- Old card class names (`.booking-item`, `.booking-amenity`, …) are global and also styled by `src/pages/admin/Dashboard.css`; the new card uses its own names.
- `docs/product-vision.md` has no guest or entry-pass concept; the feature serves "Keep the space orderly".
