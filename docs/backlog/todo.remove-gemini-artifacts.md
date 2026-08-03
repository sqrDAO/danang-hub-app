# Remove remaining Gemini/chatbot artifacts
**Phase**: — · **Deps**: —

## Goal
The 2026-07-27 review's M-4 fix removed the fabricated Gemini AI chatbot claim from
`.github/copilot-instructions.md`, but two other references to the same nonexistent
feature remain and were out of that fix's scope. Remove them so nothing in the repo
still implies a chatbot integration exists.

## Files
- `functions/index.js` (edited) — line 301 comment on `checkSlotAvailability`
  currently reads `// Check slot availability - no auth (for chatbot, public
  availability)`; drop the chatbot reference.
- `.github/workflows/firebase-hosting-merge.yml` (edited) — remove the
  `VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}` line from the build env.
- `.github/workflows/firebase-hosting-pull-request.yml` (edited) — same removal.

## Acceptance
- [ ] `grep -in "gemini\|chatbot" functions/index.js` → no matches.
- [ ] `grep -in "gemini" .github/workflows/firebase-hosting-merge.yml
      .github/workflows/firebase-hosting-pull-request.yml` → no matches.
- [ ] `npm run build` still succeeds (confirms removing the unused env var from the
      workflow doesn't affect the local build, which never read it).
- [ ] NOT: deleting the `VITE_GEMINI_API_KEY` secret itself from GitHub repo settings —
      that's a human action outside this repo's source, not something this spec's diff
      can do.

## Verify
- `grep -in "gemini\|chatbot" functions/index.js` → no output.
- `grep -in "gemini" .github/workflows/*.yml` → no output.
- `npm run build` → succeeds.
- `cd functions && npm run lint` → passes (comment-only change, but keep the gate).

## Notes
`VITE_GEMINI_API_KEY` has zero references anywhere in `src/` or `vite.config.js` —
confirmed via repo-wide grep before writing this spec. The workflow secret reference is
dead weight, not a live wire; removing it changes no build behavior. After this spec
ships, flag to a human that the `VITE_GEMINI_API_KEY` secret in GitHub repo settings can
likely be deleted too, since nothing in the codebase will read it.
