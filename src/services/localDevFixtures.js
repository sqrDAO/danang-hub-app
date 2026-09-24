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

// Fake event banners: inline SVG data URLs so skipauth needs no image files
// or network. 1200x360 roughly matches real uploaded banners.
const fakeBanner = (title, from, to) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="360" viewBox="0 0 1200 360">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>
<pattern id="d" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="#fff" fill-opacity="0.18"/></pattern>
</defs>
<rect width="1200" height="360" fill="url(#g)"/>
<rect width="1200" height="360" fill="url(#d)"/>
<circle cx="1080" cy="60" r="180" fill="#fff" fill-opacity="0.08"/>
<text x="60" y="80" font-family="Outfit, sans-serif" font-size="26" font-weight="600" fill="#fff" fill-opacity="0.8" letter-spacing="4">DA NANG BLOCKCHAIN HUB</text>
<text x="60" y="210" font-family="Outfit, sans-serif" font-size="56" font-weight="800" fill="#fff">${title}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export const buildLocalDevEvents = () => [
  // Upcoming Approved Event hosted by Local Dev (with attendees)
  {
    id: 'local-event-1',
    bannerUrl: fakeBanner('WEB3 BUILDERS DEMO DAY', '#f97316', '#7c2d12'),
    title: 'Web3 Builders Meetup & Demo Day',
    description: [
      'Web3 Builders Meetup & Demo Day is our monthly evening for builders to show what they have been working on and get honest feedback from the community.',
      '',
      'Agenda:',
      '18:30 – Doors open, drinks and networking',
      '19:00 – Welcome + hub updates',
      '19:15 – Demo round: 6 teams, 5 minutes each + 3 minutes Q&A',
      '20:00 – Mentor feedback tables (product, smart contract security, go-to-market)',
      '20:30 – Open networking',
      '',
      'Who should come: founders, developers, designers and anyone curious about what is being built in Da Nang. You do not need to demo to attend.',
      '',
      'Want to demo? Reply in the community group before the day with your project name, one-line pitch and a link. Slots are first come, first served.',
      '',
      'Bring your laptop and a charger. Projector and HDMI/USB-C adapters are provided.'
    ].join('\n'),
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
    requestedAmenityId: 'local-hall',
    hostingProjects: 'Da Nang Blockchain Hub',
    linkedAmenityId: 'local-hall',
    eventLink: 'https://example.com/web3-builders-demo-day'
  },
  // Upcoming Approved Event hosted by Alice Nguyen (user can register/test host profile modal)
  {
    id: 'local-event-2',
    bannerUrl: fakeBanner('AI AGENTS × CONTRACTS', '#6366f1', '#1e1b4b'),
    title: 'AI Agents & Smart Contracts Workshop',
    description: [
      'A hands-on workshop on connecting autonomous AI agents to on-chain smart contracts, from reading chain state to safely signing and sending transactions.',
      '',
      'What we will cover:',
      '1. Agent architecture basics: tools, memory and planning loops',
      '2. Giving an agent read access to chain data through RPC and indexers',
      '3. Letting an agent propose transactions without holding the keys',
      '4. Guardrails: spending limits, allowlists and human approval steps',
      '5. Live build: an agent that monitors a DAO treasury and drafts proposals',
      '',
      'Prerequisites: comfortable with JavaScript or Python and a basic understanding of how wallets and transactions work. Solidity experience helps but is not required.',
      '',
      'Please install Node.js 20+ and a browser wallet before the session. Starter repo and slides will be shared in the event link a day before.',
      '',
      'Seats are limited to keep it hands-on. If you register and cannot come, please unregister so someone on the waitlist can take your spot.'
    ].join('\n'),
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
    requestedAmenityId: 'local-hall',
    hostingProjects: 'SuperteamVN, PayStream Protocol',
    linkedAmenityId: 'local-hall',
    eventLink: 'https://example.com/ai-agents-smart-contracts-workshop'
  },
  // Pending Event submitted by Bob Tran (for testing admin review / approval / rejection)
  {
    id: 'local-event-3',
    bannerUrl: fakeBanner('RUST &amp; SOLANA 101', '#14b8a6', '#134e4a'),
    title: 'Rust & Solana: Zero to Hero',
    description: [
      'Rust & Solana: Zero to Hero is a beginner-friendly evening for developers who want to start writing Solana programs.',
      '',
      'Part 1 – Rust fundamentals (45 min)',
      'Ownership and borrowing, structs and enums, error handling with Result, and the parts of Rust you actually need for on-chain code.',
      '',
      'Part 2 – Solana program model (45 min)',
      'Accounts, program-derived addresses, instructions and transactions, rent, and how Solana differs from EVM chains.',
      '',
      'Part 3 – Build with Anchor (60 min)',
      'We scaffold a counter program, write tests, deploy to devnet and call it from a small web client.',
      '',
      'Bring a laptop with Rust, the Solana CLI and Anchor installed. Setup guide is in the event link; mentors will be around 30 minutes early to help with installs.',
      '',
      'No prior blockchain experience needed. Snacks provided.'
    ].join('\n'),
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
    requestedAmenityId: 'local-hall',
    hostingProjects: 'Solana Vietnam',
    eventLink: 'https://example.com/rust-solana-zero-to-hero'
  },
  // Past Completed Event (5 days ago) -> completed count test on Admin Dashboard
  {
    id: 'local-event-4',
    bannerUrl: fakeBanner('DA NANG TECH MIXER #1', '#ec4899', '#500724'),
    title: 'Da Nang Tech Mixer #1',
    description: [
      'Da Nang Tech Mixer #1 was the kickoff of our community mixer series, bringing together developers, founders, designers and investors living in or passing through Da Nang.',
      '',
      'The format is simple: short intros, a few lightning talks and plenty of time to talk.',
      '',
      'Lightning talks:',
      '- Building a remote team from Da Nang',
      '- Lessons from shipping our first mainnet launch',
      '- What local startups need from the developer community',
      '',
      'Thanks to everyone who came out. Photos and slides are shared in the community group, and the next mixer will be announced on the events page.',
      '',
      'Suggestions for speakers or topics are always welcome, just message the hub team.'
    ].join('\n'),
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
    requestedAmenityId: 'local-hall',
    hostingProjects: 'Da Nang Blockchain Hub',
    linkedAmenityId: 'local-hall'
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
