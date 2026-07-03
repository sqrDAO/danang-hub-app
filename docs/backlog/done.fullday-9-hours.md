# Full Day booking should be 9 hours (9am–6pm)
**Phase**: — · **Deps**: migrate-amenities-hours

## Goal
The "Full day" duration option books 8 hours, a leftover from the old 8am–6pm hours. With 9am–6pm operating hours a full day is 9 hours, so a 9am full-day booking should end at 6pm, not 5pm.

## Files
- `src/pages/member/Bookings.jsx` (edited) — full-day option value 8 → 9
- `src/locales/en.json` (edited) — "Full day (8 hours)" → "Full day (9 hours)"
- `src/locales/vi.json` (edited) — "Cả ngày (8 giờ)" → "Cả ngày (9 giờ)"

## Acceptance
- [ ] Selecting Full day with a 09:00 start produces an end time of 18:00
- [ ] Both EN and VI labels say 9 hours
- [ ] NOT: no change to other duration options or server-side validation

## Verify
- `npm run lint && npm run build` → green
- In `npm run dev`: book a desk, pick Full day + 09:00 slot → summary shows 9:00 AM – 6:00 PM
