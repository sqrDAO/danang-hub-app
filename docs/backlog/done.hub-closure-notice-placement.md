# Place the hub-closure notice under the page title
**Phase**: — · **Deps**: —

## Goal
Both bookings pages should read title → hub-closure banner (and admin header actions). Member only had extra space from `.page-header`'s 4rem margin between title and banner; admin rendered the banner above the title.

## Files
- `src/pages/member/Bookings.jsx` (edited) — notice inside `.page-header` after the title.
- `src/pages/admin/Bookings.jsx` (edited) — title first; banner and Assign/Approve share the next row.
- `src/styles/globals.css` (edited) — `.page-header-stacked` / `.page-header-toolbar` so the header margin sits below the banner; `.page-header .page-title` zeros leaked title margin; `.page-header-toolbar > .page-actions` keeps the actions right-aligned.
- `src/pages/admin/Bookings.css` (edited) — filters stay on their own row under the toolbar.
- `src/pages/member/Dashboard.css` (edited) — scope `.page-title` under `.member-dashboard` so its 4rem margin does not leak onto bookings.
- `src/pages/member/Dashboard.jsx` (edited) — add `.member-dashboard` on the page container.

## Acceptance
- [x] `/member/bookings` renders the page title, then HubClosureNotice, then the amenity list.
- [x] `/admin/bookings` renders the page title, then HubClosureNotice beside the header actions, then the filters.
- [x] With no active closure, `/admin/bookings` still right-aligns Assign Booking / Approve All — `HubClosureNotice` renders null and must not drag them left.
- [x] `/member/bookings` does not leave the 4rem `.page-header` gap between the title and the banner.
- [x] After visiting `/member` then `/member/bookings` or `/admin/bookings`, title-to-banner gap stays the header `gap` (1rem), not 4rem.
- [x] NOT: do not restyle the notice or change its copy.
- [x] NOT: do not add or remove the notice on any other page.

## Verify
- `npm run lint` → zero warnings.
- `npm run build` → succeeds.
- `npm run dev` → open `/member` first, then `/member/bookings` and `/admin/bookings`. Title, then banner (admin: banner + Assign/Approve All), then the list. No 4rem hole between title and banner.
- `/admin/bookings` with no closure active → Assign Booking / Approve All stay at the right edge; at ≤768px they stack full-width.

## Notes
- `.page-header` `margin-bottom: var(--spacing-lg)` belongs below the banner, not between the title and the banner.
- Title uses `flex: 1 1 100%` so the banner cannot sit on the same row as the heading.
- `Events.css` and `Amenities.css` also ship an unscoped `.page-title` margin, so the
  `.page-header .page-title` guard is load-bearing for more than the dashboard.
- Member `Dashboard.css` used a global `.page-title { margin-bottom: 4rem }`. Vite keeps that stylesheet after you leave `/member`, so the first placement pass still showed the old gap on bookings. Scope the dashboard rule and zero `.page-header .page-title` margin.
