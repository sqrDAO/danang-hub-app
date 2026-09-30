// Pages without a host profile modal (home) omit onShowHost: plain text then.
const OrganizerName = ({ event, onShowHost, className }) => {
  const name = event.organizerDisplayName || event.organizerId
  if (!onShowHost) return name
  return (
    <button type="button" className={className} onClick={() => onShowHost(event.organizerId)}>
      {name}
    </button>
  )
}

export default OrganizerName
