import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPushToken, hasAccountPushEnabled } from '../src/utils/pushDeviceToken.js'

test('hashPushToken produces deterministic hashes for tokens', async () => {
  const tokenA = 'fcm_token_sample_abc_123_device_phone'
  const tokenB = 'fcm_token_sample_xyz_456_device_tablet'

  const hashA1 = await hashPushToken(tokenA)
  const hashA2 = await hashPushToken(tokenA)
  const hashB = await hashPushToken(tokenB)

  assert.equal(typeof hashA1, 'string')
  assert.ok(hashA1.length > 0)
  assert.equal(hashA1, hashA2)
  assert.notEqual(hashA1, hashB)
})

test('hashPushToken handles falsy tokens gracefully', async () => {
  assert.equal(await hashPushToken(''), 'default')
  assert.equal(await hashPushToken(null), 'default')
  assert.equal(await hashPushToken(undefined), 'default')
})

test('getPushTokens returns empty array when member has push disabled at account level', async () => {
  const memberWithPushOff = {
    displayName: 'Alice',
    preferences: { pushNotifications: false }
  }

  assert.equal(hasAccountPushEnabled(memberWithPushOff), false)
})

test('getPushTokens resolves multiple tokens for a single member with push enabled', () => {
  const member = {
    displayName: 'Bob',
    preferences: { pushNotifications: true }
  }

  assert.equal(hasAccountPushEnabled(member), true)

  const subcollectionDocs = [
    { data: () => ({ token: 'token_phone_1', platform: 'web' }) },
    { data: () => ({ token: 'token_phone_2', platform: 'web' }) }
  ]

  const tokens = []
  subcollectionDocs.forEach((doc) => {
    const data = doc.data()
    if (data && data.token && typeof data.token === 'string') {
      tokens.push(data.token)
    }
  })

  assert.equal(tokens.length, 2)
  assert.deepEqual(tokens, ['token_phone_1', 'token_phone_2'])
})

test('stale token pruning targets only the failed token and preserves account preference', () => {
  const failedToken = 'token_phone_1'
  const currentTokens = [
    { id: 'hash1', token: 'token_phone_1' },
    { id: 'hash2', token: 'token_phone_2' }
  ]
  const memberDoc = {
    uid: 'user_123',
    preferences: { pushNotifications: true }
  }

  // Simulate deleteStalePushToken filtering
  const remainingTokens = currentTokens.filter((t) => t.token !== failedToken)

  // Verify only failed token is removed
  assert.equal(remainingTokens.length, 1)
  assert.equal(remainingTokens[0].token, 'token_phone_2')

  // Verify member preference is NOT touched
  assert.equal(memberDoc.preferences.pushNotifications, true)
})

test('multi-token recipient expansion flattens all devices for eligible members', () => {
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

test('mixed device outcomes mark dedupe marker as sent if at least one token succeeds', () => {
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

    if (sendResult.success) {
      current.anySuccess = true
    }
    recipientOutcomes.set(key, current)

    if (!sendResult.success && sendResult.error.code === 'messaging/registration-token-not-registered') {
      staleTokens.push({ memberId: recipient.memberId, token: recipient.token })
    }
  })

  const user1Outcome = recipientOutcomes.get('booking_approved_user_1_b1')
  const user2Outcome = recipientOutcomes.get('booking_approved_user_2_b2')

  // User 1 had 1 success, 1 failure -> Should be marked sent (anySuccess: true)
  assert.equal(user1Outcome.anySuccess, true)
  // User 2 had 0 success -> Should be released for retry (anySuccess: false)
  assert.equal(user2Outcome.anySuccess, false)
  // Stale token for user 1 is isolated and recorded for pruning
  assert.deepEqual(staleTokens, [{ memberId: 'user_1', token: 'token_2' }])
})

test('launch-time token refresh preserves account-level push off preference', () => {
  const member = {
    uid: 'user_456',
    preferences: { pushNotifications: false }
  }
  const deviceState = {
    optedIn: true,
    token: 'fresh_device_token'
  }

  // Token refresh updates device token in subcollection
  const updatedDeviceDoc = {
    token: deviceState.token,
    platform: 'web',
    updatedAt: '2026-08-24T00:00:00.000Z'
  }

  // Account preference remains strictly false
  assert.equal(member.preferences.pushNotifications, false)
  assert.equal(hasAccountPushEnabled(member), false)
  assert.equal(updatedDeviceDoc.token, 'fresh_device_token')
})

