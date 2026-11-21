# Extend event imports to Meetup and Eventbrite
**Phase**: — · **Deps**: —

## Goal
Finish [#207](https://github.com/sqrDAO/danang-hub-app/issues/207) by extending the existing public-page importer to Meetup and Eventbrite.
Preserve manual review, bounded fetching and per-account rate limits.

## Files
- `functions/eventImport.js` (edited) — explicit platform/page and cover hosts.
- `test/eventImport.test.js` (edited) — platform mapping, allowlists and redirects.
- `test/fixtures/event-import/meetup.json` (new) — minimal real-page JSON-LD with provenance.
- `test/fixtures/event-import/eventbrite.json` (new) — minimal real-page JSON-LD with provenance.
- `src/services/storage.js` (edited) — validate permitted cover sources.
- `src/utils/importedBanner.js` (new) — testable cover URL allowlist.
- `test/importedBanner.test.js` (new) — cover host validation.
- `src/components/event/EventImportField.jsx` (edited) — platform-neutral comment.
- `src/locales/en.json` (edited) — supported-platform copy.
- `src/locales/vi.json` (edited) — supported-platform copy.
- `firebase.json` (edited) — report-only CSP cover connect hosts.
- `README.md` (edited) — supported import platforms and limits.
- `docs/knowledge/data-flow.md` (edited) — callable/import source documentation.

## Acceptance
- [ ] Supported public Meetup pages map Event JSON-LD into a draft.
- [ ] Supported public Eventbrite pages map Event JSON-LD into a draft.
- [ ] Every redirect target is checked against an explicit hostname allowlist.
- [ ] Lookalike hosts are rejected.
- [ ] Schemes other than HTTPS are rejected.
- [ ] Credentials and nonstandard ports are rejected.
- [ ] Permitted cover hosts have observed browser-compatible CORS responses.
- [ ] Unsupported or failed cover downloads retain the manual-banner fallback.
- [ ] EN and VI text names all supported platforms.
- [ ] Luma import behavior remains covered by regression tests.
- [ ] NOT: arbitrary URL fetching or wildcard platform-domain matching.
- [ ] NOT: automatic event creation, cover upload or capacity/venue import.
- [ ] NOT: change the shared 10-attempt hourly rate limit.

## Verify
- `node --test test/eventImport.test.js test/importedBanner.test.js` → passes.
- `npm run lint` → passes.
- `npm test` → passes.
- `npm run build` → passes.
- `npm --prefix functions run lint` → passes.
- `git diff --check` → passes.
- Fetch actual public platform pages with importer user-agent; record status/redirects/size and fixture provenance.
- Request observed cover URLs with production Origin; verify image type and CORS headers.
- Fixture browser: EN/VI import copy and pre-fill/manual review workflow.

## Notes
No bot challenges are bypassed; unsupported or blocked pages fall back to manual entry.
Live source evidence determines the exact supported regional and short-link hosts.
Cloud Functions egress may differ from developer-machine observations; report that limitation.
