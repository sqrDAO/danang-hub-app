import { clearPushRegistration, pushLifecycleError, withPushDeadline } from './pushTokenLifecycle.js'

const assertCurrent = (ticket) => {
  if (!ticket.isCurrent()) throw pushLifecycleError('cancelled')
}

/** This is the production pipeline, with SDK boundaries injected for race tests. */
const runRegistration = async ({ ticket, ready, prepare, issue, save, commit, mark, cleanup }) => {
  let deviceId
  let issuing = false
  try {
    await ready()
    assertCurrent(ticket)
    deviceId = await prepare()
    assertCurrent(ticket)
    if (!deviceId) return false
    issuing = true
    const token = await issue(() => assertCurrent(ticket))
    assertCurrent(ticket)
    await save(ticket.uid, deviceId, token, () => assertCurrent(ticket))
    assertCurrent(ticket)
    await commit(ticket.uid)
    assertCurrent(ticket)
    mark(ticket.uid)
    return token
  } catch (error) {
    // Keep ownership until late getToken/save work has settled and been revoked.
    if (issuing) await cleanup(ticket.uid, deviceId).catch((cause) => {
      throw pushLifecycleError('cleanup-failed', cause)
    })
    throw pushLifecycleError('registration-failed', error)
  }
}

/** One app has one current auth user and one browser subscription. */
export const createPushRegistrationLifecycle = ({ currentUid, issue, save, remove, revoke, timeoutMs = 30000, cleanupTimeoutMs = 5000 }) => {
  let generation = 0
  let registrations = Promise.resolve()
  let revocation = Promise.resolve()
  let onRevokeSuccess = () => {}

  const queueRevoke = () => {
    revocation = revocation.catch(() => {}).then(revoke).then(() => onRevokeSuccess())
    return revocation
  }
  const ready = () => revocation.catch(queueRevoke)
  const cleanup = async (uid, deviceId) => {
    const deletes = Promise.allSettled(remove(uid, deviceId))
    // Never release ownership while unsubscribe can still finish later.
    await queueRevoke()
    // A dead endpoint makes stale documents harmless; deletion is bounded.
    await withPushDeadline(deletes, cleanupTimeoutMs).catch(() => {})
  }

  const register = async (uid, { permission = async () => {}, prepare, commit = async () => {}, mark }) => {
    if (!uid || currentUid() !== uid) return Promise.reject(pushLifecycleError('cancelled'))
    const started = ++generation
    const ticket = { uid, cancelled: false }
    ticket.isCurrent = () => !ticket.cancelled && started === generation && currentUid() === uid
    // Human permission time owns no SDK queue slot and has no network deadline.
    // Reserve the ticket first so Off/logout while the prompt is open cancels it.
    try {
      await permission()
    } catch (error) {
      throw error?.code?.startsWith('push/') ? error : pushLifecycleError('registration-failed', error)
    }
    assertCurrent(ticket)
    const work = registrations.then(() => runRegistration({
      ticket, ready, prepare, issue, save, commit, mark, cleanup
    }))
    registrations = work.catch(() => {})
    return withPushDeadline(work, timeoutMs, () => { ticket.cancelled = true })
  }

  const clear = (uid, { onRevokeFailed = () => {}, onRevoked = () => {} } = {}) => {
    if (currentUid() && currentUid() !== uid) return Promise.reject(pushLifecycleError('cancelled'))
    const started = ++generation
    // A later stale-registration cleanup can successfully retry this Off.
    onRevokeSuccess = () => {
      if (generation === started && currentUid() === uid) onRevoked()
    }
    // Queue the revoke synchronously so a new registration sees this barrier.
    const pendingRevoke = queueRevoke()
    return clearPushRegistration({
      deletes: remove(uid), revoke: () => pendingRevoke, timeoutMs: cleanupTimeoutMs,
      onRevokeFailed: () => {
        if (generation === started && currentUid() === uid) onRevokeFailed()
      }
    })
  }
  return { register, clear }
}
