# Event detail modal (admin + member)
**Phase**: — · **Deps**: —

## Goal
Clicking an event card on `/`, `/admin/events` or `/member/events` opens a read-only modal with the event's full details. Cards currently clamp the description (line breaks lost) and have no way to see everything.

## Files
- `src/components/EventDetailModal.jsx` (new) — read-only detail modal on top of `Modal`
- `src/components/EventDetailModal.css` (new) — detail rows, banner, pre-line description, clickable-card cursor
- `src/utils/eventCardClick.js` (new) — `getCardOpenProps(onOpen)`: mouse-only whole-card click that skips inner buttons/links and text selection
- `src/components/EventTitleButton.jsx` (new) — card title as a real button that opens the modal (keyboard/screen-reader path)
- `src/components/Modal.jsx` (edited) — per-instance title id via `useId` so stacked modals don't share `modal-title`
- `src/pages/admin/Events.jsx` (edited) — admin card opens modal with admin-only rows
- `src/pages/member/Events.jsx` (edited) — my-request, upcoming and past cards open modal; capacity fallback 80 → `MAX_EVENT_CAPACITY`
- `src/pages/Home.jsx` (edited) — home upcoming and past event cards open modal (organizer shown as plain text, no host modal there)
- `src/services/localDevFixtures.js` (edited) — skipauth events get fake banners, long multi-line descriptions, hosts, linked hall and event links
- `src/locales/en.json` (edited) — `eventDetails` keys
- `src/locales/vi.json` (edited) — `eventDetails` keys

## Acceptance
- [ ] Clicking an admin event card body opens the detail modal for that event
- [ ] Clicking a member my-request, upcoming or past card body opens the detail modal for that event
- [ ] Clicking a home page upcoming or past event card body opens the detail modal for that event
- [ ] Organizer in the home page modal is plain text, not a button
- [ ] Clicking a button or link inside a card does not open the modal
- [ ] Card title is a button; Tab to it and Enter opens the modal
- [ ] Card itself has no `role` or `tabIndex`
- [ ] Selecting text on a card does not open the modal
- [ ] Card and modal use the same capacity fallback (`50`) when `capacity` is missing
- [ ] Modal shows the event link button only for `http(s)://` links
- [ ] Stacked modals have distinct title ids
- [ ] Modal description shows the full text with line breaks preserved
- [ ] Modal shows start–end time computed from `duration`
- [ ] Requested/linked venue and resubmission note appear only in the admin modal
- [ ] Rejection reason appears in the modal for rejected events
- [ ] Organizer button in the modal opens the host profile modal on top of it
- [ ] Every new string exists in both `en.json` and `vi.json`
- [ ] NOT: card layout or card styling changes
- [ ] NOT: public `/events` page changes (separate spec)
- [ ] NOT: action buttons inside the modal

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `npm run dev` → `/admin/events`: open pending + approved events; venue rows and resubmission note shown; Approve/Reject/Edit/Delete/organizer link do not open the modal; organizer in modal stacks host modal
- `npm run dev` → `/member/events`: open my request (rejected shows reason), upcoming (Register does not open modal), past; no venue rows
- `npm run dev:skipauth` → `/`: open an upcoming and a past event; Register does not open the modal; event link opens in a new tab
- regression: toggle VI locale, dark/light theme, mobile width (<768px bottom sheet)
