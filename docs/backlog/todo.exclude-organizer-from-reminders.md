# Don't remind organizers to register for their own event
**Phase**: — · **Deps**: —

## Goal
`segmentReminderRecipients` sorts every member into attendee/waitlisted/other without excluding
the event's organizer. Since organizers aren't auto-added to `attendees`, they land in "other"
and get a "spots open — register now" reminder for the event they created.

## Files
- `functions/index.js` (edited) — pass `eventData.organizerId` into `segmentReminderRecipients`
  (~line 1487) and skip it (`return`/`continue`) before segmenting, alongside the existing
  `prefs.eventReminders === false` skip.

## Acceptance
- [ ] An event's organizer receives no `event_reminder` notification or push for their own event.
- [ ] Attendees, waitlisted members, and other non-organizer members are unaffected.
- [ ] An organizer who is also an attendee of a *different* approved event in the same reminder
      window still gets reminded for that other event.
- [ ] `cd functions && npm run lint` passes.

## Verify
- `cd functions && npm run lint` → passes.
- `firebase emulators:start`, create an approved event dated ~24h out with a known organizer and
  a mix of attendees/waitlist/other members, run the reminder logic → assert no
  `notifications/{...}` doc with `userId == organizerId` and `type == 'event_reminder'` for that
  event is created.
- regression: `sendEventReminders`'s existing attendee/waitlisted copy and counts in the
  `console.log` summary line are unaffected for non-organizer members.
