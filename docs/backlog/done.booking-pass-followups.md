# Booking pass follow-ups from the #156 review
**Phase**: — · **Deps**: —

## Goal
Fix the small booking-pass defects from the #156 review (issue #161): a closed pass that reopens by itself, a card that crashes without `now`, an avatar stuck on initials after one failed load, and an "Entry pass" pill whose tap area overlaps the time line and whose tap flash lingers behind the opening panel. Fixes #161.

## Files
- `src/hooks/usePassBooking.js` (new) — open-pass state; clears the id once `findPassBooking` stops matching
- `src/pages/member/Bookings.jsx` (edited) — use `usePassBooking`
- `src/pages/member/Dashboard.jsx` (edited) — same
- `src/components/BookingCard.jsx` (edited) — `now = new Date()` default
- `src/components/BookingCard.css` (edited) — pill tap area clears the time line; no tap highlight; hover border only on hover devices
- `src/components/Avatar.jsx` (edited) — retry a `src` that failed offline when the browser comes back online

## Acceptance
- [ ] An open pass closes when its booking leaves approved/checked-in
- [ ] `passBookingId` is cleared when that pass closes
- [ ] Re-approving that booking does not reopen the pass without a tap
- [ ] The pass still opens on a tap of the pill after a re-approve
- [ ] `<BookingCard>` without a `now` prop renders without throwing
- [ ] An avatar that failed to load while offline shows the photo again after an `online` event, with no reload
- [ ] NOT: an avatar that failed while online is re-requested on reconnect
- [ ] The `.btn-pass::after` tap area does not overlap `.booking-tile-time`
- [ ] The tap area stays ~44px tall
- [ ] The pill sits at the same position as on cards without a pass
- [ ] Tapping the pill on a touch screen shows no tap-highlight box
- [ ] The pill border does not stay highlighted after a tap on a touch screen
- [ ] Keyboard focus still shows the `:focus-visible` outline
- [ ] NOT: changes to the logo `alt` in `BookingPass.jsx` (see Notes)
- [ ] NOT: changes to `useHubNow` tick behavior
- [ ] NOT: changes to `BookingPass.css` palette

## Verify
- `npm run lint && npm run build && npm test` → green
- `firebase emulators:start` + `npm run dev` with `VITE_USE_EMULATORS=true`: member opens the pass on today's approved booking; admin sets it to pending → pass closes; admin re-approves → pass stays closed; tap the pill → pass opens
- DevTools → Network → Offline, reload My Bookings → avatar shows initials; switch back to Online → photo returns without reload; an expired photo URL stays on initials with no request on reconnect
- DevTools device mode (or a phone): tap the pill → no highlight box, no lingering green border behind the panel; tap just above the pill on the time line → pass does not open
- Desktop: hover the pill → green border; Tab to it → focus outline
- regression: Dashboard "Upcoming" cards open and close the pass the same way

## Notes
- Clear the id during render (`if (passBookingId && !passBooking) setPassBookingId(null)`), React's "adjust state when props change" pattern; no effect needed. It lives in a shared hook because inline it pushes `MemberBookings` past the `complexity` cap.
- Tap area: `::after` grows mostly downward (`inset: -6px -4px -14px`): 6px up meets the `.booking-tile-info` gap, 14px down meets the `.booking-tile-body` gap or card padding. No margin, so the pill doesn't shift.
- Tap flash: `-webkit-tap-highlight-color: transparent` (precedent `src/components/BottomNav.css:52`); wrap `.btn-pass:hover` in `@media (hover: hover) and (pointer: fine)` so touch screens don't keep the hover state.
- Logo alt is not translated on purpose: `common.appNameShort` is "Portal", and "Da Nang Blockchain Hub" is a proper noun, as in `Footer.jsx`.
- Skipped from #161: `useHubNow` page re-render (one cheap render a minute; a smarter tick would cost more than it saves) and `BookingPass.css` tokens (the pass is always dark and its opaque `#2F2B2C` has no matching token).
