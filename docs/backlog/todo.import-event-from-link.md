# Import an event from a Luma link
**Phase**: — · **Deps**: —

Issue: https://github.com/sqrDAO/danang-hub-app/issues/207

## Goal
Organizers and admins retype every event field even when the event already lives on Luma.
Let them paste a Luma link in the create form and have the server read the public page and
pre-fill title, description, date/time, duration, event link and cover image for review.

## Files
- `functions/eventImport.js` (new) — URL allowlist, guarded page fetch, schema.org `Event`
  JSON-LD extraction, mapping to a form draft.
- `functions/index.js` (edited) — `importEventFromUrl` callable.
- `test/eventImport.test.js` (new) — tests for the module above, with a fake `fetch`.
- `src/services/functions.js` (edited) — `importEventFromUrl` wrapper.
- `src/services/localDevStore.js` (edited) — sample draft for local dev mode.
- `src/services/storage.js` (edited) — `fetchBannerFile` downloads the cover as a `File`.
- `src/components/event/EventImportField.jsx` (new) — link input and Import button.
- `src/components/event/EventFormModal.jsx`, `EventFormModal.css` (edited) — render the
  field on create; preview the chosen banner.
- `src/components/event/eventFields.js`, `test/eventFields.test.js` (edited) — `getImportedFormValues`.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — import strings.
- `README.md`, `docs/knowledge/data-flow.md` (edited) — feature line and callable rows.

## Acceptance
- [ ] The create form shows a link input and an Import button for members and admins.
- [ ] The edit form shows no import field.
- [ ] Importing a public Luma event fills title, description, date/time, duration and event link.
- [ ] The imported date/time shows the event's start in Asia/Ho_Chi_Minh.
- [ ] Duration is `endDate − startDate` in minutes, rounded up to a multiple of 15.
- [ ] A page with no end date leaves the duration field unchanged.
- [ ] The callable rejects unauthenticated callers.
- [ ] The callable rejects any URL that is not `https:` on `lu.ma` or `luma.com` (or their `www.`).
- [ ] A redirect is followed only when its target passes the same URL check.
- [ ] The page fetch stops after 3 redirects, 8 seconds or 1 MB.
- [ ] A page without an `Event` JSON-LD block returns `not-found`.
- [ ] Each failure shows its own toast and leaves the form values untouched.
- [ ] Title is capped at 200 characters and description at 5000.
- [ ] The draft's `image` is null unless the page's image is `https:` on `images.lumacdn.com`.
- [ ] An imported cover is placed in the banner file input as a JPG, PNG or WebP file.
- [ ] The banner field previews the chosen file, imported or picked by hand.
- [ ] Picking another file by hand replaces the imported cover.
- [ ] When the cover cannot be imported, the other fields still fill and a toast asks for a manual upload.
- [ ] With the Event Hall box ticked, an import re-runs the hours check on the new date.
- [ ] NOT: nothing is written to Firestore by the import.
- [ ] NOT: capacity, hosting organizations and venue are not imported.
- [ ] NOT: the cover is not uploaded to Storage before the form is submitted.
- [ ] NOT: a Luma image URL is never saved as `bannerUrl`.
- [ ] NOT: no host other than Luma is accepted.
- [ ] NOT: no `importedFrom` field is stored on the event.
- [ ] NOT: no change to `firestore.rules`, `createEvent`, `editOwnEvent` or `reviewEvent`.
- [ ] NOT: no new npm dependency.

## Verify
- `npm run lint && npm run build && npm test` → all exit 0
- `cd functions && npm run lint` → exit 0
- `npm run dev:skipauth`, member Events page: Create Event, accept guidelines, paste any
  text, Import → the sample draft fills the five fields and the banner input
- same on the admin Events page → field shown; open Edit on an event → field absent
- `firebase emulators:start` + `VITE_USE_EMULATORS=true`: import a real Luma link → fields
  and cover match the page; `https://example.com` → "not supported" toast
- after deploy: one real import from production (see Notes)
- regression: create without importing, member edit returns an approved event to pending,
  Event Hall hours error still blocks submit

## Notes
- Checked 2026-11-17: `lu.ma/<slug>` redirects to `luma.com/<slug>`, and the page carries
  one `application/ld+json` block of `@type: Event` whose `startDate`/`endDate` include an
  offset. That check ran from a developer machine; Luma may treat requests from Google
  Cloud differently, which only a deployed call proves.
- The host allowlist replaces the issue's private-IP checks: the function can only ever
  request two fixed public hosts. #203/#204's known-host list is not merged, so this spec
  defines its own.
- Decisions on the issue's open questions: any signed-in member may import (anyone who can
  create an event); no `importedFrom`; cover imported (2026-11-17) by the browser, since
  Luma's image host sends `access-control-allow-origin: *` and honours a JPEG/PNG/WebP `Accept`.
- The form is uncontrolled, so the import writes values through `form.elements`.
- Luma can change the JSON-LD block at any time; the feature then fails soft to manual
  entry. Maintainer to confirm one fetch per pasted link is fine under Luma's terms.
