export const resolveBookingDeepLink = (amenities, amenityId) => {
  const amenity = amenities.find(candidate => candidate.id === amenityId)

  if (!amenity || amenity.isAvailable === false) return null

  if (amenity.type === 'event-space') {
    return {
      redirectTo: `/member/events?action=create&amenityId=${encodeURIComponent(amenity.id)}`,
    }
  }

  return { amenity }
}
