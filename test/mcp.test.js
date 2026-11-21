import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { makeStore } from './helpers/mcpStore.js'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { createTokenService, hashToken, reserveRequest } = require('./mcpTokens')
const { createBookingTools, assertRange } = require('./mcpBookings')
const { createHttpHandler, toolDefinitions } = require('./mcpServer')
const { Client } = require('@modelcontextprotocol/sdk/client/index.js')
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js')
const express = require('express')

const uid = 'member-a'
const secret = 'dhm_' + 'a'.repeat(64)
const hash = hashToken(secret)
const member = { displayName: 'Tester', company: 'Hub', jobTitle: 'Builder' }
const auth = { getUser: async () => ({ disabled: false }) }
const slot = () => {
  const date = new Date(Date.now() + 7 * 86400000)
  date.setUTCHours(2, 0, 0, 0)
  return { amenityId: 'desk', startTime: date.toISOString(),
    endTime: new Date(+date + 3600000).toISOString(), requestId: 'retry-key' }
}
const fixture = () => {
  const store = makeStore({
    [`members/${uid}`]: member,
    [`mcpTokens/${hash}`]: { uid, expiresAt: Date.now() + 86400000 },
    'amenities/desk': { name: 'Desk', type: 'desk', capacity: 1 },
    'bookings/foreign': { memberId: 'someone-else', status: 'approved', amenityId: 'other' }
  })
  const availability = { isWithinAmenityHours: () => true,
    computeBookingAvailability: async ({ readQuery, amenityId }) => {
      const docs = await readQuery(store.db.collection('bookings').where('amenityId', '==', amenityId))
      return { hasConflicts: docs.docs.some(d => d.data().status === 'pending'), conflicts: [] }
    } }
  return { ...store, availability, handlers: createBookingTools(store.db, availability), principal: { uid, hash } }
}

test('token lifecycle stores only hash, revokes previous secret, and rejects disabled accounts', async () => {
  const { db, data } = makeStore()
  const service = createTokenService(db, auth)
  const request = action => ({ auth: { uid }, data: { action } })
  const created = await service.manage(request('create'))
  assert.match(created.token, /^dhm_[a-f0-9]{64}$/)
  assert.equal(JSON.stringify([...data.values()]).includes(created.token), false)
  assert.equal((await service.authenticate('Bearer ' + created.token)).uid, uid)
  assert.equal((await service.manage(request('status'))).token, undefined)
  await assert.rejects(service.manage(request('create')), /Wait one minute/)
  await service.manage(request('revoke'))
  await assert.rejects(service.authenticate('Bearer ' + created.token), /Invalid/)
  await assert.rejects(createTokenService(db, { getUser: async () => ({ disabled: true }) })
    .manage(request('create')), /disabled/)
})

test('revocation preserves cooldown and regeneration succeeds after it expires', async () => {
  const { db, data } = makeStore()
  const service = createTokenService(db, auth)
  const request = action => ({ auth: { uid }, data: { action } })
  const created = await service.manage(request('create'))
  const revoked = await service.manage(request('revoke'))
  assert.equal(revoked.active, false)
  assert.ok(revoked.retryAfterMs > 0 && revoked.retryAfterMs <= 60000)
  assert.equal((await service.manage(request('status'))).createdAt, created.createdAt)
  await assert.rejects(service.manage(request('create')), error => {
    assert.equal(error.code, 'resource-exhausted')
    assert.ok(error.details.retryAfterMs > 0 && error.details.retryAfterMs <= 60000)
    return true
  })
  await assert.rejects(service.authenticate('Bearer ' + created.token), /Invalid/)
  const owner = data.get(`mcpTokenOwners/${uid}`)
  owner.createdAt = Date.now() - 60000
  assert.equal((await service.manage(request('status'))).retryAfterMs, 0)
  const replacement = await service.manage(request('create'))
  assert.notEqual(replacement.token, created.token)
  assert.equal((await service.authenticate('Bearer ' + replacement.token)).uid, uid)
  await assert.rejects(service.authenticate('Bearer ' + created.token), /Invalid/)
})

test('MCP checks trusted profile age for unverified emails at issuance and on every token use', async () => {
  const account = { email: 'member@example.org', emailVerified: false }
  const currentAuth = { getUser: async () => account }
  const request = { auth: { uid }, data: { action: 'create' } }
  const profilePath = `members/${uid}`
  const tokenPath = `mcpTokens/${hash}`
  const token = { uid, expiresAt: Date.now() + 86400000 }

  for (const profile of [undefined, {}, { emailVerificationRequired: false, createdAt: '2020-01-01' }]) {
    const { db } = makeStore({ [tokenPath]: token, ...(profile && { [profilePath]: profile }) })
    const service = createTokenService(db, currentAuth)
    await assert.rejects(service.manage(request), /Verify your email/)
    await assert.rejects(service.authenticate('Bearer ' + secret), /Verify your email/)
  }

  const { db } = makeStore({ [profilePath]: member }, Date.parse('2026-11-01T00:00:00Z'))
  const legacy = createTokenService(db, currentAuth)
  const created = await legacy.manage(request)
  assert.equal((await legacy.authenticate('Bearer ' + created.token)).uid, uid)

  const current = createTokenService(fixture().db, currentAuth)
  account.emailVerified = true
  const verified = await current.manage(request)
  assert.equal((await current.authenticate('Bearer ' + verified.token)).uid, uid)
})

test('rate reservation is bounded, expiry fails closed, concurrent requests cannot overspend', async () => {
  const now = Date.now()
  assert.throws(() => reserveRequest({ expiresAt: now }, now), /expired/)
  const f = fixture()
  f.data.set(`mcpTokens/${hash}`, { uid, expiresAt: now + 86400000, window: Math.floor(now / 60000), count: 59 })
  const service = createTokenService(f.db, auth)
  const results = await Promise.allSettled([service.authenticate('Bearer ' + secret), service.authenticate('Bearer ' + secret)])
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1)
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'resource-exhausted')
})

test('create is pending, owner-bound, source-tagged and idempotent; competing create fails', async () => {
  const f = fixture()
  const args = slot()
  const results = await Promise.all([f.handlers.create_booking(f.principal, args), f.handlers.create_booking(f.principal, args)])
  assert.equal(results[0].id, results[1].id)
  const stored = f.data.get('bookings/' + results[0].id)
  assert.equal(stored.status, 'pending')
  assert.equal(stored.source, 'mcp')
  assert.equal(stored.memberId, uid)
  await assert.rejects(f.handlers.create_booking(f.principal, { ...args, requestId: 'another' }), /full/)
  await assert.rejects(f.handlers.create_booking(f.principal, { ...args, amenityId: 'other' }), /different booking/)
  const own = await f.handlers.list_my_bookings(f.principal, { limit: 20 })
  assert.equal(own.items.length, 1)
  await f.handlers.cancel_booking(f.principal, { bookingId: results[0].id })
  assert.equal(f.data.get('bookings/' + results[0].id).status, 'cancelled')
})

test('event spaces are omitted from discovery and rejected by availability and booking', async () => {
  const f = fixture()
  f.data.set('amenities/event-hall', { name: 'Event Hall', type: 'event-space', isAvailable: true })
  const listed = await f.handlers.list_amenities(f.principal, { limit: 20 })
  assert.deepEqual(listed.items.map(item => item.id), ['desk'])

  const args = { ...slot(), amenityId: 'event-hall' }
  await assert.rejects(f.handlers.check_availability(f.principal, args), /Use Events/)
  await assert.rejects(f.handlers.create_booking(f.principal, args), /Use Events/)
  assert.equal([...f.data.keys()].some(key => key.startsWith('bookings/mcp_')), false)
})

test('incomplete, reserved, missing, revoked and failed checks never create bookings', async () => {
  for (const setup of [
    f => f.data.set(`members/${uid}`, { ...member, company: ' ' }),
    f => f.data.set('amenities/desk', { reservedForPartnerId: 'other' }),
    f => f.data.delete('amenities/desk'),
    f => f.data.delete(`mcpTokens/${hash}`),
    f => { f.availability.computeBookingAvailability = async () => { throw Error('database offline') } }
  ]) {
    const f = fixture(); setup(f)
    await assert.rejects(f.handlers.create_booking(f.principal, slot()))
    assert.equal([...f.data.keys()].filter(k => k.startsWith('bookings/mcp_')).length, 0)
  }
})

test('cancellation rejects foreign, approved and plan bookings', async () => {
  for (const booking of [ { memberId: 'other', status: 'pending' },
    { memberId: uid, status: 'approved' }, { memberId: uid, status: 'pending', planType: 'fixed-desk' } ]) {
    const f = fixture(); f.data.set('bookings/target', booking)
    await assert.rejects(f.handlers.cancel_booking(f.principal, { bookingId: 'target' }), /Only your own/)
    assert.deepEqual(f.data.get('bookings/target'), booking)
  }
})

test('schemas reject protected fields, malformed IDs and timezone-less times', () => {
  const schema = toolDefinitions.find(d => d[0] === 'create_booking')[3]
  assert.equal(schema.safeParse({ ...slot(), status: 'approved' }).success, false)
  assert.equal(schema.safeParse({ ...slot(), amenityId: '../secret' }).success, false)
  assert.equal(schema.safeParse({ ...slot(), startTime: '2026-12-01T09:00:00' }).success, false)
  assert.throws(() => assertRange({ startTime: 'invalid', endTime: 'invalid' }), /future slot/)
})

test('SDK HTTP client initializes, discovers six tools, and calls tools with isolated identity', async t => {
  const f = fixture()
  const service = createTokenService(f.db, auth)
  const app = express()
  app.use(express.json({ limit: '16kb' }))
  app.all('/mcp', createHttpHandler(service.authenticate, f.handlers, ['https://trusted.example']))
  const listener = app.listen(0, '127.0.0.1')
  await new Promise(resolve => listener.once('listening', resolve))
  const url = new URL(`http://127.0.0.1:${listener.address().port}/mcp`)
  t.after(() => listener.close())
  const denied = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(denied.status, 401)
  const evil = await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example' }, body: '{}' })
  assert.equal(evil.status, 403)
  assert.equal((await fetch(url)).status, 405)
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer ' + secret } } }))
  t.after(() => client.close())
  const { tools } = await client.listTools()
  assert.equal(tools.length, 6)
  assert.match(client.getInstructions(), /list_amenities.*check_availability.*confirm.*create_booking/s)
  assert.match(client.getInstructions(), /Asia\/Ho_Chi_Minh/)
  assert.match(client.getInstructions(), /never report pending as confirmed/)
  assert.match(client.getInstructions(), /nextCursor/)
  for (const tool of tools) {
    assert.notEqual(tool.title, tool.name.replaceAll('_', ' '))
    assert.equal(tool.annotations.destructiveHint, tool.name === 'cancel_booking')
  }
  const inputs = Object.fromEntries(tools.map(tool => [tool.name, tool.inputSchema.properties]))
  for (const [name, field] of [['check_availability', 'amenityId'], ['cancel_booking', 'bookingId'],
    ['get_my_hours_left', 'month'], ['list_my_bookings', 'limit'], ['list_my_bookings', 'cursor']]) {
    assert.ok(inputs[name][field].description, `${name}.${field} has a description`)
  }
  const list = await client.callTool({ name: 'list_amenities', arguments: {} })
  assert.equal(list.structuredContent.items[0].name, 'Desk')
  const bad = await client.callTool({ name: 'create_booking', arguments: { ...slot(), memberId: 'other' } })
  assert.equal(bad.isError, true)
  const range = slot()
  delete range.requestId
  const available = await client.callTool({ name: 'check_availability', arguments: range })
  assert.equal(available.structuredContent.available, true)
  const hours = await client.callTool({ name: 'get_my_hours_left', arguments: { month: range.startTime.slice(0, 7) } })
  assert.equal(hours.structuredContent.hoursLeft, 40)
  const own = await client.callTool({ name: 'list_my_bookings', arguments: { limit: 1 } })
  assert.equal(own.structuredContent.items.length, 0)
  const create = await client.callTool({ name: 'create_booking', arguments: slot() })
  assert.equal(create.structuredContent.status, 'pending')
  const cancel = await client.callTool({ name: 'cancel_booking', arguments: { bookingId: create.structuredContent.id } })
  assert.equal(cancel.structuredContent.status, 'cancelled')
  f.data.delete(`mcpTokens/${hash}`)
  await assert.rejects(client.listTools())
})
