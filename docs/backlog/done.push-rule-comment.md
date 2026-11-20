# Keep the push-token comment beside its rule
**Phase**: — · **Deps**: —

## Goal
Resolve [#227](https://github.com/sqrDAO/danang-hub-app/issues/227) by placing the browser push-token explanation immediately before its rule. Preserve every access condition.

## Files
- `firestore.rules` (edited) — move the rate-limit block above the push-token comment.

## Acceptance
- [ ] The push-token comment immediately precedes `match /push_tokens/{userId}`.
- [ ] The server-only import-rate-limit rule remains unchanged.
- [ ] NOT: change any authorization behavior.

## Verify
- `git diff -- firestore.rules` → only the comment/block placement changes.
- `npm run test:rules` → all rules tests pass.
- `npm run lint` → no warnings or errors.
- `npm --prefix functions run lint` → no errors.
- `npm test` → all runnable tests pass.
- `npm run build` → production bundle succeeds.
- Regression: private push-token access and server-only rate-limit protection remain covered by the rules suite.
