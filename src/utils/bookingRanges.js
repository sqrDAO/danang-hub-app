// Shape guard for the getAmenityBookingRanges payload. It lives in utils
// rather than beside its caller in services/functions.js so it can be tested
// without loading the firebase SDK.
//
// A response we cannot read is not an empty calendar. Defaulting a malformed
// payload to [] would paint every slot free — the same fail-open the service's
// throw exists to prevent — so an unreadable shape is an error too, and the
// calendar shows its retry panel instead of an availability claim it cannot
// back up.
export const parseBookingRanges = (payload) => {
  const ranges = payload?.ranges
  if (!Array.isArray(ranges)) {
    throw new Error('Availability response was missing its ranges')
  }
  return ranges.map(range => {
    const startTime = new Date(range?.startTime)
    const endTime = new Date(range?.endTime)
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      throw new Error('Availability response contained an unreadable range')
    }
    return { startTime, endTime, status: range.status }
  })
}
