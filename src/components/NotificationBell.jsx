import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getUnreadNotifications, markNotificationRead, markNotificationsRead } from '../services/notifications'
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

const getDefaultNotificationCopy = (t) => ({
  title: t('notifications.defaultTitle'),
  body: t('notifications.defaultBody')
})

const NOTIFICATION_COPY_BY_TYPE = {
  event_pending_review: getEventPendingReviewCopy,
  booking_pending_review: getBookingPendingReviewCopy,
  booking_approved: getBookingApprovedCopy
}

const getNotificationCopy = (notification, t) => {
  const copyFactory = NOTIFICATION_COPY_BY_TYPE[notification.type]
  const copy = copyFactory ? copyFactory(notification, t) : getDefaultNotificationCopy(t)
  const tone = notification.type === 'booking_approved' ? 'approved' : 'pending'

  return {
    ...copy,
    tone
  }
}

const getNotificationPath = (notification) => notification.link || '/member/bookings'

const NotificationItem = ({ notification, onOpen, t }) => {
  const { title, body, tone } = getNotificationCopy(notification, t)
  return (
    <button type="button" className="notification-item" onClick={() => onOpen(notification)}>
      <span className={`notification-status notification-status--${tone}`} aria-hidden />
      <span className="notification-copy">
        <strong>{title}</strong>
        <span>{body}</span>
      </span>
    </button>
  )
}

const NotificationBell = ({ userId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getUnreadNotifications(userId),
    enabled: Boolean(userId),
    refetchInterval: 30000,
    refetchOnWindowFocus: false
  })
  const invalidateNotifications = () => queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
  const readMutation = useMutation({ mutationFn: markNotificationRead, onSuccess: invalidateNotifications })
  const readAllMutation = useMutation({ mutationFn: markNotificationsRead, onSuccess: invalidateNotifications })

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
                <NotificationItem key={notification.id} notification={notification} onOpen={handleOpenNotification} t={t} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default NotificationBell
