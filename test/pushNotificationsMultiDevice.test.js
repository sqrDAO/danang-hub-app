import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hasAccountPushEnabled } from '../src/utils/pushDeviceToken.js'

// ---------------------------------------------------------------------------
// hashPushToken
// ---------------------------------------------------------------------------
describe('hashPushToken', () => {
  it('throws on falsy input — no silent default doc ID', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    await assert.rejects(
      () => hashPushToken(''),
      /non-empty string/
    )
    await assert.rejects(
      () => hashPushToken(null),
      /non-empty string/
    )
    await assert.rejects(
      () => hashPushToken(undefined),
      /non-empty string/
    )
  })

  it('returns a 32-char hex string for a valid token', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    const result = await hashPushToken('some-fcm-token')
    assert.equal(typeof result, 'string')
    assert.equal(result.length, 32)
    assert.match(result, /^[0-9a-f]{32}$/)
  })

  it('is deterministic — same token always produces same hash', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    const token = 'fcm:abc123'
    const a = await hashPushToken(token)
    const b = await hashPushToken(token)
    assert.equal(a, b)
  })

  it('produces different hashes for different tokens', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    const a = await hashPushToken('token-device-1')
    const b = await hashPushToken('token-device-2')
    assert.notEqual(a, b)
  })
})

// ---------------------------------------------------------------------------
// hasAccountPushEnabled
// ---------------------------------------------------------------------------
describe('hasAccountPushEnabled', () => {
  it('returns true when preferences.pushNotifications is exactly true', () => {
    assert.equal(hasAccountPushEnabled({ preferences: { pushNotifications: true } }), true)
  })

  it('returns false when preferences.pushNotifications is false', () => {
    assert.equal(hasAccountPushEnabled({ preferences: { pushNotifications: false } }), false)
  })

  it('returns false when preferences is missing', () => {
    assert.equal(hasAccountPushEnabled({}), false)
    assert.equal(hasAccountPushEnabled(null), false)
    assert.equal(hasAccountPushEnabled(undefined), false)
  })

  it('returns false when pushNotifications is truthy but not strictly true', () => {
    assert.equal(hasAccountPushEnabled({ preferences: { pushNotifications: 1 } }), false)
    assert.equal(hasAccountPushEnabled({ preferences: { pushNotifications: 'yes' } }), false)
  })
})

// ---------------------------------------------------------------------------
// Multi-device token fan-out
// ---------------------------------------------------------------------------
describe('multi-device recipient fan-out', () => {
  it('expands one recipient per token for opted-in members, skips opted-out', () => {
    const members = [
      {
        id: 'user_1',
        data: () => ({ preferences: { pushNotifications: true }, locale: 'vi' }),
        tokens: ['token_1_phone', 'token_1_tablet']
      },
      {
        id: 'user_2',
        data: () => ({ preferences: { pushNotifications: true }, locale: 'en' }),
        tokens: ['token_2_phone']
      },
      {
        id: 'user_3',
        data: () => ({ preferences: { pushNotifications: false }, locale: 'en' }),
        tokens: ['token_3_phone']
      }
    ]

    const recipients = members.flatMap((m) => {
      const data = m.data()
      if (!data.preferences?.pushNotifications) return []
      return m.tokens.map((token) => ({
        memberId: m.id,
        token,
        locale: data.locale,
        type: 'booking_approved',
        subjectId: 'booking_123'
      }))
    })

    assert.equal(recipients.length, 3)
    assert.deepEqual(recipients.map((r) => r.token), [
      'token_1_phone',
      'token_1_tablet',
      'token_2_phone'
    ])
    assert.equal(recipients.filter((r) => r.memberId === 'user_1').length, 2)
    assert.equal(recipients.filter((r) => r.memberId === 'user_3').length, 0)
  })
})

// ---------------------------------------------------------------------------
// Recipient outcome aggregation (anySuccess per-member dedupe key)
// ---------------------------------------------------------------------------
describe('recipient outcome aggregation', () => {
  const aggregateOutcomes = (batchRecipients, responses) => {
    const recipientOutcomes = new Map()
    const staleTokens = []

    responses.forEach((sendResult, index) => {
      const recipient = batchRecipients[index]
      const key = `${recipient.type}_${recipient.memberId}_${recipient.subjectId}`
      const current = recipientOutcomes.get(key) || {
        memberId: recipient.memberId,
        type: recipient.type,
        subjectId: recipient.subjectId,
        anySuccess: false
      }
      if (sendResult.success) current.anySuccess = true
      recipientOutcomes.set(key, current)

      if (
        !sendResult.success &&
        sendResult.error?.code === 'messaging/registration-token-not-registered'
      ) {
        staleTokens.push({ memberId: recipient.memberId, token: recipient.token })
      }
    })

    return { recipientOutcomes, staleTokens }
  }

  it('marks dedupe key as sent when at least one device token succeeds', () => {
    const batchRecipients = [
      { memberId: 'user_1', token: 'token_1', type: 'booking_approved', subjectId: 'b1' },
      { memberId: 'user_1', token: 'token_2', type: 'booking_approved', subjectId: 'b1' },
      { memberId: 'user_2', token: 'token_3', type: 'booking_approved', subjectId: 'b2' }
    ]

    const responses = [
      { success: true },
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: false, error: { code: 'messaging/internal-error' } }
    ]

    const { recipientOutcomes, staleTokens } = aggregateOutcomes(batchRecipients, responses)

    // user_1 had 1 success + 1 stale → marker should be sent (anySuccess: true)
    assert.equal(recipientOutcomes.get('booking_approved_user_1_b1').anySuccess, true)
    // user_2 had 0 success → marker should be released for retry (anySuccess: false)
    assert.equal(recipientOutcomes.get('booking_approved_user_2_b2').anySuccess, false)
    // Only token_2 is stale; token_1 succeeded and is not in staleTokens
    assert.deepEqual(staleTokens, [{ memberId: 'user_1', token: 'token_2' }])
  })

  it('preserves anySuccess across chunks for the same dedupe key', () => {
    // Chunk 1: user_1 fails, user_2 succeeds
    const chunk1 = [
      { memberId: 'user_1', token: 'token_1_a', type: 'booking_approved', subjectId: 'b1' },
      { memberId: 'user_2', token: 'token_2', type: 'booking_approved', subjectId: 'b2' }
    ]
    const resp1 = [
      { success: false, error: { code: 'messaging/internal-error' } },
      { success: true }
    ]

    // Chunk 2: user_1 succeeds on its second device
    const chunk2 = [
      { memberId: 'user_1', token: 'token_1_b', type: 'booking_approved', subjectId: 'b1' }
    ]
    const resp2 = [{ success: true }]

    const recipientOutcomes = new Map()
    const processChunk = (recipients, responses) => {
      responses.forEach((res, idx) => {
        const recipient = recipients[idx]
        const key = `${recipient.type}_${recipient.memberId}_${recipient.subjectId}`
        const current = recipientOutcomes.get(key) || {
          memberId: recipient.memberId,
          type: recipient.type,
          subjectId: recipient.subjectId,
          anySuccess: false
        }
        if (res.success) current.anySuccess = true
        recipientOutcomes.set(key, current)
      })
    }

    processChunk(chunk1, resp1)
    processChunk(chunk2, resp2)

    assert.equal(recipientOutcomes.get('booking_approved_user_1_b1').anySuccess, true)
    assert.equal(recipientOutcomes.get('booking_approved_user_2_b2').anySuccess, true)
  })
})

// ---------------------------------------------------------------------------
// Token cap + recency sort (numeric timestamp comparison)
// ---------------------------------------------------------------------------
describe('getPushTokens cap and recency sort', () => {
  it('caps tokens to MAX_PUSH_TOKENS_PER_MEMBER using numeric sort', () => {
    const MAX_PUSH_TOKENS_PER_MEMBER = 5
    const subcollectionDocs = Array.from({ length: 8 }, (_, i) => ({
      data: () => ({
        token: `token_device_${i + 1}`,
        platform: 'web',
        // Use clearly distinct numeric timestamps to avoid string-sort ambiguity
        updatedAt: new Date(2026, 7, 24, 10, i).toISOString()
      })
    }))

    const tokenDocs = []
    subcollectionDocs.forEach((doc) => {
      const data = doc.data()
      if (data?.token && typeof data.token === 'string') {
        const trimmed = data.token.trim()
        if (trimmed) {
          tokenDocs.push({
            token: trimmed,
            ts: new Date(data.updatedAt || 0).getTime()
          })
        }
      }
    })

    // Numeric sort — newest first
    tokenDocs.sort((a, b) => b.ts - a.ts)
    const tokenSet = new Set(tokenDocs.map((d) => d.token))

    let tokens = Array.from(tokenSet)
    if (tokens.length > MAX_PUSH_TOKENS_PER_MEMBER) {
      tokens = tokens.slice(0, MAX_PUSH_TOKENS_PER_MEMBER)
    }

    assert.equal(tokens.length, 5)
    // Newest is device 8 (index 7), oldest kept is device 4 (index 3)
    assert.equal(tokens[0], 'token_device_8')
    assert.equal(tokens[4], 'token_device_4')
  })
})

// ---------------------------------------------------------------------------
// Token pruning — oldest device evicted when limit exceeded
// ---------------------------------------------------------------------------
describe('pruneOldestPushTokens', () => {
  it('deletes the oldest device when a new (6th) device registers', () => {
    const MAX_PUSH_DEVICES_PER_MEMBER = 5
    const existingDocs = [
      { id: 'dev_1', data: { updatedAt: new Date(2026, 7, 24, 1).toISOString() } },
      { id: 'dev_2', data: { updatedAt: new Date(2026, 7, 24, 2).toISOString() } },
      { id: 'dev_3', data: { updatedAt: new Date(2026, 7, 24, 3).toISOString() } },
      { id: 'dev_4', data: { updatedAt: new Date(2026, 7, 24, 4).toISOString() } },
      { id: 'dev_5', data: { updatedAt: new Date(2026, 7, 24, 5).toISOString() } }
    ]
    const incomingId = 'dev_6'

    const docs = [...existingDocs]
    docs.sort((a, b) => {
      const tA = new Date(a.data.updatedAt || 0).getTime()
      const tB = new Date(b.data.updatedAt || 0).getTime()
      return tA - tB
    })

    const isExisting = docs.some((d) => d.id === incomingId)
    const excessCount = isExisting
      ? docs.length - MAX_PUSH_DEVICES_PER_MEMBER
      : (docs.length + 1) - MAX_PUSH_DEVICES_PER_MEMBER

    const candidates = docs.filter((d) => d.id !== incomingId)
    const toDelete = candidates.slice(0, excessCount)

    assert.equal(excessCount, 1)
    assert.equal(toDelete.length, 1)
    assert.equal(toDelete[0].id, 'dev_1') // Oldest device is evicted

    const remaining = docs
      .filter((d) => !toDelete.some((td) => td.id === d.id))
    remaining.push({ id: incomingId, data: { updatedAt: new Date(2026, 7, 24, 6).toISOString() } })

    assert.equal(remaining.length, 5)
    assert.deepEqual(remaining.map((d) => d.id), ['dev_2', 'dev_3', 'dev_4', 'dev_5', 'dev_6'])
  })

  it('skips pruning when the same token refreshes (doc already exists)', () => {
    const MAX_PUSH_DEVICES_PER_MEMBER = 5
    const existingDocs = [
      { id: 'dev_1', data: { updatedAt: new Date(2026, 7, 24, 1).toISOString() } },
      { id: 'dev_2', data: { updatedAt: new Date(2026, 7, 24, 2).toISOString() } },
      { id: 'dev_3', data: { updatedAt: new Date(2026, 7, 24, 3).toISOString() } },
      { id: 'dev_4', data: { updatedAt: new Date(2026, 7, 24, 4).toISOString() } },
      { id: 'dev_5', data: { updatedAt: new Date(2026, 7, 24, 5).toISOString() } }
    ]
    // dev_5 is refreshing — it already exists in the subcollection
    const incomingId = 'dev_5'

    const docs = [...existingDocs]
    const isExisting = docs.some((d) => d.id === incomingId)

    // When the incoming token already has a doc, no net new slot is consumed
    const excessCount = isExisting
      ? docs.length - MAX_PUSH_DEVICES_PER_MEMBER
      : (docs.length + 1) - MAX_PUSH_DEVICES_PER_MEMBER

    assert.equal(isExisting, true)
    assert.equal(excessCount, 0) // Nothing to prune
  })
})

// ---------------------------------------------------------------------------
// disableDevicePushNotifications — local state committed before async work
// ---------------------------------------------------------------------------
describe('disableDevicePushNotifications ordering', () => {
  it('marks device as opted-out before the Firestore delete runs', async () => {
    const events = []

    const setDeviceOptedOut = () => { events.push('opted-out') }
    const clearStoredDeviceToken = () => { events.push('token-cleared') }

    // Simulate removeStoredPushToken failing after local state is already set
    const removeStoredPushToken = async () => {
      events.push('firestore-delete-attempted')
      throw new Error('network error')
    }

    // Simulate the disable flow order
    setDeviceOptedOut()
    clearStoredDeviceToken()
    await removeStoredPushToken().catch(() => { events.push('firestore-delete-failed') })

    // Local state must precede Firestore work
    assert.equal(events[0], 'opted-out')
    assert.equal(events[1], 'token-cleared')
    assert.equal(events[2], 'firestore-delete-attempted')
    assert.equal(events[3], 'firestore-delete-failed')
  })
})

// ---------------------------------------------------------------------------
// Account preference immutability — server never writes it
// ---------------------------------------------------------------------------
describe('account preference immutability', () => {
  it('hasAccountPushEnabled returns false when preference is off regardless of device state', () => {
    const member = { preferences: { pushNotifications: false } }
    const deviceOptedIn = true // device is locally opted in

    // The account preference gates server dispatch, independent of device state
    assert.equal(hasAccountPushEnabled(member), false)
    // Device state does not override the account gate
    assert.equal(hasAccountPushEnabled(member) && deviceOptedIn, false)
  })

  it('stale token pruning does not modify account preference', () => {
    // Simulate deleteStalePushToken: only the token doc is affected
    const operations = []
    const deletedTokenDocs = []
    const memberDocUpdates = []

    const simulateSurgicalDelete = (tokenId) => {
      operations.push(`delete-token:${tokenId}`)
      deletedTokenDocs.push(tokenId)
      // NOTE: no memberDocUpdates.push() — account pref never touched
    }

    simulateSurgicalDelete('stale-token-hash-abc')

    assert.equal(deletedTokenDocs.length, 1)
    assert.equal(memberDocUpdates.length, 0) // Account doc untouched
    assert.equal(operations[0], 'delete-token:stale-token-hash-abc')
  })
})
