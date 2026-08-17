# Remove the dead dev:booking script and its stale spec
**Phase**: — · **Deps**: —

## Goal
The local-booking preview mode this spec describes was implemented in `5bfaf3f` and fully
reverted six commits later in `876d869` (per-day amenity availability fix), which deleted
`src/utils/localBookingMode.js` and its `App.jsx`/`Bookings.jsx` wiring. The `dev:booking` npm
script is now a no-op, and the spec describing the removed feature is still open. Remove both.

## Files
- `package.json` (edited) — delete the `"dev:booking": "vite --mode booking"` script.
- `docs/backlog/todo.local-booking-dev.md` (deleted) — the feature it describes no longer exists
  in the codebase; nothing to rename to `done.*` since it was reverted, not shipped.

## Acceptance
- [ ] `package.json` has no `dev:booking` script.
- [ ] `docs/backlog/todo.local-booking-dev.md` no longer exists.
- [ ] `grep -r "MODE === 'booking'" src/` returns no matches (confirms nothing else depended on
      the removed mode).
- [ ] NOT: do not re-implement the local booking preview feature — this spec is about removing
      dead references, not restoring the reverted functionality.

## Verify
- `npm run lint` → passes.
- `npm run build` → passes.
- `grep -n "dev:booking" package.json` → no output.
- `ls docs/backlog/todo.local-booking-dev.md` → "No such file or directory".

## Notes
If the local booking preview mode is still wanted, that's a product decision for a fresh spec
written against the current `BookingCalendar.jsx`/`Bookings.jsx`, not a revival of this one —
too much has changed underneath it (the booking range picker rewrite, per-day availability) for
the original implementation to still apply.
