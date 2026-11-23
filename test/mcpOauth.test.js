import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { makeStore } from './helpers/mcpStore.js'
const require = createRequire(new URL('../functions/package.json', import.meta.url))
const { createOauthHandler } = require('./oauth/http')
const { registerClient } = require('./oauth/register')
const { authorize } = require('./oauth/authorize')
const { token, revoke, validateAccessToken } = require('./oauth/token')
const { createConsentService } = require('./oauth/consent')
const { redirectMatches, isAllowedRedirect, verifyPkce, s256 } = require('./oauth/util')
const { isHostedRequest, challenge: wwwAuthenticate } = require('./oauth/resource')
const { createTokenService } = require('./mcpTokens')
const { createBookingTools } = require('./mcpBookings')

const ISSUER = 'https://app.danangblockchainhub.com'
const RESOURCE = `${ISSUER}/mcp`
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback'
const FORM = { headers: { 'content-type': 'application/x-www-form-urlencoded' } }
const verifier = 'v'.repeat(43) + '-._~'
const challenge = s256(verifier)
const uid = 'member-a'
const user = { email: 'member@example.org', emailVerified: true, disabled: false }
const auth = { getUser: async () => user }
const allow = async () => {}

const fakeRes = () => {
  const res = { statusCode: 200, headers: {}, body: undefined }
  res.set = (key, value) => {
    Object.assign(res.headers, typeof key === 'object' ? key : { [key]: value })
    return res
  }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (body) => { res.body = body; return res }
  res.send = (body) => { res.body = body; return res }
  res.end = () => res
  return res
}
const call = async (db, req, options) => {
  const res = fakeRes()
  await createOauthHandler(db, options)({ headers: {}, query: {}, ip: '1.2.3.4', ...req }, res)
  return res
}

const register = (db, uris = [CLAUDE], opts = {}) =>
  registerClient(db, { redirect_uris: uris, client_name: 'Claude' }, { ip: '1.2.3.4', ...opts })
const authorizeQuery = (clientId, extra = {}) => ({
  response_type: 'code', client_id: clientId, redirect_uri: CLAUDE, code_challenge: challenge,
  code_challenge_method: 'S256', resource: RESOURCE, scope: 'bookings', state: 'st-1', ...extra
})
// Register, authorize, approve: returns everything a token request needs.
const approved = async (store, now = Date.now()) => {
  const client = (await register(store.db, [CLAUDE], { now })).body
  const started = await authorize(store.db, authorizeQuery(client.client_id), { now })
  const requestId = new URL(started.location).searchParams.get('request')
  const consent = createConsentService(store.db, auth, allow)
  const { redirectUrl } = await consent.handle({ auth: { uid }, data: { action: 'approve', request: requestId } }, now)
  const url = new URL(redirectUrl)
  return { clientId: client.client_id, code: url.searchParams.get('code'), url }
}
const exchange = (db, clientId, code, now, extra = {}) => token(db, {
  grant_type: 'authorization_code', client_id: clientId, code, redirect_uri: CLAUDE,
  code_verifier: verifier, resource: RESOURCE, ...extra
}, { ...FORM, now })
const refresh = (db, clientId, refreshToken, now) => token(db, {
  grant_type: 'refresh_token', client_id: clientId, refresh_token: refreshToken
}, { ...FORM, now })
const hash = (value) => createHash('sha256').update(value).digest('hex')
// The grant a code was issued for, read straight from the store.
const grantOf = (store, code) => store.data.get(`oauthGrants/${store.data.get(`oauthCodes/${hash(code)}`).grantId}`)
const docs = (data, prefix) => [...data].filter(([path]) => path.startsWith(prefix + '/'))

const WELL_KNOWN = ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/oauth-authorization-server']

test('with discovery off (phase 2 dark mode), metadata documents return JSON 404, not a page', async () => {
  const { db } = makeStore()
  for (const path of WELL_KNOWN) {
    const res = await call(db, { method: 'GET', path }, { discovery: false })
    assert.equal(res.statusCode, 404, path)
    assert.deepEqual(res.body, { error: 'not_found' })
  }
})

test('discovery is on: metadata documents return 200 with the canonical resource, S256 and public clients', async () => {
  const { db } = makeStore()
  const on = undefined
  for (const path of WELL_KNOWN.slice(0, 2)) {
    const res = await call(db, { method: 'GET', path }, on)
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { resource: RESOURCE, authorization_servers: [ISSUER],
      scopes_supported: ['bookings'], bearer_methods_supported: ['header'] })
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*')
    assert.equal(res.headers['Cache-Control'], 'no-store')
  }
  const as = (await call(db, { method: 'GET', path: WELL_KNOWN[2] }, on)).body
  assert.equal(as.issuer, ISSUER)
  assert.deepEqual(as.code_challenge_methods_supported, ['S256'])
  assert.deepEqual(as.token_endpoint_auth_methods_supported, ['none'])
  assert.deepEqual(as.grant_types_supported, ['authorization_code', 'refresh_token'])
  assert.deepEqual(as.response_types_supported, ['code'])
  assert.equal(as.authorization_response_iss_parameter_supported, true)
  assert.equal(as.token_endpoint, `${ISSUER}/oauth/token`)
  assert.equal('client_id_metadata_document_supported' in as, false)
  assert.equal((await call(db, { method: 'GET', path: '/oauth/other' })).statusCode, 404)
  assert.equal((await call(db, { method: 'OPTIONS', path: '/oauth/token' })).statusCode, 204)
})

test('PKCE accepts only the S256 transform of a well-formed verifier', () => {
  const expected = createHash('sha256').update(verifier).digest('base64url')
  assert.equal(challenge, expected)
  assert.equal(verifyPkce(verifier, challenge), true)
  assert.equal(verifyPkce(verifier + 'x', challenge), false)
  assert.equal(verifyPkce(challenge, challenge), false, 'plain is not accepted')
  assert.equal(verifyPkce('short', s256('short')), false)
  assert.equal(verifyPkce(undefined, challenge), false)
})

test('redirect allowlist and matching: exact for hosted, any port for loopback', () => {
  for (const uri of [CLAUDE, 'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector_platform_oauth_redirect', 'https://chatgpt.com/connector/oauth/abc_D-1',
    'https://chatgpt.com/connector/oauth/' + 'a'.repeat(128), 'http://localhost:33418/callback', 'http://127.0.0.1/callback', 'http://localhost:6274/oauth/callback']) {
    assert.equal(isAllowedRedirect(uri), true, uri)
  }
  for (const uri of ['https://evil.example/callback', 'http://claude.ai/api/mcp/auth_callback',
    CLAUDE + '?x=1', 'https://chatgpt.com/connector/oauth/a/b', 'https://chatgpt.com/connector/oauth/' + 'a'.repeat(129),
    'https://chatgpt.com/connector/oauth/', 'http://localhost:0/callback',
    'http://localhost:70000/callback', 'http://localhost.evil.com/callback', 'http://localhost:80/other',
    'https://localhost:3000/callback', 'http://[::1]:3000/callback', 42]) {
    assert.equal(isAllowedRedirect(uri), false, String(uri))
  }
  assert.equal(redirectMatches([CLAUDE], CLAUDE), true)
  assert.equal(redirectMatches([CLAUDE], CLAUDE + '/'), false)
  assert.equal(redirectMatches(['http://localhost:1000/callback'], 'http://localhost:5555/callback'), true)
  assert.equal(redirectMatches(['http://localhost:1000/callback'], 'http://127.0.0.1:1000/callback'), false)
  assert.equal(redirectMatches(['http://localhost:1000/callback'], 'http://localhost:1000/oauth/callback'), false)
})

test('DCR registers public clients only and rejects redirects outside the allowlist', async () => {
  const { db, data } = makeStore()
  const bad = await register(db, ['https://evil.example/cb'])
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error, 'invalid_redirect_uri')
  assert.equal((await register(db, [])).body.error, 'invalid_redirect_uri')
  const creds = await registerClient(db, { redirect_uris: [CLAUDE], grant_types: ['client_credentials'] }, {})
  assert.equal(creds.body.error, 'invalid_client_metadata')
  const implicit = await registerClient(db, { redirect_uris: [CLAUDE], response_types: ['token'] }, {})
  assert.equal(implicit.body.error, 'invalid_client_metadata')
  const now = Date.now()
  const ok = await registerClient(db, { redirect_uris: [CLAUDE], token_endpoint_auth_method: 'client_secret_post',
    client_name: 'C\u0000laude ' + 'x'.repeat(100) }, { now })
  assert.equal(ok.status, 201)
  assert.match(ok.body.client_id, /^dhc_[a-f0-9]{32}$/)
  assert.equal(ok.body.token_endpoint_auth_method, 'none')
  assert.equal('client_secret' in ok.body, false)
  const stored = data.get(`oauthClients/${ok.body.client_id}`)
  assert.equal(stored.clientName.length, 64)
  assert.equal(stored.clientName.startsWith('Claude '), true)
  assert.equal(stored.expiresAt.toMillis(), now + 86400000, 'unused clients expire after a day (TTL)')
})

test('DCR strips invisible characters from client_name and keeps the client document small', async () => {
  const { db, data } = makeStore()
  const hidden = '\u202E\u202A\u2066\u2069\u200B\u200F\uFEFF\u2028\u2029\u0085'
  const ok = await registerClient(db, { redirect_uris: [CLAUDE], client_name: `Cl${hidden}aude ✓` }, {})
  assert.equal(ok.status, 201)
  assert.equal(data.get(`oauthClients/${ok.body.client_id}`).clientName, 'Claude ✓')
  const loop = (i) => `http://localhost:${1000 + i}/callback`
  assert.equal((await register(db, [1, 2, 3, 4, 5, 6].map(loop))).body.error, 'invalid_redirect_uri')
  const long = 'http://localhost:1/callback' + '?'.repeat(300)
  assert.equal((await register(db, [long])).body.error, 'invalid_redirect_uri')
  const many = await registerClient(db, { redirect_uris: [CLAUDE],
    grant_types: Array(1000).fill('refresh_token'), response_types: Array(1000).fill('code') }, {})
  assert.equal(many.status, 201)
  const stored = data.get(`oauthClients/${many.body.client_id}`)
  assert.deepEqual(stored.grantTypes, ['refresh_token'])
  assert.deepEqual(stored.responseTypes, ['code'])
})

test('DCR drops blank-rendering letters from client_name; a blank name is stored like a missing one', async () => {
  const { db, data } = makeStore()
  const name = async (clientName) => {
    const ok = await registerClient(db, { redirect_uris: [CLAUDE], client_name: clientName }, {})
    assert.equal(ok.status, 201)
    return [ok.body, data.get(`oauthClients/${ok.body.client_id}`).clientName]
  }
  assert.equal((await name('Cl\u115Fa\u1160u\u3164d\uFFA0e\u2800\u180E'))[1], 'Claude')
  const missing = await name(undefined)
  for (const blank of ['\u3164', '\u115F\u1160', ' \uFFA0 \u2800 ', '\u180E\u3164\t']) {
    const [body, stored] = await name(blank)
    assert.equal(stored, missing[1], JSON.stringify(blank))
    assert.equal(body.client_name, undefined, JSON.stringify(blank))
  }
})

test('DCR: hosted callbacks share a global hourly cap, not a per-IP one', async () => {
  const { db, data } = makeStore()
  const now = Date.now()
  const hour = Math.floor(now / 3600000)
  for (const ip of ['1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1',
    '1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1', '1.1.1.1']) {
    assert.equal((await register(db, [CLAUDE], { ip, now })).status, 201)
  }
  assert.equal(data.get(`oauthRateLimits/dcr-hosted-${hour}`).count, 12)
  data.set(`oauthRateLimits/dcr-hosted-${hour}`, { count: 499 })
  assert.equal((await register(db, [CLAUDE], { ip: '9.9.9.9', now })).status, 201)
  const capped = await register(db, ['https://chatgpt.com/connector_platform_oauth_redirect'], { ip: '8.8.8.8', now })
  assert.equal(capped.status, 429)
  assert.ok(Number(capped.headers['Retry-After']) > 0)
  assert.equal((await register(db, [CLAUDE], { ip: '8.8.8.8', now: now + 3600000 })).status, 201)
})

test('DCR: loopback redirects are limited to 10 per IP per hour', async () => {
  const { db } = makeStore()
  const now = Date.now()
  const loopback = ['http://localhost:3000/callback']
  for (let i = 0; i < 10; i++) {
    assert.equal((await register(db, loopback, { ip: '5.5.5.5', now })).status, 201)
  }
  assert.equal((await register(db, loopback, { ip: '5.5.5.5', now })).status, 429)
  assert.equal((await register(db, [CLAUDE, ...loopback], { ip: '5.5.5.5', now })).status, 429)
  assert.equal((await register(db, loopback, { ip: '6.6.6.6', now })).status, 201)
  assert.equal((await register(db, [CLAUDE], { ip: '5.5.5.5', now })).status, 201)
})

test('DCR returns 503 above the unused-client ceiling; a token exchange frees a slot', async () => {
  const store = makeStore()
  const now = Date.now()
  const hour = Math.floor(now / 3600000)
  const first = await approved(store, now)
  store.data.set('oauthRateLimits/dcr-unused', { buckets: { [hour]: 4999, [hour - 30]: 9999 } })
  assert.equal((await register(store.db, [CLAUDE], { now })).status, 201)
  const full = await register(store.db, [CLAUDE], { now })
  assert.equal(full.status, 503)
  assert.equal(full.headers['Retry-After'], '3600')
  assert.equal((await exchange(store.db, first.clientId, first.code, now)).status, 200)
  assert.equal((await register(store.db, [CLAUDE], { now })).status, 201)
  const client = store.data.get(`oauthClients/${first.clientId}`)
  assert.equal(client.usedAt, now)
  assert.equal(client.expiresAt.toMillis(), now + 30 * 86400000)
})

test('authorize never redirects for an unknown client or unregistered redirect URI', async () => {
  const { db } = makeStore()
  const { client_id: clientId } = (await register(db)).body
  const unknown = await authorize(db, authorizeQuery('dhc_' + 'f'.repeat(32)))
  assert.equal(unknown.status, 400)
  assert.equal(unknown.location, undefined)
  const foreign = await authorize(db, authorizeQuery(clientId, { redirect_uri: 'https://claude.com/api/mcp/auth_callback' }))
  assert.equal(foreign.status, 400)
  assert.equal(foreign.location, undefined)
  const res = await call(db, { method: 'GET', path: '/oauth/authorize',
    query: authorizeQuery(clientId, { redirect_uri: 'https://evil.example/<b>' }) })
  assert.equal(res.statusCode, 400)
  assert.equal(res.headers.Location, undefined)
  assert.match(res.body, /redirect_uri is not registered/)
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined)
})

test('authorize rejects missing or plain PKCE, wrong resource and scope via redirect with state and iss', async () => {
  const { db } = makeStore()
  const { client_id: clientId } = (await register(db)).body
  const cases = [
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge: undefined, code_challenge_method: undefined }, 'invalid_request'],
    [{ code_challenge: 'short' }, 'invalid_request'],
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ resource: 'https://other.example/mcp' }, 'invalid_target'],
    [{ scope: 'bookings admin' }, 'invalid_scope']
  ]
  for (const [extra, error] of cases) {
    const result = await authorize(db, authorizeQuery(clientId, extra))
    assert.equal(result.status, 302)
    const url = new URL(result.location)
    assert.equal(url.origin + url.pathname, CLAUDE)
    assert.equal(url.searchParams.get('error'), error)
    assert.equal(url.searchParams.get('state'), 'st-1')
    assert.equal(url.searchParams.get('iss'), ISSUER)
  }
})

test('authorize stores the request (10 min TTL) and sends the member to consent', async () => {
  const { db, data } = makeStore()
  const now = Date.now()
  const loopback = 'http://localhost:3000/callback'
  const { client_id: clientId } = (await register(db, [loopback])).body
  const result = await authorize(db, authorizeQuery(clientId, {
    redirect_uri: 'http://localhost:4567/callback', resource: undefined, scope: 'bookings offline_access' }), { now })
  assert.equal(result.status, 302)
  const url = new URL(result.location)
  assert.equal(url.origin + url.pathname, `${ISSUER}/oauth/consent`)
  const stored = data.get(`oauthRequests/${url.searchParams.get('request')}`)
  assert.equal(stored.redirectUri, 'http://localhost:4567/callback')
  assert.equal(stored.resource, RESOURCE)
  assert.equal(stored.scope, 'bookings')
  assert.equal(stored.expiresAt.toMillis(), now + 600000)
})

test('consent describes the redirect host, flags loopback, and deny returns access_denied', async () => {
  const { db } = makeStore()
  const { client_id: clientId } = (await register(db, ['http://127.0.0.1/callback'])).body
  const start = async () => new URL((await authorize(db, authorizeQuery(clientId,
    { redirect_uri: 'http://127.0.0.1:9999/callback' }))).location).searchParams.get('request')
  const consent = createConsentService(db, { getUser: async () => ({}) }, allow)
  const request = await start()
  const described = await consent.handle({ auth: { uid: 'eth_0x1234567890abcdef' }, data: { action: 'describe', request } })
  assert.equal(described.redirectHost, '127.0.0.1:9999')
  assert.equal(described.loopback, true)
  assert.equal(described.clientName, 'Claude')
  assert.equal(described.account, '0x1234…cdef')
  const denied = new URL((await consent.handle({ auth: { uid }, data: { action: 'deny', request } })).redirectUrl)
  assert.equal(denied.searchParams.get('error'), 'access_denied')
  assert.equal(denied.searchParams.get('iss'), ISSUER)
  await assert.rejects(consent.handle({ auth: { uid }, data: { action: 'approve', request } }), /expired/)
  const blocked = createConsentService(db, auth, async () => { throw new Error('Verify your email first.') })
  await assert.rejects(blocked.handle({ auth: { uid }, data: { action: 'approve', request: await start() } }), /Verify/)
})

test('code exchange: PKCE, single use, 60 s expiry, no raw secrets stored', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  assert.equal(flow.url.searchParams.get('iss'), ISSUER)
  assert.equal(flow.url.searchParams.get('state'), 'st-1')
  const json = await token(store.db, { grant_type: 'authorization_code', client_id: flow.clientId }, { now, headers: {} })
  assert.equal(json.body.error, 'invalid_request')
  const wrongClient = await exchange(store.db, 'dhc_' + '0'.repeat(32), flow.code, now)
  assert.equal(wrongClient.status, 401)
  assert.equal(wrongClient.body.error, 'invalid_client')
  const issued = await exchange(store.db, flow.clientId, flow.code, now + 59000)
  assert.equal(issued.status, 200)
  assert.match(issued.body.access_token, /^dha_[a-f0-9]{64}$/)
  assert.match(issued.body.refresh_token, /^dhr_[a-f0-9]{64}$/)
  assert.equal(issued.body.token_type, 'Bearer')
  assert.equal(issued.body.expires_in, 3600)
  const dump = JSON.stringify([...store.data])
  for (const secret of [flow.code, issued.body.access_token, issued.body.refresh_token]) {
    assert.equal(dump.includes(secret), false)
  }

  const late = await approved(store, now)
  assert.equal((await exchange(store.db, late.clientId, late.code, now + 61000)).body.error, 'invalid_grant')
  const pkce = await approved(store, now)
  assert.equal((await exchange(store.db, pkce.clientId, pkce.code, now, { code_verifier: 'w'.repeat(43) })).body.error, 'invalid_grant')
  const target = await approved(store, now)
  assert.equal((await exchange(store.db, target.clientId, target.code, now, { resource: 'https://x.example/mcp' })).body.error, 'invalid_grant')
  const redirect = await approved(store, now)
  assert.equal((await exchange(store.db, redirect.clientId, redirect.code, now, { redirect_uri: 'https://claude.com/api/mcp/auth_callback' })).body.error, 'invalid_grant')
})

test('a rejected exchange does not count as use: a corrected retry works, a failed PKCE check burns the code', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const wrongResource = await exchange(store.db, flow.clientId, flow.code, now, { resource: 'https://x.example/mcp' })
  assert.equal(wrongResource.body.error, 'invalid_grant')
  const wrongRedirect = await exchange(store.db, flow.clientId, flow.code, now, { redirect_uri: 'https://claude.com/api/mcp/auth_callback' })
  assert.equal(wrongRedirect.body.error, 'invalid_grant')
  const retry = await exchange(store.db, flow.clientId, flow.code, now + 1000)
  assert.equal(retry.status, 200)
  assert.equal(docs(store.data, 'oauthGrants')[0][1].revoked, false)
  assert.equal((await validateAccessToken(store.db, retry.body.access_token, { now })).uid, uid)

  const guessed = await approved(store, now)
  const badVerifier = await exchange(store.db, guessed.clientId, guessed.code, now, { code_verifier: 'w'.repeat(43) })
  assert.equal(badVerifier.body.error, 'invalid_grant')
  const after = await exchange(store.db, guessed.clientId, guessed.code, now + 1000)
  assert.equal(after.body.error, 'invalid_grant', 'a burned code never issues tokens')
  assert.match(after.body.error_description, /no longer valid/)
  assert.equal(grantOf(store, guessed.code).revoked, false, 'a burned code does not revoke its own grant')
  assert.equal((await validateAccessToken(store.db, retry.body.access_token, { now })).uid, uid,
    'a burned code does not revoke other grants')
})

test('a code presented with another registered client_id can be retried with the right one', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const other = (await register(store.db, [CLAUDE], { now })).body.client_id
  const foreign = await exchange(store.db, other, flow.code, now)
  assert.equal(foreign.status, 400)
  assert.equal(foreign.body.error, 'invalid_grant')
  assert.match(foreign.body.error_description, /another client/)
  const retry = await exchange(store.db, flow.clientId, flow.code, now + 1000)
  assert.equal(retry.status, 200)
  assert.equal(grantOf(store, flow.code).revoked, false)
  assert.equal((await validateAccessToken(store.db, retry.body.access_token, { now })).uid, uid)
})

test('a reused authorization code revokes the grant and its tokens', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const issued = await exchange(store.db, flow.clientId, flow.code, now)
  assert.equal((await validateAccessToken(store.db, issued.body.access_token, { now })).uid, uid)
  const replay = await exchange(store.db, flow.clientId, flow.code, now + 1000)
  assert.equal(replay.body.error, 'invalid_grant')
  assert.equal(docs(store.data, 'oauthTokens').length, 0)
  assert.equal(docs(store.data, 'oauthGrants')[0][1].revoked, true)
  assert.equal((await validateAccessToken(store.db, issued.body.access_token, { now })).reason, 'unknown')
  assert.equal((await refresh(store.db, flow.clientId, issued.body.refresh_token, now)).body.error, 'invalid_grant')
})

test('refresh rotates tokens; reusing a rotated refresh token revokes the whole grant', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const first = (await exchange(store.db, flow.clientId, flow.code, now)).body
  assert.equal((await refresh(store.db, 'dhc_' + '0'.repeat(32), first.refresh_token, now)).status, 401)
  const second = await refresh(store.db, flow.clientId, first.refresh_token, now + 1000)
  assert.equal(second.status, 200)
  assert.notEqual(second.body.refresh_token, first.refresh_token)
  assert.notEqual(second.body.access_token, first.access_token)
  const third = await refresh(store.db, flow.clientId, second.body.refresh_token, now + 2000)
  assert.equal(third.status, 200)
  const reuse = await refresh(store.db, flow.clientId, first.refresh_token, now + 3000)
  assert.equal(reuse.body.error, 'invalid_grant')
  assert.equal(docs(store.data, 'oauthGrants')[0][1].revoked, true)
  assert.equal((await refresh(store.db, flow.clientId, third.body.refresh_token, now + 4000)).body.error, 'invalid_grant')
  assert.equal((await validateAccessToken(store.db, third.body.access_token, { now })).reason, 'unknown')
})

test('refresh tokens slide 30 days but never outlive the 90-day grant', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  let current = (await exchange(store.db, flow.clientId, flow.code, now)).body
  const lifetime = (value) => store.data.get(`oauthTokens/${createHash('sha256').update(value).digest('hex')}`).expiresAt.toMillis()
  assert.equal(lifetime(current.refresh_token), now + 30 * 86400000)
  const later = now + 75 * 86400000
  store.data.forEach((doc, path) => {
    // Pretend the member kept refreshing: token and client stay alive.
    if (path.startsWith('oauthClients/') || doc.type === 'refresh') doc.expiresAt = { toMillis: () => now + 365 * 86400000 }
  })
  current = (await refresh(store.db, flow.clientId, current.refresh_token, later)).body
  assert.equal(lifetime(current.refresh_token), now + 90 * 86400000)
  const past = now + 91 * 86400000
  assert.equal((await refresh(store.db, flow.clientId, current.refresh_token, past)).body.error, 'invalid_grant')
})

test('access tokens are bound to the MCP audience and expire after an hour', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const { access_token: access } = (await exchange(store.db, flow.clientId, flow.code, now)).body
  assert.deepEqual(Object.keys(await validateAccessToken(store.db, access, { now })).sort(), ['grantId', 'uid'])
  assert.equal((await validateAccessToken(store.db, access, { now, audience: 'https://other.example/mcp' })).reason, 'audience')
  assert.equal((await validateAccessToken(store.db, access, { now: now + 3600001 })).reason, 'expired')
  assert.equal((await validateAccessToken(store.db, 'dhm_' + 'a'.repeat(64), { now })).reason, 'malformed')
  const [path, doc] = docs(store.data, 'oauthTokens').find(([, d]) => d.type === 'access')
  store.data.set(path, { ...doc, aud: 'https://us-central1-danang-hub-app.cloudfunctions.net/mcp' })
  assert.equal((await validateAccessToken(store.db, access, { now })).reason, 'audience')
})

test('revocation: refresh token ends the grant, unknown tokens still get 200', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const issued = (await exchange(store.db, flow.clientId, flow.code, now)).body
  const res = await call(store.db, { method: 'POST', path: '/oauth/revoke', headers: FORM.headers,
    body: { token: 'dhr_' + '0'.repeat(64), client_id: flow.clientId } })
  assert.equal(res.statusCode, 200)
  assert.equal(res.headers['Access-Control-Allow-Origin'], '*')
  const other = await revoke(store.db, { token: issued.refresh_token, client_id: 'dhc_' + '1'.repeat(32) }, { ...FORM, now })
  assert.equal(other.status, 200)
  assert.equal((await validateAccessToken(store.db, issued.access_token, { now })).uid, uid)
  await revoke(store.db, { token: issued.refresh_token, client_id: flow.clientId }, { ...FORM, now })
  assert.equal((await validateAccessToken(store.db, issued.access_token, { now })).reason, 'unknown')
  assert.equal(docs(store.data, 'oauthGrants')[0][1].revoked, true)
})

test('token endpoint enforces the grant types a client registered (RFC 6749 5.2)', async () => {
  const store = makeStore()
  const now = Date.now()
  const flow = await approved(store, now)
  const issued = (await exchange(store.db, flow.clientId, flow.code, now)).body
  const clientPath = `oauthClients/${flow.clientId}`
  assert.deepEqual(store.data.get(clientPath).grantTypes, ['authorization_code', 'refresh_token'],
    'omitted grant_types default to both, so Claude and ChatGPT can refresh')

  store.data.set(clientPath, { ...store.data.get(clientPath), grantTypes: ['authorization_code'] })
  const noRefresh = await refresh(store.db, flow.clientId, issued.refresh_token, now + 1000)
  assert.equal(noRefresh.status, 400)
  assert.equal(noRefresh.body.error, 'unauthorized_client')

  const { grantTypes, ...legacy } = store.data.get(clientPath)
  assert.ok(grantTypes)
  store.data.set(clientPath, legacy)
  assert.equal((await refresh(store.db, flow.clientId, issued.refresh_token, now + 2000)).status, 200,
    'a stored client without grantTypes gets the default')

  const refreshOnly = (await registerClient(store.db, { redirect_uris: [CLAUDE], grant_types: ['refresh_token'] }, { now })).body
  const noCode = await exchange(store.db, refreshOnly.client_id, 'a'.repeat(64), now)
  assert.equal(noCode.status, 400)
  assert.equal(noCode.body.error, 'unauthorized_client')
  const unsupported = await token(store.db, { grant_type: 'password', client_id: refreshOnly.client_id }, { ...FORM, now })
  assert.equal(unsupported.body.error, 'unsupported_grant_type')
})

test('token endpoint rejects grants other than authorization_code and refresh_token', async () => {
  const store = makeStore()
  const { client_id: clientId } = (await register(store.db)).body
  for (const grant of ['client_credentials', 'password', 'implicit', 'toString', '__proto__', undefined]) {
    const result = await token(store.db, { grant_type: grant, client_id: clientId }, FORM)
    assert.equal(result.body.error, 'unsupported_grant_type')
  }
})

// Phase 3: the resource server (`mcp`) side.
const HOSTED = { headers: { 'x-forwarded-host': 'app.danangblockchainhub.com' } }
const METADATA_URL = `${ISSUER}/.well-known/oauth-protected-resource/mcp`
const memberStore = () => makeStore({
  [`members/${uid}`]: { displayName: 'Tester', company: 'Hub', jobTitle: 'Builder' },
  'amenities/desk': { name: 'Desk', type: 'desk', capacity: 1 }
})
// Approve and exchange: an access token plus the grant id behind it.
const connected = async (store, now = Date.now()) => {
  const flow = await approved(store, now)
  const grantId = store.data.get(`oauthCodes/${hash(flow.code)}`).grantId
  const issued = (await exchange(store.db, flow.clientId, flow.code, now)).body
  return { ...flow, grantId, access: issued.access_token, refresh: issued.refresh_token }
}
const reasonOf = (promise) => promise.then(() => null, (e) => {
  assert.equal(e.code, 'unauthenticated')
  return e.details.reason
})
const manageAs = (service, data, who = uid) => service.manage({ auth: { uid: who }, data })

test('Hosting detection: only the canonical X-Forwarded-Host (last hop) counts as hosted', () => {
  assert.equal(isHostedRequest(HOSTED), true)
  assert.equal(isHostedRequest({ headers: { 'x-forwarded-host': 'APP.danangblockchainhub.com' } }), true)
  assert.equal(isHostedRequest({ headers: { 'x-forwarded-host': 'evil.example, app.danangblockchainhub.com' } }), true)
  assert.equal(isHostedRequest({ headers: {} }), false, 'raw cloudfunctions.net request')
  assert.equal(isHostedRequest({ headers: { host: 'us-central1-danang-hub-app.cloudfunctions.net' } }), false)
  assert.equal(isHostedRequest({ headers: { 'x-forwarded-host': 'danang-hub-app.web.app' } }), false)
  assert.equal(isHostedRequest({ headers: { 'x-forwarded-host': 'app.danangblockchainhub.com.evil.example' } }), false)
  assert.equal(isHostedRequest({ headers: { 'x-forwarded-host': ['app.danangblockchainhub.com'] } }), false)
})

test('401 challenge: resource_metadata and scope only through Hosting; the raw URL keeps the realm', () => {
  assert.equal(wwwAuthenticate(true), `Bearer resource_metadata="${METADATA_URL}", scope="bookings"`)
  assert.equal(wwwAuthenticate(false), 'Bearer realm="Hub MCP"')
  assert.equal(wwwAuthenticate(true, false), 'Bearer realm="Hub MCP"', 'discovery off advertises nothing')
})

test('mcp accepts a dha_ access token through Hosting, with the dhm_ requireUser gate', async () => {
  const store = memberStore()
  const { access, grantId } = await connected(store)
  const service = createTokenService(store.db, auth)
  const principal = await service.authenticate('Bearer ' + access, { hosted: true })
  assert.equal(principal.uid, uid)
  assert.equal(principal.grantId, grantId)
  // Booking tools re-check the grant inside their transactions.
  const tools = createBookingTools(store.db, { isWithinAmenityHours: () => true, computeBookingAvailability: async () => ({}) })
  assert.deepEqual((await tools.list_amenities(principal, { limit: 20 })).items.map((a) => a.id), ['desk'])
  assert.equal(await reasonOf(service.authenticate('Bearer ' + access)), 'not-hosted', 'raw URL stays dhm_-only')
  const unverified = createTokenService(store.db, { getUser: async () => ({ email: 'a@b.c', emailVerified: false }) })
  await assert.rejects(unverified.authenticate('Bearer ' + access, { hosted: true }), /Verify your email/)
  const disabled = createTokenService(store.db, { getUser: async () => ({ disabled: true }) })
  assert.equal(await reasonOf(disabled.authenticate('Bearer ' + access, { hosted: true })), 'disabled')
  assert.equal(await reasonOf(service.authenticate('Bearer dha_' + '0'.repeat(64), { hosted: true })), 'unknown')
  assert.equal(await reasonOf(service.authenticate('Bearer ' + flipCase(access), { hosted: true })), 'malformed')
})
const flipCase = (value) => value.slice(0, 4) + value.slice(4).toUpperCase()

test('mcp rejects a dha_ token whose aud is not the canonical MCP URL with 401', async () => {
  const store = memberStore()
  const { access } = await connected(store)
  const [path, doc] = docs(store.data, 'oauthTokens').find(([, d]) => d.type === 'access')
  store.data.set(path, { ...doc, aud: 'https://us-central1-danang-hub-app.cloudfunctions.net/mcp' })
  const service = createTokenService(store.db, auth)
  assert.equal(await reasonOf(service.authenticate('Bearer ' + access, { hosted: true })), 'audience')
})

test('mcp rejects a dha_ token of a revoked or expired grant with 401', async () => {
  const store = memberStore()
  const { access, grantId } = await connected(store)
  const service = createTokenService(store.db, auth)
  const grantPath = `oauthGrants/${grantId}`
  const grant = store.data.get(grantPath)
  store.data.set(grantPath, { ...grant, revoked: true })
  assert.equal(await reasonOf(service.authenticate('Bearer ' + access, { hosted: true })), 'revoked')
  store.data.set(grantPath, { ...grant, expiresAt: { toMillis: () => Date.now() - 1 } })
  assert.equal(await reasonOf(service.authenticate('Bearer ' + access, { hosted: true })), 'revoked')
})

test('dha_ requests are limited to 60 per minute per grant; lastUsedAt is written once per minute', async () => {
  const store = memberStore()
  const { access, grantId } = await connected(store)
  const service = createTokenService(store.db, auth)
  const grantPath = `oauthGrants/${grantId}`
  for (let i = 0; i < 60; i++) await service.authenticate('Bearer ' + access, { hosted: true })
  const grant = store.data.get(grantPath)
  assert.equal(grant.count, 60)
  assert.equal(typeof grant.lastUsedAt, 'number')
  await assert.rejects(service.authenticate('Bearer ' + access, { hosted: true }), (e) => e.code === 'resource-exhausted')
  store.data.set(grantPath, { ...grant, lastUsedAt: 1, window: grant.window - 1 })
  await service.authenticate('Bearer ' + access, { hosted: true })
  assert.equal(store.data.get(grantPath).count, 1)
  assert.notEqual(store.data.get(grantPath).lastUsedAt, 1, 'a new window records lastUsedAt')
})

test('Connected apps: listGrants shows the member\'s live grants only; revokeGrant disconnects', async () => {
  const store = memberStore()
  const first = await connected(store)
  const second = await connected(store, Date.now() + 1000)
  const service = createTokenService(store.db, auth)
  const { grants } = await manageAs(service, { action: 'listGrants' })
  assert.deepEqual(grants.map((g) => g.id), [second.grantId, first.grantId], 'newest first')
  assert.deepEqual(Object.keys(grants[0]).sort(), ['clientName', 'createdAt', 'expiresAt', 'id', 'lastUsedAt', 'redirectHost'])
  assert.equal(grants[0].clientName, 'Claude')
  assert.equal(grants[0].redirectHost, 'claude.ai')
  assert.deepEqual((await manageAs(service, { action: 'listGrants' }, 'member-b')).grants, [])
  // Another member cannot disconnect it, and ids are validated.
  await assert.rejects(manageAs(service, { action: 'revokeGrant', grantId: first.grantId }, 'member-b'), /Unknown app/)
  await assert.rejects(manageAs(service, { action: 'revokeGrant', grantId: '../x' }), /Unknown app/)
  assert.equal(docs(store.data, 'mcpTokens').length, 0, 'grants need no mcpTokens doc')
  assert.deepEqual(await manageAs(service, { action: 'revokeGrant', grantId: first.grantId }), { revoked: true })
  assert.equal(store.data.get(`oauthGrants/${first.grantId}`).revoked, true)
  assert.equal(docs(store.data, 'oauthTokens').some(([, d]) => d.grantId === first.grantId), false, 'tokens deleted')
  assert.deepEqual((await manageAs(service, { action: 'listGrants' })).grants.map((g) => g.id), [second.grantId])
  assert.equal((await refresh(store.db, first.clientId, first.refresh, Date.now())).body.error, 'invalid_grant')
})

test('after Disconnect, the grant\'s next MCP request and in-flight booking calls fail with 401', async () => {
  const store = memberStore()
  const { access, grantId } = await connected(store)
  const service = createTokenService(store.db, auth)
  const principal = await service.authenticate('Bearer ' + access, { hosted: true })
  await manageAs(service, { action: 'revokeGrant', grantId })
  assert.equal(await reasonOf(service.authenticate('Bearer ' + access, { hosted: true })), 'unknown')
  const tools = createBookingTools(store.db, { isWithinAmenityHours: () => true, computeBookingAvailability: async () => ({}) })
  await assert.rejects(tools.list_amenities(principal, { limit: 20 }), (e) => e.code === 'unauthenticated')
})

const bookingTools = (store) => createBookingTools(store.db, { isWithinAmenityHours: () => true, computeBookingAvailability: async () => ({ hasConflicts: false, conflicts: [] }) })
const nextWeekSlot = () => {
  const date = new Date(Date.now() + 7 * 86400000)
  date.setUTCHours(2, 0, 0, 0)
  return { amenityId: 'desk', startTime: date.toISOString(), endTime: new Date(+date + 3600000).toISOString(), requestId: 'oauth-key' }
}

test('booking tools: a dha_ principal books against its grant, not an mcpTokens doc', async () => {
  const store = memberStore()
  const { access } = await connected(store)
  const principal = await createTokenService(store.db, auth).authenticate('Bearer ' + access, { hosted: true })
  assert.equal(principal.hash, undefined)
  const booking = await bookingTools(store).create_booking(principal, nextWeekSlot())
  assert.equal(store.data.get(`bookings/${booking.id}`).memberId, uid)
  assert.equal(docs(store.data, 'mcpTokens').length, 0)
})

test('booking tools: a grant revoked after authenticate, expired, or owned by another uid fails the call', async () => {
  const store = memberStore()
  const { access, grantId } = await connected(store)
  const principal = await createTokenService(store.db, auth).authenticate('Bearer ' + access, { hosted: true })
  const tools = bookingTools(store)
  const grantPath = `oauthGrants/${grantId}`
  const grant = store.data.get(grantPath)
  const unauthenticated = (e) => e.code === 'unauthenticated' && /revoked or expired/.test(e.message)
  store.data.set(grantPath, { ...grant, revoked: true })
  await assert.rejects(tools.create_booking(principal, nextWeekSlot()), unauthenticated)
  store.data.set(grantPath, { ...grant, expiresAt: { toMillis: () => Date.now() - 1 } })
  await assert.rejects(tools.create_booking(principal, nextWeekSlot()), unauthenticated)
  store.data.set(grantPath, grant)
  await assert.rejects(tools.create_booking({ uid: 'member-b', grantId }, nextWeekSlot()), unauthenticated)
  await assert.rejects(tools.list_amenities({ uid, grantId: 'f'.repeat(32) }, { limit: 20 }), unauthenticated)
  assert.equal(docs(store.data, 'bookings').length, 0, 'no booking created')
})
