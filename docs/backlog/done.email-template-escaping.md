# Test complete event email escaping
**Phase**: — · **Deps**: —

## Goal
Address the template-test portion of [#178](https://github.com/sqrDAO/danang-hub-app/issues/178) by exercising the HTML actually sent for approval and rejection emails. Keep output unchanged while protecting the current member-controlled fields from escaping regressions.

## Files
- `functions/emailHtml.js` (edited) — extract the complete event status template beside the existing escaping helper.
- `functions/index.js` (edited) — invoke the template builder at the existing send path.
- `test/emailHtml.test.js` (edited) — inject HTML into title, display name and rejection reason.

## Acceptance
- [ ] Event titles are escaped in approval and rejection messages.
- [ ] Recipient display names are escaped in both message types.
- [ ] Rejection feedback is escaped.
- [ ] Missing rejection feedback uses the existing fallback message.
- [ ] Existing copy and rendered layout remain equivalent.
- [ ] Legitimate event and guideline links remain intact.
- [ ] NOT: change email delivery or introduce an escape-by-default templating API.

## Verify
- `node --test test/emailHtml.test.js` → 12 tests pass, covering complete messages and the escaping helper.
- `npm test` → no failed unit tests; emulator-dependent tests may skip.
- `npm run lint` → no errors or warnings.
- `npm run build` → production bundle succeeds.
- `npm --prefix functions run lint` → no errors.
- Regression: compare approval and rejection output to the pre-extraction template after normalizing whitespace; text and markup remain equivalent.

## Notes
An escape-by-default `html` tag with an explicit `raw()` escape hatch was considered and deferred. It would change composition of trusted markup fragments beyond this extraction and require its own API contract and regression coverage. These tests protect the three current member-controlled fields; they cannot automatically detect a future field added without escaping. #178 remains open for that broader protection. No live email delivery is claimed by these pure-template checks.
