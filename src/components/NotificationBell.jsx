import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getUnreadNotifications, markNotificationRead, markNotificationsRead } from '../services/notifications'
import { playDesktopNotificationSound } from '../utils/desktopNotificationSound'
import { formatHubDateTimeCompact } from '../utils/timezone'
import './NotificationBell.css'

const BellIcon = () => (
  <svg className="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const getFallbackName = (value, t) => value || t('notifications.memberFallback')

const getEventPendingReviewCopy = (notification, t) => ({
  title: t('notifications.eventPendingReviewTitle'),
  body: t('notifications.eventPendingReviewBody', {
    organizer: getFallbackName(notification.organizerName, t),
    title: notification.eventTitle
  })
})

const getEventStatusCopy = (notification, t) => {
  const isRejected = notification.status === 'rejected'
  return {
    title: isRejected
      ? t('notifications.eventRejectedTitle')
      : t('notifications.eventApprovedTitle'),
    body: isRejected && notification.rejectionReason
      ? t('notifications.eventRejectedReason', {
        title: notification.eventTitle,
        reason: notification.rejectionReason
      })
      : t(isRejected ? 'notifications.eventRejectedBody' : 'notifications.eventApprovedBody', {
        title: notification.eventTitle
      })
  }
}

const getBookingPendingReviewBody = (notification, t) => {
  const args = {
    member: getFallbackName(notification.memberName, t),
    amenity: notification.amenityName
  }

  return notification.planType === 'fixed-desk'
    ? t('notifications.fixedDeskPendingReviewBody', args)
    : t('notifications.bookingPendingReviewBody', args)
}

const getBookingPendingReviewCopy = (notification, t) => ({
  title: t('notifications.bookingPendingReviewTitle'),
  body: getBookingPendingReviewBody(notification, t)
})

const getBookingApprovedBody = (notification, t) => (
  notification.planType === 'fixed-desk'
    ? t('notifications.fixedDeskApprovedBody', { amenity: notification.amenityName })
    : t('notifications.bookingApprovedBody', { amenity: notification.amenityName })
)

const getBookingApprovedCopy = (notification, t) => ({
  title: t('notifications.bookingApprovedTitle'),
  body: getBookingApprovedBody(notification, t)
})

// A closure cancellation says why; anything else stays generic, since the raw
// `cancelledReason` is an internal marker and not member-facing copy.
const getBookingCancelledBody = (notification, t) => {
  const args = { amenity: notification.amenityName }
  if (notification.isHubClosure) {
    return notification.planType === 'fixed-desk'
      ? t('notifications.fixedDeskCancelledClosureBody', args)
      : t('notifications.bookingCancelledClosureBody', args)
  }
  return notification.planType === 'fixed-desk'
    ? t('notifications.fixedDeskCancelledBody', args)
    : t('notifications.bookingCancelledBody', args)
}

const getBookingCancelledCopy = (notification, t) => ({
  title: t('notifications.bookingCancelledTitle'),
  body: getBookingCancelledBody(notification, t)
})

// Reminder copy depends on the recipient's relationship to the event, which
// the function stamps onto the notification as `segment`. A non-attendee at a
// full event is pointed at the waitlist rather than told spots are open.
const isEventFullForReminder = (notification) => (
  !!notification.capacity && notification.attendeeCount >= notification.capacity
)

const getEventReminderBody = (notification, t) => {
  if (notification.segment === 'waitlisted') {
    return t('notifications.eventReminderWaitlistedBody', {
      position: notification.waitlistPosition,
      title: notification.eventTitle
    })
  }
  if (notification.segment === 'other' && notification.capacity) {
    const key = isEventFullForReminder(notification)
      ? 'notifications.eventReminderFullBody'
      : 'notifications.eventReminderOpenBody'
    return t(key, {
      title: notification.eventTitle,
      time: notification.eventTime,
      taken: notification.attendeeCount,
      capacity: notification.capacity
    })
  }
  return t('notifications.eventReminderBody', {
    title: notification.eventTitle,
    time: notification.eventTime
  })
}

const getEventReminderTitle = (notification, t) => {
  if (notification.segment !== 'other') return t('notifications.eventReminderTitle')
  return isEventFullForReminder(notification)
    ? t('notifications.eventReminderFullTitle')
    : t('notifications.eventReminderOpenTitle')
}

const getEventReminderCopy = (notification, t) => ({
  title: getEventReminderTitle(notification, t),
  body: getEventReminderBody(notification, t)
})

const getEventRevisionCopy = (notification, t) => {
  const key = `notifications.eventRevision${notification.reviewStatus}`
  return {
    title: t(`${key}Title`),
    body: t(`${key}Body`, { title: notification.eventTitle })
  }
}

const getDefaultNotificationCopy = (t) => ({
  title: t('notifications.defaultTitle'),
  body: t('notifications.defaultBody')
})

const NOTIFICATION_COPY_BY_TYPE = {
  event_status: getEventStatusCopy,
  event_pending_review: getEventPendingReviewCopy,
  booking_pending_review: getBookingPendingReviewCopy,
  booking_approved: getBookingApprovedCopy,
  booking_cancelled: getBookingCancelledCopy,
  event_reminder: getEventReminderCopy,
  event_revision: getEventRevisionCopy
}

const getNotificationCopyFactory = (type) => NOTIFICATION_COPY_BY_TYPE[type]

const getNotificationTone = (type) => {
  if (type === 'booking_approved') return 'approved'
  if (type === 'booking_cancelled') return 'rejected'
  if (type === 'event_rejected') return 'rejected'
  return 'pending'
}

const getEventStatusTone = (status) => (
  status === 'rejected' ? 'rejected' : 'approved'
)

const getEventRevisionTone = (status) => (
  status === 'pending' ? 'pending' : getEventStatusTone(status)
)

const getNotificationCopy = (notification, t) => {
  const copyFactory = getNotificationCopyFactory(notification.type)
  const copy = copyFactory ? copyFactory(notification, t) : getDefaultNotificationCopy(t)

  return {
    ...copy,
    tone: notification.type === 'event_status'
      ? getEventStatusTone(notification.status)
      : notification.type === 'event_revision'
        ? getEventRevisionTone(notification.reviewStatus)
      : getNotificationTone(notification.type)
  }
}

const NOTIFICATION_FALLBACK_PATH_BY_TYPE = {
  event_pending_review: '/admin/events',
  booking_pending_review: '/admin/bookings',
  booking_approved: '/member/bookings',
  booking_cancelled: '/member/bookings',
  event_status: '/member/events',
  event_reminder: '/member/events',
  event_revision: '/member/events'
}

const getNotificationPath = (notification) => (
  notification.link ||
  NOTIFICATION_FALLBACK_PATH_BY_TYPE[notification.type] ||
  '/member/bookings'
)

const getNotificationTimeLabel = (createdAt, language) => {
  const locale = language?.startsWith('vi') ? 'vi-VN' : 'en-US'
  return formatHubDateTimeCompact(createdAt, locale)
}

const NotificationItem = ({ notification, onOpen, t, language }) => {
  const { title, body, tone } = getNotificationCopy(notification, t)
  const timeLabel = getNotificationTimeLabel(notification.createdAt, language)
  return (
    <button type="button" className="notification-item" onClick={() => onOpen(notification)}>
      <span className={`notification-status notification-status--${tone}`} aria-hidden />
      <span className="notification-copy">
        <strong>{title}</strong>
        <span>{body}</span>
        {timeLabel ? <time className="notification-time" dateTime={notification.createdAt?.toISOString?.()}>{timeLabel}</time> : null}
      </span>
    </button>
  )
}

const NotificationBell = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const hasLoadedNotificationsRef = useRef(false)
  const previousUnreadNotificationIdsRef = useRef(new Set())
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const { data: notifications = [], isSuccess, isError } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUnreadNotifications(userId),
    enabled: Boolean(userId),
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  })
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
  const readMutation = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidateNotifications })
  const readAllMutation = useMutation({ mutationFn: markNotificationsRead, onSuccess: invalidateNotifications })

  useEffect(() => {
    hasLoadedNotificationsRef.current = false
    previousUnreadNotificationIdsRef.current = new Set()

    return () => {
      hasLoadedNotificationsRef.current = false
      previousUnreadNotificationIdsRef.current = new Set()
    }
  }, [userId])

  useEffect(() => {
    if (!isSuccess || isError) return

    const unreadNotificationIds = new Set(notifications.map(notification => notification.id))
    const hasNewUnreadNotification = hasLoadedNotificationsRef.current &&
      [...unreadNotificationIds].some(id => !previousUnreadNotificationIdsRef.current.has(id))

    if (hasNewUnreadNotification) playDesktopNotificationSound()

    previousUnreadNotificationIdsRef.current = unreadNotificationIds
    hasLoadedNotificationsRef.current = true
  }, [notifications, isError, isSuccess])

  useEffect(() => {
    const closePanel = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) setIsOpen(false)
    }
    if (isOpen) document.addEventListener('mousedown', closePanel)
    return () => document.removeEventListener('mousedown', closePanel)
  }, [isOpen])

  const handleOpenNotification = (notification) => {
    readMutation.mutate(notification.id)
    setIsOpen(false)
    navigate(getNotificationPath(notification))
  }

  const handleReadAll = () => readAllMutation.mutate(notifications.map(notification => notification.id))

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="header-icon-btn notification-bell-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={t('notifications.open')}
        aria-expanded={isOpen}
      >
        <BellIcon />
        {notifications.length > 0 && <span className="notification-badge">{notifications.length > 99 ? '99+' : notifications.length}</span>}
      </button>
      {isOpen && (
        <section className="notification-panel" aria-label={t('notifications.title')}>
          <div className="notification-panel-header">
            <h2>{t('notifications.title')}</h2>
            {notifications.length > 0 && (
              <button type="button" onClick={handleReadAll} disabled={readAllMutation.isPending}>
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="notification-empty">{t('notifications.empty')}</p>
          ) : (
            <div className="notification-list">
              {notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpenNotification}
                  t={t}
                  language={i18n.language}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationBell
