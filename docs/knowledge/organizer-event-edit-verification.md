# Organizer event edit verification

Use this procedure to verify the organizer event-revision lifecycle. It is intentionally
tracked separately from the implementation plan so the acceptance evidence remains
reproducible after temporary planning notes are removed.

A run passes only when the automated gate is green, every matrix row is marked PASS, and
the emulator and dev-server processes are stopped. Record the tested commit, date, tester,
and requested Firestore evidence in the run record at the end of this document.

## 1. Automated gate

Run from a clean checkout with Node.js 22, Java 21 or newer, and Firebase CLI installed:

```bash
npm ci
npm --prefix functions ci
npm run lint
npm run build
npm test
npm --prefix functions run lint
firebase emulators:exec --project demo-danang-hub-event-edit --only firestore "node --test test/firestore-event-edit.rules.test.js"
```

PASS means every command exits 0. `emulators:exec` must report four passing Firestore
rules tests and stop its emulator automatically. Do not continue after a failure.

## 2. Isolated manual environment

Start empty emulators in terminal A. The `demo-` project ID prevents accidental access to
a real Firebase project; the temporary export gives the run one inspectable data set.

```bash
export EVENT_EDIT_PROJECT_ID=demo-danang-hub-event-edit
export EVENT_EDIT_TMP_ROOT="${TMPDIR:-/tmp}"
export EVENT_EDIT_TMP_ROOT="${EVENT_EDIT_TMP_ROOT%/}"
export EVENT_EDIT_DATA_DIR="$(mktemp -d "$EVENT_EDIT_TMP_ROOT/danang-event-edit.XXXXXX")"
firebase emulators:start --project "$EVENT_EDIT_PROJECT_ID" --only auth,firestore,functions,storage --export-on-exit="$EVENT_EDIT_DATA_DIR"
```

Wait for the Emulator UI at `http://127.0.0.1:4000`, then start the emulator-routed app
in terminal B:

```bash
export EVENT_EDIT_PROJECT_ID=demo-danang-hub-event-edit
VITE_FIREBASE_API_KEY=demo-api-key \
VITE_FIREBASE_AUTH_DOMAIN="$EVENT_EDIT_PROJECT_ID.firebaseapp.com" \
VITE_FIREBASE_PROJECT_ID="$EVENT_EDIT_PROJECT_ID" \
VITE_FIREBASE_STORAGE_BUCKET="$EVENT_EDIT_PROJECT_ID.appspot.com" \
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789 \
VITE_FIREBASE_APP_ID=1:123456789:web:event-edit \
VITE_USE_EMULATORS=true VITE_EMULATOR_HOST=127.0.0.1 \
npm run dev -- --host 127.0.0.1 --port 3000
```

Use four separate browser profiles at `http://127.0.0.1:3000`: `admin@example.test`,
`organizer@example.test`, `member-a@example.test`, and `member-b@example.test`. Create each
with email/password authentication and complete its profile. In Emulator UI, change only
the admin's `members/{uid}.membershipType` to `admin`.

In Emulator UI, create `amenities/event-hall-a` and `amenities/event-hall-b` with these
fields: `name` = `Event Hall A` or `Event Hall B`, `type` = `event-space`, `isAvailable` =
`true`, `availableDays` = `[0,1,2,3,4,5,6]`, `startHour` = `9`, and `endHour` = `22`.
Choose Hall test times at least seven days ahead: 18:00–21:00 on a weekday or
09:00–21:00 on a weekend, in Asia/Ho_Chi_Minh.

## 3. Organizer/member/admin matrix

Perform rows in order. Use the displayed event ID in Firestore for evidence. Allow up to
10 seconds after each write for Functions-emulator triggers to settle.

| Row | Actions | PASS evidence |
|---|---|---|
| M1 — pending edit | Organizer creates `M1 Pending` without a Hall, then edits its title while pending. | Event stays `pending`; `revision` advances from 1 to 2; protected identity, status, registrations, and review fields are unchanged; the initial admin review notification is not duplicated by the pending-to-pending edit. |
| M2 — stale review | Admin opens M1 in tab A. Organizer edits M1 again in another profile. Without refreshing tab A, admin approves its stale card. | Approval reports the stale/refresh error; event remains `pending` at revision 3; no booking is created. Refreshing then approving succeeds. |
| M3 — linked booking lifecycle | Organizer creates `M3 Hall` requesting Event Hall A; admin approves it; organizer edits its title; admin approves the revision. | Initial approval creates exactly one active booking with `eventId`; its window is event start minus one hour through event end plus one hour. Edit retains attendees/waitlist, sets `pending`, cancels that booking, and clears linked fields. Reapproval creates exactly one new active booking and restores linked fields. |
| M4 — Hall conflict | Organizer creates `M4 Conflict` for Event Hall A at the same time as approved M3, then admin attempts approval. | Approval reports the existing failed-precondition conflict; M4 remains `pending`; no active M4 booking exists. |
| M5 — registration freeze | On approved M3, member A registers. Set capacity to 1 through the admin edit flow, then member B joins the waitlist. Organizer edits M3. | Approved registration/unregistration and waitlist actions work before the edit. During review, M3 disappears from live/upcoming registration surfaces; attendee and waitlist arrays are retained and member registration writes are denied. After reapproval, registration actions work again. |
| M6 — waitlist promotion | Create and approve a separate capacity-1 `M6 Waitlist` with member A registered and member B waitlisted. Member A unregisters. In Emulator UI reset it to member A registered/member B waitlisted, then have the organizer edit it into `pending`; remove member A in Emulator UI, confirm no promotion, and restore the two arrays before reapproval. After reapproval, member A unregisters again. | Each approved removal promotes member B once from FIFO waitlist. The pending removal does not promote anyone. Arrays contain no duplicate UID. |
| M7 — revision notifications | Observe notifications for M3's organizer, admins, member A, and member B across pending revision, approval, another revision, and rejection. Refresh each client and inspect `notifications` in Emulator UI. | Admin review, organizer result, and retained-participant `event_revision` records use event/revision/transition-specific IDs. Refreshes and trigger retries create no duplicate document for the same recipient and subject. Initial approval is not mislabeled as a participant revision. |
| M8 — legacy event | In Emulator UI create a future `M8 Legacy` event owned by the organizer with required event fields, `status: pending`, empty attendee/waitlist arrays, and no `revision`, `everApproved`, or `approvedRevision`. Organizer edits it, then admin approves it. | The edit treats the stored record as revision 1 and writes revision 2. Review succeeds with revision 2; no backfill of unrelated legacy records is required. |
| M9 — admin edit regression | Admin edits the content of approved M3 without changing its status. | Content update succeeds, status remains `approved`, and revision increments transactionally so an already-open organizer/admin edit using the prior revision is rejected as stale. |
| M10 — reminder and dedupe | Create an approved `M10 Reminder` starting 24–25 hours from now with capacity 1. Register member A and waitlist member B. Set one other member's `preferences.eventReminders` to `false`. Run the command below twice. | Both calls return HTTP 2xx. Eligible attendee, waitlisted, and other-member copies match their segment; the opted-out member has none. The second call creates no duplicate `event_reminder` notification for any UID/event pair. |

Invoke the scheduled reminder from terminal C while the emulators are running:

```bash
export EVENT_EDIT_PROJECT_ID=demo-danang-hub-event-edit
curl --fail-with-body --request POST \
  "http://127.0.0.1:5001/$EVENT_EDIT_PROJECT_ID/us-central1/sendEventReminders" \
  --header "Content-Type: application/json" --data '{}'
```

The public/member/admin event lists must agree after M10: only approved future events are
live/registerable, while the organizer's own pending or rejected records remain visible in
My Event Requests.

## 4. Run record and teardown

Copy this table into the PR or release record; attach screenshots or exported document IDs
for failures. Never mark an unexecuted row PASS.

| Commit | Date/time | Tester | Automated gate | M1–M10 | Evidence/notes |
|---|---|---|---|---|---|
| `<sha>` | `<ISO-8601>` | `<name>` | PASS/FAIL | PASS/FAIL | `<links or emulator document IDs>` |

Stop terminal B with Ctrl-C, then stop terminal A with Ctrl-C. Confirm both ports are free
and remove only the temporary directory printed in terminal A:

```bash
lsof -nP -iTCP:3000 -iTCP:4000 -iTCP:5001 -iTCP:8080 -iTCP:9099 -iTCP:9199 -sTCP:LISTEN
case "$EVENT_EDIT_DATA_DIR" in
  "$EVENT_EDIT_TMP_ROOT"/danang-event-edit.*)
    test -d "$EVENT_EDIT_DATA_DIR" && rm -rf -- "$EVENT_EDIT_DATA_DIR"
    ;;
  *)
    echo "Refusing unexpected cleanup target: $EVENT_EDIT_DATA_DIR" >&2
    exit 1
    ;;
esac
```

PASS teardown means `lsof` prints no listeners on those ports and the isolated export
directory no longer exists. Do not use a repository path or an unset variable as the
cleanup target.
