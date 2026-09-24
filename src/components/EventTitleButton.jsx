// The accessible way to open an event's detail modal from its card.
const EventTitleButton = ({ title, onOpen }) => (
  <button type="button" className="event-title-button" onClick={onOpen}>
    {title}
  </button>
)

export default EventTitleButton
