// Event spaces are booked through Events, never the regular booking modal.
export const isEventSpaceAmenity = (amenity) => amenity?.type === 'event-space'

export const eventCreatePath = (amenity) =>
  `/member/events?action=create&amenityId=${encodeURIComponent(amenity.id)}`

// The My Bookings grid lists only amenities booked there.
export const bookingGridAmenities = (amenities) =>
  amenities.filter(amenity => !isEventSpaceAmenity(amenity))

export const resolveBookingDeepLink = (amenities, amenityId) => {
  const amenity = amenities.find(candidate => candidate.id === amenityId)

  if (!amenity || amenity.isAvailable === false) return null

  if (isEventSpaceAmenity(amenity)) {
    return { redirectTo: eventCreatePath(amenity) }
  }

  return { amenity }
}
