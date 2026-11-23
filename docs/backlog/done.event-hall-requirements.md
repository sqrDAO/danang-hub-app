# Event Hall requirements match the Event Guidelines
**Phase**: — · **Deps**: —

## Goal
Resolve #277: the event form still tells hosts to pay a 100,000 VND parking fee, which the published Event Guidelines (danangblockchainhub.com/event-guidelines) dropped. Show the guidelines' current Event Hall points instead, and remove unused strings that describe the old fee and deposit.

## Files
- `src/components/event/EventFormModal.jsx` (edited) — the notice lists `HALL_REQUIREMENTS` instead of the parking-fee line.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — new `memberEvents.modal.hallRequirementLuma|Setup|Fees`; unused parking-fee and deposit keys removed.
- `docs/backlog/done.event-hall-requirements.md` (new) — this spec.

## Acceptance
- [ ] The Event Hall notice no longer mentions a parking fee amount.
- [ ] It says there is no venue or parking fee and a guard tip is optional.
- [ ] It lists the Lu.ma listing with gm@sqrdao.com as host or manager.
- [ ] It lists the 30-minute setup and the 3-hour room reset.
- [ ] EN and VI carry the same keys.
- [ ] No locale string says a parking fee or an on-chain deposit is required.
- [ ] NOT: event form fields, validation or submission change.

## Verify
- `npm run lint && npm run build && npm test` → green (2 local failures that also fail on `main` aside).
- `grep -n -i "deposit\|100,000" src/locales/en.json src/locales/vi.json` → no matches.
- PR preview: Events → Create event → Event Hall notice shows the three points in EN and VI.
