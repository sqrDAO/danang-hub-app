# Remove dead CSS selector in booking-range status panel

**Phase**: — · **Deps**: —

## Goal

Delete a CSS selector that can never match any element, left over from a markup change in
the booking-range-picker rewrite.

## Files

- `src/pages/member/Bookings.css` (edited) — in the mobile media query around lines
  415-417, remove `.booking-range-status > .btn` from the selector list, keeping
  `.booking-range-actions { width: 100%; }` (the rule that actually applies, since every
  `.btn` in `BookingRangeStatus` is a child of `.booking-range-actions`, not a direct
  child of `.booking-range-status`).

## Acceptance

- [ ] `.booking-range-status > .btn` no longer appears in `Bookings.css`.
- [ ] The mobile full-width-buttons layout for the range-status panel is visually
      unchanged (verified manually — the rule was already dead, so removing it changes
      nothing rendered).
- [ ] NOT: this does not touch `.booking-range-actions .btn` (line 420), which is the
      selector doing the actual work.

## Verify

- `npm run lint` → passes.
- `npm run build` → passes.
- Manual: open the booking modal's range-status panel at a mobile viewport width in
  `npm run dev` and confirm the "Choose again" / "Continue to Confirm" buttons still
  render full-width.
