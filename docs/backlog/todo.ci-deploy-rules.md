# Deploy Firestore and Storage rules from CI
**Phase**: — · **Deps**: —

## Goal
`firebase-hosting-merge.yml` deploys hosting and functions but never security rules, so prod rules silently drifted ~2.5 months behind `main` (live ruleset 2026-05-05 = `10bb7d3`; four rules commits unshipped, including the `push_tokens` block — enabling push notifications failed with permission-denied in prod).
Add a rules deploy step so merging to `main` ships rules with the client that depends on them.

## Files
- `.github/workflows/firebase-hosting-merge.yml` (edited) — deploy `firestore:rules` after gcloud auth, before functions.
- `README.md` (edited) — note that merges to `main` deploy Firestore rules automatically, and what stays manual.

## Acceptance
- [ ] Merging to `main` releases `firestore.rules` to the `cloud.firestore` release.
- [ ] The deploy step is scoped to `firestore:rules` — never bare `firestore`, never `storage`.
- [ ] The rules step runs before the Cloud Functions step.
- [ ] A merge to `main` completes with the Cloud Functions step reached, not skipped.
- [ ] NOT: no Firestore **index** deploys from CI — the CI service account lacks `datastore.indexes.*`.
- [ ] NOT: no **Storage rules** deploys from CI — the CI service account has no `firebasestorage.*` permission.
- [ ] NOT: no IAM grant beyond `roles/firebaserules.developer` on the CI service account.
- [ ] NOT: no change to the rules themselves in this spec.
- [ ] NOT: no change to the pull-request workflow (previews stay hosting-only).

## Verify
- `npx firebase-tools deploy --only firestore:rules --project danang-hub-app --dry-run` → compiles, no index or bucket work attempted
- after merge: `firebaserules.googleapis.com/v1/projects/danang-hub-app/releases` → `cloud.firestore` `updateTime` matches the run
- after merge: fetch the released ruleset source → byte-identical to `firestore.rules` on `main`
- regression: hosting and functions steps still succeed in the same run

## Notes
- CI service account is `firebase-adminsdk-fbsvc@danang-hub-app.iam.gserviceaccount.com` — the only SA on the project with user-managed JSON keys, which is what `FIREBASE_SERVICE_ACCOUNT_DANANG_HUB_APP` holds.
- **One IAM grant was required** (2026-07-25): `roles/firebaserules.developer`. Its base role `roles/firebase.sdkAdminServiceAgent` can create rulesets and update releases but lacks `firebaserules.rulesets.test`, and firebase-tools compiles rules server-side via `POST firebaserules.googleapis.com/v1/projects/{p}:test` — so every deploy 403'd. The grant adds `firebaserules.rulesets.test` and **nothing else** to that SA (the role's other permissions were already held).
- It still has **no** `firebaserules.releases.create`, so this works only because the `cloud.firestore` release already exists. A brand-new project needs one manual deploy to bootstrap.
- Full API call path for `--only firestore:rules`, in order: `cloudresourcemanager:testIamPermissions` → `GET firestore/…/databases/(default)` → `POST firebaserules/…:test` → `GET …/releases` → `GET …/rulesets/{id}` → `PATCH …/releases/cloud.firestore` (plus `POST …/rulesets` when the content actually changed). Check permissions against this list, not against the one call that happens to fail first.
- That role also has no `datastore.indexes.*`; `--only firestore` pulls in `firestore.indexes.json` and would fail the job. Index changes stay manual (`firebase deploy --only firestore:indexes` as owner).
- It has **zero** `firebasestorage.*` permissions either — `roles/storage.admin` is GCS, a different surface. `--only storage` calls `firebasestorage.googleapis.com/v1alpha/.../defaultBucket` to resolve the bucket before touching rules, so it 403s on `firebasestorage.defaultBucket.get`. This was tried in the first cut of this spec and broke the merge run: the failure aborted the job and the **Cloud Functions step was skipped**. Storage rules stay a manual owner deploy.
- Deliberately not fixed by granting `roles/firebasestorage.admin` to the CI SA: that is broad write access over the storage bucket, traded for automating a file that has changed once since 2026-02-01. Revisit only if `storage.rules` starts changing often.
- firebase-tools validates and prepares every target before releasing any of them, so a partial failure releases nothing — the aborted run left the existing rulesets untouched rather than half-applying.
- Ordering caveat: hosting deploys first, so for ~1 min the new client runs against old rules. Safe when rules loosen or add collections; a **tightening** rules change paired with a client change should be deployed manually ahead of the merge.
- Related prod-drift class: see the gen-2 functions note — some deploys still can't run from CI as the SA.
