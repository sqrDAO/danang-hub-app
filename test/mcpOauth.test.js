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
const call = async (db, req) => {
  const res = fakeRes()
  await createOauthHandler(db)({ headers: {}, query: {}, ip: '1.2.3.4', ...req }, res)
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
const docs = (data, prefix) => [...data].filter(([path]) => path.startsWith(prefix + '/'))

test('metadata documents advertise the canonical resource, S256 and public clients', async () => {
  const { db } = makeStore()
  for (const path of ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp']) {
    const res = await call(db, { method: 'GET', path })
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { resource: RESOURCE, authorization_servers: [ISSUER],
      scopes_supported: ['bookings'], bearer_methods_supported: ['header'] })
    assert.equal(res.headers['Access-Control-Allow-Origin'], '*')
    assert.equal(res.headers['Cache-Control'], 'no-store')
  }
  const as = (await call(db, { method: 'GET', path: '/.well-known/oauth-authorization-server' })).body
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
    'http://localhost:33418/callback', 'http://127.0.0.1/callback', 'http://localhost:6274/oauth/callback']) {
    assert.equal(isAllowedRedirect(uri), true, uri)
  }
  for (const uri of ['https://evil.example/callback', 'http://claude.ai/api/mcp/auth_callback',
    CLAUDE + '?x=1', 'https://chatgpt.com/connector/oauth/a/b', 'http://localhost:0/callback',
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

test('token endpoint rejects grants other than authorization_code and refresh_token', async () => {
  const store = makeStore()
  const { client_id: clientId } = (await register(store.db)).body
  for (const grant of ['client_credentials', 'password', 'implicit', undefined]) {
    const result = await token(store.db, { grant_type: grant, client_id: clientId }, FORM)
    assert.equal(result.body.error, 'unsupported_grant_type')
  }
})
