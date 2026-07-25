# Post-success push opt-in drop-in
**Phase**: — · **Deps**: —

## Goal
After a successful member booking or event create/register, follow the legacy success toast with a top drop-in soft prompt to enable browser push.
The card body is “tap to enable”; corner **×** dismisses. Stop auto-prompts after **3 ×-dismisses** (countdown alone does not count). Profile keeps long-term on/off.

## Files
- `src/services/pushNotifications.js` (edited) — `isPushConfigured`, `canShowPushOptInPrompt`; keep enable/disable.
- `src/components/PushOptInBanner.jsx` (new) — top drop-in: body enable, × dismiss, progress auto-close.
- `src/components/PushOptInBanner.css` (new) — slide-from-top; progress drains right → left.
- `src/utils/pushOptInPrompt.js` (new) — `promptPushOptInAfterSuccess` + dismiss count; reset on logout.
- `src/pages/member/Bookings.jsx` (edited) — schedule on single / recurring / fixed-desk create success.
- `src/pages/member/Events.jsx` (edited) — schedule on event create + register success.
- `src/App.jsx` (edited) — mount `PushOptInBanner` app-wide.
- `src/locales/en.json` + `vi.json` (edited) — banner copy.

## Acceptance
- [ ] On member booking create success (single, recurring, fixed-desk) success toast still shows first; after toast duration + ~400ms, drop-in may appear if eligible.
- [ ] On member event create and register success, same delayed drop-in rules apply.
- [ ] Drop-in slides from top under header; body tap runs `enablePushNotifications`; × closes and increments dismiss count.
- [ ] After 3 ×-dismisses for that uid, banner never auto-shows again in that browser.
- [ ] Countdown auto-close (~7s, progress right → left) does not increment dismiss count.
- [ ] Banner only when: prod push supported, VAPID set, permission not denied, not opted in, dismiss count &lt; 3.
- [ ] Profile push checkbox still enables/disables push.
- [ ] NOT: No dev auto-preview on load. No NotificationBell CTA. No don't-show-again checkbox. No FCM path changes.

## Verify
- `npm run lint` → zero warnings
- `npm run build` → succeeds
- regression: booking/event success toasts unchanged
- manual (prod + VAPID): book → toast → gap → drop-in → tap → permission + token
- manual: × three times across successes → no further drop-in
- manual: countdown only → later success can still show drop-in

## Notes
- Branch: `feat/push-opt-in-prompt` off `main`.
- localStorage: `pushOptInDismissCount:{uid}` integer; stop when `>= 3`.
- `isPushSupported` is prod-only; soft prompt will not appear under `npm run dev` by design (accepted — no dev preview).
- Triggers: booking create (single/recurring/fixed-desk), event create, event register — all kept.
