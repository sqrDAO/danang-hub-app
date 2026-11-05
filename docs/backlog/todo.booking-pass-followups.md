# Booking pass follow-ups from the #156 review
**Phase**: — · **Deps**: —

## Goal
Fix the small booking-pass defects from the #156 review (issue #161): a closed pass that reopens by itself, a card that crashes without `now`, an avatar stuck on initials after one failed load, and an "Entry pass" pill whose tap area overlaps the time line and whose tap flash lingers behind the opening panel. Fixes #161.

## Files
- `src/pages/member/Bookings.jsx` (edited) — clear `passBookingId` once `findPassBooking` stops matching
- `src/pages/member/Dashboard.jsx` (edited) — same
- `src/components/BookingCard.jsx` (edited) — `now = new Date()` default
- `src/components/BookingCard.css` (edited) — pill clears the time line; no tap highlight; hover border only on hover devices
- `src/components/Avatar.jsx` (edited) — retry a failed `src` when the browser comes back online

## Acceptance
- [ ] An open pass whose booking leaves approved/checked-in closes and clears `passBookingId`
- [ ] Re-approving that booking does not reopen the pass without a tap
- [ ] The pass still opens on a tap of the pill after a re-approve
- [ ] `<BookingCard>` without a `now` prop renders without throwing
- [ ] An avatar that failed to load shows the photo again after an `online` event, with no reload
- [ ] The `.btn-pass::after` tap area does not overlap `.booking-tile-time`
- [ ] The tap area stays ~44px tall
- [ ] Tapping the pill on a touch screen shows no tap-highlight box
- [ ] The pill border does not stay highlighted after a tap on a touch screen
- [ ] Keyboard focus still shows the `:focus-visible` outline
- [ ] NOT: changes to the logo `alt` in `BookingPass.jsx` (see Notes)
- [ ] NOT: changes to `useHubNow` tick behavior
- [ ] NOT: changes to `BookingPass.css` palette

## Verify
- `npm run lint && npm run build && npm test` → green
- `firebase emulators:start` + `npm run dev` with `VITE_USE_EMULATORS=true`: member opens the pass on today's approved booking; admin sets it to pending → pass closes; admin re-approves → pass stays closed; tap the pill → pass opens
- DevTools → Network → Offline, reload My Bookings → avatar shows initials; switch back to Online → photo returns without reload
- DevTools device mode (or a phone): tap the pill → no highlight box, no lingering green border behind the panel; tap just above the pill on the time line → pass does not open
- Desktop: hover the pill → green border; Tab to it → focus outline
- regression: Dashboard "Upcoming" cards open and close the pass the same way

## Notes
- Clear the id during render (`if (passBookingId && !passBooking) setPassBookingId(null)`), React's "adjust state when props change" pattern; no effect needed.
- Tap area: `.booking-tile-info` has `gap: 6px` and `::after` extends 10px up, so a `margin-top: 4px` on `.btn-pass` clears the time line while keeping the 44px target.
- Tap flash: `-webkit-tap-highlight-color: transparent` (precedent `src/components/BottomNav.css:52`); wrap `.btn-pass:hover` in `@media (hover: hover)` so touch screens don't keep the hover state.
- Logo alt is not translated on purpose: `common.appNameShort` is "Portal", and "Da Nang Blockchain Hub" is a proper noun, as in `Footer.jsx`.
- Skipped from #161: `useHubNow` page re-render (one cheap render a minute; a smarter tick would cost more than it saves) and `BookingPass.css` tokens (the pass is always dark and its opaque `#2F2B2C` has no matching token).
