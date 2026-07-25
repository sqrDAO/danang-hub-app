# Post-success push opt-in drop-in
**Phase**: — · **Deps**: —

## Goal
After a successful member booking or event create/register, follow the legacy success toast with a top drop-in soft prompt to enable browser push.
The card body is “tap to enable”; corner **×** dismisses. Stop auto-prompts after **3 ×-dismisses** (countdown alone does not count). Profile keeps long-term on/off.

## Files
- `src/services/pushNotifications.js` (edited) — `canShowPushOptInPrompt`; keep enable/disable.
- `src/components/PushOptInBanner.jsx` (new) — top drop-in: body enable, × dismiss, progress auto-close.
- `src/components/PushOptInBanner.css` (new) — slide-from-top; progress drains right → left.
- `src/utils/pushOptInPrompt.js` (new) — `promptPushOptInAfterSuccess` + dismiss count; reset on logout.
- `src/pages/member/Bookings.jsx` (edited) — schedule on single / recurring / fixed-desk create success.
- `src/pages/member/Events.jsx` (edited) — schedule on event create + register success.
- `src/App.jsx` (edited) — mount `PushOptInBanner` app-wide.
- `src/contexts/AuthContext.jsx` (edited) — reset the pending prompt on logout.
- `src/locales/en.json` (edited) — banner copy.
- `src/locales/vi.json` (edited) — banner copy.

## Acceptance
- [ ] On single booking create success, the existing success toast still shows first.
- [ ] On recurring booking create success, the existing success toast still shows first.
- [ ] On fixed-desk create success, the existing success toast still shows first.
- [ ] After booking create success toast duration + ~400ms, the drop-in may appear if eligible.
- [ ] On event create success, the existing success toast still shows first.
- [ ] On event register success, the existing success toast still shows first.
- [ ] After event create/register success toast duration + ~400ms, the drop-in may appear if eligible.
- [ ] Drop-in slides from top under the header.
- [ ] Body tap runs `enablePushNotifications`.
- [ ] Body tap success refreshes AuthContext so later successes pass `pushOptedIn=true`.
- [ ] × closes the drop-in and increments the dismiss count.
- [ ] After 3 ×-dismisses for that uid, the banner never auto-shows again in that browser.
- [ ] Countdown auto-close (~7s) does not increment the dismiss count.
- [ ] Progress bar drains right → left during the countdown.
- [ ] Banner is not shown when push is unsupported (including non-prod).
- [ ] Banner is not shown when VAPID is unset.
- [ ] Banner is not shown when Notification permission is denied.
- [ ] Banner is not shown when the user is already opted in.
- [ ] Banner is not shown when dismiss count is >= 3.
- [ ] Profile push checkbox still enables push.
- [ ] Profile push checkbox still disables push.
- [ ] `firebase/messaging` stays out of the eager entry chunk — `pushNotifications.js` is only fetched on banner tap or eligibility check.
- [ ] A failed `pushNotifications` chunk load skips the prompt and never blocks logout.
- [ ] NOT: No dev auto-preview of the drop-in on load.
- [ ] NOT: No NotificationBell CTA for push opt-in.
- [ ] NOT: No don't-show-again checkbox on the drop-in.
- [ ] NOT: No FCM path changes.

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
- Dismiss storage is best-effort: read failure → 0; write failure ignored.
- `PushOptInBanner` is mounted app-wide and therefore eager, so it and `pushOptInPrompt.js` must stay free of static `services/pushNotifications` imports — that import pulls `firebase/messaging` (~32 KB) into the entry chunk every visitor downloads. Both call sites load it dynamically instead.
- `resetPushOptInPrompt` is imported statically in `AuthContext`: `pushOptInPrompt.js` has no Firebase dependency, and a failed dynamic import inside `logout()` would throw before `signOut` ran.
