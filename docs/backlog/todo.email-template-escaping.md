# Test complete event email escaping

## Goal
Resolve [#178](https://github.com/sqrDAO/danang-hub-app/issues/178) by exercising the HTML actually sent for approval and rejection emails.

## Files
- `functions/emailHtml.js` — extract the complete event status template.
- `functions/index.js` — invoke the template builder at the existing send path.
- `test/emailHtml.test.js` — inject HTML into title, display name and rejection reason.

## Acceptance
- [ ] Member-supplied text is escaped in complete approval and rejection messages.
- [ ] Existing copy and layout remain equivalent.
- [ ] Missing rejection reason still uses the fallback message.

## Verify
- Run app lint, build, unit tests and Functions lint.
- Compare generated output against the former inline template for both statuses.

## Results
- App lint, Functions lint and production build pass.
- Unit tests report 305 passed and 8 emulator-dependent skips.
- Approval and rejection output matches the prior template after whitespace normalization.
- Tests inject a link, quotes, apostrophe and ampersand into every member-controlled field and verify the legitimate event link survives.
- Live email delivery was not exercised.
