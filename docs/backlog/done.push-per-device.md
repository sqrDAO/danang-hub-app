# Push tokens per phone, on/off per phone
**Phase**: — · **Deps**: —

## Goal
Each member keeps one push token per phone, so every phone that turned notifications on receives them, and switching off or logging out on one phone never silences the others (#141). Members move off the single legacy token without anyone getting push they don't get today.

## Files
- `firestore.rules` (edited) · `test/firestore-push-tokens.rules.test.js` (new) — owner-only, write-only `push_tokens/{uid}/devices/{deviceId}` with field checks; legacy rule kept
- `functions/pushTokens.js` (new) · `test/pushTokens.test.js` (new) — pure helpers: dedupe tokens, settle per-member markers
- `functions/index.js` (edited) — preference-on members get every device token plus the legacy doc; per-doc stale cleanup
- `src/utils/pushDeviceOptIn.js` (edited) · `test/pushDeviceOptIn.test.js` (edited) — per-phone id, marker change event, launch decisions
- `src/services/pushNotifications.js`, `src/services/members.js` (edited) — save/remove this phone's device doc; delete the legacy doc; logout cleans up this phone only; `updateMemberPreferences` handles local dev mode
- `src/utils/pushOptInPrompt.js`, `src/components/PushOptInBanner.jsx`, `src/pages/member/Bookings.jsx`, `src/pages/member/Events.jsx`, `src/contexts/AuthContext.jsx` (edited) — prompt keys on this phone; logout cleanup on every push-eligible phone; listener gated on this phone
- `src/pages/member/Profile.jsx`, `src/pages/member/Profile.css` (edited) — switch shows this phone and follows marker changes; desktop note
- `src/locales/en.json`, `src/locales/vi.json`, `README.md`, `docs/knowledge/data-flow.md` (edited) — desktop note, drop registered-phone keys; `push_tokens` shape and routing

## Acceptance
- [ ] A member who turned notifications on for two phones gets each push on both
- [ ] A token stored in two entries is sent once
- [ ] A member whose `preferences.pushNotifications` is not true gets no push and costs no token reads
- [ ] A member whose token sits only in the legacy doc keeps receiving push after the deploy
- [ ] A dead token deletes every entry whose stored token equals it
- [ ] The dedupe marker is kept when any of a member's phones succeeded, across all send batches
- [ ] The dedupe marker is released when every one of a member's phones failed or went unsent
- [ ] A failed marker write does not replace the send error
- [ ] Turning a phone on sets `preferences.pushNotifications` to true
- [ ] Turning a phone on deletes the legacy `push_tokens/{uid}` doc after its device doc lands
- [ ] Enabling fails with an error when this phone can't store its device id
- [ ] With the preference off, launch marks an opted-in phone opted out and writes nothing
- [ ] With the preference on, launch re-issues an opted-in phone's device doc
- [ ] Launch deletes the legacy doc only after the device doc lands
- [ ] An adopted phone starts the foreground listener in the same session it is adopted
- [ ] Turning notifications off on phone A stops push on phone A only
- [ ] Turning a phone off deletes its device doc and the legacy doc
- [ ] A turn-off whose delete fails leaves the phone marked on, so the switch shows On and saving again retries
- [ ] A new token on this phone is requested only after its pending browser-token revoke settles
- [ ] Logging out on phone A deletes only phone A's device doc
- [ ] Logging out deletes the legacy doc only when this phone has notification permission
- [ ] Logging out keeps phone A's opt-in, so logging back in re-registers it without a permission prompt
- [ ] Logout cleanup runs on every push-eligible phone, whatever its marker says
- [ ] Logout does not wait for the browser token revoke before signing out
- [ ] Turning off or logging out skips the browser token revoke while another account on this phone is opted in
- [ ] Logout on a phone with no device id creates none
- [ ] A refused cleanup step does not skip the other
- [ ] Profile's switch shows on for an opted-in phone and for a phone launch would adopt
- [ ] Profile's switch, in the edit form until touched, follows marker changes made after the page opened
- [ ] A Profile save with the switch untouched never turns this phone off
- [ ] Saving with the switch On registers a phone that shows On but has no device doc yet
- [ ] A save with the switch untouched still saves the profile fields when registering this phone fails
- [ ] Profile save writes only `preferences.emailNotifications` and `preferences.eventReminders`, never `preferences.pushNotifications`
- [ ] On desktop, Profile shows a note that notifications are managed on each phone, with no switch
- [ ] The after-success opt-in prompt shows on any phone that isn't opted in, even if another phone is
- [ ] An owner can create their own device doc
- [ ] An owner can update their own device doc
- [ ] An owner can delete their own device doc
- [ ] An owner cannot write another member's device docs
- [ ] An owner can delete their own legacy `push_tokens/{uid}` doc
- [ ] No client can read any device doc, including their own
- [ ] A device doc with keys other than `token`, `platform`, `updatedAt` is refused
- [ ] A device doc whose `token` is not a 1–4096 character string is refused
- [ ] A device doc whose `platform` is not `'web'` is refused
- [ ] A device doc whose `updatedAt` is not a string is refused
- [ ] NOT: the app writes `preferences.pushNotifications` false
- [ ] NOT: the app writes `push_tokens/{uid}` (delete only)
- [ ] NOT: a migration script, server-side legacy deletes, or a cap on phones per member

## Verify
- `npm run lint && npm run build && npm test` and `cd functions && npm run lint` → green, including `test/pushTokens.test.js` and `test/pushDeviceOptIn.test.js`
- `npm run test:rules` → green, including `test/firestore-push-tokens.rules.test.js`
- `npm run dev`, Profile, mobile viewport → one per-phone switch; desktop → the note
- post-deploy (human): enable on two phones, approve a booking → both buzz; turn one off → only the other buzzes; log out and back in on one → it buzzes again, no prompt; `firebase functions:log` → "Push batch sent" `attempted` counts tokens
- regression: stale-token cleanup, launch refresh, fixed-desk grouped push (one push per plan)

## Notes
- Migration rule: nobody gets push they don't get today. The app never writes the preference false, so false only means an opt-out (or an old logout) from before this change; launch turns such a phone off, and the member turns phones back on one by one.
- The legacy doc is deleted once any of the member's phones writes its device doc, turns off or logs out. A legacy-only phone that hasn't opened the app since then gets nothing until it does (accepted: before, only one phone received anyway). This also silences sold or forgotten phones.
- Deploy order is Hosting → rules → Functions. For a few minutes the old rules refuse device-doc writes, so the legacy doc is deleted only after a device write lands.
- FCM tokens are per browser, not per account. The revoke is best effort (once no doc holds a token, nothing sends to it), skipped while another account here is opted in, not awaited on logout, and awaited before a new token since FCM can return the same one. `shouldAdoptLegacyOptIn` is unchanged; a phone shared between accounts may adopt the other account (already true today; accepted).
- Device id: random, localStorage `pushDeviceId`, per phone (not per uid), kept across logouts. Can't be stored → enable throws `PUSH_DISABLED_MESSAGE`.
- Overrides `done.mobile-only-browser-push.md`: the desktop opt-out control is gone. An old cached build can still write the preference false on logout once; that member turns each phone back on.
