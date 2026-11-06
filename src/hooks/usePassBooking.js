import { useState } from 'react'
import { findPassBooking } from '../utils/bookingPass'

// The open pass, looked up by id on every render so a refetch or hub midnight
// closes it. The id is forgotten once it stops matching: otherwise a booking
// moved back to pending and re-approved would reopen the pass with no tap.
const usePassBooking = (bookings, now) => {
  const [passBookingId, setPassBookingId] = useState(null)
  const passBooking = findPassBooking(bookings, passBookingId, now)
  if (passBookingId && !passBooking) setPassBookingId(null)
  return [passBooking, setPassBookingId]
}

export default usePassBooking
