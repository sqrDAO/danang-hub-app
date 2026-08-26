import { addHubDays, parseHubDateTime, toDatetimeLocalHub } from '../utils/timezone.js'
import { LOCAL_DEV_UID, getLocalDevProfile } from '../utils/localDevMode.js'

const OFFICE_DAYS = [1, 2, 3, 4, 5]

const hubDateTime = (daysAhead, hour, minute = 0) => {
  const day = addHubDays(new Date(), daysAhead)
  const ymd = toDatetimeLocalHub(day).slice(0, 10)
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return parseHubDateTime(`${ymd}T${hh}:${mm}`)
}

const officeAmenity = (id, fields) => ({
  isAvailable: true,
  startHour: 9,
  endHour: 18,
  availableDays: OFFICE_DAYS,
  slotDuration: 30,
  timezone: 'Asia/Ho_Chi_Minh',
  photos: [],
  ...fields,
  id
})

export const buildLocalDevAmenities = () => [
  officeAmenity('local-desk', {
    name: 'Coworking Space',
    type: 'desk',
    capacity: 8
  }),
  officeAmenity('local-meeting', {
    name: 'Meeting Room',
    type: 'meeting-room',
    capacity: 10
  }),
  officeAmenity('local-hall', {
    name: 'Event Hall',
    type: 'event-space',
    capacity: 80,
    startHour: 9,
    weekdayStartHour: 18,
    endHour: 22,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    slotDuration: 60
  })
]

export const buildLocalDevMembers = () => {
  const profile = getLocalDevProfile()
  return [{ id: profile.uid, ...profile }]
}

export const buildLocalDevProjects = () => []

export const buildLocalDevEvents = () => [
  {
    id: 'local-event',
    title: 'Event',
    description: '',
    date: hubDateTime(10, 18, 0),
    status: 'approved',
    attendees: [],
    waitlist: [],
    revision: 1,
    everApproved: true,
    organizerId: LOCAL_DEV_UID,
    organizerDisplayName: 'Local Dev',
    organizerPhotoURL: '',
    duration: 90,
    capacity: 20,
    requestedAmenityId: 'local-hall'
  }
]

export const buildLocalDevBookings = () => []
