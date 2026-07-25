# Allow attendee writes and block organizer self-approval in event rules
**Phase**: — · **Deps**: — · **Blocked on**: — (step 0 resolved 2026-07-25)

## Step 0 — deployed-ruleset diff (done 2026-07-25)
**Outcome: the `events` block is identical, so this spec is a bug fix, not a drift
reconciliation.** Registration by a non-organizer is genuinely denied in production.

The rest of the ruleset *had* drifted — live was commit `10bb7d3` (2026-05-05), four rules
commits behind (`77f275d`, `47019b5`, `1cc9b6f`, `0139427`) — which is what broke push
notifications and is written up in `done.ci-deploy-rules.md`. But none of those four
touched `events`: `git diff 10bb7d3..HEAD` over the `events` block is empty, and the
`allow update: if isAuthenticated() && isOwner(resource.data.organizerId)` line dates to
the initial commit `142ba4d` (2026-01-16). So the deny is not a recent regression — it has
been there since day one, on both the stale and current rulesets.

Live now matches `main` (ruleset `25d8de84-9e00-4ac1-bb63-f7f77ac9e5d8`, released by CI),
so from here the committed `firestore.rules` is the source of truth and this spec edits it
directly.

Still worth one real-account check before implementing: `registerForEvent`
(`src/services/events.js:300`) is a bare client `updateDoc` with no callable fallback, so
the failure should reproduce as a permission-denied on any event the signed-in member did
not organize. Admins are exempt via the second `allow update: if isAdmin()`, which is the
likely reason this went unnoticed.

To re-run the diff: query the `firebaserules` releases API for the `cloud.firestore`
ruleset and diff its source against `firestore.rules`. Needs `firebaserules.viewer`, and
an `x-goog-user-project: danang-hub-app` header or the API returns SERVICE_DISABLED.

## Goal
`firestore.rules:95` is the only non-admin update path on `events/{eventId}` and requires
the writer to be the organizer, so registering for someone else's event is denied — while
the same rule's lack of field limits lets an organizer self-approve. Add a narrow
attendee-write path and pin `status` for non-admins.

## Files
- `firestore.rules` (edited) — split the `events` update rule: (a) organizer may
  update own event but may not change `status`, `organizerId`, `approvedAt`,
  `rejectedAt`; (b) any authenticated member may update when the diff touches only
  `attendees`/`waitlist`; (c) create must have `status == 'pending'` unless admin;
  (d) admin unchanged.
- `docs/knowledge/data-flow.md` (edited) — update the `events` rules-table row (~line 189)
  and the register/waitlist bullet (~line 138) to match.

## Acceptance
- [ ] A member who is not the organizer can register and unregister themselves (`attendees` write succeeds).
- [ ] A member who is not the organizer can join and leave the waitlist (`waitlist` write succeeds).
- [ ] An update touching `attendees` plus any field other than `waitlist` is denied for non-organizers.
- [ ] An update touching `waitlist` plus any field other than `attendees` is denied for non-organizers.
- [ ] An organizer updating their own event cannot change `status`.
- [ ] A member creating an event with `status: 'approved'` is denied.
- [ ] An admin can still update any field on any event.
- [ ] The rules comment states that field scoping does not restrict *which* uid is written.
- [ ] NOT: no change to the public `allow read: if true` on events.
- [ ] NOT: no capacity enforcement in rules (stays client-side and advisory, as with bookings).
- [ ] NOT: do not claim per-uid enforcement — rules cannot diff array contents (see Notes).

## Verify
- `firebase emulators:start` → in the emulator UI, signed in as member A, register for
  member B's approved event; write succeeds
- same session: attempt `status: 'approved'` on own pending event → denied
- same session: attempt `createEvent` with `status: 'approved'` → denied
- as admin: approve/reject an event → succeeds; organizer gets the notification + email
- regression: `autoPromoteWaitlist` still writes (Admin SDK bypasses rules); event delete
  by organizer and by admin both still work

## Notes
**Scope of enforcement, stated plainly.** Firestore rules have no array-diff primitive:
`request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` sees *which
fields* a write touches, never *which element* changed inside an array. So this spec
enforces field scoping only — a member can still write another member's uid.

That gap is accepted deliberately: the blast radius is a wrong name on an attendee list,
not privilege escalation — `status`, `capacity`, `date` and `organizerId` stay locked.
Acceptance is written to that enforceable boundary, and the rules comment must say so.
Closing it properly means moving attendee writes behind a callable (`registerForEvent`
checking `request.auth.uid`) and denying client `attendees` writes — its own spec, larger
than this one. Don't half-build it here.
