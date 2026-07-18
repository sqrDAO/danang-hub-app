# Lint guard against positional invalidateQueries regression
**Phase**: — · **Deps**: —

## Goal
On v5, `invalidateQueries(['key'])` doesn't throw — the array destructures to an empty filter and silently invalidates every cached query, and nothing in lint or build catches a reintroduced call. Add a `no-restricted-syntax` rule so the exact bug fixed in PR #20 can't return undetected.

## Files
- `.eslintrc.cjs` (edited) — add to the `src/**` override: `no-restricted-syntax` with selector `CallExpression[callee.property.name='invalidateQueries'] > ArrayExpression:first-child` (or the `[arguments.0.type='ArrayExpression']` attribute form) and a message pointing to the `{ queryKey: [...] }` form

## Acceptance
- [ ] `queryClient.invalidateQueries(['x'])` added to any `src/**` file fails `npm run lint`
- [ ] The object form `invalidateQueries({ queryKey: ['x'] })` still lints clean
- [ ] Current tree passes lint with 0 warnings (ratchet respected)
- [ ] NOT: no `eslint-disable` added anywhere; no other rules changed

## Verify
- `npm run lint` → green on current tree
- temporarily add `queryClient.invalidateQueries(['x'])` to a src file → `npm run lint` fails with the custom message; revert
- regression: `cd functions && npm run lint` unaffected

## Notes
`@tanstack/eslint-plugin-query` has no rule for this class of error, so core-eslint `no-restricted-syntax` is the right altitude. Consider also matching sibling methods (`refetchQueries`, `removeQueries`, `resetQueries`, `cancelQueries`) in the same selector list — cheap to include.
