# Validate chain and address in verifyWalletSignature
**Phase**: — · **Deps**: —

## Goal
`generateWalletNonce` whitelists the chain and regex-validates the address, but
`verifyWalletSignature` only checks both are truthy — so an unknown `chain` falls
through both verify branches, leaves `uid` undefined, and throws an opaque `internal`
*after* the transaction already consumed the nonce. Validate before spending the nonce.

## Files
- `functions/index.js` (edited) — extract the chain whitelist and the
  ethereum/solana address regexes into module-level constants plus one
  `assertValidWalletInput(address, chain)` helper; call it at the top of both
  `generateWalletNonce` (~line 1405) and `verifyWalletSignature` (~line 1452), before
  the nonce transaction.

## Acceptance
- [ ] `verifyWalletSignature` rejects a `chain` outside `{ethereum, solana}` with `invalid-argument`.
- [ ] `verifyWalletSignature` rejects a malformed address with `invalid-argument`.
- [ ] Both rejections happen before the nonce document is read or deleted.
- [ ] `generateWalletNonce` behavior and error messages are unchanged.
- [ ] The address regexes exist in exactly one place in `functions/index.js`.
- [ ] NOT: no change to the signature-recovery logic for either chain.
- [ ] NOT: no change to the `eth_<addr>` / `sol_<addr>` uid format.
- [ ] NOT: no client changes in `src/services/walletAuth.js`.

## Verify
- `cd functions && npm run lint` → exit 0
- `cd functions && npm run shell`, then in the shell:
  1. `generateWalletNonce({address: "0x1111111111111111111111111111111111111111", chain: "ethereum"})`
     → returns `{nonce}` and creates `nonces/0x1111111111111111111111111111111111111111`
  2. `verifyWalletSignature({address: "0x1111111111111111111111111111111111111111", signature: "0x" + "11".repeat(65), chain: "dogecoin"})`
     → `invalid-argument`
  3. in the Emulator UI, `nonces/0x1111111111111111111111111111111111111111` still holds
     the `nonce` value from step 1 (proves the nonce was not consumed)
- same shell: `verifyWalletSignature({address: "a/b", signature: "0x" + "11".repeat(65), chain: "ethereum"})`
  → `invalid-argument`, and no Firestore `INVALID_ARGUMENT` document-path error in the log
- regression: full MetaMask and Phantom sign-in through `npm run dev` both still mint a
  custom token and land on the member dashboard

## Notes
Not an impersonation path — recovery still has to match the claimed address, so an
attacker needs the key. The fix is about failing early and legibly instead of burning
the user's nonce on a 500.

The address is also used unvalidated as a Firestore document id
(`db.collection("nonces").doc(address)`, line ~1465), which is the second half of why
validation belongs before the transaction.
