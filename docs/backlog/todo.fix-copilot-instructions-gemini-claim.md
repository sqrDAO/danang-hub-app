# Remove fabricated Gemini AI claim from copilot-instructions.md
**Phase**: — · **Deps**: —

## Goal
`.github/copilot-instructions.md` (newly tracked this week, specifically to fix drift and
stale facts in what had been a gitignored file) claims the stack includes "Google Gemini
AI," describes a `src/services/gemini.js` "agentic loop with tool-calling," and says
`checkSlotAvailability` is "used by the AI chatbot." None of this exists anywhere in the
repo. Remove the fabricated claims so Copilot sessions stop being told about a subsystem
that was never built.

## Files
- `.github/copilot-instructions.md` (edited) — remove "Google Gemini AI" from the Stack
  line (~line 20); remove the `gemini.js` bullet from the Service Layer list (~line 33);
  change the `checkSlotAvailability` description (~line 34) to match README.md's actual
  wording ("public availability check", not "used by AI chatbot").

## Acceptance
- [ ] `.github/copilot-instructions.md` contains no reference to Gemini, generative AI, or a chatbot.
- [ ] The Service Layer list in the file matches the actual contents of `src/services/` — no entries for files that don't exist.
- [ ] NOT: no other section of the file rewritten — this spec only removes the fabricated claims, it does not re-audit the rest of the file.

## Verify
- `grep -in "gemini\|chatbot" .github/copilot-instructions.md` → no matches
- `ls src/services/` compared against the Service Layer bullet list in the file → every
  listed filename exists
- `npm run lint && npm run build` → green (doc-only change, but keep the gate consistent)

## Notes
Found during the 2026-07-27 weekly review. The commit that introduced this file
(`073c3c9`, this week) explicitly stated its purpose was correcting stale facts the
gitignored version had accumulated — this fabrication wasn't stale drift from an old
version, it appears to have been introduced fresh in that same commit, so there's no
prior "correct" wording to restore from; the replacement text above is written to match
what `README.md` and `docs/knowledge/data-flow.md` already say about
`checkSlotAvailability`.
