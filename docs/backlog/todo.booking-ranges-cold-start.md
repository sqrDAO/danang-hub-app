# Hide the booking calendar's cold start
**Phase**: — · **Deps**: —

## Goal
The member calendar waits on `getAmenityBookingRanges`, and 18 of 30 member calls
(Oct 19–30) hit a 3–5s cold start (issue #130). Warm the function when
/member/bookings opens, and stop every function from loading wallet and email
libraries it does not use.

## Files
- `functions/index.js` (edited) — `require` `ethers`, `tweetnacl` and `bs58` inside
  `verifyWalletSignature`'s chain branches, and `nodemailer` inside `getTransporter`,
  instead of at the top of the file.
- `src/services/functions.js` (edited) — `warmAmenityBookingRanges()`: one callable
  call with no amenity, every error swallowed, skipped in local dev mode.
- `src/pages/member/Bookings.jsx` (edited) — call it once when the page mounts.

## Acceptance
- [ ] The top of `functions/index.js` no longer requires `ethers`, `tweetnacl`, `bs58` or `nodemailer`.
- [ ] Opening /member/bookings sends one `getAmenityBookingRanges` request before any amenity is picked.
- [ ] That request's `invalid-argument` rejection shows no toast and no console error.
- [ ] In local dev mode (`LOCAL_DEV_MODE`) no warm-up request is sent.
- [ ] NOT: no change to `getAmenityBookingRanges`'s validation, query or response.
- [ ] NOT: no `minInstances` and no region change.
- [ ] NOT: no warm-up on the admin bookings page.

## Verify
- `npm run lint && npm run build && npm test` → all green
- `cd functions && npm run lint` → exit 0
- `npm run dev` against real Firebase, sign in, open /member/bookings, DevTools Network
  → one `getAmenityBookingRanges` request answered 400 `invalid-argument`, console clean
- same page, pick a desk → the calendar loads its busy slots as before
- after deploy, with the function idle 30+ minutes: open /member/bookings, wait ~5s,
  pick a desk → busy slots appear in about 1s instead of about 5s
- regression: MetaMask and Phantom sign-in still mint a token; an event approval
  still sends its email (both now load their library on first use)

## Notes
Picking an amenity opens the modal straight onto the calendar step, so prefetching
on that click (the issue's other idea) has no gap to hide.

Measured locally: the four libraries take ~110ms of the ~450ms `index.js` load.
Every Gen-2 function loads all of `index.js` at boot, so each one saves that share;
the rest of the cold start is container boot, which only the warm-up hides.
