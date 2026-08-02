# Fix npm test discovery and the stale "no test suite" claims
**Phase**: — · **Deps**: —

## Goal
PR #54 added `test/mobilePushEligibility.test.js` and an `npm test` script, but three docs
still tell readers (and Copilot) that no test suite exists, and the script's `find` glob
matches macOS AppleDouble sidecar files, so `npm test` fails on any checkout on an
exFAT/SMB volume. Make the command work and the docs true.

## Files
- `package.json` (edited) — `scripts.test`: exclude `._*` from the `find` glob.
- `CLAUDE.md` (edited) — line 18 (Commands) and line 47 (Checks): replace "No test suite"
  with the real command and what it covers.
- `.github/copilot-instructions.md` (edited) — line 23: replace "No test suite currently
  exists."
- `README.md` (edited) — Commands table (~line 341): add the missing `npm test` row.

## Acceptance
- [ ] `npm test` exits 0 on a working tree containing `test/._*.test.js` sidecar files.
- [ ] `npm test` still runs `test/mobilePushEligibility.test.js` (4 passing assertions).
- [ ] No *current-state* doc claims the project has no test suite (`CLAUDE.md`, `README.md`, `.github/copilot-instructions.md`).
- [ ] `README.md`'s Commands table lists `npm test`.
- [ ] `CLAUDE.md`'s Checks section lists `npm test` alongside lint and build.
- [ ] NOT: no new tests written — this fixes discovery and docs only.
- [ ] NOT: no test framework added; stays on `node --test`.
- [ ] NOT: no change to `test/mobilePushEligibility.test.js`.
- [ ] NOT: no edits to `docs/reviews/*` — dated reviews are point-in-time records and were accurate when written.

## Verify
- `npm test` → exit 0, `pass 4`, `fail 0`
- `ls test/._*` present locally → confirms the sidecar case is actually exercised
- `grep -rn -i "no test suite" CLAUDE.md README.md .github/copilot-instructions.md` → no matches
  (`docs/reviews/*` still match by design — see the NOT above)
- `npm run lint && npm run build` → exit 0
- regression: `cd functions && npm run lint` → exit 0

## Notes
The AppleDouble files (`._name`) are macOS resource forks, created because this repo lives
on a non-APFS volume (`/Volumes/MAIN DISK`). They are gitignored, so CI never sees them and
`npm test` passes there — this failure is local-only, which is exactly why it went unnoticed
when the script landed. `-not -name '._*'` is the minimal guard; `find`'s `-name` runs before
`node --test` sees the paths, so no runner change is needed.

Commit `a3582c1` already attempted "fix npm test discovery"; that pass changed the glob but
did not account for the sidecar files.
