# Vietnam public holiday closures for 2027 and 2028
**Phase**: — · **Deps**: hub-closure-dates, closure-culture-day-2026

## Goal
Resolve #279: declare the Hub's public holiday closures ahead of time so members cannot book them. Keep the member notice short by listing only closures that start soon.

## Files
- `src/utils/hubClosures.js` (edited) — 2027 and 2028 entries with sources; `getUpcomingHubClosures(from, { withinDays })`.
- `functions/hubClosures.js` (edited) — matching server entries with labels.
- `src/components/HubClosureNotice.jsx` (edited) — lists closures starting within 45 days.
- `src/locales/en.json`, `src/locales/vi.json` (edited) — one label key per holiday, reused across years.
- `test/hubClosures.test.js` (edited) — 2027 and 2028 dates, the notice window, well-formed and labelled entries.
- `docs/backlog/todo.holiday-closures-2027-2028.md` (new) — this spec.

## Acceptance
- [ ] Every 2027 public holiday is closed: 1/1, Tết 4–10/2, Hùng Kings 16/4, 30/4, 1/5, 3/5 in lieu, 27/7, 2–3/9, 24/11.
- [ ] 2028 holidays fixed by law are closed: 1/1, 3/1 in lieu, 4/4, 30/4–2/5, 27/7, 24/11.
- [ ] 2028 Tết and National Day are not declared until the official schedule exists.
- [ ] The client and functions lists declare the same days (mirror test).
- [ ] Every closure has a unique id, start ≤ end, and EN and VI labels.
- [ ] The member notice lists only closures starting within 45 days, plus any in progress.
- [ ] Admin closure badges still consider every upcoming closure.
- [ ] NOT: existing bookings are changed.

## Verify
- `node --test test/hubClosures.test.js` → all pass.
- `npm run lint && npm run build && npm --prefix functions run lint && npm test` → green (2 local failures that also fail on `main` aside).

## Notes
- Sources: MoHA notice 11483/TB-BNV (9 Oct 2026) for 2027 Tết and National Day; Labor Code art. 112 as amended 21 Nov 2026 (adds 27/7 and 24/11, effective 1 Mar 2027). A holiday on a weekend gets the next working day in lieu.
- Private employers choose their own Tết split; the Hub follows the public-sector schedule.
- Add 2028 Tết and National Day when the official schedule is published (usually Q4 2027).
