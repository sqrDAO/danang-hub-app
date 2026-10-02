import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import OrganizerName from './OrganizerName'
import {
  getVisibleFields,
  getWhenText,
  getHostNames,
  isHallUnlinked
} from './eventFields'
import './EventCard.css'

// Mouse convenience: clicking anywhere on an event card opens it (detail
// modal or event page). Keyboard and screen-reader users open it through the
// card's title link/button instead, so the card itself carries no role or
// tabIndex — that would hide the card's own buttons from assistive tech.
// Clicks on the card's own buttons/links and text-selection drags are ignored.
const getCardOpenProps = (onOpen) => ({
  onClick: (e) => {
    if (e.target.closest('button, a')) return
    if (window.getSelection()?.toString()) return
    onOpen()
  }
})

const HostLine = ({ event, fields, onShowHost, t }) => {
  const hosts = fields.has('hosts') ? getHostNames(event.hostingProjects) : ''
  const showOrganizer = fields.has('organizer') && Boolean(event.organizerId)
  if (!hosts && !showOrganizer) return null
  return (
    <p className="ecard-row">
      {hosts}
      {showOrganizer && (
        <>
          {hosts ? ` · ${t('eventCard.by')} ` : `${t('eventDetails.organizedBy')} `}
          <OrganizerName event={event} onShowHost={onShowHost} className="ecard-link" />
        </>
      )}
    </p>
  )
}

const AttendeesLine = ({ event, t }) => {
  const waiting = event.waitlist?.length || 0
  return (
    <p className="ecard-row">
      {t('eventCard.attending', {
        current: event.attendees?.length || 0,
        total: event.capacity || '∞'
      })}
      {waiting > 0 && ` · ${t('eventCard.waiting', { count: waiting })}`}
    </p>
  )
}

const RejectionLine = ({ event, t }) => {
  if (event.status !== 'rejected') return null
  return (
    <p className="ecard-row ecard-row-error">
      {t('eventCard.rejected', { reason: event.rejectionReason || t('eventDetails.noReason') })}
    </p>
  )
}

const RevisionLine = ({ event, t }) => {
  if (event.status !== 'pending' || !event.resubmittedFromStatus) return null
  return (
    <p className="ecard-row ecard-row-muted">
      {t('adminEvents.resubmission', { revision: event.revision || 1, status: event.resubmittedFromStatus })}
    </p>
  )
}

const CardRows = ({ event, fields, onShowHost, t }) => (
  <div className="ecard-rows">
    {fields.has('date') && event.date && <p className="ecard-row ecard-row-date">{getWhenText(event)}</p>}
    <HostLine event={event} fields={fields} onShowHost={onShowHost} t={t} />
    {fields.has('attendees') && <AttendeesLine event={event} t={t} />}
    {fields.has('rejection') && <RejectionLine event={event} t={t} />}
    {fields.has('venue') && isHallUnlinked(event) && (
      <p className="ecard-row ecard-row-warning">⚠ {t('eventCard.hallNotLinked')}</p>
    )}
    {fields.has('revision') && <RevisionLine event={event} t={t} />}
    {fields.has('description') && event.description && <p className="ecard-teaser">{event.description}</p>}
  </div>
)

const getCardClassName = ({ status, showStatus, past, compact }) => [
  'ecard',
  showStatus && `ecard-status-${status}`,
  past && 'ecard-past',
  compact && 'ecard-compact'
].filter(Boolean).join(' ')

// One card for every event list. `view` names an EVENT_VIEWS entry and decides
// which fields show; `context` (viewer-specific lines) and `actions` (buttons)
// come from the page. `compact` is the smaller size used in dashboard widgets.
// Pass `to` for a display-only card that navigates, else `onOpen(event)`.
const EventCard = ({ event, view, to, onOpen, onShowHost, context, actions, past = false, compact = false }) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const fields = getVisibleFields(view)
  const status = event.status || 'approved'
  const showStatus = fields.has('status')
  const open = () => (to ? navigate(to) : onOpen(event, view))
  const title = event.title || t('eventCard.untitled')
  return (
    <article className={getCardClassName({ status, showStatus, past, compact })} {...getCardOpenProps(open)}>
      {event.bannerUrl && (
        <div className="ecard-banner">
          <img src={event.bannerUrl} alt="" loading="lazy" decoding="async" />
        </div>
      )}
      <div className="ecard-body">
        <div className="ecard-header">
          <h3 className="ecard-title">
            {to
              ? <Link to={to} className="ecard-title-button">{title}</Link>
              : <button type="button" className="ecard-title-button" onClick={open}>{title}</button>}
          </h3>
          {showStatus && <span className={`status-badge ${status}`}>{t(`status.${status}`)}</span>}
        </div>
        <CardRows event={event} fields={fields} onShowHost={onShowHost} t={t} />
        {context && <div className="ecard-context">{context}</div>}
      </div>
      {actions && <div className="ecard-actions">{actions}</div>}
    </article>
  )
}

export default EventCard
