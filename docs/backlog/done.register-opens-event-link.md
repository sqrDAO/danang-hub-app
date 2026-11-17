# Register opens the event link; admins get a caution on unfamiliar sites
**Phase**: — · **Deps**: — · **Issue**: #203

## Goal
Clicking Register records the registration and also opens the event's page, so members land where the event actually runs. Event links are member-entered, so admins see a caution when a link goes off the known event platforms, both before approving and before opening it.

## Files
- `src/components/event/eventFields.js` (edited) — `KNOWN_EVENT_HOSTS`, `getUnfamiliarLinkHost`, `openEventLink`; admin-only `linkCheck` field
- `src/pages/member/Events.jsx` (edited) — Register opens the link, then registers
- `src/pages/Home.jsx` (edited) — signed-in Register opens the link, then redirects to register
- `src/pages/admin/Events.jsx` (edited) — approve confirm adds a note naming an unfamiliar host
- `src/components/event/EventDetailModal.jsx` / `.css` (edited) — admin: caution line under Open event link, confirm before opening an unfamiliar site
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `adminEvents.unfamiliarLinkNote`, `eventDetails.unfamiliarSite`, `eventDetails.openUnfamiliarConfirm`
- `test/eventFields.test.js` (edited) — host check cases

## Acceptance
- [ ] Register on `/member/events` opens the event link in a new tab and registers.
- [ ] Register on `/` (signed in) opens the event link in a new tab and registers.
- [ ] The link opens with `noopener,noreferrer`.
- [ ] An event with no link, or a non-http(s) link, registers without opening anything.
- [ ] NOT: Join waitlist opens the link.
- [ ] NOT: a register coming from a URL (`?action=register`, e.g. after sign-in) opens the link; it is not a click, so the browser would block it.
- [ ] Approving an event whose link host is off `KNOWN_EVENT_HOSTS` shows only the note "the event link goes to <host>" as the confirm, without the usual approve text.
- [ ] Approving an event on a known host shows the existing confirm unchanged.
- [ ] In the admin detail modal, an unfamiliar link shows "Unfamiliar site: <host>" under Open event link.
- [ ] In the admin detail modal, opening an unfamiliar link asks first; Cancel opens nothing.
- [ ] A known-host link opens with no caution line and no confirm.
- [ ] The host shown is the parsed hostname (`https://lu.ma@evil.com` shows `evil.com`).
- [ ] `lu.ma.evil.com` and `notlu.ma` count as unfamiliar; subdomains of a known host count as known.
- [ ] NOT: members or organizers see the caution.
- [ ] NOT: an unfamiliar link is blocked anywhere.

## Verify
- `npm test` → eventFields host-check tests pass
- `npm run lint && npm run build` → green
- `npm run dev`, admin: pending event with `https://evil.xyz/e` → Approve confirm has the note; detail modal shows the caution, Open asks first
- same with `https://lu.ma/e` → plain confirm, no caution, opens directly
- member: Register on an approved event with a link → new tab opens, toast says registered
- regression: Join waitlist, Unregister, Home Register while signed out (auth prompt, no tab)
