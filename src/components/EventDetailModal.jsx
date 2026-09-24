import { useTranslation } from 'react-i18next'
import Modal from './Modal'
import { formatEventDate, formatEventTime } from '../utils/timezone'
import './EventDetailModal.css'

const DEFAULT_CAPACITY = 50

const getWhenText = (event) => {
  const start = `${formatEventDate(event.date)} · ${formatEventTime(event.date)}`
  if (!event.duration) return start
  const end = new Date(new Date(event.date).getTime() + event.duration * 60 * 1000)
  return `${start} – ${formatEventTime(end)}`
}

const getHostNames = (hostingProjects, projects) => {
  if (typeof hostingProjects === 'string') return hostingProjects
  return hostingProjects.map(projectId => {
    const project = projects.find(p => p.id === projectId)
    return project?.name || projectId
  }).join(', ')
}

const getAmenityName = (amenities, amenityId) =>
  amenities.find(a => a.id === amenityId)?.name || amenityId

// Event links are member-entered; only render real web links (blocks e.g.
// `javascript:` URLs, which React 18 would still render).
const isWebLink = (url) => /^https?:\/\//i.test(url)

const isEmpty = (value) => value === null || value === undefined || value === ''

const Fact = ({ label, value, sub }) => {
  if (isEmpty(value)) return null
  return (
    <div className="event-detail-fact">
      <span className="event-detail-label">{label}</span>
      <span className="event-detail-value">{value}</span>
      {sub && <span className="event-detail-sub">{sub}</span>}
    </div>
  )
}

// Pages without a host profile modal (home) omit onShowHost: plain text then.
const OrganizerValue = ({ event, onShowHost }) => {
  const name = event.organizerDisplayName || event.organizerId
  if (!onShowHost) return name
  return (
    <button type="button" className="event-detail-link" onClick={() => onShowHost(event.organizerId)}>
      {name}
    </button>
  )
}

// Hosts are the main line, the organizer a sub line under them. Without hosts
// the organizer takes the main line.
const HostFact = ({ event, projects, onShowHost, t }) => {
  const organizer = event.organizerId ? <OrganizerValue event={event} onShowHost={onShowHost} /> : null
  const hosts = event.hostingProjects ? getHostNames(event.hostingProjects, projects) : ''
  if (!hosts) return <Fact label={t('eventDetails.organizer')} value={organizer} />
  return (
    <Fact
      label={t('eventDetails.hostedBy')}
      value={hosts}
      sub={organizer && <>{t('eventDetails.organizedBy')} {organizer}</>}
    />
  )
}

const EventFacts = ({ event, projects, onShowHost, t }) => (
  <div className="event-detail-facts">
    <Fact
      label={t('eventDetails.when')}
      value={event.date ? getWhenText(event) : null}
      sub={event.duration ? t('eventDetails.durationValue', { minutes: event.duration }) : null}
    />
    <HostFact event={event} projects={projects} onShowHost={onShowHost} t={t} />
    <Fact
      label={t('eventDetails.attendees')}
      value={t('eventDetails.attendeesValue', {
        current: event.attendees?.length || 0,
        total: event.capacity || DEFAULT_CAPACITY
      })}
      sub={event.waitlist?.length ? t('eventDetails.waitlistValue', { count: event.waitlist.length }) : null}
    />
  </div>
)

const RejectionNotice = ({ event, t }) => {
  if (event.status !== 'rejected') return null
  return (
    <div className="event-detail-rejection">
      <span className="event-detail-label">{t('eventDetails.rejectionReason')}</span>
      <p>{event.rejectionReason || t('eventDetails.noReason')}</p>
    </div>
  )
}

const getLinkedVenueText = (event, amenities, t) => {
  if (event.linkedAmenityId) return getAmenityName(amenities, event.linkedAmenityId)
  return event.requestedAmenityId ? t('eventDetails.notLinked') : null
}

const AdminRow = ({ label, value }) => {
  if (isEmpty(value)) return null
  return (
    <div className="event-detail-admin-row">
      <span className="event-detail-label">{label}</span>
      <span className="event-detail-value">{value}</span>
    </div>
  )
}

const EventAdminDetails = ({ event, amenities, t }) => (
  <section className="event-detail-admin">
    <h4 className="event-detail-heading">{t('eventDetails.adminSection')}</h4>
    <AdminRow
      label={t('eventDetails.requestedVenue')}
      value={event.requestedAmenityId ? getAmenityName(amenities, event.requestedAmenityId) : null}
    />
    <AdminRow label={t('eventDetails.venueNote')} value={event.amenityNote || null} />
    <AdminRow label={t('eventDetails.linkedVenue')} value={getLinkedVenueText(event, amenities, t)} />
    <AdminRow
      label={t('eventDetails.revision')}
      value={event.resubmittedFromStatus
        ? t('adminEvents.resubmission', { revision: event.revision || 1, status: event.resubmittedFromStatus })
        : null}
    />
  </section>
)

const EventDetailBody = ({ event, projects, amenities, onShowHost, showAdminDetails, t }) => {
  const status = event.status || 'approved'
  return (
    <div className="event-detail">
      {event.bannerUrl && (
        <img className="event-detail-banner" src={event.bannerUrl} alt="" decoding="async" />
      )}
      {(showAdminDetails || status !== 'approved') && (
        <span className={`status-badge ${status}`}>{t(`status.${status}`)}</span>
      )}
      <EventFacts event={event} projects={projects} onShowHost={onShowHost} t={t} />
      {isWebLink(event.eventLink) && (
        <a href={event.eventLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm event-detail-open-link">
          {t('eventDetails.openLink')} ↗
        </a>
      )}
      <RejectionNotice event={event} t={t} />
      {event.description && (
        <section className="event-detail-description">
          <h4 className="event-detail-heading">{t('eventDetails.description')}</h4>
          <p>{event.description}</p>
        </section>
      )}
      {showAdminDetails && <EventAdminDetails event={event} amenities={amenities} t={t} />}
    </div>
  )
}

const EventDetailModal = ({ event, onClose, projects = [], amenities = [], onShowHost, showAdminDetails = false }) => {
  const { t } = useTranslation()
  return (
    <Modal isOpen={!!event} onClose={onClose} title={event?.title} className="event-detail-modal">
      {event && (
        <EventDetailBody
          event={event}
          projects={projects}
          amenities={amenities}
          onShowHost={onShowHost}
          showAdminDetails={showAdminDetails}
          t={t}
        />
      )}
    </Modal>
  )
}

export default EventDetailModal
