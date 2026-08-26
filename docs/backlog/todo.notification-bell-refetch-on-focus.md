# Refetch the notification bell when a stale tab is focused
**Phase**: — · **Deps**: —

## Goal
Refresh the header notification badge and unread list as soon as a member
returns to a Hub tab whose notifications query is already stale. Keep the 30s
poll, in-app navigation cache, and desktop chime behavior unchanged.

## Files
- `src/components/NotificationBell.jsx` (edited) — set `refetchOnWindowFocus: true` on `['notifications', userId]`.

## Acceptance
- [ ] Focusing a Hub tab more than 30s after the last notifications fetch refetches unread notifications immediately.
- [ ] Focusing a Hub tab within 30s of the last notifications fetch does not issue an extra notifications request.
- [ ] The notifications query still uses `refetchInterval: 30000`.
- [ ] NOT: `refetchOnWindowFocus: 'always'`, `staleTime: 0`, a Firestore listener, a poll-interval change, or extra fetches on in-app route changes.

## Verify
- `npm run lint` → exits successfully with zero warnings.
- `npm run build` → production build completes successfully.
- `npm test` → exits successfully.
- regression: sit on one focused tab — the bell still polls about every 30s.
- regression: flick away and back within ~10s — Network shows no extra unread-notifications request.
- regression: leave the tab hidden longer than 30s, then return — badge/list update without waiting for the next poll.
- regression: a later successful result with a previously unseen unread ID still plays the desktop chime once.

## Notes
App-wide `staleTime` is 30s, so `true` (not `'always'`) caps extra fetches at one per 30s on tab focus. In-app navigation remounts `Layout` but uses `refetchOnMount` plus that same staleTime, not this flag. Background tabs pause `refetchInterval`; wall-clock staleTime does not pause.
