# Da Nang Blockchain Hub Management App

A full-stack Firebase-powered React application for managing members, amenities, bookings, and events at Da Nang Blockchain Hub.

## Features

### 🔐 Authentication & User Management
- **Firebase Authentication**: Google OAuth login and social authentication
- **Role-Based Access**: Admin and member roles with protected routes
- **User Profiles**: Member profile management with avatar support
- **Member Directory**: View and manage all hub members (admin)

### 📅 Amenity Booking System
- **Visual Calendar Interface**: Day and week view calendar for booking selection
- **Flexible Time Slots**: 30-minute slot duration (configurable per amenity)
- **Conflict Detection**: Real-time booking conflict checking via Cloud Functions
- **Recurring Bookings**: Support for weekly recurring reservations
- **Check-in/Check-out**: Manual and automatic checkout system
- **Custom Availability**: Per-amenity availability settings (hours, days, slot duration)
- **Booking Status**: Pending, approved, checked-in, completed status workflow
- **Booking History**: View past and upcoming bookings

### 🎉 Event Management
- **Event Creation**: Create events with details, capacity, and hosting projects
- **Approval Workflow**: Admin approval system for event submissions
- **Waitlist System**: Automatic waitlist management when events reach capacity
- **Auto-Promotion**: Automatic promotion from waitlist when spots open
- **Event Registration**: Members can register for upcoming events
- **Capacity Management**: Real-time tracking of event attendance
- **Event History**: View past events and attendance records

### 🤖 AI-Powered Features
- **AI Chatbot**: Gemini AI-powered assistant for booking help and general questions
- **Conversational Interface**: Context-aware chatbot with conversation history

### 📊 Admin Dashboard
- **Overview Statistics**: Total members, active bookings, upcoming events, available amenities
- **Member Management**: View, edit, and manage member profiles and membership types
- **Amenity Management**: Create, edit, and configure amenities with custom availability
- **Booking Management**: View all bookings, approve/reject, and manage check-ins
- **Event Management**: Create, approve, and manage events with capacity control

### 👤 Member Portal
- **Personal Dashboard**: Overview of upcoming bookings and events
- **Booking Interface**: Easy-to-use calendar for booking amenities
- **Event Registration**: Browse and register for upcoming events
- **Profile Management**: Edit personal information and view membership details
- **Booking History**: View all past and current bookings

### 📆 Unified Calendar View
- **Combined View**: See both bookings and events in a single calendar
- **Filter Options**: Filter by bookings, events, or amenity type
- **Visual Indicators**: Color-coded items showing your bookings vs. others
- **Month View**: Full month calendar with day-by-day breakdown

### 🏠 Public Homepage
- **Amenity Preview**: Browse available amenities without logging in
- **Event Showcase**: View upcoming and past events
- **Project Integration**: Display hosting projects for events
- **Call-to-Action**: Seamless sign-up flow for new members

### ⚙️ Cloud Functions & Automation
- **Conflict Checking**: Server-side validation to prevent double-bookings
- **Auto Checkout**: Automatic checkout of expired bookings (hourly)
- **Booking Confirmations**: Automated notifications on booking creation
- **Event Reminders**: Scheduled reminders for upcoming events (hourly)
- **Waitlist Promotion**: Automatic promotion from waitlist when capacity opens
- **Data Cleanup**: Daily cleanup of old completed bookings

### 🎨 User Experience
- **Responsive Design**: Mobile-friendly interface with modern UI
- **Dark/Light Mode**: System-aware theme switching with manual toggle
- **Loading States**: Skeleton loaders for better perceived performance
- **Toast Notifications**: User-friendly feedback for actions
- **Modal Dialogs**: Smooth booking and event registration flows
- **Error Handling**: Graceful error handling with user-friendly messages

## Tech Stack

- **Frontend Framework**: React 18 with Vite
- **Routing**: React Router v6 with protected routes
- **State Management**: 
  - React Context API for authentication and theme management
  - TanStack React Query for server state and data fetching
- **Backend Services**: 
  - Firebase Authentication (Google OAuth)
  - Cloud Firestore (NoSQL database)
  - Cloud Functions (Node.js serverless functions)
  - Firebase Storage (for file uploads)
- **AI Integration**: Google Gemini API (gemini-2.5-flash model)
- **Markdown Rendering**: react-markdown for AI chatbot responses
- **Styling**: Custom CSS with CSS variables, glassmorphism design, theme-aware components
- **Date Handling**: date-fns for date manipulation
- **Build Tool**: Vite for fast development and optimized production builds

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 3. Start Development

```bash
npm run dev
```

Open http://localhost:3000

---

## Firebase Setup

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → Enter project name: `danang-hub-app`
3. Disable Google Analytics (optional) → Click **"Create project"**

### Step 2: Register Web App

1. In Firebase dashboard, click the **Web icon** (`</>`)
2. App nickname: `Da Nang Hub Web App`
3. **Do NOT** check "Firebase Hosting"
4. Click **"Register app"**
5. Copy the Firebase configuration object

### Step 3: Environment Setup

```bash
cp .env.example .env
```

Add your Firebase config to `.env`:
```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_GEMINI_API_KEY=your-gemini-api-key  # Optional, for AI features
```

### Step 4: Enable Firebase Services

#### Authentication
1. Go to **Build** → **Authentication** → Click **"Get started"**
2. Go to **Sign-in method** tab → Enable **Google** provider
3. Set project support email → Click **"Save"**

#### Firestore Database
1. Go to **Build** → **Firestore Database** → Click **"Create database"**
2. Choose **"Start in test mode"**
3. Select location (asia-southeast1 recommended)
4. Click **"Enable"**

#### Cloud Functions
1. Go to **Build** → **Functions** → Click **"Get started"**
2. **Enable billing** (Blaze plan required)

### Step 5: Deploy Firebase Resources

```bash
# Initialize Firebase (if first time)
firebase init
# Select: Firestore, Functions
# Use existing project

# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Cloud Functions
firebase deploy --only functions
```

### Step 6: Grant Admin Access

1. Go to **Firestore Database** → **Data** tab
2. Find `members` collection → Find user document
3. Set `membershipType` field to `"admin"`

---

## Cloud Functions

### Deployed Functions

| Function | Type | Description |
|----------|------|-------------|
| `checkBookingConflicts` | Callable | Server-side validation to prevent double-booking conflicts |
| `checkSlotAvailability` | Callable | Public slot availability check for chatbot and unauthenticated queries |
| `autoCheckoutExpiredBookings` | Scheduled (hourly) | Automatically checks out bookings that have passed their end time |
| `sendBookingConfirmation` | Firestore Trigger (onCreate) | Sends confirmation notification when a booking is created |
| `updateEventCapacity` | Firestore Trigger (onUpdate) | Monitors event capacity and logs when events are full |
| `sendEventReminders` | Scheduled (hourly) | Sends reminders for events happening in the next 24 hours |
| `autoPromoteWaitlist` | Firestore Trigger (onUpdate) | Automatically promotes members from waitlist when spots become available |
| `cleanupOldBookings` | Scheduled (daily) | Identifies and logs old completed bookings for cleanup (30+ days old) |

### Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:checkBookingConflicts

# Deploy without linting (if lint errors)
firebase deploy --only functions --force
```

### View Logs

```bash
# View all logs
firebase functions:log

# View specific function logs
firebase functions:log --only checkBookingConflicts

# Follow logs in real-time
firebase functions:log --follow
```

### Test Locally with Emulators

```bash
# Install emulators
firebase init emulators
# Select: Functions, Firestore

# Start emulators
firebase emulators:start
```

### Call Functions from Frontend

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const checkConflicts = httpsCallable(functions, 'checkBookingConflicts');

const result = await checkConflicts({
  amenityId: 'amenity-id',
  startTime: '2024-01-20T10:00:00Z',
  endTime: '2024-01-20T12:00:00Z'
});

console.log(result.data); // { hasConflicts: boolean, conflicts: [] }
```

### Delete Functions

```bash
# Delete specific function
firebase functions:delete checkBookingConflicts

# Delete all functions
firebase functions:delete --all
```

---

## Project Structure

```
src/
├── components/              # Shared UI components
│   ├── AuthPrompt.jsx      # Authentication prompt modal
│   ├── Avatar.jsx          # User avatar component
│   ├── BookingCalendar.jsx # Visual calendar for booking selection (day/week view)
│   ├── Chatbot.jsx         # AI chatbot interface
│   ├── Footer.jsx          # Site footer
│   ├── Header.jsx          # Navigation header
│   ├── Layout.jsx          # Main layout wrapper
│   ├── LoadingSkeleton.jsx # Loading state components
│   ├── Modal.jsx           # Reusable modal component
│   ├── ProtectedRoute.jsx  # Route protection wrapper
│   ├── Toast.jsx           # Toast notification system
│   └── UnifiedCalendar.jsx # Combined bookings/events calendar view
├── pages/
│   ├── admin/              # Admin dashboard pages
│   │   ├── Dashboard.jsx   # Admin overview with statistics
│   │   ├── Members.jsx     # Member management
│   │   ├── Amenities.jsx   # Amenity management
│   │   ├── Bookings.jsx    # Booking management
│   │   └── Events.jsx     # Event management
│   ├── member/             # Member portal pages
│   │   ├── Dashboard.jsx  # Member overview
│   │   ├── Bookings.jsx    # Booking interface with calendar
│   │   ├── Events.jsx     # Event browsing and registration
│   │   └── Profile.jsx    # Profile management
│   ├── auth/               # Authentication pages
│   │   └── Login.jsx       # Login/signup page
│   ├── Home.jsx            # Public homepage
│   ├── Amenities.jsx       # Public amenities page
│   └── Events.jsx          # Public events page
├── services/               # Firebase service layers
│   ├── amenities.js        # Amenity CRUD operations
│   ├── bookings.js         # Booking CRUD and conflict checking
│   ├── events.js           # Event CRUD operations
│   ├── firebase.js         # Firebase initialization
│   ├── functions.js        # Cloud Functions client calls
│   ├── gemini.js           # Gemini AI integration
│   ├── members.js          # Member management
│   ├── projects.js         # Project management
│   └── storage.js          # File storage operations
├── contexts/               # React contexts
│   └── AuthContext.jsx     # Authentication state management
├── styles/                 # Global styles
│   └── globals.css         # Global CSS variables and styles
├── App.jsx                 # Main app component with routing
└── main.jsx               # Application entry point

functions/
└── index.js                # Cloud Functions definitions
```

## Firebase Collections

| Collection | Description |
|------------|-------------|
| `members` | User profiles, membership types (admin/member), and personal information |
| `amenities` | Available resources (desks, meeting rooms, podcast rooms) with custom availability settings |
| `bookings` | Booking records with status (pending/approved/checked-in/completed), time slots, and member associations |
| `events` | Events with approval status, capacity, attendees, waitlist, and hosting projects |
| `projects` | Project information for event hosting associations |

## Amenity Availability

Each amenity can have custom availability settings configured by admins. Default settings (if not customized):
- **Hours**: 8:00 AM - 6:00 PM (configurable start/end hours)
- **Days**: Monday to Friday (configurable available days of week)
- **Slot Duration**: 30 minutes (configurable per amenity)

Admins can customize these settings per amenity in the `/admin/amenities` page. The booking calendar automatically adapts to each amenity's availability settings.

---

## Troubleshooting

### Authentication Issues

**"Firebase: Error (auth/unauthorized-domain)"**
- Go to **Authentication** → **Settings** → **Authorized domains**
- Add your domain (e.g., `localhost`)

### Firestore Issues

**"Missing or insufficient permissions"**
- Deploy Firestore rules: `firebase deploy --only firestore:rules`
- Verify user has correct `membershipType`

### Functions Issues

**"Functions require billing"**
- Enable billing in Firebase Console (Blaze plan required)

**"Permission denied"**
```bash
firebase login
firebase use your-project-id
```

**"Function not found"**
- Deploy functions: `firebase deploy --only functions`
- Verify function name: `firebase functions:list`

**Functions not triggering**
- Check function logs: `firebase functions:log`
- Verify Node.js version is 20
- Ensure Firestore triggers are correct

### Environment Issues

**Variables not loading**
- Ensure `.env` is in root directory
- Restart dev server after changes
- Variables must start with `VITE_`

---

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `firebase deploy` | Deploy all Firebase resources |
| `firebase deploy --only functions` | Deploy Cloud Functions |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |
| `firebase functions:log` | View function logs |
| `firebase emulators:start` | Start local emulators |

---

## Optional: Gemini AI Setup

For AI chatbot feature:

1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Add to `.env`:
```env
VITE_GEMINI_API_KEY=your-api-key-here
```

The app works without Gemini, but the AI chatbot will be disabled.

---

## License

Private - Da Nang Blockchain Hub
