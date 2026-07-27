# Decide the fate of sendEventReminders (no-op scheduled function)
**Phase**: — · **Deps**: —

## Decision required
`sendEventReminders` (`functions/index.js:1064-1121`, hourly schedule) resolves the
attendee list for events 24-25h out, filters by `preferences.eventReminders`, and then
only `console.log`s a summary — it never emails or pushes anyone. `docs/knowledge/data-flow.md`
already documents this as "actual sending is TODO (logs only)." This week's PR #47 deleted
two functions of the exact same shape (`updateEventCapacity`, `cleanupOldBookings`) for
"advertising behavior that does not exist," but this third one — arguably the one members
would most notice missing, since it reads a member-facing `eventReminders` preference —
was left alone.

Two ways to close this, and this spec is written for **Option A** (delete, matching this
week's own precedent). If the answer is Option B, rewrite this spec's Files/Acceptance
around actually sending reminders (push via `sendPushToMembers` using the existing
localized-message pattern from PR #51, or email via the existing Nodemailer setup in
`notifyEventStatusChange`) before implementing — don't half-build either option.

- **Option A — delete it.** Matches PR #47's precedent exactly. Loses the
  member-facing "eventReminders" preference's only current effect (it currently does
  nothing, so no user-visible behavior actually changes), and frees the hourly invocation
  cost. Requires also deciding whether to remove the now-dead `preferences.eventReminders`
  toggle from the member profile UI, or leave it as a currently-inert setting.
- **Option B — implement real delivery.** Bigger scope: needs to decide push vs. email
  vs. both, dedupe so a member isn't reminded twice if the function's window overlaps
  across runs, and reuse (not reimplement) `sendPushToMembers`'s locale-aware messaging
  from PR #51.

## Goal (Option A, as currently written)
Remove `sendEventReminders` and its now-orphaned `preferences.eventReminders` UI toggle
(if the decision confirms it should go with it), so the function table and the member
profile settings stop promising a reminder that never sends.

## Files
- `functions/index.js` (edited) — delete the `exports.sendEventReminders` block.
- `README.md` (edited) — remove its row from the Cloud Functions table.
- `docs/knowledge/data-flow.md` (edited) — remove its row from the two tables it appears
  in and the "sendEventReminders (hourly)" bullet under the events section.
- `src/pages/member/Profile.jsx` (edited, only if the decision confirms removing the
  toggle) — remove the `eventReminders` preference control; grep first to confirm the
  exact location before editing.

## Acceptance
- [ ] `functions/index.js` no longer exports `sendEventReminders`.
- [ ] `README.md`'s Cloud Functions table has no `sendEventReminders` row.
- [ ] `docs/knowledge/data-flow.md` has no `sendEventReminders` references remaining.
- [ ] NOT: no change to `autoCheckoutExpiredBookings`, `cleanupPushNotificationMarkers`, or any other scheduled function.
- [ ] NOT: do not implement partial reminder-sending in this spec — if Option B is chosen, this spec is rewritten first.

## Verify
- `cd functions && npm run lint` → green
- `grep -rn sendEventReminders functions/ README.md docs/` → no matches
- `npm run lint && npm run build` → green
- regression: `autoCheckoutExpiredBookings`, `cleanupPushNotificationMarkers`, and
  `autoPromoteWaitlist` (the other three scheduled/triggered functions touched this week
  or living nearby in the file) still deploy and behave unchanged

## Notes
Found during the 2026-07-27 weekly review, invariant-sweep step (functions/index.js
export-by-export read), not from this week's diff — `sendEventReminders` itself wasn't
touched this week, only its two same-shaped siblings were removed. Flagged now because
leaving it standing right after the sibling cleanup reads as an oversight rather than a
choice.
