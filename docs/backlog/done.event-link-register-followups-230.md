# Resolve event link and registration follow-ups
**Phase**: — · **Deps**: —

## Goal
Resolve [#230](https://github.com/sqrDAO/danang-hub-app/issues/230).
Name the destination in forwarding warnings and recheck registration against server data.

## Files
- `src/components/event/eventFields.js` (edited) — return unfamiliar destination hostname.
- `test/eventFields.test.js` (edited) — forwarding chain regressions.
- `src/pages/member/Events.jsx` (edited) — fresh registration redirect handling.
- `src/services/events.js` (edited) — explicit server read option.
- `src/utils/eventRegistrationAction.js` (new) — testable asynchronous registration decision.
- `test/eventRegistrationAction.test.js` (new) — fresh-state and failure regressions.

## Acceptance
- [ ] Forwarding cautions name the unfamiliar destination found in query hops.
- [ ] Known-only links produce no caution within the hop limit.
- [ ] Excessively deep chains remain conservatively flagged.
- [ ] Register redirects fetch server data before deciding whether to register.
- [ ] Full events do not accept a redirect registration.
- [ ] Missing, unapproved or past events do not accept redirect registration.
- [ ] A failed fresh read causes no registration write.
- [ ] Already-registered members cause no duplicate write.
- [ ] An abandoned redirect does not register after its read resolves.
- [ ] NOT: claim atomic capacity enforcement across concurrent clients.
- [ ] NOT: open an external window after an asynchronous read.

## Verify
- `node --test test/eventFields.test.js test/eventRegistrationAction.test.js` → passes.
- `npm run lint` → passes.
- `npm test` → passes.
- `npm run build` → passes.
- `npm --prefix functions run lint` → passes.
- `git diff --check` → passes.
- Fixture browser: registration redirect to full event clears action without adding an attendee.
- Fixture browser: admin link warning shows nested unfamiliar hostname.

## Notes
Keep service access outside components and preserve synchronous external-link opening.
Fresh reads reduce stale-cache decisions; capacity still has a read/write race.
