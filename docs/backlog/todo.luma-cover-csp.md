# Allow imported Luma covers through CSP
**Phase**: — · **Deps**: —

## Goal
Resolve [#226](https://github.com/sqrDAO/danang-hub-app/issues/226) by allowing the exact Luma cover origin in `connect-src`. Cover downloads must remain possible when the report-only policy is later enforced.

## Files
- `firebase.json` (edited) — add the exact HTTPS image origin to `connect-src`.

## Acceptance
- [ ] `connect-src` permits `https://images.lumacdn.com`.
- [ ] A Luma cover fetch succeeds under a locally enforcing copy of the policy without a CSP violation.
- [ ] Other image hosts remain blocked by `connect-src` unless already allowed.
- [ ] NOT: enforce CSP in production or add a wildcard source.

## Verify
- `npm run lint` → no errors or warnings.
- `npm run build` → production bundle succeeds.
- `npm test` → no failing unit tests.
- `npm --prefix functions run lint` → no errors.
- Regression: serve the configured policy as an enforcing header locally, fetch a fixture cover from the exact Luma origin in Chrome, and observe no `connect-src` violation; repeat with the origin removed and with an unrelated image origin to confirm blocking.

## Notes
- #196 owns the broader enforcement rollout; production stays report-only.
- Browser verification may use an intercepted image response to isolate CSP from CDN availability/CORS. Such verification does not establish live CDN availability.
