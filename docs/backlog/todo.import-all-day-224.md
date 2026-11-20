# Preserve all-day event imports
**Phase**: — · **Deps**: —

## Goal
Resolve [#224](https://github.com/sqrDAO/danang-hub-app/issues/224) by importing date-only Luma events at midnight in Asia/Ho_Chi_Minh. Preserve their title and description without relying on the server's local timezone.

## Files
- `functions/eventImport.js` (edited) — normalize date-only values and recognize lowercase UTC suffixes.
- `test/eventImport.test.js` (edited) — cover all-day draft preservation and offset parsing.

## Acceptance
- [ ] A date-only start preserves the complete event draft.
- [ ] Date-only start and end values use hub midnight.
- [ ] Explicit offsets retain their original instant.
- [ ] Lowercase `z` suffixes are accepted as UTC.
- [ ] Results are independent of the server timezone.
- [ ] NOT: change import allowlists, duration caps or event submission behavior.

## Verify
- `node --test test/eventImport.test.js` → all import tests pass.
- `TZ=America/Los_Angeles node --test test/eventImport.test.js` → same assertions pass outside hub time.
- `TZ=Asia/Tokyo node --test test/eventImport.test.js` → same assertions pass in another positive-offset zone.
- `npm run lint` → zero errors/warnings.
- `npm --prefix functions run lint` → zero errors.
- `npm test` → all runnable tests pass.
- `npm run build` → production build succeeds.
- Regression: ordinary explicit-offset and offsetless timed imports keep their expected date and duration.
