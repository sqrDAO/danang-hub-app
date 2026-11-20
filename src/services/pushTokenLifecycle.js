/** Service errors carry a stable code; UI callers translate their fallback. */
export const pushLifecycleError = (code, cause, outcome = {}) =>
  Object.assign(new Error(code, { cause }), { code: `push/${code}`, ...outcome })

/** A deadline settles the caller, never cancels or releases underlying SDK work. */
export const withPushDeadline = async (work, timeoutMs, onTimeout = () => {}) => {
  let timer
  try {
    return await Promise.race([
      work,
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          onTimeout()
          reject(pushLifecycleError('timeout'))
        }, timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Revoke only the existing endpoint; never subscribe or mint a token to delete it. */
export const revokePushSubscription = async (registration) => {
  const subscription = await registration.pushManager.getSubscription()
  if (subscription && !(await subscription.unsubscribe())) {
    throw pushLifecycleError('revoke-failed')
  }
}

/** Revocation and document deletion run independently, including while offline. */
export const clearPushRegistration = async ({ deletes, revoke, timeoutMs = 5000, onRevokeFailed = () => {} }) => {
  const outcome = { subscriptionRevoked: false, revocationFailed: false }
  const revocation = Promise.resolve().then(revoke).then(() => {
    outcome.subscriptionRevoked = true
  }, (error) => {
    outcome.revocationFailed = true
    onRevokeFailed()
    throw error
  })
  const work = Promise.allSettled([...deletes, revocation]).then((results) => {
    const failure = results.find((result) => result.status === 'rejected')
    if (failure) throw failure.reason
    return outcome
  })
  try {
    return await withPushDeadline(work, timeoutMs)
  } catch (error) {
    throw pushLifecycleError('cleanup-failed', error, outcome)
  }
}
