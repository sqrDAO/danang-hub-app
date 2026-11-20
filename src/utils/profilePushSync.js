/** A revoked endpoint is safely Off even if stale token documents remain. */
export const settleProfilePushSync = async ({ sync, touched, onWarning, onPermissionChange, readPermission }) => {
  try {
    await sync
  } catch (error) {
    if (error?.code === 'push/cleanup-failed' && error.subscriptionRevoked) {
      onWarning(error)
    } else if (touched) {
      throw error
    } else {
      console.warn('Unable to register this phone for push on save:', error)
    }
  } finally {
    onPermissionChange(readPermission())
  }
}
