# Give admin event review errors specific messaging and a cache refresh
**Phase**: — · **Deps**: —

## Goal
`approveMutation`/`rejectMutation` in admin Events show one generic failure toast for every
`reviewEvent` error (stale revision, Hall unavailable, event already started) and never
invalidate the cache, so a retry after a stale-revision failure keeps failing against the same
stale `event.revision` until a manual reload. Port the organizer-edit path's per-error-code
messaging and add a refetch on failure.

## Files
- `src/pages/admin/Events.jsx` (edited) — add an `EVENT_REVIEW_ERROR_KEYS` map and a
  `getEventReviewErrorMessage(error, t)` helper mirroring `EVENT_EDIT_ERROR_KEYS` /
  `getEventEditErrorMessage` in `src/pages/member/Events.jsx:886-902`; use it in
  `approveMutation`/`rejectMutation`'s `onError` (~lines 235-254) instead of the fixed
  `toast.eventApproveFailed`/`eventRejectFailed` strings; call `invalidate('pendingEvents',
  'events')` (or the equivalent keys this page already invalidates on success) inside `onError`
  too, so a retry re-reads the current revision.
- `src/locales/en.json` (edited) — add admin-specific stale/unavailable/precondition toast keys
  if the existing `toast.eventEditStale`-style keys aren't appropriate for the admin voice (reuse
  them if the copy fits; don't duplicate strings that would read identically).
- `src/locales/vi.json` (edited) — matching Vietnamese keys, same change as en.json.

## Acceptance
- [ ] A `reviewEvent` failure with code `aborted` (stale revision) shows a distinct
      "this event changed, refreshing" message, not the generic approve/reject-failed toast.
- [ ] A `reviewEvent` failure with code `failed-precondition` (Hall unavailable / event started)
      shows a distinct message from the stale-revision case.
- [ ] Any `reviewEvent` failure triggers a cache invalidation for the pending/approved event
      lists, so the admin sees the current server state without a manual reload.
- [ ] An unrecognized error code still falls back to the existing generic
      `toast.eventApproveFailed`/`eventRejectFailed` string.
- [ ] `npm run lint` passes.
- [ ] i18n key parity holds (`en.json` / `vi.json` have identical key sets).

## Verify
- `npm run lint` → passes.
- `npm run build` → passes.
- `firebase emulators:start`, as admin trigger `reviewEvent` on an event whose revision was
  concurrently bumped by another edit → confirm the stale-specific message appears and the event
  list refreshes to show the new state without a manual reload.
- regression: successful approve/reject still shows `toast.eventApproved`/`eventRejected` and
  invalidates the same query keys as before.

## Notes
`EVENT_EDIT_ERROR_KEYS` (`src/pages/member/Events.jsx:886-896`) maps both bare codes (`aborted`)
and `functions/`-prefixed codes (`functions/aborted`) — mirror that exact shape since Firebase
callables can surface either depending on SDK version/transport.
