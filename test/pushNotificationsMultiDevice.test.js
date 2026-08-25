import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  hasAccountPushEnabled,
  previousTokenToReplace,
  pushTokenIdsToPrune
} from '../src/utils/pushDeviceToken.js'

const require = createRequire(import.meta.url)
const {
  MAX_PUSH_TOKENS_PER_MEMBER,
  readPushTokenRecord,
  selectPushTokens
} = require('../functions/pushTokens.js')

describe('hashPushToken', () => {
  it('throws on falsy input — no silent default doc ID', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    await assert.rejects(() => hashPushToken(''), /non-empty string/)
    await assert.rejects(() => hashPushToken(null), /non-empty string/)
    await assert.rejects(() => hashPushToken(undefined), /non-empty string/)
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
    assert.equal(await hashPushToken(token), await hashPushToken(token))
  })

  it('produces different hashes for different tokens', async () => {
    const { hashPushToken } = await import('../src/utils/pushDeviceToken.js')
    assert.notEqual(
      await hashPushToken('token-device-1'),
      await hashPushToken('token-device-2')
    )
  })
})

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

describe('selectPushTokens', () => {
  const iso = (hour) => new Date(2026, 7, 24, 10, hour).toISOString()

  it('caps to MAX_PUSH_TOKENS_PER_MEMBER newest-first', () => {
    const docs = Array.from({ length: 8 }, (_, i) =>
      readPushTokenRecord({ token: `token_device_${i + 1}`, updatedAt: iso(i) })
    )
    const tokens = selectPushTokens(docs, MAX_PUSH_TOKENS_PER_MEMBER)
    assert.equal(tokens.length, 5)
    assert.equal(tokens[0], 'token_device_8')
    assert.equal(tokens[4], 'token_device_4')
  })

  it('merges the legacy token when the subcollection is already populated', () => {
    const sub = [
      readPushTokenRecord({ token: 'token_new_phone', updatedAt: iso(8) })
    ]
    const legacy = readPushTokenRecord({
      token: 'token_legacy_phone',
      updatedAt: iso(1)
    })
    const tokens = selectPushTokens([...sub, legacy], MAX_PUSH_TOKENS_PER_MEMBER)
    assert.deepEqual(tokens, ['token_new_phone', 'token_legacy_phone'])
  })

  it('does not duplicate a legacy token that already exists in the subcollection', () => {
    const shared = 'token_same_phone'
    const sub = [readPushTokenRecord({ token: shared, updatedAt: iso(8) })]
    const legacy = readPushTokenRecord({ token: shared, updatedAt: iso(1) })
    const tokens = selectPushTokens([...sub, legacy], MAX_PUSH_TOKENS_PER_MEMBER)
    assert.deepEqual(tokens, [shared])
  })

  it('skips empty or missing token values', () => {
    assert.equal(readPushTokenRecord({ token: '  ' }), null)
    assert.equal(readPushTokenRecord({ token: 1 }), null)
    assert.deepEqual(selectPushTokens([null, { token: '' }], 5), [])
  })
})

describe('previousTokenToReplace', () => {
  it('returns the previous token when FCM rotated to a new value', () => {
    assert.equal(previousTokenToReplace('old-token', 'new-token'), 'old-token')
  })

  it('returns empty when this is the first save or the token is unchanged', () => {
    assert.equal(previousTokenToReplace('', 'new-token'), '')
    assert.equal(previousTokenToReplace('same', 'same'), '')
    assert.equal(previousTokenToReplace('old-token', ''), '')
  })
})

describe('pushTokenIdsToPrune', () => {
  const docs = [
    { id: 'dev_1', updatedAt: new Date(2026, 7, 24, 1).toISOString() },
    { id: 'dev_2', updatedAt: new Date(2026, 7, 24, 2).toISOString() },
    { id: 'dev_3', updatedAt: new Date(2026, 7, 24, 3).toISOString() },
    { id: 'dev_4', updatedAt: new Date(2026, 7, 24, 4).toISOString() },
    { id: 'dev_5', updatedAt: new Date(2026, 7, 24, 5).toISOString() },
    { id: 'dev_6', updatedAt: new Date(2026, 7, 24, 6).toISOString() }
  ]

  it('deletes the oldest device when a 6th token is already written', () => {
    assert.deepEqual(pushTokenIdsToPrune(docs, 'dev_6', 5), ['dev_1'])
  })

  it('never evicts the incoming token even if it is the oldest', () => {
    assert.deepEqual(pushTokenIdsToPrune(docs, 'dev_1', 5), ['dev_2'])
  })

  it('skips pruning at or under the cap', () => {
    assert.deepEqual(pushTokenIdsToPrune(docs.slice(0, 5), 'dev_5', 5), [])
  })
})

describe('recipient outcome aggregation', () => {
  const aggregateOutcomes = (batchRecipients, responses) => {
    const recipientOutcomes = new Map()
    responses.forEach((sendResult, index) => {
      const recipient = batchRecipients[index]
      const key = `${recipient.type}_${recipient.memberId}_${recipient.subjectId}`
      const current = recipientOutcomes.get(key) || { anySuccess: false }
      if (sendResult.success) current.anySuccess = true
      recipientOutcomes.set(key, current)
    })
    return recipientOutcomes
  }

  it('marks the member sent when at least one device succeeds', () => {
    const outcomes = aggregateOutcomes(
      [
        { memberId: 'user_1', type: 'booking_approved', subjectId: 'b1' },
        { memberId: 'user_1', type: 'booking_approved', subjectId: 'b1' },
        { memberId: 'user_2', type: 'booking_approved', subjectId: 'b2' }
      ],
      [
        { success: true },
        { success: false },
        { success: false }
      ]
    )
    assert.equal(outcomes.get('booking_approved_user_1_b1').anySuccess, true)
    assert.equal(outcomes.get('booking_approved_user_2_b2').anySuccess, false)
  })
})
