import Modal from '../Modal'
import { toDatetimeLocalHub } from '../../utils/timezone'
import { getEventVenueId, getEventSpaces, getDefaultEventSpace, getAmenityName } from './eventFields'
import './EventFormModal.css'

export const MAX_EVENT_CAPACITY = 50

const EventGuidelinesAcknowledgement = ({ hasAcceptedGuidelines, setHasAcceptedGuidelines, t }) => (
  <div className="form-group event-guidelines-ack">
    <label className="form-checkbox">
      <input type="checkbox" checked={hasAcceptedGuidelines} onChange={(event) => setHasAcceptedGuidelines(event.target.checked)} />
      <span>{t('memberEvents.modal.guidelinesPrefix')} <a href="https://www.danangblockchainhub.com/event-guidelines.html" target="_blank" rel="noopener noreferrer">{t('memberEvents.modal.guidelinesLink')}</a>.</span>
    </label>
    <small className="form-hint">{t('memberEvents.modal.guidelinesHint')}</small>
  </div>
)

const getEventFormDefaults = (event) => ({
  title: event?.title ?? '',
  description: event?.description ?? '',
  date: event?.date ? toDatetimeLocalHub(event.date) : '',
  capacity: String(event?.capacity ?? MAX_EVENT_CAPACITY),
  hostingProjects: event?.hostingProjects ?? '',
  eventLink: event?.eventLink ?? ''
})

const EventTextFields = ({ defaults, t }) => <>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.titleLabel')}</label>
      <input type="text" name="title" className="form-field" placeholder={t('memberEvents.modal.titlePlaceholder')} defaultValue={defaults.title} required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.descriptionLabel')}</label>
      <textarea name="description" className="form-field" placeholder={t('memberEvents.modal.descriptionPlaceholder')} defaultValue={defaults.description} rows="3" required aria-required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.hostingProjectsLabel')}</label>
      <input type="text" name="hostingProjects" className="form-field" placeholder={t('memberEvents.modal.hostingProjectsPlaceholder')} defaultValue={defaults.hostingProjects} />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.eventLinkLabel')}</label>
      <input type="url" name="eventLink" className="form-field" placeholder={t('memberEvents.modal.eventLinkPlaceholder')} defaultValue={defaults.eventLink} />
    </div>
  </>

const EventBannerField = ({ bannerInputRef, isEdit, t }) => {
  const bannerLabelKey = isEdit
    ? 'memberEvents.modal.bannerUploadReplaceLabel'
    : 'memberEvents.modal.bannerUploadLabel'
  return <div className="form-group">
    <label className="form-label">{t('memberEvents.modal.bannerLabel')}</label>
    <div className="event-banner-upload">
      <input ref={bannerInputRef} type="file" name="banner" id="event-banner-input" className="event-banner-input" accept="image/jpeg,image/jpg,image/png,image/webp" required={!isEdit} aria-required={!isEdit} />
      <span className="event-banner-upload-label">{t(bannerLabelKey)}</span>
    </div>
    <small className="form-hint">{t('memberEvents.modal.bannerHint')}</small>
  </div>
}

const EventScheduleFields = ({
  dateError, dateValue, eventDuration, changeEventDuration, validateEventHallDate,
  linkAmenity, capacity, t
}) => <>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.dateTimeLabel')}</label>
      <input type="datetime-local" name="date" className={`form-field ${dateError ? 'form-field-error' : ''}`} defaultValue={dateValue} onChange={(event) => validateEventHallDate(event.target.value)} required />
      {linkAmenity && <small className="form-hint">{t('memberEvents.modal.availabilityHint')}</small>}
      {dateError && <p className="form-error">{dateError}</p>}
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.durationLabel')}</label>
      <input type="number" name="duration" className="form-field" value={eventDuration} onChange={(event) => changeEventDuration(parseInt(event.target.value, 10) || 60, event.target.form.elements.date.value)} min="15" step="15" required />
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.capacityLabel')}</label>
      <input type="number" name="capacity" className="form-field" defaultValue={capacity} min="1" max={MAX_EVENT_CAPACITY} required />
      <small className="form-hint">{t('memberEvents.modal.capacityHint', { max: MAX_EVENT_CAPACITY })}</small>
    </div>
  </>

const EventDetailsFields = ({
  editingEvent, dateError, eventDuration, changeEventDuration, validateEventHallDate,
  bannerInputRef, linkAmenity, t
}) => {
  const defaults = getEventFormDefaults(editingEvent)
  return <>
    <EventTextFields defaults={defaults} t={t} />
    <EventBannerField bannerInputRef={bannerInputRef} isEdit={Boolean(editingEvent)} t={t} />
    <EventScheduleFields dateError={dateError} dateValue={defaults.date} eventDuration={eventDuration} changeEventDuration={changeEventDuration} validateEventHallDate={validateEventHallDate} linkAmenity={linkAmenity} capacity={defaults.capacity} t={t} />
  </>
}

const EventOrganizerField = ({ editingEvent, members, t }) => (
  <div className="form-group">
    <label className="form-label">{t('adminEvents.modal.organizerLabel')}</label>
    <select name="organizerId" className="form-field" defaultValue={editingEvent?.organizerId || ''} required>
      <option value="">{t('adminEvents.modal.organizerPlaceholder')}</option>
      {members.map(member => <option key={member.id} value={member.id}>{member.displayName || member.email}</option>)}
    </select>
  </div>
)

// The event's current venue stays selectable even if it was since marked
// unavailable or deleted; otherwise the required select would block saving.
const getVenueOptions = (amenities, currentId) => {
  const eventSpaces = getEventSpaces(amenities)
  if (!currentId || eventSpaces.some(amenity => amenity.id === currentId)) return eventSpaces
  return [{ id: currentId, name: getAmenityName(amenities, currentId) }, ...eventSpaces]
}

const EventHallFields = ({ editingEvent, prefillAmenityId, amenities, t }) => {
  const currentVenueId = getEventVenueId(editingEvent)
  const selectedAmenityId = currentVenueId || prefillAmenityId || getDefaultEventSpace(amenities)?.id || ''
  const venueOptions = getVenueOptions(amenities, currentVenueId)

  return <>
    <div className="event-hall-notice"><p><strong>{t('memberEvents.modal.hallRequirementsTitle')}</strong></p><ul><li>{t('memberEvents.modal.parkingFeeRequirement')}</li></ul></div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.preferredAmenityLabel')}</label>
      <select name="linkedAmenityId" className="form-field" defaultValue={selectedAmenityId} required>
        <option value="">{t('memberEvents.modal.preferredAmenityPlaceholder')}</option>
        {venueOptions.map(amenity => <option key={amenity.id} value={amenity.id}>{amenity.name}</option>)}
      </select>
    </div>
    <div className="form-group">
      <label className="form-label">{t('memberEvents.modal.additionalNotesLabel')}</label>
      <input type="text" name="amenityNote" className="form-field" placeholder={t('memberEvents.modal.additionalNotesPlaceholder')} defaultValue={editingEvent?.amenityNote || ''} />
    </div>
  </>
}

const EventHallRequestToggle = ({ linkAmenity, setEventHallRequest, t }) => (
  <div className="form-group">
    <label className="form-checkbox">
      <input
        type="checkbox"
        checked={linkAmenity}
        onChange={(event) => setEventHallRequest(event.target.checked, event.target.form.elements.date.value)}
      />
      <span>{t('memberEvents.modal.requestHallLabel')}</span>
    </label>
  </div>
)

// Admin copy never says "submit for approval": admin events are created approved
// and admin edits keep the status.
const getModalCopyKeys = ({ isEdit, isAdmin, isSubmitting }) => {
  if (isAdmin) {
    return {
      title: isEdit ? 'adminEvents.modal.editTitle' : 'adminEvents.modal.createTitle',
      description: null,
      submit: isSubmitting ? 'common.saving' : isEdit ? 'common.save' : 'common.create'
    }
  }
  return {
    title: isEdit ? 'memberEvents.modal.editTitle' : 'memberEvents.modal.title',
    description: isEdit ? 'memberEvents.modal.editDescription' : 'memberEvents.modal.description',
    submit: isSubmitting ? 'memberEvents.modal.submitting' : isEdit ? 'memberEvents.modal.save' : 'memberEvents.modal.submit'
  }
}

// Shared create/edit form for members and admins. `isAdmin` switches on the
// admin view (organizer picker, admin copy); `requireGuidelines` gates a
// member's new event behind the guidelines acknowledgement.
const EventFormModal = ({
  isModalOpen, editingEvent, requireGuidelines, hasAcceptedGuidelines, setHasAcceptedGuidelines,
  linkAmenity, prefillAmenityId, amenities, isAdmin, members, dateError, eventDuration,
  changeEventDuration, validateEventHallDate, bannerInputRef, isSubmitting,
  setEventHallRequest, resetEventModal, handleSubmit, t
}) => {
  const isEdit = Boolean(editingEvent)
  const needsGuidelines = requireGuidelines && !isEdit
  const copy = getModalCopyKeys({ isEdit, isAdmin, isSubmitting })
  return (
    <Modal
      isOpen={isModalOpen}
      onClose={resetEventModal}
      title={t(copy.title)}
    >
      {copy.description && <p className="modal-description">{t(copy.description)}</p>}
      <form onSubmit={handleSubmit}>
        {needsGuidelines && <EventGuidelinesAcknowledgement hasAcceptedGuidelines={hasAcceptedGuidelines} setHasAcceptedGuidelines={setHasAcceptedGuidelines} t={t} />}
        <fieldset className="event-create-fieldset" disabled={needsGuidelines && !hasAcceptedGuidelines}>
          <EventDetailsFields editingEvent={editingEvent} dateError={dateError} eventDuration={eventDuration} changeEventDuration={changeEventDuration} validateEventHallDate={validateEventHallDate} bannerInputRef={bannerInputRef} linkAmenity={linkAmenity} t={t} />
          {isAdmin && <EventOrganizerField editingEvent={editingEvent} members={members} t={t} />}
          <EventHallRequestToggle linkAmenity={linkAmenity} setEventHallRequest={setEventHallRequest} t={t} />
          {linkAmenity && <EventHallFields editingEvent={editingEvent} prefillAmenityId={prefillAmenityId} amenities={amenities} t={t} />}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting || !!dateError}>{t(copy.submit)}</button>
          </div>
        </fieldset>
        <div className="form-actions form-actions-outside"><button type="button" className="btn btn-secondary" onClick={resetEventModal}>{t('common.close')}</button></div>
      </form>
    </Modal>
  )
}

export default EventFormModal
