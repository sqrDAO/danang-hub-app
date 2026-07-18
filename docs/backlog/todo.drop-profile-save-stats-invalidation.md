# Drop wasteful memberStats invalidation on profile save
**Phase**: — · **Deps**: —

## Goal
Profile save invalidates `['memberStats', uid]`, but no savable field (name, contact, bio, links, preferences, push toggle) feeds `getMemberStats`, which re-runs a 2-year bookings query plus a 3-year events collection query on the actively mounted Profile page. Delete the invalidation — stats only change via booking/event mutations, which own their invalidations.

## Files
- `src/pages/member/Profile.jsx` (edited) — remove `queryClient.invalidateQueries({ queryKey: ['memberStats', currentUser?.uid] })` from the save `onSuccess` (~line 608)

## Acceptance
- [ ] Saving the profile form no longer triggers a `memberStats` refetch (no bookings/events reads in the network tab)
- [ ] `['members']` invalidation on save is preserved
- [ ] `refreshUserProfile()` on save is preserved
- [ ] NOT: the photo-upload mutation (~line 535) unchanged

## Verify
- `npm run lint && npm run build` → green
- `npm run dev` → edit bio on `/profile`, save; devtools network shows no events/bookings collection reads; stats tiles still render
- regression: after creating a booking, stats still refresh per `todo.invalidate-memberstats-after-mutations`

## Notes
Found by review of PR #20: pre-existing waste made visible now that invalidations are scoped. Firestore read cost scales with total events over a 3-year window — this fires on every save of the profile form.
