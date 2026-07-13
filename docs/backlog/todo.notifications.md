# Booking notification center
**Phase**: — · **Deps**: —

## Goal
Provide a persistent, app-wide notification center for booking work and new event review requests.
Use in-app notifications as the source of truth, with opt-in browser push for high-signal booking alerts.

## Files
- `src/services/notifications.js` (edited) — list, read, and bulk-read notification access through the service layer.
- `src/components/NotificationBell.jsx` (new) — authenticated notification trigger and inbox panel.
- `src/components/NotificationBell.css` (new) — token-based notification panel layout.
- `src/components/Header.jsx` (edited) — place the bell in the authenticated header.
- `src/pages/member/Events.jsx` (edited) — remove the page-specific unread-notification toast and auto-read effect.
- `src/services/pushNotifications.js` (new) — browser push token registration and cleanup helpers.
- `src/services/firebaseConfig.js` (new) — shared Firebase config for the app and service worker.
- `src/pages/member/Profile.jsx` (edited) — browser push opt-in/out UI in member preferences.
- `src/pages/member/Profile.css` (edited) — helper text styling for the push preference.
- `src/contexts/AuthContext.jsx` (edited) — hydrate push settings when a member signs in.
- `src/services/members.js` (edited) — persist the push preference in the member document.
- `src/main.jsx` (edited) — register the production service worker.
- `vite.config.js` (edited) — switch the PWA build to injectManifest.
- `public/sw.js` (new) — background push handling for the web app and Workbox caching.
- `firestore.rules` (edited) — allow owner-only push token writes without client reads.
- `.env.example` (edited) — add the web push public key variable.
- `src/locales/en.json` (edited) — English notification labels and booking/admin review copy.
- `src/locales/vi.json` (edited) — Vietnamese notification labels and booking/admin review copy.
- `functions/index.js` (edited) — create in-app notifications and send scoped booking push alerts.
- `README.md` (edited) — document notification-producing Cloud Functions, push setup, and collections.
- `docs/knowledge/data-flow.md` (edited) — trace notification lifecycle, recipient rules, and push delivery.

## Acceptance
- [ ] An authenticated member sees an unread count and notification panel from the header on every authenticated page.
- [ ] The panel lists unread notifications in newest-first order and renders an EN/VI message for every supported notification type.
- [ ] Opening a notification marks only that notification as read and navigates to its member or admin destination.
- [ ] The panel can mark all currently unread notifications as read.
- [ ] Admins receive one in-app notification for each pending event or booking review, with fixed-desk requests grouped by plan.
- [ ] Members receive in-app notifications when a booking is approved, including auto-approved bookings.
- [ ] A signed-in member can opt into and disable browser push notifications from the profile page.
- [ ] The app stores browser push tokens without exposing them through member profile reads.
- [ ] Booking review notifications reach opted-in admins as browser push.
- [ ] Booking approval notifications reach opted-in members as browser push.
- [ ] NOT: Browser push is limited to `booking_pending_review` and `booking_approved`.
- [ ] NOT: A member cancelling their own booking does not receive a notification.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully.
- `cd functions && npm run lint` → exits successfully with zero warnings.
- regression: new event review, booking review, and booking approval create one recipient-visible notification each.
- regression: a fixed-desk plan produces one admin review notification and one member approval notification per plan, not per day.

## Notes
Existing `notifications` documents are Cloud-Function-written and member-readable; clients may update only `read`.
Notification document IDs are deterministic for grouped plans, so trigger retries do not create duplicates.
Browser push requires the project owner to configure `VITE_FIREBASE_VAPID_KEY` before production push can be enabled.
