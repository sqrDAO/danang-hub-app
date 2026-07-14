# Da Nang Blockchain Hub — Member Portal

A full-stack, Firebase-powered React application for managing members, amenities, bookings, and events at [Da Nang Blockchain Hub](https://www.danangblockchainhub.com). Installable as a PWA on mobile.

Live app: **https://app.danangblockchainhub.com**

---

## Features

### Authentication & User Management
- **Firebase Authentication** — Google OAuth and Email/Password sign-in
- **EVM Wallet Login** — auto-discovers all EIP-6963 compatible wallets (MetaMask, Rabby, Coinbase Wallet, etc.)
- **Solana Wallet Login** — any Wallet Standard compatible wallet (Phantom, Solflare, Backpack, etc.)
- **Wallet Auth Flow** — sign a server-generated nonce → verify signature via Cloud Function → Firebase custom token
- **Role-Based Access** — admin and member roles with protected routes
- **User Profiles** — avatar upload, bio, LinkedIn, website, connected wallet address

### Amenity Booking System
- **Visual Calendar** — day and week view for booking selection
- **Fixed Desk Plans** — members subscribe to recurring fixed-desk allocations; admins assign desks
- **Conflict Detection** — real-time server-side conflict checking via Cloud Functions
- **Recurring Bookings** — weekly recurring reservations
- **Check-in / Check-out** — manual and automatic checkout (hourly Cloud Function)
- **Bulk Approval** — admins can approve all pending bookings in one click
- **Booking Status Workflow** — `pending → approved → checked-in → completed`
- **Event-Space Restrictions** — event space requires bookings outside office hours (weekdays: after 6 PM; weekends: 8 AM – 10 PM, must end by 10 PM)

### Event Management
- **Event Creation** — title, description, date, capacity, hosting project, banner image
- **Approval Workflow** — admin review with rejection reasons surfaced to the organizer
- **Waitlist System** — automatic waitlist + promotion when spots open
- **Organizer Profile Modal** — view host details inline on any event card
- **Event Reminders** — scheduled email reminders sent 24 hours before events

### Admin Dashboard
- **Overview Stats** — members, active bookings, upcoming events, available amenities
- **Member Management** — search by name or company, edit profiles and membership types
- **Amenity Management** — create/edit amenities, configure availability hours, days, slot duration, and photo gallery
- **Booking Management** — filter by status, bulk-approve pending bookings, assign fixed desks
- **Event Management** — approve/reject events with reason, manage attendees and waitlists

### Member Portal
- **Personal Dashboard** — upcoming bookings and events at a glance
- **Booking Interface** — calendar picker with live conflict checking
- **Fixed Desk View** — see active fixed-desk subscriptions alongside ad-hoc bookings
- **Event Registration** — browse, register, and manage waitlist position
- **Profile Management** — edit personal info, upload avatar, display wallet address

### Unified Calendar View
- Combined bookings + events in one calendar
- Filter by bookings, events, or amenity type
- Color-coded items distinguishing your bookings from others
- Month view with day-by-day breakdown

### Public Homepage
- Amenity and event showcase without login
- Hosting project display on event cards
- Seamless sign-up call-to-action for new members

### Notifications & Email
- **In-App Notification Center** — unread inbox for new event review requests plus booking review and approval work
- **Browser Push Alerts** — opt-in booking review / approval alerts through Firebase Cloud Messaging
- **Event Status Email** — Nodemailer/Lark SMTP sends email on event approval or rejection
- **Booking Confirmation Trigger** — records booking confirmation details; email delivery remains pending
- **SMTP password** stored in Firebase Secret Manager (not in code)

### Internationalization
- **English and Vietnamese** UI via i18next
- Language auto-detected from browser, persisted to localStorage
- Toggle available in the header

### Mobile / PWA
- **Installable PWA** — `vite-plugin-pwa` with Workbox service worker
- **Bottom Navigation Bar** — persistent tab bar for authenticated users on mobile
- **Offline-capable** — Google Fonts, Firebase Storage, and app shell cached via Workbox
- Responsive design throughout; glassmorphism aesthetic with dark/light theme

### Other
- **Telegram Bot Widget** — floating contact widget for quick support
- **Amenity Photo Lightbox** — full-screen photo viewer for amenity galleries
- **Dark / Light Theme** — system-aware with manual toggle, persisted to localStorage
- **Skeleton Loaders** — perceived performance on all data-fetching views

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Server State | TanStack React Query v5 |
| Auth State | React Context (AuthContext) |
| Theme State | React Context (ThemeContext) |
| i18n | i18next + react-i18next |
| PWA | vite-plugin-pwa + Workbox |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions Node.js 20) |
| Email | Nodemailer via Lark SMTP; password in Firebase Secret Manager |
| Wallet Auth | ethers v6 (EVM), tweetnacl + bs58 (Solana) |
| Styling | Custom CSS with CSS variables, glassmorphism |
| Date utils | date-fns |
| Build | Vite |

---

## Quick Start

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Set up environment
cp .env.example .env
# Populate .env with your Firebase config (see Firebase Setup below)

# Start dev server (http://localhost:3000)
npm run dev
```

---

## Firebase Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) → **Add project**
2. Disable Google Analytics (optional) → **Create project**

### 2. Register Web App

1. Click the **Web icon** (`</>`) → App nickname: `Da Nang Hub Web App`
2. Copy the Firebase configuration object

### 3. Environment Variables

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_VAPID_KEY=BLPUSH_PUBLIC_KEY_FROM_FIREBASE
```

### 4. Enable Firebase Services

**Authentication** — Enable **Google** and **Email/Password** providers. Wallet sign-in uses Custom Tokens (no extra provider needed).

**Firestore Database** — Create database in test mode; `asia-southeast1` recommended.

**Cloud Functions** — Requires Blaze (pay-as-you-go) billing plan.

**Storage** — Enable for avatar and amenity photo uploads.

### 5. Deploy Firebase Resources

```bash
# Deploy Firestore rules, Storage rules, and Cloud Functions
firebase deploy

# Or individually:
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

### 6. Configure Email (Nodemailer)

The SMTP password is stored in Firebase Secret Manager:

```bash
firebase functions:secrets:set EMAIL_PASS
```

Then set the non-secret email config in `functions/.env.<project-id>`:

```env
EMAIL_SMTP_HOST=smtp.larksuite.com
EMAIL_SMTP_PORT=465
EMAIL_SMTP_SECURE=true
EMAIL_USER=your-email@domain.com
EMAIL_FROM_NAME=Da Nang Blockchain Hub
APP_URL=https://app.danangblockchainhub.com
```

### 7. Configure Browser Push

In **Firebase Console → Project settings → Cloud Messaging → Web Push certificates**, generate or copy the web push public key and place it in `VITE_FIREBASE_VAPID_KEY`.

The app registers a custom service worker at `public/sw.js` to handle background FCM messages and keep the Workbox caching rules used by the PWA.

### 8. Grant Admin Access

In **Firestore → Data**, find the user's document in the `members` collection and set `membershipType` to `"admin"`.

---

## Cloud Functions

| Function | Type | Description |
|----------|------|-------------|
| `checkBookingConflicts` | Callable | Server-side validation to prevent double-bookings |
| `checkSlotAvailability` | Callable | Public slot availability check |
| `generateWalletNonce` | Callable | Generates a 32-byte hex nonce for wallet sign-in (5-min expiry) |
| `verifyWalletSignature` | Callable | Verifies EVM or Solana signature → returns Firebase custom token |
| `autoCheckoutExpiredBookings` | Scheduled (hourly) | Auto-completes bookings past their end time or booking date |
| `sendBookingConfirmation` | Firestore trigger (onCreate) | Logs booking confirmation details for future email delivery |
| `autoApproveDeskBooking` | Firestore trigger (onCreate) | Auto-approves available desk bookings or notifies admins of manual review work; booking review push follows the same path for opted-in admins |
| `notifyBookingApproval` | Firestore trigger (onUpdate) | Writes a member in-app notification when a booking is approved and sends booking approval push for opted-in members |
| `notifyEventPendingReview` | Firestore trigger (onCreate) | Writes admin in-app notifications for pending event requests |
| `notifyEventStatusChange` | Firestore trigger (onUpdate) | Writes organizer in-app notifications and sends email when an event is approved or rejected |
| `cleanupPushNotificationMarkers` | Scheduled (daily) | Deletes expired browser push dedupe markers |
| `updateEventCapacity` | Firestore trigger (onUpdate) | Monitors event capacity |
| `autoPromoteWaitlist` | Firestore trigger (onUpdate) | Promotes members from waitlist when spots open |
| `cleanupOldBookings` | Scheduled (daily) | Flags old completed bookings (30+ days) for cleanup |

**IAM note for wallet sign-in** — `createCustomToken` requires the `serviceAccountTokenCreator` role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator" \
  --condition=None
```

---

## Project Structure

```
src/
├── components/
│   ├── AmenityPhotoLightbox.jsx  # Full-screen amenity photo viewer
│   ├── AuthPrompt.jsx            # Login prompt modal
│   ├── Avatar.jsx                # User avatar
│   ├── BookingCalendar.jsx       # Day/week calendar for booking selection
│   ├── BottomNav.jsx             # PWA mobile bottom tab bar
│   ├── Footer.jsx
│   ├── Header.jsx                # Top nav with i18n toggle and theme switch
│   ├── Layout.jsx
│   ├── LoadingSkeleton.jsx
│   ├── Modal.jsx
│   ├── ProtectedRoute.jsx
│   ├── Toast.jsx
│   └── UnifiedCalendar.jsx       # Combined bookings + events calendar
├── pages/
│   ├── admin/
│   │   ├── Dashboard.jsx         # Stats overview
│   │   ├── Members.jsx           # Member list with search
│   │   ├── Amenities.jsx         # Amenity CRUD + photo gallery
│   │   ├── Bookings.jsx          # Booking management + bulk approval
│   │   └── Events.jsx            # Event approval + rejection with reason
│   ├── member/
│   │   ├── Dashboard.jsx
│   │   ├── Bookings.jsx          # Calendar booking + fixed desk view
│   │   ├── Events.jsx            # Event registration + waitlist
│   │   └── Profile.jsx
│   ├── auth/
│   │   └── Login.jsx             # Sign-in, sign-up, password reset, wallet login
│   ├── Home.jsx                  # Public homepage
│   ├── Amenities.jsx             # Public amenities page
│   └── Events.jsx                # Public events page
├── services/
│   ├── firebase.js               # Firebase initialization
│   ├── firebaseConfig.js         # Shared Firebase config + VAPID key
│   ├── amenities.js
│   ├── bookings.js               # CRUD + conflict checking
│   ├── events.js                 # CRUD + attendee/waitlist management
│   ├── members.js
│   ├── pushNotifications.js      # Browser push token opt-in/out helpers
│   ├── notifications.js
│   ├── projects.js
│   ├── storage.js                # Firebase Storage (avatars, amenity photos)
│   ├── functions.js              # Cloud Function client wrappers
│   └── walletAuth.js             # EIP-6963 EVM + Solana Wallet Standard
├── contexts/
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── i18n/
│   └── index.js                  # i18next setup (EN/VI, browser detection)
├── locales/
│   ├── en.json
│   └── vi.json
├── utils/
│   └── timezone.js               # Asia/Ho_Chi_Minh helpers
├── styles/
│   └── globals.css               # CSS custom properties, glassmorphism base
├── App.jsx
└── main.jsx

functions/
└── index.js                      # All Cloud Function definitions
```

---

## Firestore Collections

| Collection | Description |
|------------|-------------|
| `members` | Profiles, membership type (admin/member), wallet address |
| `amenities` | Resources with custom availability (hours, days, slot duration) |
| `bookings` | Booking records with status workflow and fixed-desk support |
| `events` | Events with approval status, attendees, waitlist, rejection reason |
| `push_tokens` | Private browser push tokens keyed by member uid; invalid tokens are pruned after unrecoverable FCM failures |
| `push_notifications` | Internal dedupe markers for browser push alerts; expired markers are deleted by schedule and carry `expiresAt` for optional Firestore TTL |
| `nonces` | Short-lived nonces for wallet auth (keyed by address, deleted after use) |
| `projects` | Hosting project info linked to events |

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint (max-warnings 0) |
| `npm run preview` | Preview production build |
| `firebase deploy` | Deploy Firestore rules, Storage rules, Functions |
| `firebase deploy --only functions` | Deploy Cloud Functions only |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |
| `firebase functions:log` | View real-time function logs |
| `firebase emulators:start` | Start local emulators |

---

## Troubleshooting

**"auth/unauthorized-domain"** — Add your domain in Firebase Console → Authentication → Settings → Authorized domains.

**Wallet sign-in 500 error** — Add the `serviceAccountTokenCreator` IAM role (see Cloud Functions section above).

**No wallets detected on EVM click** — Ensure a browser extension wallet is installed and active. EIP-6963 requires the extension to be enabled in the current browser profile.

**"Missing or insufficient permissions"** — Deploy Firestore rules: `firebase deploy --only firestore:rules` and verify the user's `membershipType` field.

**Email not sending** — Confirm `EMAIL_PASS` is set via `firebase functions:secrets:set EMAIL_PASS` and the non-secret config is in `functions/.env.<project-id>`.

---

## License

MIT
