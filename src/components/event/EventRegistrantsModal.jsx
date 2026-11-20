import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../Modal'
import Avatar from '../Avatar'
import { showToast } from '../../utils/toast'
import { resolveRegistrants, filterRegistrants, getRegistrantEmails } from './registrants'
import './EventRegistrantsModal.css'

// Below this many people the whole list fits on screen, so no search box.
const SEARCH_MIN_PEOPLE = 8

const copyEmails = async (rows, t) => {
  const emails = getRegistrantEmails(rows)
  try {
    await navigator.clipboard.writeText(emails.join(', '))
    showToast(t('eventRegistrants.emailsCopied', { count: emails.length }), 'success')
  } catch {
    showToast(t('eventRegistrants.copyFailed'), 'error')
  }
}

const Contact = ({ member }) => (
  <div className="registrant-contact">
    {member.email && <a href={`mailto:${member.email}`} className="registrant-link">{member.email}</a>}
    {member.phone && <a href={`tel:${member.phone}`} className="registrant-link">{member.phone}</a>}
  </div>
)

// A uid whose member doc is gone: still listed, so the rows add up to the count.
const DeletedRow = ({ row, t }) => (
  <li className="registrant-row is-deleted">
    <span className="registrant-position">{row.position}</span>
    <Avatar size="md" />
    <div className="registrant-main">
      <span className="registrant-name">{t('eventRegistrants.deletedAccount')}</span>
      <span className="registrant-uid">{row.uid}</span>
    </div>
  </li>
)

const RegistrantRow = ({ row, onShowMember, t }) => {
  const { member } = row
  if (!member) return <DeletedRow row={row} t={t} />
  const role = [member.jobTitle, member.company].filter(Boolean).join(' · ')
  return (
    <li className="registrant-row">
      <span className="registrant-position">{row.position}</span>
      <Avatar src={member.photoURL} name={member.displayName} size="md" />
      <div className="registrant-main">
        <button
          type="button"
          className="registrant-name"
          onClick={() => onShowMember(member)}
          title={t('common.viewProfile')}
        >
          {member.displayName || t('eventRegistrants.unnamed')}
        </button>
        {role && <span className="registrant-role">{role}</span>}
      </div>
      <Contact member={member} />
    </li>
  )
}

// One titled list (registered or waitlist). `rows` is the full list, `shown`
// what survives the search; the heading count and Copy emails use the full one.
const Section = ({ title, hint, rows, shown, onShowMember, t }) => {
  const hasEmails = getRegistrantEmails(rows).length > 0
  return (
    <section className="registrants-section">
      <div className="registrants-section-head">
        <h4 className="registrants-section-title">
          {title}
          <span className="registrants-count">{rows.length}</span>
        </h4>
        {hasEmails && (
          <button type="button" className="registrants-copy" onClick={() => copyEmails(rows, t)}>
            {t('eventRegistrants.copyEmails')}
          </button>
        )}
      </div>
      {hint && <p className="registrants-hint">{hint}</p>}
      <ol className="registrants-list">
        {shown.map(row => <RegistrantRow key={row.uid} row={row} onShowMember={onShowMember} t={t} />)}
      </ol>
    </section>
  )
}

const EmptyState = ({ title, hint }) => (
  <div className="registrants-empty">
    <p className="registrants-empty-title">{title}</p>
    {hint && <p className="registrants-hint">{hint}</p>}
  </div>
)

const RegistrantLists = ({ event, members, onShowMember, t }) => {
  const [query, setQuery] = useState('')
  const registered = resolveRegistrants(event.attendees, members)
  const waiting = resolveRegistrants(event.waitlist, members)
  const total = registered.length + waiting.length
  if (total === 0) {
    return <EmptyState title={t('eventRegistrants.emptyTitle')} hint={t('eventRegistrants.emptyHint')} />
  }
  const shownRegistered = filterRegistrants(registered, query)
  const shownWaiting = filterRegistrants(waiting, query)
  return (
    <>
      {total >= SEARCH_MIN_PEOPLE && (
        <input
          type="search"
          className="form-field registrants-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('eventRegistrants.searchPlaceholder')}
          aria-label={t('eventRegistrants.searchPlaceholder')}
        />
      )}
      {shownRegistered.length + shownWaiting.length === 0 && (
        <EmptyState title={t('eventRegistrants.noMatch', { query: query.trim() })} />
      )}
      {shownRegistered.length > 0 && (
        <Section
          title={t('eventRegistrants.registered')}
          rows={registered}
          shown={shownRegistered}
          onShowMember={onShowMember}
          t={t}
        />
      )}
      {shownWaiting.length > 0 && (
        <Section
          title={t('eventRegistrants.waitlist')}
          hint={t('eventRegistrants.waitlistHint')}
          rows={waiting}
          shown={shownWaiting}
          onShowMember={onShowMember}
          t={t}
        />
      )}
    </>
  )
}

// Admin-only: who registered for `event` and who is waiting, resolved against
// the already-loaded `members` roster. `onShowMember(member)` opens a profile.
// A failed roster load shows an error: with no members every row would
// otherwise resolve to "Deleted account".
const EventRegistrantsModal = ({ event, members, membersLoading, membersError, onClose, onShowMember }) => {
  const { t } = useTranslation()
  return (
    <Modal isOpen={!!event} onClose={onClose} title={t('eventRegistrants.title')} className="registrants-modal">
      {event && (
        <div className="registrants">
          {membersLoading
            ? <div className="spinner" role="status" aria-label={t('common.loading')}></div>
            : membersError
            ? <EmptyState title={t('eventRegistrants.loadFailed')} hint={t('eventRegistrants.loadFailedHint')} />
            // Keyed by event so the search box starts empty for each event.
            : <RegistrantLists key={event.id} event={event} members={members} onShowMember={onShowMember} t={t} />}
        </div>
      )}
    </Modal>
  )
}

export default EventRegistrantsModal
