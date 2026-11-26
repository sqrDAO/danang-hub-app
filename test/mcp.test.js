import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { makeStore } from './helpers/mcpStore.js'
import { REQUIRED_PROFILE_FIELDS } from '../src/utils/profileFields.js'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { createTokenService, hashToken } = require('./mcpTokens')
const { createBookingTools, assertComplete, REQUIRED_PROFILE_KEYS } = require('./mcpBookings')
const { createHttpHandler, authFailureLog, toolDefinitions } = require('./mcpServer')
const { Timestamp } = require('firebase-admin/firestore')
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

test('rate reservation is bounded: concurrent requests cannot overspend', async () => {
  const now = Date.now()
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

test('cancellation refuses an own pending event-space booking', async () => {
  const f = fixture()
  f.data.set('amenities/hall', { name: 'Hall', type: 'event-space' })
  const booking = { memberId: uid, status: 'pending', amenityId: 'hall' }
  f.data.set('bookings/target', booking)
  await assert.rejects(f.handlers.cancel_booking(f.principal, { bookingId: 'target' }), /Events in the Hub portal/)
  assert.deepEqual(f.data.get('bookings/target'), booking)
})

test('cancellation of an own pending booking without an amenityId still works', async () => {
  const f = fixture()
  f.data.set('bookings/target', { memberId: uid, status: 'pending' })
  await f.handlers.cancel_booking(f.principal, { bookingId: 'target' })
  assert.equal(f.data.get('bookings/target').status, 'cancelled')
})

test('cancel_booking describes the event-space refusal', () => {
  assert.match(toolDefinitions.find(d => d[0] === 'cancel_booking')[2], /event-space/)
})

test('hours left: admins are exempt, members get the 40-hour allowance', async () => {
  const f = fixture()
  const own = await f.handlers.get_my_hours_left(f.principal, { month: '2026-12' })
  assert.deepEqual([own.exempt, own.hoursLeft, own.limit], [false, 40, 40])
  f.data.set(`members/${uid}`, { ...member, membershipType: 'admin' })
  const admin = await f.handlers.get_my_hours_left(f.principal, { month: '2026-12' })
  assert.deepEqual([admin.exempt, admin.hoursLeft, admin.limit], [true, null, null])
})

test('hours left: a revoked token is refused', async () => {
  const f = fixture()
  f.data.delete(`mcpTokens/${hash}`)
  await assert.rejects(f.handlers.get_my_hours_left(f.principal, { month: '2026-12' }), /revoked/)
})

test('MCP required profile fields match the portal list', () => {
  assert.deepEqual(REQUIRED_PROFILE_KEYS, REQUIRED_PROFILE_FIELDS.map(({ key }) => key))
  for (const key of REQUIRED_PROFILE_KEYS) {
    assert.throws(() => assertComplete({ ...member, [key]: '  ' }), /Complete your name/)
  }
  assert.doesNotThrow(() => assertComplete(member))
})

test('schemas reject protected fields, malformed IDs and timezone-less times; past or over-24h slots are refused', async () => {
  const schema = toolDefinitions.find(d => d[0] === 'create_booking')[3]
  assert.equal(schema.safeParse({ ...slot(), status: 'approved' }).success, false)
  assert.equal(schema.safeParse({ ...slot(), amenityId: '../secret' }).success, false)
  assert.equal(schema.safeParse({ ...slot(), startTime: '2026-12-01T09:00:00' }).success, false)
  const f = fixture()
  const past = { amenityId: 'desk', startTime: new Date(Date.now() - 7200000).toISOString(),
    endTime: new Date(Date.now() - 3600000).toISOString() }
  const long = { ...slot(), endTime: new Date(Date.parse(slot().startTime) + 25 * 3600000).toISOString() }
  for (const args of [past, long]) {
    await assert.rejects(f.handlers.check_availability(f.principal, args), /future slot/)
  }
})

test('SDK HTTP client initializes, discovers seven tools, and calls tools with isolated identity', async t => {
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
  assert.equal(tools.length, 7)
  assert.match(client.getInstructions(), /list_amenities.*check_availability.*confirm.*create_booking/s)
  assert.match(client.getInstructions(), /Asia\/Ho_Chi_Minh/)
  assert.match(client.getInstructions(), /never report pending as confirmed/)
  assert.match(client.getInstructions(), /nextCursor/)
  assert.match(client.getInstructions(), /get_my_hours_left first/)
  assert.match(client.getInstructions(), /60 requests per minute/)
  for (const tool of tools) {
    assert.ok(tool.title, `${tool.name} has a title`)
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
  assert.match(client.getInstructions(), /list_upcoming_events.*registerUrl/s)
  assert.equal(tools.find(tool => tool.name === 'list_upcoming_events').annotations.readOnlyHint, true)
  f.data.set('events/soon', { status: 'approved', title: 'Meetup', date: Timestamp.fromMillis(Date.now() + 86400000) })
  const events = await client.callTool({ name: 'list_upcoming_events', arguments: {} })
  assert.deepEqual(events.structuredContent.items.map(e => e.title), ['Meetup'])
  f.data.delete(`mcpTokens/${hash}`)
  await assert.rejects(client.listTools())
})

test('authenticate tags each 401 with a reason code', async () => {
  const f = fixture()
  const service = createTokenService(f.db, auth)
  const reason = async (header, svc = service) => {
    const error = await svc.authenticate(header).then(() => null, e => e)
    assert.equal(error.code, 'unauthenticated')
    return error.details.reason
  }
  assert.equal(await reason(undefined), 'missing')
  assert.equal(await reason(''), 'missing')
  assert.equal(await reason('bearer ' + secret), 'malformed')
  assert.equal(await reason('Bearer ' + secret + ' '), 'malformed')
  assert.equal(await reason('Bearer dhm_' + 'b'.repeat(64)), 'unknown')
  f.data.set(`mcpTokens/${hash}`, { uid, expiresAt: Date.now() + 86400000, revoked: true })
  assert.equal(await reason('Bearer ' + secret), 'revoked')
  f.data.set(`mcpTokens/${hash}`, { uid, expiresAt: Date.now() - 1 })
  assert.equal(await reason('Bearer ' + secret), 'expired')
  f.data.set(`mcpTokens/${hash}`, { uid, expiresAt: Date.now() + 86400000 })
  const disabled = createTokenService(f.db, { getUser: async () => ({ disabled: true }) })
  assert.equal(await reason('Bearer ' + secret, disabled), 'disabled')
})

test('401 logs one structured line with the reason and header shape, never token material', async t => {
  const f = fixture()
  f.data.set(`mcpTokens/${hash}`, { uid, expiresAt: Date.now() - 1 })
  const service = createTokenService(f.db, auth)
  const lines = []
  const app = express()
  app.use(express.json({ limit: '16kb' }))
  app.all('/mcp', createHttpHandler(service.authenticate, f.handlers, [], { warn: (...args) => lines.push(args) }))
  const listener = app.listen(0, '127.0.0.1')
  await new Promise(resolve => listener.once('listening', resolve))
  t.after(() => listener.close())
  const url = `http://127.0.0.1:${listener.address().port}/mcp`
  const post = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'probe/1', ...headers }, body: '{}' })
  const cases = [
    [{}, { reason: 'missing', authorizationPresent: false, authorizationLength: 0, authorizationScheme: 'none' }],
    [{ Authorization: 'bearer ' + secret }, { reason: 'malformed', authorizationPresent: true, authorizationLength: 75, authorizationScheme: 'bearer-case' }],
    [{ Authorization: 'Basic ' + secret }, { reason: 'malformed', authorizationScheme: 'other' }],
    [{ Authorization: 'Bearer ' + secret }, { reason: 'expired', authorizationScheme: 'Bearer', userAgent: 'probe/1' }],
  ]
  for (const [headers, expected] of cases) {
    const response = await post(headers)
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('www-authenticate'), 'Bearer realm="Hub MCP"')
    assert.deepEqual(await response.json(), { error: 'Invalid or expired token' })
    const [args] = lines.splice(0)
    assert.equal(args.length, 1)
    assert.deepEqual({ ...args[0], ...expected }, args[0])
    const text = JSON.stringify(args)
    for (const needle of [secret, secret.slice(4), secret.slice(0, 12), hash, hash.slice(0, 12)]) {
      assert.equal(text.includes(needle), false, 'log leaks token material')
    }
  }
  const missingUser = authFailureLog({ headers: {} }, { code: 'auth/user-not-found' })
  assert.equal(missingUser.reason, 'user-not-found')
})

test('401 advertises resource_metadata and scope only for requests through Hosting', async t => {
  const f = fixture()
  const service = createTokenService(f.db, auth)
  const lines = []
  const app = express()
  app.use(express.json({ limit: '16kb' }))
  app.all('/mcp', createHttpHandler(service.authenticate, f.handlers, [], { warn: (...args) => lines.push(args) }))
  const listener = app.listen(0, '127.0.0.1')
  await new Promise(resolve => listener.once('listening', resolve))
  t.after(() => listener.close())
  const url = `http://127.0.0.1:${listener.address().port}/mcp`
  const post = headers => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: '{}' })
  const hosted = await post({ 'X-Forwarded-Host': 'app.danangblockchainhub.com' })
  assert.equal(hosted.status, 401)
  assert.equal(hosted.headers.get('www-authenticate'), 'Bearer resource_metadata="https://app.danangblockchainhub.com/.well-known/oauth-protected-resource/mcp", scope="bookings"')
  assert.equal(lines.at(-1)[0].hosted, true)
  const raw = await post({})
  assert.equal(raw.status, 401)
  assert.equal(raw.headers.get('www-authenticate'), 'Bearer realm="Hub MCP"')
  const rawAccess = await post({ Authorization: 'Bearer dha_' + 'a'.repeat(64) })
  assert.equal(rawAccess.status, 401)
  assert.equal(lines.at(-1)[0].reason, 'not-hosted')
  assert.equal(rawAccess.headers.get('www-authenticate'), 'Bearer realm="Hub MCP"')
})

const inDays = (days) => Timestamp.fromMillis(Date.now() + days * 86400000)
const eventFixture = () => {
  const f = fixture()
  const seed = {
    'events/late': { status: 'approved', title: 'Demo Day', date: inDays(3), duration: 90, capacity: 2,
      attendees: [uid, 'member-x'], waitlist: ['member-y'], requestedAmenityId: 'hall',
      organizerId: 'member-z', organizerDisplayName: 'Alice', hostingProjects: 'SuperteamVN',
      eventLink: 'https://lu.ma/demo', description: 'x'.repeat(999) + '🎉' + 'y'.repeat(50) },
    'events/soon': { status: 'approved', title: 'Coffee', date: inDays(1), attendees: [], waitlist: [],
      eventLink: 'javascript:alert(1)' },
    'events/full': { status: 'approved', title: 'Workshop', date: inDays(2), capacity: 1,
      attendees: ['member-x'], waitlist: [uid], organizerId: 'member-x' },
    'events/past': { status: 'approved', title: 'Old', date: inDays(-1) },
    'events/pending': { status: 'pending', title: 'Unreviewed', date: inDays(2) },
    'events/rejected': { status: 'rejected', title: 'No', date: inDays(2) },
    'members/member-x': { displayName: 'Xuan' },
    'amenities/hall': { name: 'Event Hall', type: 'event-space' }
  }
  for (const [path, value] of Object.entries(seed)) f.data.set(path, value)
  return f
}
const listEvents = (f, args = {}) => f.handlers.list_upcoming_events(f.principal, { limit: 20, ...args })

test('upcoming events: approved and not yet started, nearest first', async () => {
  const { items, nextCursor } = await listEvents(eventFixture())
  assert.deepEqual(items.map(e => e.id), ['soon', 'full', 'late'])
  assert.equal(nextCursor, null)
})

test('upcoming events: time, organizer, links and your own state', async () => {
  const { items: [soon, full, late] } = await listEvents(eventFixture())
  assert.equal(late.title, 'Demo Day')
  assert.equal(late.durationMinutes, 90)
  assert.equal(Date.parse(late.endTime) - Date.parse(late.startTime), 90 * 60000)
  assert.equal(late.timezone, 'Asia/Ho_Chi_Minh')
  assert.deepEqual([late.organizer, late.hostingProjects], ['Alice', 'SuperteamVN'])
  assert.deepEqual([late.registered, late.waitlisted], [true, false])
  assert.deepEqual([full.registered, full.waitlisted], [false, true])
  assert.deepEqual([soon.endTime, soon.durationMinutes, soon.organizer], [null, null, null])
})

test('upcoming events: an older event without a stored organizer name gets it from the member', async () => {
  const { items } = await listEvents(eventFixture())
  assert.equal(items.find(e => e.id === 'full').organizer, 'Xuan')
})

test('upcoming events: an event with its own page is registered there, never against Hub capacity', async () => {
  const late = (await listEvents(eventFixture())).items.find(e => e.id === 'late')
  assert.equal(late.signUp, 'event-page')
  assert.equal(late.eventLink, 'https://lu.ma/demo')
  assert.equal(late.registerUrl, 'https://lu.ma/demo')
  assert.equal(late.isFull, null)
})

test('upcoming events: a Hub sign-up says if it is full and links to portal registration', async () => {
  const { items: [soon, full] } = await listEvents(eventFixture())
  assert.equal(full.signUp, 'hub')
  assert.equal(full.isFull, true)
  assert.equal(full.registerUrl, 'https://app.danangblockchainhub.com/member/events?action=register&eventId=full')
  assert.equal(soon.isFull, false)
})

test('upcoming events: a non-web event link is never handed out', async () => {
  const soon = (await listEvents(eventFixture())).items.find(e => e.id === 'soon')
  assert.equal(soon.eventLink, null)
  assert.equal(soon.signUp, 'hub')
  assert.equal(JSON.stringify(soon).includes('javascript:'), false)
})

test('upcoming events: only what the member view shows; no venue, counts or member IDs', async () => {
  const { items } = await listEvents(eventFixture())
  for (const event of items) {
    for (const key of ['venue', 'capacity', 'attendeeCount', 'waitlistCount', 'spotsLeft', 'attendees', 'waitlist']) {
      assert.equal(key in event, false, `${event.id}.${key}`)
    }
  }
  const text = JSON.stringify(items)
  for (const hidden of ['member-x', 'member-y', 'member-z', uid, 'Event Hall']) {
    assert.equal(text.includes(hidden), false, hidden)
  }
})

test('upcoming events: long descriptions are cut on a whole character', async () => {
  const late = (await listEvents(eventFixture())).items.find(e => e.id === 'late')
  assert.equal(late.descriptionTruncated, true)
  assert.equal(late.description, 'x'.repeat(999) + '🎉…')
  const soon = (await listEvents(eventFixture())).items.find(e => e.id === 'soon')
  assert.deepEqual([soon.description, soon.descriptionTruncated], ['', false])
})

test('upcoming events: pages follow nextCursor, even when the last-listed event moves', async () => {
  const f = eventFixture()
  const first = await listEvents(f, { limit: 2 })
  assert.deepEqual(first.items.map(e => e.id), ['soon', 'full'])
  assert.match(first.nextCursor, /^\d+_\d+_full$/)
  f.data.set('events/full', { ...f.data.get('events/full'), date: inDays(10) })
  const second = await listEvents(f, { limit: 2, cursor: first.nextCursor })
  assert.deepEqual(second.items.map(e => e.id), ['late', 'full'])
  assert.equal(second.nextCursor, null)
})

test('upcoming events: a malformed cursor is refused', async () => {
  for (const cursor of ['missing', '12_x_full', 'pending']) {
    await assert.rejects(listEvents(eventFixture(), { cursor }), /Unknown cursor/)
  }
})

test('upcoming events: a revoked token is refused', async () => {
  const f = eventFixture()
  f.data.delete(`mcpTokens/${hash}`)
  await assert.rejects(listEvents(f), /revoked or expired/)
})
