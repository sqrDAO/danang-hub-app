/**
 * Generates a deterministic hash for an FCM token string.
 *
 * Truncating SHA-256 to 32 hex chars (128 bits of entropy) ensures brevity for
 * Firestore document IDs while guaranteeing zero collision probability across
 * device tokens for a given member.
 *
 * Callers MUST guard against falsy/empty tokens before calling. This function
 * throws on falsy input rather than returning a sentinel value, so that a bug
 * in a caller cannot silently write to or delete a 'default' document.
 * @param {string} token FCM registration token
 * @returns {Promise<string>} Deterministic 32-char hex token identifier
 */
export const hashPushToken = async (token) => {
  if (!token) throw new Error('hashPushToken: token must be a non-empty string')

  let subtleCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : null

  if (!subtleCrypto) {
    try {
      const nodeCrypto = await import('node:crypto')
      subtleCrypto = nodeCrypto.webcrypto?.subtle || nodeCrypto.default?.webcrypto?.subtle
    } catch {
      // Ignore — not in a Node environment
    }
  }

  if (!subtleCrypto) {
    throw new Error('SHA-256 cryptographic hashing is unavailable in this environment.')
  }

  const msgBuffer = new TextEncoder().encode(token)
  const hashBuffer = await subtleCrypto.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

/**
 * Checks whether a member has push notifications enabled in account preferences.
 * This is the account-level flag — it says whether the member *wants* push on
 * any device, not whether this device is registered.
 * @param {Object} member Member document data
 * @returns {boolean}
 */
export const hasAccountPushEnabled = (member) => Boolean(
  member &&
  member.preferences &&
  member.preferences.pushNotifications === true
)
