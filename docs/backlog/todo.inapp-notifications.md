# In-app notification center
**Phase**: — · **Deps**: —

## Goal
Provide a persistent, app-wide inbox for booking states and new event review requests.
Give members and admins localized messages with an appropriate route for each notification type.

## Files
- `src/services/notifications.js` (edited) — list, read, and bulk-read notification access through the service layer.
- `src/components/NotificationBell.jsx` (new) — authenticated notification trigger and inbox panel.
- `src/components/NotificationBell.css` (new) — token-based notification panel layout.
- `src/components/Header.jsx` (edited) — place the bell in the authenticated header.
- `src/pages/member/Events.jsx` (edited) — remove the page-specific unread-notification toast and auto-read effect.
- `src/locales/en.json` (edited) — English notification labels and booking/admin review copy.
- `src/locales/vi.json` (edited) — Vietnamese notification labels and booking/admin review copy.
- `functions/index.js` (edited) — create in-app notifications for new event review requests, booking review, and booking approval.
- `README.md` (edited) — document notification-producing Cloud Functions.
- `docs/knowledge/data-flow.md` (edited) — trace the notification lifecycle and recipient rules.

## Acceptance
- [ ] An authenticated member sees an unread count and notification panel from the header on every authenticated page.
- [ ] The panel lists unread notifications in newest-first order and renders an EN/VI message for every supported notification type.
- [ ] Opening a notification marks only that notification as read and navigates to its member or admin destination.
- [ ] The panel can mark all currently unread notifications as read.
- [ ] Admins receive one in-app notification for each pending event or booking review, with fixed-desk requests grouped by plan.
- [ ] Members receive in-app notifications when a booking is approved, including auto-approved bookings.
- [ ] NOT: This task does not add FCM, browser permissions, push delivery, or notifications for a member cancelling their own booking.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully.
- `cd functions && npm run lint` → exits successfully with zero warnings.
- regression: new event review, booking review, and booking approval create one recipient-visible notification each.
- regression: a fixed-desk plan produces one admin review notification and one member approval notification per plan, not per day.

## Notes
Existing `notifications` documents are Cloud-Function-written and member-readable; clients may update only `read`.
Notification document IDs are deterministic for grouped plans and scheduled reminders, so trigger retries do not create duplicates.
