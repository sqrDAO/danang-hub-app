import { useState } from 'react'
import { importEventFromUrl } from '../../services/functions'
import { fetchBannerFile } from '../../services/storage'
import { showToast } from '../../utils/toast'
import { getImportedFormValues } from './eventFields'

const IMPORT_ERROR_KEYS = {
  'functions/invalid-argument': 'toast.eventImportUnsupported',
  'functions/not-found': 'toast.eventImportNoData'
}

// The event form is uncontrolled (inputs keep their own values), so an import
// writes straight to the inputs. Duration is the one controlled field: it goes
// through changeEventDuration last, which also re-runs the Event Hall check
// against the date just filled in.
const fillEventForm = (form, values, changeEventDuration) => {
  for (const name of ['title', 'description', 'date', 'eventLink']) {
    form.elements[name].value = values[name]
  }
  changeEventDuration(values.duration ?? form.elements.duration.value, form)
}

// Puts the event's cover into the banner file input, as if it had been picked
// by hand, so it takes the normal upload path on submit. The change event
// lets the banner field show its preview. False when there is no usable cover.
const importBanner = async (form, imageUrl) => {
  if (!imageUrl) return false
  try {
    const transfer = new DataTransfer()
    transfer.items.add(await fetchBannerFile(imageUrl))
    form.elements.banner.files = transfer.files
    form.elements.banner.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  } catch (error) {
    console.error('Event cover import failed:', error)
    return false
  }
}

// Pre-fills the create form from a Luma link. It has no `name`, so the pasted
// link is never part of the submitted event.
const EventImportField = ({ changeEventDuration, t }) => {
  const [url, setUrl] = useState('')
  const [isImporting, setIsImporting] = useState(false)

  const importEvent = async (form) => {
    if (!url.trim() || isImporting) return
    setIsImporting(true)
    try {
      const draft = await importEventFromUrl(url.trim())
      fillEventForm(form, getImportedFormValues(draft), changeEventDuration)
      const hasBanner = await importBanner(form, draft.image)
      if (hasBanner) showToast(t('toast.eventImported'), 'success')
      else showToast(t('toast.eventImportedNoBanner'), 'info', 5000)
    } catch (error) {
      showToast(t(IMPORT_ERROR_KEYS[error?.code] || 'toast.eventImportFailed'), 'error')
    } finally {
      setIsImporting(false)
    }
  }

  // Enter in this input would otherwise submit the whole event form.
  const importOnEnter = (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    importEvent(event.target.form)
  }

  return (
    <div className="form-group event-import">
      <label className="form-label" htmlFor="event-import-url">{t('memberEvents.modal.importLabel')}</label>
      <div className="event-import-row">
        <input id="event-import-url" type="text" inputMode="url" className="form-field" placeholder={t('memberEvents.modal.eventLinkPlaceholder')} value={url} onChange={(event) => setUrl(event.target.value)} onKeyDown={importOnEnter} />
        <button type="button" className="btn btn-secondary" onClick={(event) => importEvent(event.target.form)} disabled={isImporting || !url.trim()}>
          {t(isImporting ? 'memberEvents.modal.importing' : 'memberEvents.modal.importButton')}
        </button>
      </div>
      <small className="form-hint">{t('memberEvents.modal.importHint')}</small>
    </div>
  )
}

export default EventImportField
