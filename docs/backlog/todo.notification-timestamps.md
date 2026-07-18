# Show notification timestamps in the bell panel
**Phase**: — · **Deps**: —

## Goal
Display when each unread notification was created so members can judge recency.
Normalize `createdAt` at the service boundary and render it in hub timezone.

## Files
- `src/services/notifications.js` (edited) — map Firestore `createdAt` Timestamp to `Date` on read.
- `src/utils/timezone.js` (edited) — compact hub-timezone datetime formatter for list rows.
- `src/components/NotificationBell.jsx` (edited) — render timestamp on each notification item.
- `src/components/NotificationBell.css` (edited) — style the timestamp line.
- `src/locales/en.json` (edited) — only if a visible label key is required.
- `src/locales/vi.json` (edited) — only if a visible label key is required.

## Acceptance
- [ ] Each notification row shows a created time derived from `createdAt`.
- [ ] Times are formatted in Asia/Ho_Chi_Minh using the active UI locale (EN/VI).
- [ ] Missing or invalid `createdAt` does not break the row (time simply omitted).
- [ ] `getUnreadNotifications` returns `createdAt` as a `Date` when Firestore provides a Timestamp.
- [ ] NOT: No change to mark-read, navigation, push, or notification creation.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully.
- regression: open the bell with unread items; each row shows title, body, and a timestamp.
- regression: switch language EN/VI; timestamp locale formatting updates.

## Notes
Cloud Functions already write `createdAt: FieldValue.serverTimestamp()` on create.
