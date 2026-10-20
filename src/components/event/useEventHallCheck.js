import { useState } from 'react'
import { validateEventSpaceTime } from '../../utils/eventSpaceHours'

const toMinutes = (value) => parseInt(value, 10) || 60

// The "uses a Hub space" checkbox, the duration, and the Event Hall hours error,
// shared by the member and admin event forms so both re-check the same way.
export const useEventHallCheck = (t, amenities) => {
  const [linkAmenity, setLinkAmenity] = useState(false)
  // The raw input value, so the field can be emptied while typing.
  const [eventDuration, setEventDuration] = useState(60)
  const [dateError, setDateError] = useState(null)

  // Reads the date and selected venue from the form. `linked`/`duration` are
  // passed explicitly on change, before the state update lands.
  const checkEventHall = (form, { linked = linkAmenity, duration = eventDuration } = {}) => {
    const { date, amenityId } = form.elements
    const amenity = amenities.find(candidate => candidate.id === amenityId?.value)
    const error = linked ? validateEventSpaceTime(date.value, toMinutes(duration), amenity) : null
    setDateError(error ? t(error.key, error.params) : null)
    return !error
  }

  const setEventHallRequest = (linked, form) => {
    setLinkAmenity(linked)
    checkEventHall(form, { linked })
  }

  const changeEventDuration = (value, form) => {
    setEventDuration(value)
    checkEventHall(form, { duration: value })
  }

  const resetEventHallCheck = (linked = false, duration = 60) => {
    setLinkAmenity(linked)
    setEventDuration(duration)
    setDateError(null)
  }

  return {
    linkAmenity, eventDuration, dateError,
    checkEventHall, setEventHallRequest, changeEventDuration, resetEventHallCheck
  }
}
