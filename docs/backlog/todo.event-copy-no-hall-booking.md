# Event copy no longer mentions an Event Hall booking
**Phase**: — · **Deps**: unify-event-form

## Goal
Since #109 events never book the Event Hall, but the confirm shown when an organizer edits
an approved event still says its "Event Hall reservation will be released" (#110). Reword
the user-facing copy so nothing implies approving or editing an event books or frees the hall.

## Files
- `src/locales/en.json` (edited) — `memberEvents.confirmEditApproved` without the reservation
  clause; `adminAmenities.form.capacityHint` says "per event", not "per event booking".
- `src/locales/vi.json` (edited) — `memberEvents.confirmEditApproved` without the reservation clause.

## Acceptance
- [ ] Neither locale's `memberEvents.confirmEditApproved` mentions an Event Hall reservation.
- [ ] Both still say the event goes back for review and registration pauses until re-approved.
- [ ] No rendered locale string implies approving or editing an event books or releases the Event Hall.
- [ ] NOT: no code changes; no translation keys added, renamed or deleted.

## Verify
- `npm run lint && npm run build && npm test` → all exit 0
- `grep -n -i "reservation\|đặt Event Hall\|event booking" src/locales/en.json src/locales/vi.json` → only the
  unrendered `memberEvents.modal.hallRequirementsItem` and amenity-booking `availableAmenitiesDesc`
- `npm run dev` as a member: edit an approved event → confirm shows the new wording (EN and VI)

## Notes
`memberEvents.modal.hallRequirementsItem` ("…for each event booking") is not rendered anywhere and
was already unused before #109; left for a separate dead-key cleanup.
