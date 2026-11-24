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
- **Monthly desk-hours limit** — members can book up to 40 hours of ordinary desk time per calendar month (hub time); Fixed/Partner Desk days and admins are exempt. The booking page shows hours used and blocks over-limit bookings, and the server cancels any that slip through
- **Fixed Desk Renewal** — members renew from 7 days before a plan ends to 7 days after; renewals wait for admin approval (approved or rejected as one plan) and don't hold the desk meanwhile; a reminder goes out 3 days before the end
- **Partner Desks** — members of a partner organization (e.g. 9AM Games, DiiD) are booked on the partner's desk every working day, four weeks ahead, for as long as they stay attached; they can skip single days
- **AI Agent Booking** — seven MCP tools (six for booking, one listing upcoming events) at `app.danangblockchainhub.com/mcp`; Claude, ChatGPT and Codex sign in with the member's Hub account (OAuth 2.1, consent page at `/oauth/consent`, Connected apps with Disconnect in Profile), other clients use a personal bearer token; [setup and first deployment](docs/knowledge/mcp-booking.md).
- **Conflict Detection** — real-time server-side conflict checking via Cloud Functions
- **Recurring Bookings** — weekly recurring reservations
- **Check-in / Check-out** — manual and automatic checkout (hourly Cloud Function)
- **Bulk Approval** — admins can approve all pending bookings in one click
- **Booking Status Workflow** — `pending → approved → checked-in → completed`
- **Event-Space Restrictions** — event space requires bookings outside office hours (weekdays: after 6 PM; weekends: 8 AM – 10 PM, must end by 10 PM)
- **Hub Closures** — declared holiday/shutdown dates close every amenity for whole days: no new bookings, no Event Hall events, and recurring/fixed-desk plans skip those days. Events that do not request the Event Hall (online or off-site) are unaffected (`src/utils/hubClosures.js`, mirrored in `functions/hubClosures.js`)

### Event Management
- **Event Creation** — title, description, date, capacity, hosting project, banner image
- **Import from Luma, Meetup or Eventbrite** — paste a supported public event link in the create form to pre-fill title, description, date/time, duration, event link and banner for review
  - Supported page hosts: `lu.ma`, `luma.com`, `meetup.com`, `meetu.ps`, `eventbrite.com`, `eventbrite.co.uk` (also `www.`). Other regional domains, Eventbrite custom subdomains and unverified shorteners are rejected; use a supported canonical event URL. Login-only, blocked or metadata-free pages fall back to manual entry. Covers come only from `images.lumacdn.com`, `secure-content.meetupstatic.com` and `img.evbuc.com`; failed cover downloads require manual upload.
- **Revisioned Approval Workflow** — organizers can revise future events; approved or
  rejected revisions return to pending review
- **Venue** — one optional Hub venue per event (Event Hall hours and Hub closures apply);
  events don't book the hall, since ops agrees each event with its organizer
- **Waitlist System** — automatic waitlist + promotion when spots open
- **Organizer Profile Modal** — view host details inline on any event card
- **Event Reminders** — scheduled email reminders sent 24 hours before events

### Admin Dashboard
- **Overview Stats** — members, active bookings, upcoming events, available amenities
- **Member Management** — search by name, company or partner; edit profiles, membership types and partner organization; add/remove partner organizations
- **Amenity Management** — create/edit amenities, configure availability hours, days, slot duration, and photo gallery
- **Booking Management** — filter by status, bulk-approve pending bookings, assign fixed desks
- **Event Management** — approve/reject events with reason, manage attendees and waitlists

### Member Portal
- **Personal Dashboard** — upcoming bookings and events at a glance, with shortcuts to book an amenity or create an event
- **Booking Interface** — calendar picker with live conflict checking
- **Fixed Desk View** — see active fixed-desk subscriptions alongside ad-hoc bookings
- **Event Registration** — browse, register, and manage waitlist position
- **Profile Management** — edit personal info, upload avatar, display wallet address; the profile email is read-only and mirrors the sign-in email; new email/password sign-ups must verify it on a separate Verify email screen before using the hub, while for older accounts verifying is optional (linked next to the email on Profile) and lets the hub email them about events they submit; there is no email-notifications setting yet; wallet accounts have no sign-in email and type their own contact address; shared member/contact displays label emails Verified or Unverified, with legacy records conservatively unverified until Auth sync

### Unified Calendar View
- Combined bookings + events in one calendar
- Filter by amenity type
- Color-coded items distinguishing your bookings from others
- Month view with day-by-day breakdown

### Public Homepage
- Amenity and event showcase without login
- Hosting project display on event cards
- Seamless sign-up call-to-action for new members

### Notifications & Email
- **In-App Notification Center** — unread inbox for new event review requests plus booking review and approval work
- **Browser Push Alerts** — opt-in booking and event review / status alerts through Firebase Cloud Messaging
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
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions Node.js 22) |
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

# Optional: route Auth/Firestore/Functions/Storage to local emulators
# VITE_USE_EMULATORS=true
# VITE_EMULATOR_HOST=localhost
```

To test the built app with Hosting headers, run `npm run emulators` and open the Hosting URL printed by the CLI. This command builds the app with emulator routing enabled and generates a local Hosting config for the same `VITE_EMULATOR_HOST` (default `localhost`). It uses the Firebase project selected by the CLI, so match that project to `VITE_FIREBASE_PROJECT_ID`.

### 4. Enable Firebase Services

**Authentication** — Enable **Google** and **Email/Password** providers. Wallet sign-in uses Custom Tokens (no extra provider needed).

**Firestore Database** — Create database in test mode; `asia-southeast1` recommended.

**Cloud Functions** — Requires Blaze (pay-as-you-go) billing plan.

**Storage** — Enable for avatar and amenity photo uploads.

### 5. Deploy Firebase Resources

**Required for a different Firebase project:** Before deploying Hosting, update the `Content-Security-Policy` header in `firebase.json` to match the Firebase settings used to build the app. Hosting serves this header literally. Changing the Vite environment variables alone leaves the original origins in place.

| Directive | Replace this origin | Use this project's origin |
|---|---|---|
| `connect-src` | `https://us-central1-danang-hub-app.cloudfunctions.net` | `https://us-central1-<VITE_FIREBASE_PROJECT_ID>.cloudfunctions.net` |
| `connect-src` and `frame-src` | `https://danang-hub-app.firebaseapp.com` | `https://<VITE_FIREBASE_AUTH_DOMAIN>` |

Substitute the actual values, including your custom Auth domain if configured. Keep each entry an exact HTTPS origin. On the Hosting preview, check the `Content-Security-Policy` response header on `/login`, then test Google sign-in and a booking availability check.

```bash
# Deploy Firestore rules, Storage rules, and Cloud Functions
firebase deploy

# Or individually:
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

Merging to `main` deploys **Firestore rules**, functions, then hosting via GitHub
Actions; the backend goes first, so a new site never calls an old function. Two
things are *not* deployed by CI, because the CI service account lacks the
permissions — run these manually as project owner when they change:

```bash
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

#### New callable functions: owner invoker setup

CI can update existing functions but cannot set the Cloud Run invoker IAM policy
for a newly added callable. Its first deploy can fail with **“Failed to set the
IAM Policy” / “Unable to set the invoker”**. Because Functions deploy before
Hosting, that failure also skips Hosting; later merges may remain blocked until
an owner fixes the affected service. Keep this setup manual rather than granting
CI broader IAM permissions. Flag new functions in the PR checklist and arrange
for a project owner to handle the first deployment.

After merging a new callable, if this invoker error occurs:

1. A project owner opens **Cloud Run** in project **danang-hub-app**, region
   **us-central1**, and identifies the affected function's backing service from
   the failed deploy log. Check the actual service name; do not assume it matches
   the JavaScript export's capitalization.
2. For a callable intended to be invoked by the browser, grant **Cloud Run
   Invoker** (`roles/run.invoker`) to **allUsers** on that service. The console's
   **Allow public access** option provides public invocation, or use the following
   command as the owner, replacing `SERVICE_NAME` with the actual service name:

   ```bash
   gcloud run services add-iam-policy-binding SERVICE_NAME \
     --project=danang-hub-app \
     --region=us-central1 \
     --member=allUsers \
     --role=roles/run.invoker
   ```

   This is service-level invocation access, not access to Firestore or admin
   actions. The handler must still enforce its intended Firebase Auth and
   authorization checks; wallet sign-in endpoints instead validate their nonce
   and signature. Do **not** apply this public binding to event-driven functions
   or intentionally private HTTP endpoints. Those need their trigger/caller's
   service identity permissions instead.
3. In GitHub Actions, open the failed **Deploy to Firebase Hosting on merge**
   run and choose **Re-run failed jobs**. Repeat the service-specific setup if
   another new callable reports the same invoker error. Do not bypass the backend
   failure by deploying Hosting alone.
4. Confirm **Deploy Cloud Functions** and **Deploy to Firebase Hosting** succeed,
   confirm the intended production revision is live, and exercise the new
   callable's application flow (including its access checks). A successful PR
   preview only verifies Hosting and does not prove a new function was deployed.

Reference: [Google Cloud's function invocation IAM guidance](https://docs.cloud.google.com/functions/docs/securing/managing-access-iam)
and [Cloud Run public access permissions](https://docs.cloud.google.com/run/docs/authenticating/public).
The owner needs `run.services.setIamPolicy`; if an organization policy forbids
public access, the project administrator must resolve that policy rather than
repeatedly rerunning CI.

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

### 9. Partner Organizations (optional)

Add partner organizations on `/admin/members`, pick each one's desk, then attach members from the member edit form. Their bookings appear on the next hourly run. To attach existing members in bulk by the `company` on their profile, run `node functions/scripts/assign-partners-by-company.cjs` (dry run) and, after reviewing the list, the same command with `--apply`. Other company names for a partner (DiiD's legal name, "Trí tuệ số") are listed in `PARTNER_ALIASES` in `functions/partners.js`.

Picking a partner's desk reserves it for that partner: it is hidden from other members on `/member/bookings`, and the rules refuse their bookings on it (its schedule is still readable, like any amenity). A reserved desk cannot be retyped or deleted until it is released in the Partners panel. Desks picked before this existed are reserved by `node functions/scripts/backfill-partner-desk-reservations.cjs` (dry run; add `--apply` after reviewing it).

---

## Cloud Functions

| Function | Type | Description |
|----------|------|-------------|
| `mcp` | HTTPS request | Stateless MCP endpoint, six member booking tools plus `list_upcoming_events`. Accepts personal `dhm_` tokens anywhere and OAuth `dha_` access tokens (audience-checked) only through Hosting on `app.danangblockchainhub.com`, whose 401 carries `resource_metadata`; 60 requests/min per token or grant |
| `oauth` | HTTPS request | OAuth 2.1 authorization server for MCP connectors (#263), served through Hosting rewrites on `app.danangblockchainhub.com`: protected-resource and authorization-server metadata, dynamic client registration (Claude, ChatGPT and loopback callbacks only), Client ID Metadata Documents for four allowlisted client URLs (ChatGPT, Claude, Claude Code, Codex; fetched with a 3 s / 16 KB cap, no redirects, cached 1 h), authorize (binds the request to the browser with a `__session` cookie; RFC 9207 `iss` on every response), the consent page's `POST /oauth/consent-action` (describe, approve, deny; ID token + same browser), token (PKCE S256, rotating refresh tokens) and revoke. Discovery on (`DISCOVERY_ENABLED` in `functions/oauth/config.js`) |
| `oauthConsent` | Callable | Retired stub (always `failed-precondition`): consent moved to `oauth` `/oauth/consent-action`, which sees the browser-binding cookie. Kept so deploys don't try to delete it; remove after `firebase functions:delete oauthConsent` |
| `manageMcpToken` | Callable | Issue, inspect and revoke the signed-in member’s one personal token (90-day expiry); `listGrants`/`revokeGrant` list and disconnect the member's sign-in apps (Profile → Connected apps) |
| `checkBookingConflicts` | Callable | Server-side validation to prevent double-bookings |
| `checkSlotAvailability` | Callable | Public slot availability check |
| `editOwnEvent` | Callable | Validates and saves an organizer's future-event revision; resubmits live or rejected events |
| `reviewEvent` | Callable | Admin-only revision-aware approval/rejection; changes status only |
| `importEventFromUrl` | Callable | Reads a public event page (Luma, Meetup / `meetu.ps`, Eventbrite `.com` / `.co.uk`; exact hosts only) and returns a draft that pre-fills the create form; reserves one of 10 hourly import attempts in a server-only counter |
| `removePartner` | Callable | Admin-only partner removal: detaches its members, releases its desk and deletes it, then cancels the members' upcoming Partner Desk days (`partner-removed`) |
| `generateWalletNonce` | Callable | Generates a 32-byte hex nonce for wallet sign-in (5-min expiry) |
| `verifyWalletSignature` | Callable | Verifies EVM or Solana signature → returns Firebase custom token |
| `autoCheckoutExpiredBookings` | Scheduled (hourly) | Auto-completes bookings past their end time or booking date, then syncs Partner Desk days (books attached members on their partner's desk 28 days ahead, cancels days of detached members); cancels unapproved renewal days instead of completing them, and sends Fixed Desk ending reminders 3 days ahead |
| `autoApproveDeskBooking` | Firestore trigger (onCreate) | Cancels a member's single desk booking that would go over 40 desk hours that month (`monthly-hours-limit`), otherwise auto-approves available single desk bookings (never desk plans) or notifies admins of manual review work; booking review push follows the same path for opted-in admins |
| `notifyBookingApproval` | Firestore trigger (onUpdate) | Writes a member in-app notification when a booking is approved, or cancelled for them by an admin/script (`cancelledReason` set), and sends the matching push for opted-in members |
| `notifyEventPendingReview` | Firestore trigger (onCreate) | Writes admin in-app notifications for a new pending event request and sends review push for opted-in admins |
| `notifyEventResubmission` | Firestore trigger (onUpdate) | Notifies admins of a revisioned approved/rejected event resubmission |
| `notifyEventStatusChange` | Firestore trigger (onUpdate) | Writes organizer in-app notifications and status push for opted-in organizers when an event is approved or rejected, plus an email, always sent (no preference turns it off) but only to the organizer's verified Firebase Auth email (Google, or email/password once verified; wallet organizers get none) |
| `notifyEventRevisionParticipants` | Firestore trigger (onUpdate) | Sends in-app status updates to retained attendees/waitlisted members after a previously approved event changes revision state |
| `cleanupPushNotificationMarkers` | Scheduled (daily) | Deletes expired browser push dedupe markers |
| `sendEventReminders` | Scheduled (hourly) | Reminds every member about approved events ~24h out (in-app + push), with copy per attendee/waitlisted/other |
| `autoPromoteWaitlist` | Firestore trigger (onUpdate) | Promotes members from waitlist when spots open |

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
│   ├── NotificationBell.jsx      # In-app notification center (bell + panel)
│   ├── ProtectedRoute.jsx
│   ├── Toast.jsx
│   └── UnifiedCalendar.jsx       # Combined bookings + events calendar
├── pages/
│   ├── admin/
│   │   ├── Dashboard.jsx         # Stats overview
│   │   ├── Members.jsx           # Member list with search
│   │   ├── PartnersPanel.jsx     # Partner organizations (add/remove)
│   │   ├── Amenities.jsx         # Amenity CRUD + photo gallery
│   │   ├── Bookings.jsx          # Booking management + bulk approval
│   │   ├── RenewalsPanel.jsx     # Fixed Desk renewals to approve/reject
│   │   └── Events.jsx            # Event approval + rejection with reason
│   ├── member/
│   │   ├── Dashboard.jsx
│   │   ├── Bookings.jsx          # Calendar booking + fixed desk view
│   │   ├── Events.jsx            # Event registration + waitlist
│   │   └── Profile.jsx
│   ├── auth/
│   │   └── Login.jsx             # Sign-in, sign-up, password reset, wallet login
│   └── Home.jsx                  # Public homepage
├── services/
│   ├── firebase.js               # Firebase initialization
│   ├── firebaseConfig.js         # Shared Firebase config + VAPID key
│   ├── amenities.js
│   ├── bookings.js               # CRUD + conflict checking
│   ├── events.js                 # CRUD + attendee/waitlist management
│   ├── members.js
│   ├── partners.js               # Partner organizations
│   ├── pushNotifications.js      # Browser push token opt-in/out helpers
│   ├── notifications.js
│   ├── projects.js
│   ├── storage.js                # Firebase Storage (avatars, amenity photos)
│   ├── functions.js              # Cloud Function client wrappers
│   └── walletAuth.js             # EIP-6963 EVM + Solana Wallet Standard
├── contexts/
│   ├── AuthContext.jsx
│   └── ThemeContext.jsx
├── hooks/
│   ├── useAuth.js                # AuthContext accessor
│   └── useTheme.js               # ThemeContext accessor
├── i18n/
│   └── index.js                  # i18next setup (EN/VI, browser detection)
├── locales/
│   ├── en.json
│   └── vi.json
├── utils/
│   ├── timezone.js               # Asia/Ho_Chi_Minh helpers
│   └── toast.js                  # showToast helper
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
| `members` | Profiles, membership type (admin/member), wallet address, admin-set `partnerId` (owners cannot set or change it), `email` (owners with a sign-in email may only set that; wallet accounts type their own), `verifiedEmail` (exact address proven by the owner’s verified Auth token; synced on profile load or verification, never inferred for legacy records), `emailVerificationRequired` (set on new email/password sign-ups; the app holds them on the verify screen until verified), `phone` (E.164, e.g. `+84905123456`; owners may write only E.164 or empty, older free-text values stay until the next save), optional self-reported `gender` (`female`/`male`/`other`/`prefer-not-to-say`, member and admins only, for aggregate UN SDG 5 reporting), server migration marker `pushTokensMigrated` (legacy push-token document confirmed absent) |
| `partners` | Partner organizations (`name`, `deskAmenityId`); admin-written, readable by signed-in users |
| `amenities` | Resources with custom availability (hours, days, slot duration); optional `reservedForPartnerId` marks a partner's desk, bookable only by that partner's members (set from the Partners panel, rules-enforced) |
| `bookings` | Booking records with status workflow and desk plans (`planType`: `fixed-desk` or `partner-desk`); renewal days carry `renewalOf`, rejected ones `rejectionReason` |
| `events` | Events with approval status, revision/everApproved metadata, attendees, waitlist, rejection reason, and venue (`requestedAmenityId`) |
| `notifications` | In-app notifications written only by Cloud Functions; members read their own and may update only the `read` field |
| `push_tokens` | Per-phone tokens at `push_tokens/{uid}/devices/{deviceId}`; read only when `preferences.pushNotifications` is on. Device registration, Off and logout delete the legacy `push_tokens/{uid}` doc, which clients can no longer create/update. The sender sets `members.pushTokensMigrated` best effort after confirming legacy absence, then skips legacy reads. Off/logout invalidate in-flight registration and revoke this browser's subscription. Registration is serialized so a late cancelled operation is cleaned up before another account registers. A successful revoke keeps Off even if document cleanup fails; logout retains the marker for next-login intent. Unrecoverable FCM errors prune every doc holding the invalid token. |
| `push_notifications` | Internal dedupe markers for browser push alerts; expired markers are deleted by schedule and carry `expiresAt` for optional Firestore TTL |
| `importRateLimits` | Server-only per-account import counters (`windowStart` in milliseconds and `count`), allowing 10 attempts per hour, including failed page fetches |
| `mcpTokens` | Server-only SHA-256 token-hash IDs, member ID, expiry and per-minute request counter; raw tokens are never stored. |
| `mcpTokenOwners` | Server-only per-member token metadata/index; one token per member, one generation per minute |
| `mcpBookingLocks` | Server-only per-amenity transaction serialization documents for MCP creates |
| `oauthClients` | Server-only OAuth clients from dynamic registration (public, no secret; CIMD clients are not stored here); expire 1 day after registration unless used, then 30 days after each token exchange (`expiresAt` TTL) |
| `oauthRequests` | Server-only pending authorization requests, 10-minute TTL, consumed once on approve or deny |
| `oauthCodes` | Server-only SHA-256 hashes of authorization codes (60 s, single use; replaying a code that was already exchanged revokes its grant, a code burned by a failed PKCE check is just refused) |
| `oauthGrants` | Server-only per-member app connections (client, redirect URI, scope, revoked flag, per-minute request counter, `lastUsedAt`), 90-day cap |
| `oauthTokens` | Server-only SHA-256 hashes of `dha_` access (1 h) and `dhr_` refresh (30 days sliding, rotated on use) tokens with grant, member and audience |
| `oauthRateLimits` | Server-only registration counters: global hourly cap for hosted callbacks, per-IP hourly cap for loopback, unused-client buckets |
| `nonces` | Short-lived nonces for wallet auth (keyed by address, deleted after use) |
| `projects` | Hosting project info linked to events |

---

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run dev:skipauth` | Skip-auth preview with in-memory amenities, bookings, and events (stub admin). Production builds never skip login. |
| `npm run build` | Production build |
| `npm run lint` | ESLint (max-warnings 0) |
| `npm test` | Node test runner over `test/*.test.js` (Firestore rules tests skip unless the emulator host is configured) |
| `npm run test:rules` | Firestore rules tests against the Firestore emulator (needs Java); also runs in CI on every PR and push to `main` |
| `npm run preview` | Preview production build |
| `firebase deploy` | Deploy Firestore rules, Storage rules, Functions |
| `firebase deploy --only functions` | Deploy Cloud Functions only |
| `firebase deploy --only firestore:rules` | Deploy Firestore rules |
| `firebase functions:log` | View real-time function logs |
| `npm run emulators` | Build and serve the app with local Hosting, Auth, Firestore, Functions and Storage |

Vite loads `.env.local` in every mode. Do not put `VITE_SKIP_AUTH=true` there, or plain `npm run dev` will skip auth too — keep the flag in `.env.skipauth` only.

---

## Versions & Releases

The app version is `version` in `package.json` ([semver](https://semver.org)). The footer shows it with the commit the build came from, e.g. `v1.0.0 (38164ca)`; hover for the build time.

To release, bump the version in a PR: `npm version minor --no-git-tag-version` for features, `patch` for fixes, `major` for breaking changes. When that PR merges, the deploy workflow publishes a GitHub release `v<version>`, tagged on that merge commit, from that version's section in `CHANGELOG.md`, so add the section in the same PR. If that deploy fails, the next successful one still tags the bump merge. Merges that don't bump the version deploy as usual and add no tag; their footer still shows the new commit.

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
