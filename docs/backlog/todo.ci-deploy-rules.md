# Deploy Firestore and Storage rules from CI
**Phase**: — · **Deps**: —

## Goal
`firebase-hosting-merge.yml` deploys hosting and functions but never security rules, so prod rules silently drifted ~2.5 months behind `main` (live ruleset 2026-05-05 = `10bb7d3`; four rules commits unshipped, including the `push_tokens` block — enabling push notifications failed with permission-denied in prod).
Add a rules deploy step so merging to `main` ships rules with the client that depends on them.

## Files
- `.github/workflows/firebase-hosting-merge.yml` (edited) — deploy `firestore:rules` + `storage` after gcloud auth, before functions.
- `README.md` (edited) — note that merges to `main` deploy rules automatically.

## Acceptance
- [ ] Merging to `main` releases `firestore.rules` to the `cloud.firestore` release.
- [ ] Merging to `main` releases `storage.rules` to the storage release.
- [ ] The deploy step is scoped to `firestore:rules`, never bare `firestore`.
- [ ] The rules step runs before the Cloud Functions step.
- [ ] NOT: no Firestore **index** deploys from CI — the CI service account lacks `datastore.indexes.*` and the step would fail.
- [ ] NOT: no change to the rules themselves in this spec.
- [ ] NOT: no change to the pull-request workflow (previews stay hosting-only).

## Verify
- `npx firebase-tools deploy --only firestore:rules,storage --project danang-hub-app --dry-run` → compiles, no index work attempted
- after merge: `firebaserules.googleapis.com/v1/projects/danang-hub-app/releases` → `cloud.firestore` `updateTime` matches the run
- after merge: fetch the released ruleset source → byte-identical to `firestore.rules` on `main`
- regression: hosting and functions steps still succeed in the same run

## Notes
- CI service account is `firebase-adminsdk-fbsvc@danang-hub-app.iam.gserviceaccount.com` (`roles/firebase.sdkAdminServiceAgent`). It has `firebaserules.rulesets.create` and `firebaserules.releases.update` — enough to publish rules — but **no** `firebaserules.releases.create`, so this only works because the `cloud.firestore` and storage releases already exist. A brand-new project would still need one manual deploy first.
- That role also has no `datastore.indexes.*`; `--only firestore` pulls in `firestore.indexes.json` and would fail the job. Index changes stay manual (`firebase deploy --only firestore:indexes` as owner).
- Ordering caveat: hosting deploys first, so for ~1 min the new client runs against old rules. Safe when rules loosen or add collections; a **tightening** rules change paired with a client change should be deployed manually ahead of the merge.
- Related prod-drift class: see the gen-2 functions note — some deploys still can't run from CI as the SA.
