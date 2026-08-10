import { isMobileOrTabletDevice } from './mobilePushEligibility.js'

const NOTIFICATION_SOUND_URL = '/assets/notification-ding.wav'

let notificationAudio

export const resolveDesktopNotificationSoundEligibility = ({
  windowAvailable,
  navigatorLike
}) => Boolean(windowAvailable && navigatorLike && !isMobileOrTabletDevice(navigatorLike))

export const playDesktopNotificationSound = () => {
  const navigatorLike = typeof navigator !== 'undefined' ? navigator : null
  const eligible = resolveDesktopNotificationSoundEligibility({
    windowAvailable: typeof window !== 'undefined',
    navigatorLike
  })

  if (!eligible || typeof Audio === 'undefined') return

  try {
    notificationAudio ??= new Audio(NOTIFICATION_SOUND_URL)
    notificationAudio.currentTime = 0
    const playResult = notificationAudio.play()
    playResult?.catch(() => {})
  } catch {
    // Audio construction and playback may be blocked by browser policy.
  }
}
