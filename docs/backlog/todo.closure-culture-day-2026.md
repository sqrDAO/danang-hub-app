# Close the Hub on 24 Nov 2026 (Vietnamese Culture Day)
**Phase**: — · **Deps**: hub-closure-dates

## Goal
Resolve #275: the Hub is closed on Tuesday 24 November 2026 for a public holiday. Add it to the declared closure list so no new bookings or events land on that day.

## Files
- `src/utils/hubClosures.js` (edited) — `culture-day-2026` entry, `labelKey: closures.cultureDay2026`.
- `functions/hubClosures.js` (edited) — matching server entry with its `label`.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — `closures.cultureDay2026`.
- `test/hubClosures.test.js` (edited) — 24 Nov cases and upcoming-closure counts.
- `docs/backlog/todo.closure-culture-day-2026.md` (new) — this spec.

## Acceptance
- [ ] `isHubClosed` is true for every instant of 24 Nov 2026 hub time (+07:00) and false on 23 and 25 Nov.
- [ ] The client and functions closure lists declare the same days (mirror test).
- [ ] Both locales carry `closures.cultureDay2026`.
- [ ] NOT: existing bookings or events on 24 Nov are cancelled or changed; admins see them badged and decide.

## Verify
- `npm test` → `test/hubClosures.test.js` passes.
- `npm run lint && npm run build && npm --prefix functions run lint` → green.
- regression: Independence Day 2026 cases in `test/hubClosures.test.js` still pass.
