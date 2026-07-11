# Auto-approve regular bookings
**Phase**: — · **Deps**: —

## Goal
Approve regular amenity bookings immediately so members can use them without admin review. Preserve the existing approval flow for member-created fixed desk plans and keep booking status UI consistent with Danang Hub tokens and localization.

## Files
- `src/services/bookings.js` (edited) — choose the default status by booking plan type
- `src/pages/member/Bookings.jsx` (edited) — render localized booking status labels
- `src/pages/member/Bookings.css` (edited) — rely on shared status badge design tokens
- `src/locales/en.json` (edited) — clarify regular and recurring booking success copy
- `src/locales/vi.json` (edited) — mirror updated booking success copy
- `README.md` (edited) — keep the canonical booking workflow description current
- `docs/knowledge/data-flow.md` (edited) — document the booking status defaults

## Acceptance
- [ ] A regular booking without an explicit status is created as `approved`.
- [ ] Recurring regular bookings are created as `approved`.
- [ ] A member-created fixed desk booking is created as `pending`.
- [ ] An admin-created fixed desk booking remains `approved`.
- [ ] Member booking cards use localized status text and shared status badge tokens.
- [ ] Members can cancel approved regular bookings.
- [ ] Fixed-desk plans remain cancellable only through the plan action.
- [ ] Event-linked bookings keep their existing cancellation flow.
- [ ] Delete remains available only for pending standalone bookings.
- [ ] NOT: Existing booking records or production data are modified.
- [ ] NOT: Event approval behavior is changed.

## Verify
- `npm run lint` → exits successfully without increasing the warning baseline
- `npm run build` → Vite production build completes successfully
- regression: inspect regular, recurring, member fixed-desk, and admin fixed-desk creation status paths
