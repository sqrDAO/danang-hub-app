/** Firebase/push diagnostics stay in logs; push failures use translated UI text. */
export const profileErrorMessage = (error, t) => error?.code?.startsWith('push/')
  ? t('toast.profileUpdateFailed')
  : error?.message || t('toast.profileUpdateFailed')
