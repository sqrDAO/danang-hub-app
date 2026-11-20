/** A different signed-in account can share this browser subscription. */
export const anotherAccountNeedsPush = ({ uid, activeUid, state, preferenceEnabled, permission }) =>
  Boolean(activeUid && activeUid !== uid && preferenceEnabled && permission === 'granted' &&
    (state === 'in' || state === 'unknown'))

/** Revoke only the existing endpoint; never subscribe or mint a token to delete it. */
export const revokePushSubscription = async (registration) => {
  const subscription = await registration.pushManager.getSubscription()
  if (subscription && !(await subscription.unsubscribe())) {
    throw new Error('Unable to revoke the browser push subscription.')
  }
}

/** Offline Firestore deletes remain pending; logout must still reach signOut. */
const waitForDeletes = async (deletes, timeoutMs) => {
  let timer
  try {
    return await Promise.race([
      Promise.allSettled(deletes),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Push token cleanup timed out.')), timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Failed or offline document cleanup must not leave the old account reachable. */
export const clearPushRegistration = async ({ deletes, anotherAccountNeedsPush, revoke, timeoutMs = 5000 }) => {
  // Attach rejection handlers immediately, even while checking the active user.
  const results = waitForDeletes(deletes, timeoutMs)
  results.catch(() => {})
  let revoked = false
  try {
    // Start the privacy backstop before waiting for possibly offline writes.
    if (!(await anotherAccountNeedsPush())) {
      await revoke()
      revoked = true
    }
    const failed = (await results).find((result) => result.status === 'rejected')
    if (failed) throw failed.reason
  } catch (error) {
    if (!revoked) await revoke()
    throw error
  }
}
