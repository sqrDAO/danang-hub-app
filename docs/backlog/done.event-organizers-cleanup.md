# Event organizers: relabel the hosting field as free text
**Phase**: — · **Deps**: —

## Goal
`event.hostingProjects` is a free-text string of the organizations hosting an event, but both event forms label it "Hosting Project(s)" with a "Project Alpha" placeholder, which reads like a link to resident projects. Relabel the EN/VI strings so the field reads as free-text organizer names. Linking events to resident `projects` docs stays a planned feature (confirmed in PR #92), so its code stays in place.

## Files
- `src/locales/en.json` (edited) — new values for `adminEvents.modal.hosting*` and `memberEvents.modal.hostingProjects*`
- `src/locales/vi.json` (edited) — same keys, VI values

## Acceptance
- [ ] EN label reads "Hosting organization(s)" in the admin and member forms
- [ ] EN placeholder reads "e.g., Superteam VN, Solana Vietnam" in the admin and member forms
- [ ] EN admin hint reads "Enter the hosting organization names, separated by commas"
- [ ] VI label reads "Đơn vị tổ chức" in the admin and member forms
- [ ] VI placeholder reads "vd: Superteam VN, Solana Vietnam" in the admin and member forms
- [ ] VI admin hint reads "Nhập tên các đơn vị tổ chức, cách nhau bằng dấu phẩy"
- [ ] Unused `memberEvents.modal.hostingProjectsHint` gets the same new EN/VI hint text, so no "project(s)" wording is left for a future render
- [ ] Admin edit form pre-fills the existing `hostingProjects` string
- [ ] Creating or editing an event still saves `hostingProjects` as a trimmed string
- [ ] NOT: removing or editing `src/services/projects.js`
- [ ] NOT: removing or editing any `['projects']` React Query
- [ ] NOT: removing the array branch in `getHostNames` (`src/components/event/eventFields.js`) or in `HostingProjectsField` (`src/pages/admin/Events.jsx`)
- [ ] NOT: editing `docs/product-vision.md`
- [ ] NOT: rendering `hostingProjectsHint` in the member form (component change, out of scope)
- [ ] NOT: renaming i18n keys, the Firestore field `hostingProjects`, Cloud Functions or `firestore.rules`

## Verify
- `npm run lint` → 0 errors, 0 warnings
- `npm run build` → succeeds
- `npm test` → all pass
- `npm run dev:skipauth` → `/admin/events`, create and edit an event: new EN label, placeholder and hint; edit pre-fills the organizer string; save; card shows the new text
- `npm run dev:skipauth` → `/member/events`, request a new event with and without organizers: new EN label and placeholder; card shows "Hosted by" only when set
- regression: switch to VI and repeat both form checks

## Notes
- No writer has ever stored an array: both forms use `<input type="text">` and trim it into a string, and the `editOwnEvent` callable validates it with `asOptionalString` (`functions/eventLifecycle.js`). The array branch is kept only because project linking is planned.
- Future design hint for project linking: store project IDs in a separate array field (e.g. `hostProjectIds`) next to the free-text `hostingProjects`, rather than letting one field be either a string or an array. That removes the `typeof` check readers need today.
