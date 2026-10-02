# Remove the unused projects lookup for event hosts
**Phase**: — · **Deps**: event-organizers-cleanup

## Goal
`event.hostingProjects` holds free-text hosting organization names (agreed in PR #92), but three helpers still treat it as a possible array of project IDs and six pages fetch the whole `projects` collection only to feed them. Remove that dead lookup so host names render straight from the string and those pages stop reading `projects`.

## Files
- `src/components/event/eventFields.js` (edited) — `getHostNames` drops the array branch and the `projects` param
- `src/components/event/EventCard.jsx` (edited) — drop the `projects` prop
- `src/components/event/EventDetailModal.jsx` (edited) — drop the `projects` prop
- `src/pages/Events.jsx` (edited) — delete `getHostingProjectsLabel`; drop the `['projects']` query and `projects` props
- `src/pages/Home.jsx` (edited) — drop the `['projects']` query and `projects` props
- `src/pages/member/Events.jsx` (edited) — drop the `['projects']` query and `projects` props
- `src/pages/member/Dashboard.jsx` (edited) — drop the `['projects']` query and `projects` props
- `src/pages/admin/Events.jsx` (edited) — `HostingProjectsField` pre-fills the string directly; drop the `['projects']` query and `projects` props
- `src/pages/admin/Dashboard.jsx` (edited) — drop the `['projects']` query and `projects` props
- `src/main.jsx` (edited) — remove `projects` from the shared-query-keys comment
- `docs/knowledge/data-flow.md` (edited) — `projects` row no longer lists Home as a reader

## Acceptance
- [ ] `getHostNames(hostingProjects)` returns the string, or `''` when unset
- [ ] Event cards, the detail modal and both dashboards show the same "Hosted by" text as before
- [ ] The public `/events` page shows the same hosts line as before
- [ ] Admin edit form pre-fills the existing `hostingProjects` string
- [ ] No page under `src/` imports `services/projects` or queries `['projects']`
- [ ] NOT: removing or editing `src/services/projects.js` or `src/services/local/*`
- [ ] NOT: editing `firestore.rules` or `docs/product-vision.md`
- [ ] NOT: renaming the Firestore field `hostingProjects`, its form input `name`, or any i18n key
- [ ] NOT: adding a project-linking field (e.g. `hostProjectIds`); that is the future feature

## Verify
- `grep -rnE "services/projects|\['projects'\]|hostingProjects\??\.map|projects\.find" src --include=*.jsx --include=*.js | grep -v "^src/services/"` → no matches
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `npm run dev:skipauth` → `/`, `/events`, `/member/events`, `/member/dashboard`, `/admin/dashboard`, `/admin/events`: an event with organizers shows "Hosted by …"; one without shows no hosts line
- `npm run dev:skipauth` → `/admin/events`, edit an event with organizers: field pre-fills the string; save; card unchanged
- regression: DevTools Network on those pages shows no `projects` collection read

## Notes
- No writer has ever stored an array (see `done.event-organizers-cleanup.md` Notes). A hand-edited array in the console would render as joined text, not crash.
- `services/projects.js` stays because project linking is planned; it just has no callers until then.
