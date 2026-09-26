# Event organizers: drop dead "hosting project" lookup
**Phase**: — · **Deps**: —

## Goal
`event.hostingProjects` has always been a free-text string of the organizations hosting an event, but six render helpers still carry a never-used branch that maps it as an array of `projects` doc IDs, and four pages fetch the `projects` collection only to feed that branch. Remove the dead lookup and relabel the form so the field reads as "hosting organizations" everywhere, without touching stored data.

## Files
- `src/pages/Home.jsx` (edited) — drop `getHostingProjectsLabel` array branch and the `['projects']` query; render the string
- `src/pages/Events.jsx` (edited) — same for `getHostingProjectsLabel` / `HostingProjectsLine`
- `src/pages/member/Events.jsx` (edited) — same for `getHostNames` / `HostedProjectsLine`; stop threading `projects` props
- `src/pages/admin/Events.jsx` (edited) — same for `EventHostingRow` and `HostingProjectsField` default value; stop threading `projects` props
- `src/components/EventDetailModal.jsx` (edited) — drop `getHostNames` array branch and the `projects` prop
- `src/services/projects.js` (deleted) — read-only service with no remaining caller
- `src/services/localDevStore.js` (edited) — drop `projects` store, `listLocalProjects`, `getLocalProject`
- `src/services/localDevFixtures.js` (edited) — drop `buildLocalDevProjects`
- `src/locales/en.json` (edited) — relabel `adminEvents.modal.hosting*` and `memberEvents.modal.hostingProjects*` values
- `src/locales/vi.json` (edited) — same keys, VI values
- `README.md` (edited) — feature bullets, project-structure tree, `projects` collection row
- `docs/product-vision.md` (edited) — drop "projects showcase" wording
- `docs/knowledge/data-flow.md` (edited) — `projects` rows marked legacy / unused by the client

## Acceptance
- [ ] No file under `src/` imports `services/projects`
- [ ] No component runs a `['projects']` React Query
- [ ] No render path calls `.map` on `event.hostingProjects`
- [ ] Event cards on `/`, `/events`, `/member/events`, `/admin/events` still show "Hosted by: <string>" when `hostingProjects` is set
- [ ] Event cards show no "Hosted by" line when `hostingProjects` is empty
- [ ] Event detail modal still shows the "Hosted by" row from the string
- [ ] Admin edit form pre-fills the existing `hostingProjects` string
- [ ] EN form label reads "Hosting organization(s)"
- [ ] EN form placeholder reads "e.g., Superteam VN, Solana Vietnam"
- [ ] VI form label reads "Đơn vị tổ chức"
- [ ] VI form placeholder reads "vd: Superteam VN, Solana Vietnam"
- [ ] Creating or editing an event still saves `hostingProjects` as a trimmed string
- [ ] NOT: renaming the Firestore field `hostingProjects`
- [ ] NOT: changes to `functions/eventLifecycle.js` or any Cloud Function
- [ ] NOT: changes to `firestore.rules` or to data in the `projects` collection
- [ ] NOT: renaming i18n keys or CSS classes (`event-projects`, `event-preview-projects`)

## Verify
- `grep -rn "services/projects\|\['projects'\]\|hostingProjects.map" src` → no matches
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `npm run dev:skipauth` → `/`, `/events`, `/member/events`, `/admin/events`: fixture events show "Hosted by: SuperteamVN, PayStream Protocol" etc.; detail modal shows the same
- `npm run dev:skipauth` → admin edit an event: organizer field pre-filled; save; card shows the new text
- regression: toggle VI locale; create a new member event request with and without organizers

## Notes
- No writer has ever stored an array: both forms use `<input type="text">` and trim it into a string before `src/services/events.js` writes it, and the `editOwnEvent` callable validates it with `asOptionalString` (`functions/eventLifecycle.js`). The array branch dates from `3f01b78` and never had a producer, so no data migration is needed.
- The array branch looked up `project.name`, but project fixtures use `title`, so it would have rendered raw IDs even if reached.
- `firestore.rules` `match /projects/{projectId}` and any production docs in `projects` are left in place on purpose (no DB-side changes). Drop them in a follow-up once someone confirms the collection holds nothing needed.
- Option B (not in scope): rename the field to `hostOrganizations`. That needs a one-off migration script in `functions/` (like `migrate-bookings-hours.js`), a callable allowlist change in `functions/eventLifecycle.js`, and a transition window where reads accept both keys. The gain is naming only, so it is deferred.
