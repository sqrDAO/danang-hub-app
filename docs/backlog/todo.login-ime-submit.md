# Native login form submission

## Goal
Resolve [#197](https://github.com/sqrDAO/danang-hub-app/issues/197) by relying on native form submission, which respects IME composition.

## Files
- `src/pages/auth/Login.jsx` — remove the redundant Enter handler and its prop plumbing.

## Acceptance
- [ ] Sign-in, sign-up and password-reset forms retain native submit buttons and submit handlers.
- [ ] Enter keydown no longer calls requestSubmit during composition.

## Verify
- App lint, Functions lint, build and unit tests pass.
- Browser-check native Enter and composition events on the actual form markup.

## Results
- App lint, Functions lint, build and 298 tests pass; 8 emulator-dependent tests skipped.
- Chrome harness extracted from EmailAuthForm verifies native Enter in email/password and sign-up confirmation inputs.
- Synthetic composing Enter does not invoke submission. Real OS IME sessions and live authentication remain unverified.
