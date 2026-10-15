import { useState } from 'react'
import { validateEventSpaceTime } from '../../services/amenities'

// The "uses a Hub space" checkbox, the duration, and the Event Hall hours error,
// shared by the member and admin event forms so both re-check the same way.
export const useEventHallCheck = (t) => {
  const [linkAmenity, setLinkAmenity] = useState(false)
  const [eventDuration, setEventDuration] = useState(60)
  const [dateError, setDateError] = useState(null)

  // `linked`/`durationMinutes` are passed explicitly on change, before the
  // state update lands.
  const validateEventHallDate = (dateValue, durationMinutes = eventDuration, linked = linkAmenity) => {
    const errorKey = linked && dateValue ? validateEventSpaceTime(dateValue, durationMinutes) : null
    setDateError(errorKey ? t(errorKey) : null)
    return !errorKey
  }

  const setEventHallRequest = (linked, dateValue) => {
    setLinkAmenity(linked)
    validateEventHallDate(dateValue, eventDuration, linked)
  }

  const changeEventDuration = (minutes, dateValue) => {
    setEventDuration(minutes)
    validateEventHallDate(dateValue, minutes)
  }

  const resetEventHallCheck = (linked = false, duration = 60) => {
    setLinkAmenity(linked)
    setEventDuration(duration)
    setDateError(null)
  }

  return {
    linkAmenity, eventDuration, dateError,
    validateEventHallDate, setEventHallRequest, changeEventDuration, resetEventHallCheck
  }
}
