import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { groupTokenEntries, decideMemberMarkers, getPushTokens } = require('../functions/pushTokens.js')

test('groupTokenEntries keeps one item per phone token', () => {
  const grouped = groupTokenEntries([
    { token: 'a', ref: 'devices/phone-1' },
    { token: 'b', ref: 'devices/phone-2' }
  ])
  assert.deepEqual(grouped, [
    { token: 'a', refs: ['devices/phone-1'] },
    { token: 'b', refs: ['devices/phone-2'] }
  ])
})

test('groupTokenEntries sends a token stored twice once, keeping both docs for cleanup', () => {
  const grouped = groupTokenEntries([
    { token: 'a', ref: 'push_tokens/member-a' },
    { token: 'a', ref: 'devices/phone-1' }
  ])
  assert.deepEqual(grouped, [
    { token: 'a', refs: ['push_tokens/member-a', 'devices/phone-1'] }
  ])
})

test('groupTokenEntries skips empty and non-string tokens', () => {
  assert.deepEqual(groupTokenEntries([
    { token: '', ref: 'x' },
    { token: undefined, ref: 'y' }
  ]), [])
})

test('decideMemberMarkers marks a member when any phone succeeded', () => {
  const result = decideMemberMarkers([
    { memberId: 'm1', success: false },
    { memberId: 'm1', success: true },
    { memberId: 'm1', success: false }
  ])
  assert.deepEqual(result, { marked: ['m1'], released: [] })
})

test('decideMemberMarkers releases a member only when every phone failed', () => {
  const result = decideMemberMarkers([
    { memberId: 'm1', success: false },
    { memberId: 'm2', success: true },
    { memberId: 'm1', success: false }
  ])
  assert.deepEqual(result, { marked: ['m2'], released: ['m1'] })
})

const tokenDb = ({ legacy = null, update = async () => {}, onLegacyRead = () => {} } = {}) => ({
  collection: (name) => ({ doc: () => name === 'members' ? { update } : {
    collection: () => ({ get: async () => ({ docs: [{ get: () => 'device-token', ref: 'device-ref' }] }) }),
    get: async () => {
      onLegacyRead()
      return { exists: Boolean(legacy), get: () => legacy }
    }
  } })
})

test('migration write failure cannot abort token collection for any recipient', async () => {
  let updates = 0
  const db = tokenDb({ update: async () => { updates += 1; throw new Error('transient write failure') } })
  const member = { preferences: { pushNotifications: true } }
  const results = await Promise.all(['a', 'b'].map((uid) => getPushTokens(db, uid, member)))
  assert.deepEqual(results, [
    [{ token: 'device-token', refs: ['device-ref'] }],
    [{ token: 'device-token', refs: ['device-ref'] }]
  ])
  assert.equal(updates, 2)
})

test('migrated accounts skip legacy reads and disabled accounts skip all token reads', async () => {
  let reads = 0
  const db = tokenDb({ onLegacyRead: () => { reads += 1 } })
  const member = { preferences: { pushNotifications: true } }
  await getPushTokens(db, 'a', { ...member, pushTokensMigrated: true })
  assert.equal(reads, 0)
  assert.deepEqual(await getPushTokens(null, 'a', {}), [])
  await getPushTokens(db, 'a', member)
  assert.equal(reads, 1)
})

test('existing legacy tokens remain deliverable until deleted', async () => {
  let updates = 0
  const db = tokenDb({ legacy: 'legacy-token', update: async () => { updates += 1 } })
  const result = await getPushTokens(db, 'a', { preferences: { pushNotifications: true } })
  assert.deepEqual(result.map(({ token }) => token), ['device-token', 'legacy-token'])
  assert.equal(updates, 0)
})
