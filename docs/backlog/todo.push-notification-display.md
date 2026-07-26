# Fix browser push notification display copy
**Phase**: — · **Deps**: —

## Goal
Stop Chrome’s default “This site has been updated in the background” push shell.
Show the real booking title/body, hub icon, and deep-link on click — including
when a tab is open but unfocused.

## Files
- `functions/index.js` (edited) — include `webpush.notification` + `fcmOptions.link`
  when multicasting so the browser always has displayable content.
- `public/sw.js` (edited) — show notification only for data-only payloads; resolve
  click URL from custom `data.url` or FCM payload; keep hub icon/badge.
- `src/services/pushNotifications.js` (edited) — register `onMessage` and show a
  system notification when the document is not focused; concurrency-safe ensure/stop.
- `src/contexts/AuthContext.jsx` (edited) — ensure/stop foreground listener from
  the push preference for already-opted-in sessions.

## Acceptance
- [ ] Multicast push includes web display fields (`title`, `body`, `icon`) and a link.
- [ ] Background push shows app title/body and hub icon, not Chrome’s default shell.
- [ ] Clicking a push opens the payload link (`/admin/bookings` or `/member/bookings`).
- [ ] With an open unfocused tab, a system notification still shows custom title/body.
- [ ] NOT: change who receives push or which booking events trigger it.
- [ ] NOT: implement push i18n (still `todo.push-i18n.md`).

## Verify
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `cd functions && npm run lint` → exit 0
- regression: booking review/approval still create in-app notifications as before
- manual: trigger a booking push with the tab unfocused → custom title/body + icon

## Notes
Data-only FCM + no client `onMessage` is why Chrome injects its default copy when
a visible client exists. Server webpush display + client unfocused `onMessage`
covers both paths; SW must not double-show when FCM already displayed a
`notification` payload.
