# Native login form submission
**Phase**: — · **Deps**: — · **Issue**: #197

## Goal
Typing Vietnamese with an IME on the login page could submit the form mid-word: a custom Enter handler called `requestSubmit()` on the composition's confirming Enter (#197). Rely on native form submission, which ignores Enter during IME composition.

## Files
- `src/pages/auth/Login.jsx` (edited) — remove the custom Enter `onKeyDown` handler and its prop plumbing

## Acceptance
- [ ] Enter pressed while an IME composition is active does not submit the form.
- [ ] Enter in the email or password field signs in.
- [ ] Enter submits the sign-up form, and "Passwords do not match" still shows.
- [ ] Enter submits the forgot-password form.
- [ ] A password under 6 characters still shows its error with no auth call.
- [ ] Double submits stay blocked while signing in.
- [ ] NOT: changes to `autoComplete` attributes or to the wallet, Google or footer buttons.

## Verify
- `npm run lint && npm test && npm run build` → green (298 pass, 8 emulator-dependent skips)
- `npm run dev:skipauth`, open `/login`: Enter signs in from the email and from the password field; Enter submits sign-up and forgot-password
- regression: with a Vietnamese IME (macOS Telex or Gboard), type a name or password and confirm a word with Enter → no submit until a final Enter

## Notes
- The only button inside the `<form>` is the submit button; "Forgot password" is `type="button"`, and the wallet, Google and footer buttons sit outside it.
- Composition was checked with a synthetic IME session over the Chrome debugger protocol; a real OS IME is still to be tried.
