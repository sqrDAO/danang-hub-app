# Recover autoCheckoutExpiredBookings from silent index failure
**Phase**: — · **Deps**: dashboard-completed-counts (ships the `bookings (status, endTime)` index)

## Goal
`autoCheckoutExpiredBookings` has never completed a single booking: it throws
FAILED_PRECONDITION on its first query every hour and one `catch` swallows it, aborting the
other two sweep steps too. Isolate the steps and make failure loud so this cannot recur silently.

## Files
- `functions/index.js` (edited) — per-step error isolation and reporting in `autoCheckoutExpiredBookings`

## Acceptance
- [ ] Each of the three sweep steps runs inside its own try/catch
- [ ] A failure in one step does not prevent the other two from running
- [ ] A failure in one step does not prevent the batch commit of what the other steps collected
- [ ] The handler rethrows after a partial failure, so the run is marked failed in Cloud Scheduler
- [ ] Every run logs the number of bookings it completed, including `0`
- [ ] Each step's failure log names which step failed
- [ ] `functions/index.js` passes `cd functions && npm run lint`
- [ ] NOT: change which bookings the sweep selects or the statuses it writes
- [ ] NOT: add a backfill script — the index makes the next scheduled run drain the backlog
- [ ] NOT: re-add `bookings (status, endTime)` to `firestore.indexes.json` (already deployed)
- [ ] NOT: change the hourly schedule

## Verify
- `cd functions && npm run lint` → 0 errors
- `firebase deploy --only functions:autoCheckoutExpiredBookings` → succeeds
- `firebase functions:log --only autoCheckoutExpiredBookings` after the next hourly run →
  an `Auto-completed <n>` line, no `Error in auto checkout`
- After that run, `status == 'checked-in' AND endTime <= now` counts ~0 (was 525) and
  `status IN (pending, approved) AND endTime <= now` counts ~0 (was 322)
- /admin/dashboard "Completed Bookings" climbs from 162 toward ~1009
- regression: /admin/bookings check-in then check-out still works by hand; a booking cancelled
  by an admin still emails the member (the sweep must not start sending mail)

## Notes
- Root cause: `firestore.indexes.json` carried `bookings (status, startTime)` but the sweep
  queries `(status, endTime)`. Steps 1 and 2 need the `endTime` index; step 3 uses `startTime`
  and would have worked, but step 1 throws first and takes the whole handler down.
- The `endTime` queries date to the initial commit (2026-01-16), so this has never worked in
  production. Nine hourly runs in the retained log window, nine `code: 9` failures, zero
  `Auto-completed` lines.
- The missing index was deployed on 2026-08-26 ahead of this spec, so the sweep is already
  armed — the code change here is about not hiding the NEXT failure of this kind.
- Backlog at time of writing: 1148 booking docs — completed 162, checked-in 526, approved 419,
  cancelled 39, pending 2. Oldest stale checked-in ended 2026-03-02.
- The sweep queries have no date floor, so one run drains all ~847 stranded docs. At batch size
  500 that is 2 commits; well within the function timeout.
- Confirmed safe to sweep in bulk: the only booking trigger is `notifyBookingApproval`, which
  returns early unless the new status is `approved` or `cancelled`. Writing `completed` sends
  no email and no push, so draining the backlog will not notify anyone.
- Consider separately whether "Active Bookings" should count in-progress `approved` bookings
  and not just `checked-in` ones — with check-out broken for months, members had no reason to
  trust the check-in button. Not in scope here.
