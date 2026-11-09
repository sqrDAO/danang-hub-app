# Fixed desk plans cancel whole, rule stays as is
**Phase**: — · **Deps**: —

## Goal
CLAUDE.md says fixed-desk days are never cancelled individually, while `firestore.rules` lets an owner cancel an approved `fixed-desk` day (#172). Decision: members cancel approved days only as a whole plan, through the app, and there is no server-side enforcement, so the wording is corrected and the rule is kept.

## Files
- `CLAUDE.md` (edited) — Fixed desk plans bullet: approved days cancel only as a whole plan; why the owner rule must keep allowing approved `fixed-desk` days

## Acceptance
- [ ] CLAUDE.md says members cancel approved fixed desk days only as a whole plan, via `cancelFixedDeskPlan`.
- [ ] CLAUDE.md says pending fixed desk days keep the usual Cancel and Delete.
- [ ] CLAUDE.md says the app offers no single-day cancel for approved fixed desk days.
- [ ] CLAUDE.md says `cancelFixedDeskPlan` cancels each day under the owner rule.
- [ ] CLAUDE.md says `firestore.rules` must keep letting owners cancel approved `fixed-desk` days.
- [ ] NOT: no change to `firestore.rules`.
- [ ] NOT: no change to `cancelFixedDeskPlan`.
- [ ] NOT: no change to the Bookings UI.

## Verify
- `git diff origin/main...HEAD --stat` → only `CLAUDE.md` and this spec
- `npm run lint && npm run build` → green (no code change; sanity only)

## Notes
Server enforcement (moving Cancel Plan into a callable, then tightening the rule to `partner-desk` only) was considered and declined: the app doesn't expose a single-day cancel for approved days, members don't attempt one, and fixed-desk days sit outside the 40h limit (`DESK_PLAN_TYPES`), so a direct write gains nothing.
