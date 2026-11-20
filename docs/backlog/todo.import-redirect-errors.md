# Clarify blocked event-import redirects
**Phase**: — · **Deps**: —

## Goal
Resolve [#225](https://github.com/sqrDAO/danang-hub-app/issues/225) by showing a fetch-failure message when a valid Luma link redirects outside the allowlist. Preserve the unsupported-link feedback for directly pasted unsupported URLs.

## Files
- `functions/eventImport.js` (edited) — classify a blocked redirect as a fetch failure.
- `src/utils/eventImportErrors.js` (new) — expose the existing toast selection for verification.
- `src/components/event/EventImportField.jsx` (edited) — use the shared toast selector.
- `test/eventImport.test.js` (edited) — verify blocked redirects and direct unsupported-input feedback.

- `docs/review/import-redirect-error.png` (new) — fixture screenshot of blocked-redirect feedback.

## Acceptance
- [ ] A Luma link redirecting outside the allowlist shows the existing import-failure toast.
- [ ] Direct unsupported input retains the unsupported-link toast.
- [ ] Both feedback paths resolve to existing EN and VI translations.
- [ ] No request is made to the blocked redirect destination.
- [ ] NOT: expand the allowed hosts or alter redirect validation.

## Verify
- `node --test test/eventImport.test.js` → redirect, direct-input and existing parsing tests pass.
- `npm run lint` → no errors or warnings.
- `npm --prefix functions run lint` → no errors.
- `npm test` → no failing tests.
- `npm run build` → production build succeeds.
- Regression: allowed lu.ma → luma.com redirects still import; rate-limit and no-data error mapping is preserved.

## Notes
Reuse `toast.eventImportFailed` in both locales; no new copy or layout is required. The server still rejects every off-allowlist hop before fetching it.
