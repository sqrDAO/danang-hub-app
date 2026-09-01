import {
  addHubDays,
  getHubDayOfWeek,
  makeHubDateAtTime
} from '../utils/timezone.js'
import { LOCAL_DEV_UID, getLocalDevProfile } from '../utils/localDevMode.js'

const OFFICE_DAYS = [1, 2, 3, 4, 5]
const isOfficeDay = (date) => OFFICE_DAYS.includes(getHubDayOfWeek(date))

const snapToOfficeDay = (date, step) => {
  let day = date
  while (!isOfficeDay(day)) {
    day = addHubDays(day, step)
  }
  return day
}

const walkOfficeDays = (start, count) => {
  const step = count < 0 ? -1 : 1
  let day = start
  let left = Math.abs(count)
  while (left > 0) {
    day = addHubDays(day, step)
    if (isOfficeDay(day)) left -= 1
  }
  return day
}

/** Shift by N Mon–Fri hub days. 0 is today if weekday, else the next weekday. */
export const addOfficeDays = (date, count) => {
  if (count >= 0) return walkOfficeDays(snapToOfficeDay(date, 1), count)
  if (isOfficeDay(date)) return walkOfficeDays(date, count)
  return walkOfficeDays(snapToOfficeDay(date, -1), count + 1)
}

const hubDateTime = (daysAhead, hour, minute = 0) =>
  makeHubDateAtTime(addHubDays(new Date(), daysAhead), hour, minute)

const officeDateTime = (officeDaysAhead, hour, minute = 0) =>
  makeHubDateAtTime(addOfficeDays(new Date(), officeDaysAhead), hour, minute)

const eventEndTime = (event) =>
  new Date(event.date.getTime() + (event.duration || 60) * 60 * 1000)

// Event Hall is never a standalone amenity booking. Approval writes one
// linked booking (memberId = organizer, amenityId = requested hall).
const linkedHallBooking = (event, id, status = 'approved') => ({
  id,
  memberId: event.organizerId,
  amenityId: event.requestedAmenityId,
  eventId: event.id,
  startTime: event.date,
  endTime: eventEndTime(event),
  status,
  createdAt: new Date().toISOString()
})

const hallBookingsForApprovedEvents = (events) =>
  events
    .filter((event) => event.status === 'approved' && event.requestedAmenityId)
    .map((event) => {
      const past = event.date.getTime() < Date.now()
      return linkedHallBooking(
        event,
        `local-hall-${event.id}`,
        past ? 'completed' : 'approved'
      )
    })

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
  return [
    { id: profile.uid, ...profile },
    {
      id: 'member-alice',
      uid: 'member-alice',
      displayName: 'Alice Nguyen',
      email: 'alice@dananghub.dev',
      photoURL: '',
      company: 'Solana Labs VN',
      jobTitle: 'Smart Contract Dev',
      membershipType: 'member',
      preferences: {
        emailNotifications: true,
        eventReminders: true,
        pushNotifications: true
      }
    },
    {
      id: 'member-bob',
      uid: 'member-bob',
      displayName: 'Bob Tran',
      email: 'bob@dananghub.dev',
      photoURL: '',
      company: 'Da Nang AI Labs',
      jobTitle: 'AI Engineer',
      membershipType: 'member',
      preferences: {
        emailNotifications: false,
        eventReminders: true,
        pushNotifications: false
      }
    },
    {
      id: 'member-carol',
      uid: 'member-carol',
      displayName: 'Carol Le',
      email: 'carol@dananghub.dev',
      photoURL: '',
      company: 'Kyber Network',
      jobTitle: 'Product Manager',
      membershipType: 'member',
      preferences: {
        emailNotifications: true,
        eventReminders: true,
        pushNotifications: false
      }
    }
  ]
}

export const buildLocalDevProjects = () => [
  {
    id: 'local-proj-hub',
    title: 'Da Nang Hub Portal',
    description: 'Community portal and booking system for Da Nang Blockchain Hub members.',
    category: 'Community',
    status: 'active',
    tags: ['React', 'Firebase', 'Vite'],
    memberIds: [LOCAL_DEV_UID, 'member-alice'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'local-proj-stream',
    title: 'PayStream Protocol',
    description: 'Decentralized escrow and money streaming protocol for Web3 freelancers.',
    category: 'DeFi',
    status: 'active',
    tags: ['Solana', 'Rust', 'Web3'],
    memberIds: ['member-alice', 'member-bob'],
    createdAt: new Date().toISOString()
  }
]

export const buildLocalDevEvents = () => [
  // Upcoming Approved Event hosted by Local Dev (with attendees)
  {
    id: 'local-event-1',
    title: 'Web3 Builders Meetup & Demo Day',
    description: 'Showcase your Web3 decentralized apps, get feedback, and network with local builders in Da Nang.',
    date: hubDateTime(3, 18, 30),
    status: 'approved',
    attendees: [LOCAL_DEV_UID, 'member-alice', 'member-bob'],
    waitlist: [],
    revision: 1,
    everApproved: true,
    organizerId: LOCAL_DEV_UID,
    organizerDisplayName: 'Local Dev',
    organizerPhotoURL: '',
    duration: 90,
    capacity: 30,
    requestedAmenityId: 'local-hall'
  },
  // Upcoming Approved Event hosted by Alice Nguyen (user can register/test host profile modal)
  {
    id: 'local-event-2',
    title: 'AI Agents & Smart Contracts Workshop',
    description: 'Hands-on session on integrating autonomous AI agents with on-chain smart contracts.',
    date: hubDateTime(6, 19, 0),
    status: 'approved',
    attendees: ['member-alice', 'member-carol'],
    waitlist: [],
    revision: 1,
    everApproved: true,
    organizerId: 'member-alice',
    organizerDisplayName: 'Alice Nguyen',
    organizerPhotoURL: '',
    duration: 120,
    capacity: 25,
    requestedAmenityId: 'local-hall'
  },
  // Pending Event submitted by Bob Tran (for testing admin review / approval / rejection)
  {
    id: 'local-event-3',
    title: 'Rust & Solana: Zero to Hero',
    description: 'Introduction to Rust programming and Solana program architecture.',
    date: hubDateTime(8, 18, 0),
    status: 'pending',
    attendees: ['member-bob'],
    waitlist: [],
    revision: 1,
    everApproved: false,
    organizerId: 'member-bob',
    organizerDisplayName: 'Bob Tran',
    organizerPhotoURL: '',
    duration: 60,
    capacity: 20,
    requestedAmenityId: 'local-hall'
  },
  // Past Completed Event (5 days ago) -> completed count test on Admin Dashboard
  {
    id: 'local-event-4',
    title: 'Da Nang Tech Mixer #1',
    description: 'Kickoff community mixer for developers and founders in Da Nang.',
    date: hubDateTime(-5, 18, 0),
    status: 'approved',
    attendees: [LOCAL_DEV_UID, 'member-alice', 'member-bob', 'member-carol'],
    waitlist: [],
    revision: 1,
    everApproved: true,
    organizerId: LOCAL_DEV_UID,
    organizerDisplayName: 'Local Dev',
    organizerPhotoURL: '',
    duration: 120,
    capacity: 40,
    requestedAmenityId: 'local-hall'
  }
]

export const buildLocalDevBookings = () => [
  ...hallBookingsForApprovedEvents(buildLocalDevEvents()),
  // This office day: Approved Meeting Room booking for Local Dev
  {
    id: 'local-booking-1',
    memberId: LOCAL_DEV_UID,
    amenityId: 'local-meeting',
    startTime: officeDateTime(0, 10, 0),
    endTime: officeDateTime(0, 11, 30),
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  // Next office day: Pending Coworking Desk booking for Local Dev
  {
    id: 'local-booking-2',
    memberId: LOCAL_DEV_UID,
    amenityId: 'local-desk',
    startTime: officeDateTime(1, 14, 0),
    endTime: officeDateTime(1, 18, 0),
    status: 'pending',
    createdAt: new Date().toISOString()
  },
  // In 2 office days: Checked-in Meeting Room booking for Local Dev
  {
    id: 'local-booking-3',
    memberId: LOCAL_DEV_UID,
    amenityId: 'local-meeting',
    startTime: officeDateTime(2, 9, 0),
    endTime: officeDateTime(2, 10, 30),
    status: 'checked-in',
    checkInTime: officeDateTime(2, 9, 0),
    createdAt: new Date().toISOString()
  },
  // Next office day: Alice on Meeting Room -> calendar multi-user display
  {
    id: 'local-booking-4',
    memberId: 'member-alice',
    amenityId: 'local-meeting',
    startTime: officeDateTime(1, 10, 0),
    endTime: officeDateTime(1, 12, 0),
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  // In 4 office days: Booking by another member (Bob) on Coworking Desk
  {
    id: 'local-booking-5',
    memberId: 'member-bob',
    amenityId: 'local-desk',
    startTime: officeDateTime(4, 9, 0),
    endTime: officeDateTime(4, 18, 0),
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  // Past completed booking (2 office days ago) -> completed count on Admin Dashboard
  {
    id: 'local-booking-6',
    memberId: LOCAL_DEV_UID,
    amenityId: 'local-desk',
    startTime: officeDateTime(-2, 9, 0),
    endTime: officeDateTime(-2, 17, 0),
    status: 'completed',
    checkInTime: officeDateTime(-2, 9, 0),
    checkOutTime: officeDateTime(-2, 17, 0),
    createdAt: new Date().toISOString()
  },
  // Past cancelled booking (3 office days ago)
  {
    id: 'local-booking-7',
    memberId: LOCAL_DEV_UID,
    amenityId: 'local-meeting',
    startTime: officeDateTime(-3, 14, 0),
    endTime: officeDateTime(-3, 15, 0),
    status: 'cancelled',
    createdAt: new Date().toISOString()
  }
]
