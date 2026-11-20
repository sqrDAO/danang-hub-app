import { Trans } from 'react-i18next'

// "3 / 50" with the attendee count wrapped in the message's <count> tag. Pages
// that can show the registrant list (admin) pass onShowRegistrants and the
// count becomes a link; everywhere else it is plain text.
const AttendeeCount = ({ event, i18nKey, onShowRegistrants, className }) => {
  const count = onShowRegistrants
    ? <button type="button" className={className} onClick={() => onShowRegistrants(event)} />
    : <span />
  return (
    <Trans
      i18nKey={i18nKey}
      values={{ current: event.attendees?.length || 0, total: event.capacity || '∞' }}
      components={{ count }}
    />
  )
}

export default AttendeeCount
