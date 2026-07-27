# Fix browser push display + cover all high-signal alerts
**Phase**: — · **Deps**: —

## Goal
Stop Chrome’s default “site updated in the background” shell, show real
title/body/icon/link, and send browser push for every high-signal case that
already creates an in-app notification (bookings + events).

## Files
- `functions/index.js` (edited) — `webpush.notification` + guarded APP_URL; push
  for `event_pending_review` and `event_status` alongside booking types.
- `public/sw.js` (edited) — data-only show + click URL resolution.
- `src/services/pushNotifications.js` (edited) — unfocused `onMessage` +
  concurrency-safe ensure/stop.
- `src/contexts/AuthContext.jsx` (edited) — preference-driven listener lifecycle.
- `src/locales/en.json` + `src/locales/vi.json` (edited) — opt-in copy mentions events too.
- `README.md` + `docs/knowledge/data-flow.md` (edited) — push coverage docs.

## Acceptance
- [ ] Multicast push includes web display fields and a deep link.
- [ ] Background / unfocused open tab show hub icon + real title/body (not Chrome shell).
- [ ] Opted-in admins get push for `booking_pending_review` and `event_pending_review`.
- [ ] Opted-in members get push for `booking_approved` and `event_status` (approve/reject).
- [ ] Click opens the matching path: `/admin/bookings`, `/admin/events`,
  `/member/bookings`, or `/member/events`.
- [ ] Event/booking push copy is EN/VI from recipient `locale` (fallback `en`).
- [ ] NOT: multi-device token model (still single `push_tokens/{uid}`).
- [ ] NOT: waitlist / reminder / other non-inbox types.

## Verify
- `npm run lint` → exit 0
- `npm run build` → exit 0
- `cd functions && npm run lint` → exit 0
- regression: all four types still create in-app notifications
- manual: unfocused tab **and** closed window + each of the four types → system
  notification title/body/icon (not Chrome default shell) + correct click path
- manual: focused tab → no required system toast; in-app bell still works

## Notes
In-app types that get push: `booking_pending_review`, `booking_approved`,
`event_pending_review`, `event_status`. Dedupe markers use the same subject ids
as in-app docs (fixed-desk plan id; event status uses `{eventId}_{status}`).
Phase/Deps use `—` per backlog format (no phase gate; no deps).
