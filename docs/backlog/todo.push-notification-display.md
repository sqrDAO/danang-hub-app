# Fix browser push display + cover all high-signal alerts
**Phase**: — · **Deps**: —

## Goal
Stop Chrome’s default “site updated in the background” shell, show real
title/body/icon/link, and send browser push for every high-signal case that
already creates an in-app notification (bookings + events).

## Files
- `functions/index.js` (edited) — `webpush.notification` + origin APP_URL;
  relative `fcmOptions.link`; push for event review/status; single member read.
- `public/sw.js` (edited) — claim `notificationclick` before Firebase SDK;
  path-aware open/focus; data-only show when no notification payload.
- `src/services/pushNotifications.js` (edited) — unfocused `onMessage`,
  peer-focus skip, locks-based single shower, concurrency-safe ensure/stop.
- `src/contexts/AuthContext.jsx` (edited) — preference-driven listener lifecycle.
- `src/locales/en.json` + `src/locales/vi.json` (edited) — opt-in copy mentions events too.
- `README.md` + `docs/knowledge/data-flow.md` (edited) — push coverage docs.

## Acceptance
- [x] Multicast push includes web display fields and a deep link.
- [x] Background / unfocused open tab show hub icon + real title/body (not Chrome shell).
- [x] Opted-in admins get push for `booking_pending_review` and `event_pending_review`.
- [x] Opted-in members get push for `booking_approved` and `event_status` (approve/reject).
- [x] Click opens the matching path (`/admin/*` or `/member/*`) even when a hub
  tab is already open on another route (app handler wins over Firebase SDK).
- [x] Event/booking push copy is EN/VI from recipient `locale` (fallback `en`).
- [x] With one focused and one unfocused tab, no system toast from the unfocused path.
- [x] NOT: multi-device token model (still single `push_tokens/{uid}`).
- [x] NOT: waitlist / reminder / other non-inbox types.

## Verify
- [x] `npm run lint` → exit 0
- [x] `npm run build` → exit 0
- [x] `cd functions && npm run lint` → exit 0
- [x] regression: all four types still create in-app notifications; event-status email still sends
- [ ] manual: unfocused tab **and** closed window + each of the four types → system
  notification title/body/icon (not Chrome default shell) + correct click path
- [ ] manual: hub tab open on another route → click still navigates to deep link
- [ ] manual: focused tab → no required system toast; in-app bell still works
- [ ] manual: two tabs (A focused, B not) → no toast while using A

## Notes
In-app types that get push: `booking_pending_review`, `booking_approved`,
`event_pending_review`, `event_status`. Dedupe markers use the same subject ids
as in-app docs (fixed-desk plan id; event status uses `{eventId}_{status}`).
Phase/Deps use `—` per backlog format (no phase gate; no deps).
SW must register `notificationclick` before `getMessaging` so FCM cannot
`stopImmediatePropagation` with host-only focus.
