import test from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate as nextTurn } from 'node:timers/promises'
import { createPushRegistrationLifecycle } from '../src/services/pushRegistrationLifecycle.js'

// Exercise the same production pipeline wired by pushNotifications.js, with
// deferred SDK boundaries and observable token documents/markers/preferences.
const setup = (overrides = () => ({})) => {
  const state = { uid: 'a', subscription: null, documents: new Map(), markers: new Map(), preferences: new Set(), calls: [] }
  const sdk = {
    currentUid: () => state.uid,
    issue: async () => {
      const token = `token-${state.uid}`
      state.calls.push(`issue:${state.uid}`)
      state.subscription = token
      return token
    },
    save: async (uid, deviceId, token, assertCurrent) => {
      assertCurrent()
      state.calls.push(`save:${uid}`)
      state.documents.set(`${uid}/${deviceId}`, token)
      assertCurrent()
    },
    remove: (uid, deviceId = 'phone') => {
      state.calls.push(`remove:${uid}`)
      state.documents.delete(`${uid}/${deviceId}`)
      return [Promise.resolve()]
    },
    revoke: async () => { state.calls.push(`revoke:${state.subscription}`); state.subscription = null },
    timeoutMs: 5000,
    cleanupTimeoutMs: 30
  }
  Object.assign(sdk, overrides(state, sdk))
  const lifecycle = createPushRegistrationLifecycle(sdk)
  const register = (uid = state.uid) => lifecycle.register(uid, {
    prepare: async () => 'phone',
    commit: async (id) => { state.preferences.add(id) },
    mark: (id) => { state.markers.set(id, 'in') }
  })
  return { state, lifecycle, register }
}

const defaults = () => ({})

test('late A getToken after logout is revoked before B can issue or save', async () => {
  const token = Promise.withResolvers()
  const h = setup((state, sdk) => {
    const issue = sdk.issue
    return { issue: async () => {
      if (state.uid === 'a') {
        state.calls.push('issue:a:pending')
        await token.promise
        state.subscription = 'late-token-a'
        return 'late-token-a'
      }
      return issue()
    } }
  })
  const a = assert.rejects(h.register('a'), { code: 'push/registration-failed' })
  await nextTurn()
  await h.lifecycle.clear('a')
  h.state.uid = 'b'
  const b = h.register('b')
  await nextTurn()
  assert.equal(h.state.calls.includes('issue:b'), false)
  token.resolve()
  await a
  assert.equal(await b, 'token-b')
  assert.equal(h.state.calls.includes('save:a'), false)
  assert.equal(h.state.markers.has('a'), false)
  assert.equal(h.state.preferences.has('a'), false)
  assert.deepEqual([...h.state.documents], [['b/phone', 'token-b']])
  assert.equal(h.state.subscription, 'token-b')
  assert.ok(h.state.calls.indexOf('revoke:late-token-a') < h.state.calls.indexOf('issue:b'))
})

test('Off during an already pending save cleans its late write and never commits On', async () => {
  const write = Promise.withResolvers()
  const h = setup((state) => ({ save: async (uid, deviceId, token, assertCurrent) => {
    assertCurrent()
    state.calls.push('save:a:pending')
    await write.promise
    state.documents.set(`${uid}/${deviceId}`, token)
    assertCurrent()
  } }))
  const a = assert.rejects(h.register(), { code: 'push/registration-failed' })
  await nextTurn()
  assert.ok(h.state.calls.includes('save:a:pending'))
  h.state.markers.set('a', 'out')
  await h.lifecycle.clear('a', { onRevokeFailed: () => h.state.markers.set('a', 'in') })
  write.resolve()
  await a
  assert.equal(h.state.documents.has('a/phone'), false)
  assert.equal(h.state.subscription, null)
  assert.equal(h.state.markers.get('a'), 'out')
  assert.equal(h.state.preferences.has('a'), false)
})

test('logout finishes while getToken hangs; timed-out queued B never starts later', async () => {
  const token = Promise.withResolvers()
  const h = setup((state) => ({ timeoutMs: 20, issue: async () => {
    state.calls.push(`issue:${state.uid}`)
    await token.promise
    state.subscription = 'late-a'
    return 'late-a'
  } }))
  const a = assert.rejects(h.register('a'), { code: 'push/timeout' })
  await nextTurn()
  await h.lifecycle.clear('a')
  h.state.uid = 'b'
  const b = assert.rejects(h.register('b'), { code: 'push/timeout' })
  await Promise.all([a, b])
  token.resolve()
  await nextTurn()
  await nextTurn()
  assert.deepEqual(h.state.calls.filter((call) => call.startsWith('issue:')), ['issue:a'])
  assert.equal(h.state.documents.size, 0)
  assert.equal(h.state.subscription, null)
})

test('a failed revoke blocks registration until a retry actually succeeds', async () => {
  let fail = true
  const h = setup((state) => ({ revoke: async () => {
    if (fail) throw new Error('offline unsubscribe failure')
    state.subscription = null
  } }))
  await assert.rejects(h.lifecycle.clear('a'), { code: 'push/cleanup-failed' })
  h.state.uid = 'b'
  await assert.rejects(h.register('b'), { code: 'push/registration-failed' })
  assert.equal(h.state.calls.includes('issue:b'), false)
  fail = false
  assert.equal(await h.register('b'), 'token-b')
})

test('pending native revoke times out logout but remains a barrier for B', async () => {
  const revoke = Promise.withResolvers()
  const h = setup((state) => ({ cleanupTimeoutMs: 5, revoke: async () => {
    await revoke.promise
    state.subscription = null
  } }))
  await assert.rejects(h.lifecycle.clear('a'), (error) => !error.subscriptionRevoked && !error.revocationFailed)
  h.state.uid = 'b'
  const b = h.register('b')
  await nextTurn()
  assert.equal(h.state.calls.includes('issue:b'), false)
  revoke.resolve()
  assert.equal(await b, 'token-b')
  assert.equal(h.state.subscription, 'token-b')
})

test('a late A clear cannot invalidate or revoke an already active B', async () => {
  const h = setup(defaults)
  h.state.uid = 'b'
  await h.register('b')
  await assert.rejects(h.lifecycle.clear('a'), { code: 'push/cancelled' })
  assert.equal(h.state.subscription, 'token-b')
  assert.equal(h.state.markers.get('b'), 'in')
})

test('failed Off restores On only if revoke failed in the current session', async () => {
  const rejection = Promise.withResolvers()
  const h = setup(() => ({ cleanupTimeoutMs: 5, revoke: () => rejection.promise }))
  h.state.markers.set('a', 'out')
  await assert.rejects(h.lifecycle.clear('a', { onRevokeFailed: () => h.state.markers.set('a', 'in') }))
  h.state.uid = 'b'
  rejection.reject(new Error('late unsubscribe failure'))
  await nextTurn()
  assert.equal(h.state.markers.get('a'), 'out')
})

test('ordinary registration commits preference and marker after saving only this phone', async () => {
  const h = setup(defaults)
  h.state.documents.set('a/second-phone', 'second-token')
  assert.equal(await h.register('a'), 'token-a')
  assert.equal(h.state.markers.get('a'), 'in')
  assert.ok(h.state.preferences.has('a'))
  await h.lifecycle.clear('a')
  assert.deepEqual([...h.state.documents], [['a/second-phone', 'second-token']])
})

test('logout during preference commit prevents the stale opt-in marker', async () => {
  const commit = Promise.withResolvers()
  const h = setup(defaults)
  const a = assert.rejects(h.lifecycle.register('a', {
    prepare: async () => 'phone',
    commit: async () => { h.state.calls.push('commit:pending'); await commit.promise },
    mark: (uid) => h.state.markers.set(uid, 'in')
  }), { code: 'push/registration-failed' })
  await nextTurn()
  assert.ok(h.state.calls.includes('commit:pending'))
  await h.lifecycle.clear('a')
  h.state.uid = 'b'
  const b = h.register('b')
  commit.resolve()
  await a
  await b
  assert.equal(h.state.markers.has('a'), false)
  assert.equal(h.state.subscription, 'token-b')
})

test('a failed old Off cannot restore its marker after a newer registration request', async () => {
  const revocation = Promise.withResolvers()
  let attempts = 0
  const h = setup(() => ({ cleanupTimeoutMs: 5, revoke: () => {
    attempts += 1
    return attempts === 1 ? revocation.promise : Promise.resolve()
  } }))
  h.state.markers.set('a', 'out')
  let staleRestores = 0
  await assert.rejects(h.lifecycle.clear('a', { onRevokeFailed: () => { staleRestores += 1 } }))
  const on = h.register('a')
  revocation.reject(new Error('old unsubscribe failed'))
  assert.equal(await on, 'token-a')
  assert.equal(staleRestores, 0)
  assert.equal(h.state.markers.get('a'), 'in')
})

test('a delayed A registration request cannot invalidate B while B is issuing its token', async () => {
  const token = Promise.withResolvers()
  const h = setup((state) => ({ issue: async () => {
    state.calls.push(`issue:${state.uid}`)
    await token.promise
    state.subscription = 'token-b'
    return 'token-b'
  } }))
  h.state.uid = 'b'
  const b = h.register('b')
  await nextTurn()
  await assert.rejects(h.register('a'), { code: 'push/cancelled' })
  token.resolve()
  assert.equal(await b, 'token-b')
  assert.equal(h.state.subscription, 'token-b')
  assert.equal(h.state.markers.get('b'), 'in')
  assert.equal(h.state.calls.some((call) => call.startsWith('revoke:')), false)
})

test('successful late cleanup restores Off after its first revoke attempt failed', async () => {
  const token = Promise.withResolvers()
  let revokes = 0
  const h = setup((state) => ({
    issue: async () => { await token.promise; state.subscription = 'late-a'; return 'late-a' },
    revoke: async () => {
      revokes += 1
      if (revokes === 1) throw new Error('first unsubscribe failed')
      state.subscription = null
    }
  }))
  const a = assert.rejects(h.register('a'), { code: 'push/registration-failed' })
  await nextTurn()
  h.state.markers.set('a', 'out')
  await assert.rejects(h.lifecycle.clear('a', {
    onRevokeFailed: () => h.state.markers.set('a', 'in'),
    onRevoked: () => h.state.markers.set('a', 'out')
  }))
  assert.equal(h.state.markers.get('a'), 'in')
  token.resolve()
  await a
  assert.equal(h.state.subscription, null)
  assert.equal(h.state.markers.get('a'), 'out')
})

test('SDK cleanup errors keep a push code so raw English cannot reach the UI', async () => {
  const h = setup(() => ({
    issue: async () => { throw new Error('FCM error in English') },
    revoke: async () => { throw new Error('Native unsubscribe error in English') }
  }))
  await assert.rejects(h.register('a'), { code: 'push/cleanup-failed' })
})

test('permission can remain open beyond the network deadline and still register', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const permission = Promise.withResolvers()
  const h = setup(() => ({ timeoutMs: 15000 }))
  let settled = false
  const registration = h.lifecycle.register('a', {
    permission: () => permission.promise,
    prepare: async () => 'phone',
    mark: (uid) => h.state.markers.set(uid, 'in')
  })
  registration.then(() => { settled = true }, () => { settled = true })
  t.mock.timers.tick(60000)
  await nextTurn()
  assert.equal(settled, false)
  assert.equal(h.state.calls.length, 0)
  permission.resolve()
  assert.equal(await registration, 'token-a')
  assert.equal(h.state.markers.get('a'), 'in')
})

test('logout during permission cancels A without blocking B or revoking its token', async () => {
  const permission = Promise.withResolvers()
  const h = setup(defaults)
  const a = assert.rejects(h.lifecycle.register('a', {
    permission: () => permission.promise,
    prepare: async () => 'phone',
    mark: (uid) => h.state.markers.set(uid, 'in')
  }), { code: 'push/cancelled' })
  await h.lifecycle.clear('a')
  h.state.uid = 'b'
  assert.equal(await h.register('b'), 'token-b')
  permission.resolve()
  await a
  assert.equal(h.state.subscription, 'token-b')
  assert.deepEqual([...h.state.documents], [['b/phone', 'token-b']])
  assert.equal(h.state.markers.has('a'), false)
})

test('Off during permission cancels registration even while the uid stays the same', async () => {
  const permission = Promise.withResolvers()
  const h = setup(defaults)
  const a = assert.rejects(h.lifecycle.register('a', {
    permission: () => permission.promise,
    prepare: async () => 'phone', mark: () => assert.fail('must not mark On')
  }), { code: 'push/cancelled' })
  await h.lifecycle.clear('a')
  permission.resolve()
  await a
  assert.equal(h.state.calls.some(call => call.startsWith('issue:')), false)
})


test('native permission failures retain a localized push error code', async () => {
  const h = setup(defaults)
  await assert.rejects(h.lifecycle.register('a', {
    permission: async () => { throw new Error('Native permission failure in English') },
    prepare: async () => 'phone', mark: () => assert.fail('must not mark On')
  }), { code: 'push/registration-failed' })
  assert.equal(h.state.calls.length, 0)
})
