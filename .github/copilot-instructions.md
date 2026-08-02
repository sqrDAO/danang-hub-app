# Copilot Instructions — Da Nang Hub App

## Commands

```bash
# Frontend (root)
npm run dev          # Dev server on port 3000
npm run build        # Production build
npm run lint         # ESLint — zero warnings allowed (will fail on any warning)
npm run preview      # Preview production build

# Firebase
firebase deploy                        # Deploy everything (rules + functions)
firebase deploy --only functions       # Deploy Cloud Functions only
firebase deploy --only firestore:rules
firebase emulators:start               # Run all local emulators

# Cloud Functions (/functions directory)
npm run serve        # Start functions emulator only
npm run logs         # Tail function logs
```

`npm test` runs node's built-in test runner over `test/*.test.js`. It covers pure helpers
only — there is no component, integration, or Firestore-rules coverage, so a green run does
not mean a change is verified. Check behavior against the dev server or the emulators too.

## Architecture

**Stack:** React 18 + Vite, React Router v6, TanStack React Query v5, Firebase (Auth/Firestore/Storage/Cloud Functions Node 22), i18next (EN + VI).

### Layered State Model

1. **AuthContext** (`src/contexts/AuthContext.jsx`) — wraps the entire app. Provides `currentUser`, `userProfile`, `isAdmin()`, `isProfileComplete()`. User profile is auto-created in Firestore on first login.
2. **ThemeContext** (`src/contexts/ThemeContext.jsx`) — toggles `data-theme` on `document.documentElement`; persisted to `localStorage["hub-theme"]`.
3. **React Query** — all Firestore-backed server state. Configured globally with `refetchOnWindowFocus: false`, `retry: 1`.

### Service Layer

**Never call Firebase SDK directly from components.** All Firestore/Auth/Storage calls go through `src/services/`:

- `firebase.js` — SDK init, `auth`, `db`, `storage`, `functions` exports
- `bookings.js` — CRUD + conflict checking + recurring bookings
- `events.js` — CRUD + attendee/waitlist management
- `amenities.js`, `members.js`, `projects.js` — CRUD
- `functions.js` — Callable Cloud Function wrappers
- `storage.js` — Firebase Storage
- `walletAuth.js` — EVM (EIP-6963) + Solana (Wallet Standard) sign-in via Cloud Functions + custom token

### Cloud Functions (`functions/index.js`)

Every function lives in a single file; `README.md` holds the authoritative table.
- `checkBookingConflicts` — callable, authenticated
- `checkSlotAvailability` — callable, public (public slot availability check)
- `generateWalletNonce` / `verifyWalletSignature` — callables, public (wallet sign-in)
- `sendBookingConfirmation` — Firestore `onCreate` on bookings
- `autoApproveDeskBooking` — Firestore `onCreate` on bookings
- `notifyBookingApproval` — Firestore `onUpdate` on bookings
- `notifyEventPendingReview` — Firestore `onCreate` on events
- `notifyEventStatusChange` — Firestore `onUpdate` on events
- `autoPromoteWaitlist` — Firestore `onUpdate` on events
- `autoCheckoutExpiredBookings` — scheduled hourly
- `sendEventReminders` — scheduled hourly
- `cleanupPushNotificationMarkers` — scheduled daily

### Routing & Auth Guard

`App.jsx` defines all routes. `ProtectedRoute` accepts `requireAdmin` and `requireProfileComplete` props. Profile completion requires `company` and `jobTitle` fields.

Route structure:
- `/` — public home
- `/login` — unified sign-in/sign-up/password-reset
- `/admin/*` — admin only
- `/member/*` — authenticated members

## Key Conventions

### Firestore Timestamps

Service functions always convert Firestore `Timestamp` to `Date` when reading:
```js
startTime: doc.data().startTime?.toDate?.() || doc.data().startTime,
```
And convert `Date` → `Timestamp.fromDate(...)` when writing. Always follow this pattern.

### Timezone

All booking/event times are in `Asia/Ho_Chi_Minh` (UTC+7). Use utilities from `src/utils/timezone.js`:
- `parseHubDateTime(localStr)` — parse `datetime-local` input as Vietnam time
- `toDatetimeLocalHub(date)` — convert `Date` → `datetime-local` string in Vietnam time
- `formatEventDateTime / formatEventDate / formatEventTime` — for display

Never use raw `new Date()` or browser locale formatting for event/booking times.

### React Query Keys

Follow the pattern `['collection', optionalId]`:
```js
useQuery({ queryKey: ['bookings'] })
useQuery({ queryKey: ['bookings', bookingId] })
```

### i18n

All UI strings must use `useTranslation` hook — no hardcoded strings. Locales live in `src/locales/en.json` and `src/locales/vi.json`. Language is persisted to `localStorage["hub-lang"]`.

### Styling

- Colors exclusively via CSS custom properties defined in `src/styles/globals.css` (e.g., `--bg-color`, `--text-primary`, `--accent-primary`)
- Dark/light theme: override vars under `[data-theme="dark"]` selector
- Glassmorphism: `backdrop-filter` + semi-transparent backgrounds
- Font: `'Outfit'` (Google Fonts); standard border-radius: `12px`
- Each component has a co-located `.css` file

### Notifications

Use the `Toast` system (`src/components/Toast.jsx`) for user-facing feedback — do not use `alert()` or `console` for user messages.

### Firestore Data Model

- **members**: `uid`, `displayName`, `email`, `membershipType` (admin|member), `company`, `jobTitle`, `phone`, `bio`, `linkedIn`, `website`, `preferences`
- **amenities**: `name`, `type` (desk|meeting-room|podcast-room|event-space), `capacity`, `isAvailable`, plus **top-level** availability fields `startHour`, `endHour`, `availableDays` (not nested under an `availability` object)
- **bookings**: `memberId`, `amenityId`, `startTime`, `endTime`, `status` (pending→approved→checked-in→completed|cancelled), `checkInTime`, `checkOutTime`
- **events**: `organizerId`, `title`, `date`, `capacity`, `attendees[]`, `waitlist[]`, `status` (pending|approved|rejected)
- **projects**: `name`, plus arbitrary fields

### Environment

Copy `.env.example` → `.env` and populate Firebase config.
