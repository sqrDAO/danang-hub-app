# Delete PR preview channels when the PR closes
**Phase**: — · **Deps**: — · **Issue**: #286

## Goal
Each PR deploys a Firebase Hosting preview channel that nothing deletes, so channels pile
up to Hosting's 50-channel limit and previews fail with HTTP 429. Delete a PR's channel when
it is merged or closed, and shorten the expiry so a missed cleanup still clears itself.

## Files
- `.github/workflows/firebase-hosting-pr-cleanup.yml` (new) — on `pull_request: closed`, delete channels whose id starts with `pr<number>-`
- `.github/workflows/firebase-hosting-pull-request.yml` (edited) — preview deploy gets `expires: 3d`

## Acceptance
- [ ] Merging or closing a same-repo PR deletes that PR's preview channel
- [ ] A closed PR with no channel ends the cleanup job green
- [ ] A failing `hosting:channel:list` fails the cleanup job (not reported as "nothing to delete")
- [ ] Fork PRs skip the cleanup job
- [ ] New preview channels expire after 3 days
- [ ] NOT: the `live` channel is never deleted (only ids matching `^pr<number>-`)
- [ ] NOT: `pr23-*` cleanup never matches `pr239-*`
- [ ] NOT: no sweep of other closed PRs' channels during preview deploys
- [ ] NOT: no `pull_request_target` trigger

## Verify
- `python3 -c "import yaml,sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/firebase-hosting-pr-cleanup.yml .github/workflows/firebase-hosting-pull-request.yml` → no error
- run the workflow's "Delete this PR's preview channel" filter lines locally (delete call stubbed) against `firebase hosting:channel:list --project danang-hub-app --json` with `PREFIX=pr294-` → exactly one id; with `PREFIX=pr999-` → "nothing to delete"; against a list holding `live`, `pr23-a`, `pr239-b` with `PREFIX=pr23-` → only `pr23-a`; with invalid JSON → non-zero exit
- post-merge: this PR's own close runs "Clean up PR preview channel" green, and `firebase hosting:channel:list` no longer shows its `pr<number>-` channel
- post-merge: the next PR's preview comment shows an expiry 3 days out
- regression: the next PR's `build_and_preview` still deploys and comments its URL

## Notes
- Channel ids come from `action-hosting-deploy`: `pr<number>-<branch>` with the branch cut to 20 chars and `/` → `-`. Matching the `pr<number>-` prefix avoids rebuilding that rule.
- The CI service account (`roles/firebase.sdkAdminServiceAgent`) creates channels, so deleting them is expected to work but is unproven. If the first cleanup run is refused, an owner grants `roles/firebasehosting.admin`; nothing else is affected.
- No catch-up sweep needed: on 2026-11-24 every existing preview belongs to a closed PR and expires by 2026-11-30.
