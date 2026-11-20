# Register sends people to the event page
**Phase**: — · **Deps**: register-opens-event-link · **Issue**: #209

## Goal
An event's real sign-up lives on its own page (Luma, Facebook, a form…), and a Hub registration is only a light "I'm going". For events with a link, Register therefore always gets people to that page and says so, even signed out or when the Hub's spots are full. Unregister and Leave Waitlist are demoted, and #204's review gaps in the admin caution are closed.

## Files
- `docs/backlog/todo.register-event-page.md` (new) — this spec
- `src/components/event/eventFields.js` (edited) — `hasEventPage`; a known host whose query carries a link to another site counts as unfamiliar
- `src/pages/Home.jsx` (edited) — Register on an event with a page opens it, signed in or out, full or not
- `src/pages/member/Events.jsx`, `Events.css` (edited) — Register label and capacity rule; demoted Unregister / Leave Waitlist; event page link in the status row; `?action=register` re-checks a full event with a page
- `src/pages/admin/Events.jsx` (edited) — approve confirm keeps its approve text under the caution note
- `src/locales/en.json`, `src/locales/vi.json` (edited) — new labels; drop the two replaced button strings
- `src/services/localDevFixtures.js` (edited) — AI Agents workshop is full, to try the full-with-a-page case
- `test/eventFields.test.js` (edited) — `hasEventPage` and redirect-link cases

## Acceptance
- [ ] Signed out on `/`, Register on an event with a link opens the link in a new tab.
- [ ] Signed out on `/`, Register on an event with a link shows no sign-in prompt.
- [ ] Signed out on `/`, Register on an event without a link shows the sign-in prompt, as before.
- [ ] Register on an event with a link reads "Register on event page ↗" on `/`.
- [ ] Register on an event with a link reads "Register on event page ↗" on `/member/events`.
- [ ] Register on an event without a link keeps its current label.
- [ ] On an event with a link whose Hub spots are full, Register is enabled and opens the link.
- [ ] On an event with a link whose Hub spots are full, Register adds no attendee and no waitlist entry.
- [ ] Join Waitlist shows only on a full event without a link.
- [ ] A registered member sees "✓ Registered" and a small "Can't make it? Unregister" link instead of the full-width button.
- [ ] A waitlisted member sees "On the waitlist" and a small "Leave waitlist" link instead of the full-width button.
- [ ] On an event with a link, the registered status row also shows an "Open event page ↗" link.
- [ ] On an event with a link, the waitlist status row also shows the "Open event page ↗" link.
- [ ] On an event without a link, the status row shows no event page link.
- [ ] The Unregister and Leave waitlist links are at least 24px tall.
- [ ] Unregister still asks for confirmation first.
- [ ] The approve confirm for an unfamiliar link shows the host note followed by the usual approve text.
- [ ] A known-host link is treated as unfamiliar when a query value, followed the way a browser follows a redirect, lands on an unknown site.
- [ ] That check catches a backslash form (`/\evil.com`).
- [ ] That check catches a space-prefixed form (` https://evil.com`).
- [ ] That check catches a tab-split form (`ht%09tps://evil.com`).
- [ ] That check follows a forward through another known host (`l.facebook.com/l.php?u=` wrapping itself).
- [ ] A known-host link whose query links to another known platform is still known.
- [ ] `?action=register` on a full event with a link records nothing, even when Home's data was stale.
- [ ] A known-host link with an ordinary query string (e.g. `?utm_source=x`) is still known.
- [ ] NOT: a change to `firestore.rules` or `src/services/events.js`.
- [ ] NOT: a change to events without a link, beyond the demoted Unregister / Leave Waitlist.
- [ ] NOT: Hub registration, Unregister, capacity or the waitlist removed.

## Verify
- `npm run lint && npm run build && npm test` → all exit 0
- `npm run dev:skipauth`, `/member/events`: AI Agents workshop (full, `lu.ma`) → "Register on event page ↗", opens the link, attendee count unchanged, no Join Waitlist
- same page, Web3 Builders: "✓ Registered" with "Open event page ↗" (opens the link) and the Unregister link (≥ 24px tall) → confirm → Register on event page ↗ → link opens, registered again
- `/`: Register on AI Agents → link opens, stays on `/`
- admin Events: approve Rust & Solana (`lu.ma@phish.example`) → note, then "Approve this event?"
- signed out on the PR preview: Register on an event with a link → link opens, no sign-in prompt
- regression: Join Waitlist and Leave Waitlist on a full event without a link; admin detail modal caution

## Notes
- Capacity is enforced only by the client (`registerForEvent` and `firestore.rules` never compare it), so skipping the Hub registration for a full event needs no rules change.
- Home hands signed-in Register to `?action=register`. Home skips it for a full event with a page, and `/member/events` re-checks on fresh data because Home's list can be stale. For an event without a link, `?action=register` still has no capacity check (existing behaviour).
- `dev:skipauth` is always signed in; the signed-out case needs the PR preview or emulators.
