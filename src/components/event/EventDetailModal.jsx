import { useTranslation } from 'react-i18next'
import Modal from '../Modal'
import {
  getVisibleFields,
  getWhenText,
  getHostNames,
  getAmenityName,
  isWebLink,
  isHallUnlinked
} from './eventFields'
import OrganizerName from './OrganizerName'
import './EventDetailModal.css'

const isEmpty = (value) => value === null || value === undefined || value === ''

const Fact = ({ label, value, sub, className = 'event-detail-fact' }) => {
  if (isEmpty(value)) return null
  return (
    <div className={className}>
      <span className="event-detail-label">{label}</span>
      <span className="event-detail-value">{value}</span>
      {sub && <span className="event-detail-sub">{sub}</span>}
    </div>
  )
}

// Hosts are the main line, the organizer a sub line under them. Without hosts
// (or with hosts hidden) the organizer takes the main line.
const HostFact = ({ event, fields, onShowHost, t }) => {
  const organizer = fields.has('organizer') && event.organizerId
    ? <OrganizerName event={event} onShowHost={onShowHost} className="event-detail-link" />
    : null
  const hosts = fields.has('hosts') ? getHostNames(event.hostingProjects) : ''
  if (!hosts) return <Fact label={t('eventDetails.organizer')} value={organizer} />
  return (
    <Fact
      label={t('eventDetails.hostedBy')}
      value={hosts}
      sub={organizer && <>{t('eventDetails.organizedBy')} {organizer}</>}
    />
  )
}

const AttendeesFact = ({ event, t }) => (
  <Fact
    label={t('eventDetails.attendees')}
    value={t('eventDetails.attendeesValue', {
      current: event.attendees?.length || 0,
      total: event.capacity || '∞'
    })}
    sub={event.waitlist?.length ? t('eventDetails.waitlistValue', { count: event.waitlist.length }) : null}
  />
)

const EventFacts = ({ event, fields, onShowHost, t }) => (
  <div className="event-detail-facts">
    {fields.has('date') && (
      <Fact
        label={t('eventDetails.when')}
        value={event.date ? getWhenText(event) : null}
        sub={event.duration ? t('eventDetails.durationValue', { minutes: event.duration }) : null}
      />
    )}
    <HostFact event={event} fields={fields} onShowHost={onShowHost} t={t} />
    {fields.has('attendees') && <AttendeesFact event={event} t={t} />}
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
  return isHallUnlinked(event) ? t('eventDetails.notLinked') : null
}

const AdminRow = (props) => <Fact {...props} className="event-detail-admin-row" />

const VenueRows = ({ event, amenities, t }) => (
  <>
    <AdminRow
      label={t('eventDetails.requestedVenue')}
      value={event.requestedAmenityId ? getAmenityName(amenities, event.requestedAmenityId) : null}
    />
    <AdminRow label={t('eventDetails.venueNote')} value={event.amenityNote || null} />
    <AdminRow label={t('eventDetails.linkedVenue')} value={getLinkedVenueText(event, amenities, t)} />
  </>
)

const RestrictedDetails = ({ event, fields, amenities, t }) => {
  if (!fields.has('venue') && !fields.has('revision')) return null
  return (
    <section className="event-detail-admin">
      <h4 className="event-detail-heading">{t('eventDetails.adminSection')}</h4>
      {fields.has('venue') && <VenueRows event={event} amenities={amenities} t={t} />}
      {fields.has('revision') && (
        <AdminRow
          label={t('eventDetails.revision')}
          value={event.resubmittedFromStatus
            ? t('adminEvents.resubmission', { revision: event.revision || 1, status: event.resubmittedFromStatus })
            : null}
        />
      )}
    </section>
  )
}

const EventDetailBody = ({ event, view, amenities, onShowHost, t }) => {
  const fields = getVisibleFields(view)
  const status = event.status || 'approved'
  return (
    <div className="event-detail">
      {event.bannerUrl && (
        <img className="event-detail-banner" src={event.bannerUrl} alt="" decoding="async" />
      )}
      {fields.has('status') && (
        <span className={`status-badge ${status}`}>{t(`status.${status}`)}</span>
      )}
      <EventFacts event={event} fields={fields} onShowHost={onShowHost} t={t} />
      {fields.has('eventLink') && isWebLink(event.eventLink) && (
        <a href={event.eventLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm event-detail-open-link">
          {t('eventDetails.openLink')} ↗
        </a>
      )}
      {fields.has('rejection') && <RejectionNotice event={event} t={t} />}
      {fields.has('description') && event.description && (
        <section className="event-detail-description">
          <h4 className="event-detail-heading">{t('eventDetails.description')}</h4>
          <p>{event.description}</p>
        </section>
      )}
      <RestrictedDetails event={event} fields={fields} amenities={amenities} t={t} />
    </div>
  )
}

// `view` names an entry in EVENT_VIEWS (eventFields.js).
const EventDetailModal = ({ event, view, onClose, amenities = [], onShowHost }) => {
  const { t } = useTranslation()
  return (
    <Modal isOpen={!!event} onClose={onClose} title={event && (event.title || t('eventCard.untitled'))} className="event-detail-modal">
      {event && (
        <EventDetailBody
          event={event}
          view={view}
          amenities={amenities}
          onShowHost={onShowHost}
          t={t}
        />
      )}
    </Modal>
  )
}

export default EventDetailModal
