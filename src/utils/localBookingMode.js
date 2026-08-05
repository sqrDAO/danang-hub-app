export const isLocalBookingDev = import.meta.env.DEV && import.meta.env.MODE === 'booking'

export const LOCAL_PREVIEW_AMENITIES = [
  {
    id: 'local-preview-desk',
    name: 'Booking Preview Desk',
    type: 'desk',
    description: 'Local-only amenity for reviewing the booking range picker.',
    capacity: 1,
    isAvailable: true,
    startHour: 9,
    endHour: 18,
    availableDays: [1, 2, 3, 4, 5],
    slotDuration: 30,
    photos: [],
  },
]
