# Fix admin Bookings mobile layout

**Phase**: — · **Deps**: —

## Goal

On mobile PWA the admin Bookings page renders broken: filter bar and header buttons
shrink to ~70% width, zero results show a blank box, and a "Page 1 of 1" pagination
block renders as giant stacked buttons. Make the page follow the app's existing
mobile conventions.

## Files

- `src/pages/admin/Bookings.css` (edited) — style `.page-actions`; full-width
  `.page-actions`/`.page-filters` at ≤768px; compact horizontal mobile pagination;
  add `.empty-state`
- `src/pages/admin/Bookings.jsx` (edited) — empty-state message when zero results;
  render pagination only when more than one page
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `adminBookings.noBookings`

## Acceptance

- [ ] At 390px width, filter box and both header buttons span the full container width
- [ ] Zero filtered results show "No bookings match your filters." (both locales)
- [ ] Pagination does not render when totalPages ≤ 1
- [ ] At 390px, pagination (when shown) is a single horizontal row: Prev · info · Next
- [ ] Desktop (≥769px) pill filter bar and table layout unchanged
- [ ] NOT: no changes to globals.css or other admin pages (audited already responsive)

## Verify

- `npm run lint` → exit 0 (warnings ≤ 45 ratchet)
- `npm run build` → green
- `npm run dev` → DevTools 390×844 on /admin/bookings: full-width filters, empty
  state, pagination behavior; sweep /admin, /admin/members, /admin/amenities,
  /admin/events for regressions
