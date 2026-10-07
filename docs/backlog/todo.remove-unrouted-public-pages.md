# Remove the unrouted public Events and Amenities pages
**Phase**: — · **Deps**: —

## Goal
`src/pages/Events.jsx` and `src/pages/Amenities.jsx` have never had a route in `App.jsx`. They are older copies of the home page's events and amenities sections, and the weekly review (#104) mistook `/events` for a live page. Delete them and everything only they use, so dead code stops reading as live behavior.

## Files
- `src/pages/Events.jsx` (deleted) — unrouted public events page
- `src/pages/Events.css` (deleted) — imported only by `Events.jsx`
- `src/pages/Amenities.jsx` (deleted) — unrouted public amenities page
- `src/pages/Amenities.css` (deleted) — imported only by `Amenities.jsx`
- `src/locales/en.json`, `src/locales/vi.json` (edited) — drop keys only these pages used
- `docs/backlog/todo.public-events-match-view-model.md` (deleted) — review spec for a page no user can reach; replaced by this one
- `docs/knowledge/architecture.md` (edited) — resolve the "confirm dead or wire up" note
- `README.md` (edited) — drop both pages from the project structure

## Acceptance
- [ ] `src/pages/Events.jsx`, `Events.css`, `Amenities.jsx`, `Amenities.css` no longer exist
- [ ] `publicEvents` namespace is gone from both locales
- [ ] `publicAmenities` namespace is gone from both locales
- [ ] `memberEvents.{duration,attendees,hosted,eventLink,onWaitlist}` are gone from both locales
- [ ] No remaining reference in `src/` to any removed file or key
- [ ] Home page events and amenities sections render as before
- [ ] NOT: changing `OrganizerName.jsx`, `EventCard`, `EVENT_VIEWS` or any routed page
- [ ] NOT: removing services/components still used elsewhere (`getUpcomingEvents`, `getApprovedEvents`, `getAmenities`, `AuthPrompt`)

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `grep -rn "publicEvents\|publicAmenities\|pages/Events'\|pages/Amenities'" src` → no output
- `npm run dev:skipauth` → `/` shows upcoming/past events and amenities; event modal and Register work
- regression: `/member/events` and `/admin/events` load

## Notes
Keys were chosen by a script: used in the two pages, not referenced as a literal by any other `src/` file, and not under a dynamic `` `ns.${x}` `` prefix. The `organizerId` name fallback raised in #104 is real but cosmetic (events are publicly readable, and new events always carry `organizerDisplayName`); left out of scope.
