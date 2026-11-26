import { readFile } from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { initializeTestEnvironment, assertFails } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { initializeApp, deleteApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { createBookingTools } = require('./mcpBookings')

const SERVER_ONLY = ['mcpTokens', 'mcpTokenOwners', 'mcpBookingLocks', 'mcpMemberQuotas', 'oauthClients',
  'oauthRequests', 'oauthCodes', 'oauthGrants', 'oauthTokens', 'oauthRateLimits']

test('MCP and OAuth secrets, owner indexes and locks deny all client access', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST
}, async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-mcp-rules',
    firestore: { rules: await readFile('firestore.rules', 'utf8') } })
  try {
    await env.withSecurityRulesDisabled(async c => {
      await setDoc(doc(c.firestore(), 'members/admin'), { membershipType: 'admin' })
      for (const collection of SERVER_ONLY) {
        await setDoc(doc(c.firestore(), collection, 'owner'), { uid: 'owner' })
      }
    })
    for (const c of [env.authenticatedContext('owner'), env.authenticatedContext('other'), env.authenticatedContext('admin'), env.unauthenticatedContext()]) {
      for (const collection of SERVER_ONLY) {
        const ref = doc(c.firestore(), collection, 'owner')
        await assertFails(getDoc(ref))
        await assertFails(setDoc(ref, { uid: 'owner' }))
        await assertFails(deleteDoc(ref))
      }
    }
  } finally { await env.cleanup() }
})

test('Firestore transactions serialize competing MCP creates for one seat', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST
}, async () => {
  const app = initializeApp({ projectId: 'demo-mcp-concurrency' }, 'mcp-concurrency')
  const db = getFirestore(app)
  try {
    await db.collection('members').doc('owner').set({ displayName: 'Test', company: 'Hub', jobTitle: 'Builder' })
    await db.collection('mcpTokens').doc('hash').set({ uid: 'owner', expiresAt: Date.now() + 60000 })
    await db.collection('amenities').doc('desk').set({ type: 'desk', capacity: 1 })
    const handlers = createBookingTools(db, {
      isWithinAmenityHours: () => true,
      computeBookingAvailability: async ({ readQuery }) => {
        const snapshot = await readQuery(db.collection('bookings').where('amenityId', '==', 'desk'))
        return { hasConflicts: snapshot.docs.some(d => d.data().status === 'pending'), conflicts: [] }
      }
    })
    const start = new Date(Date.now() + 7 * 86400000)
    const args = { amenityId: 'desk', startTime: start.toISOString(), endTime: new Date(+start + 3600000).toISOString() }
    const principal = { uid: 'owner', hash: 'hash' }
    const results = await Promise.allSettled(['first', 'second'].map(requestId => handlers.create_booking(principal, { ...args, requestId })))
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
    assert.match(results.find(r => r.status === 'rejected').reason.message, /full/)
    assert.equal((await db.collection('bookings').get()).size, 1)
  } finally { await deleteApp(app) }
})

test('Firestore transactions apply the per-member MCP caps across tokens', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST
}, async () => {
  const app = initializeApp({ projectId: 'demo-mcp-caps' }, 'mcp-caps')
  const db = getFirestore(app)
  try {
    await db.collection('members').doc('owner').set({ displayName: 'Test', company: 'Hub', jobTitle: 'Builder' })
    for (const hash of ['one', 'two']) {
      await db.collection('mcpTokens').doc(hash).set({ uid: 'owner', expiresAt: Date.now() + 60000 })
    }
    await db.collection('amenities').doc('room').set({ type: 'meeting-room', capacity: 1 })
    const handlers = createBookingTools(db, { isWithinAmenityHours: () => true,
      computeBookingAvailability: async () => ({ hasConflicts: false, conflicts: [] }) })
    const create = (hash, day) => {
      const start = new Date(Date.now() + day * 86400000)
      return handlers.create_booking({ uid: 'owner', hash }, { amenityId: 'room', requestId: 'r' + day,
        startTime: start.toISOString(), endTime: new Date(+start + 3600000).toISOString() })
    }
    for (let day = 1; day <= 5; day++) await create(day % 2 ? 'one' : 'two', day)
    await assert.rejects(create('two', 6), /already have 5 pending non-desk/)
    assert.equal((await db.collection('bookings').get()).size, 5)
    assert.equal((await db.collection('mcpMemberQuotas').doc('owner').get()).get('creates'), 5)
  } finally { await deleteApp(app) }
})
