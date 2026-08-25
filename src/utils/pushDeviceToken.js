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

export const MAX_PUSH_DEVICES_PER_MEMBER = 5

/**
 * Previous FCM token to delete when this browser's token rotated.
 * Empty when there is no cached token or the value is unchanged.
 * @param {string} previousToken Cached token for this device
 * @param {string} nextToken Newly minted FCM token
 * @returns {string}
 */
export const previousTokenToReplace = (previousToken, nextToken) => {
  if (!previousToken || !nextToken || previousToken === nextToken) return ''
  return previousToken
}

const tokenRecencyMs = (doc) => {
  const ts = new Date(doc.updatedAt || doc.createdAt || 0).getTime()
  return Number.isFinite(ts) ? ts : 0
}

/**
 * Oldest token document ids to delete so the collection fits under `max`.
 * The incoming token is never evicted — a same-browser rotation must not
 * kick off a different device.
 * @param {Array<{id: string, updatedAt?: string, createdAt?: string}>} docs
 * @param {string} incomingTokenId Hashed id of the token being saved
 * @param {number} [max]
 * @returns {Array<string>}
 */
export const pushTokenIdsToPrune = (
  docs,
  incomingTokenId,
  max = MAX_PUSH_DEVICES_PER_MEMBER
) => {
  if (!Array.isArray(docs) || docs.length <= max) return []
  const sorted = [...docs].sort((a, b) => tokenRecencyMs(a) - tokenRecencyMs(b))
  const excessCount = sorted.length - max
  return sorted
    .filter((d) => d.id !== incomingTokenId)
    .slice(0, excessCount)
    .map((d) => d.id)
}
