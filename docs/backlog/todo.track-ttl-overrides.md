# Track the OAuth TTL field overrides in firestore.indexes.json
**Phase**: — · **Deps**: — · **Issue**: #305

## Goal
The six TTL policies that delete expired OAuth docs were enabled live during #263
and never added to `firestore.indexes.json`, so an index deploy with `--force`
would delete them. Track them in the file so the repo matches production.

## Files
- `firestore.indexes.json` (edited) — add `fieldOverrides` for `expiresAt` on
  `oauthClients`, `oauthCodes`, `oauthGrants`, `oauthRateLimits`,
  `oauthRequests`, `oauthTokens`

## Acceptance
- [ ] `fieldOverrides` holds exactly the six entries the live project reports
- [ ] Each entry sets `"ttl": true`
- [ ] Each entry keeps the default single-field indexes (ASC, DESC, array CONTAINS)
- [ ] `indexes` (composite) is unchanged
- [ ] NOT: a new TTL policy on `push_notifications` or any other collection
- [ ] NOT: changes to how any function writes `expiresAt`

## Verify
- `firebase firestore:indexes --project danang-hub-app > /tmp/live.json && node -e "const a=require('/tmp/live.json').fieldOverrides,b=require('./firestore.indexes.json').fieldOverrides;const s=x=>JSON.stringify([...x].sort((p,q)=>p.collectionGroup.localeCompare(q.collectionGroup)));console.log(s(a)===s(b)?'match':'DIFF')"` → `match`
- `git diff origin/main -- firestore.indexes.json` → only `fieldOverrides` added
- after merge, `firebase deploy --only firestore:indexes` → no "field overrides … not present" warning

## Notes
An override with an empty `indexes` array would turn off single-field indexing on
`expiresAt`, so the default index list has to be spelled out.
