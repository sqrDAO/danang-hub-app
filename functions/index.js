const {setGlobalOptions} = require("firebase-functions/v2");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated, onDocumentUpdated,
} = require("firebase-functions/v2/firestore");
const {initializeApp} = require("firebase-admin/app");
const {
  getFirestore, Timestamp, FieldValue,
} = require("firebase-admin/firestore");
const {getAuth} = require("firebase-admin/auth");
const crypto = require("crypto");
const {ethers} = require("ethers");
const nacl = require("tweetnacl");
const bs58 = require("bs58");

initializeApp();

const db = getFirestore();

// Region for all deployed Cloud Functions. Pinned to us-central1 until the
// deploying service account is granted roles/cloudfunctions.admin (required
// to set the public invoker IAM policy in other regions).
const REGION = "us-central1";
setGlobalOptions({region: REGION});

const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
const BUSINESS_START_HOUR = 9;
const BUSINESS_END_HOUR = 18;

const AMENITY_TYPES_WITH_BUSINESS_HOURS = [
  "desk", "meeting-room", "podcast-room",
];

// Amenity types that support multiple concurrent bookings up to capacity
const AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY = ["desk"];

/**
 * @param {Date} date The date to extract time from
 * @param {string} timeZone IANA timezone (e.g. Asia/Ho_Chi_Minh)
 * @return {number} Minutes since midnight in that timezone
 */
function getMinutesSinceMidnight(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === "hour").value, 10);
  const minute = parseInt(parts.find((p) => p.type === "minute").value, 10);
  const second = parseInt(parts.find((p) => p.type === "second").value, 10);
  return hour * 60 + minute + second / 60;
}

/**
 * @param {Date} date The date to check
 * @return {boolean} True if Monday–Friday in hub timezone
 */
function isWeekday(date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: HUB_TIMEZONE,
    weekday: "short",
  }).format(date);
  return !["Sat", "Sun"].includes(weekday);
}

/**
 * Returns the day-of-week index (0=Sun … 6=Sat) for a given date in the hub
 * timezone.
 * @param {Date|string} date
 * @return {number}
 */
function getDayNumber(date) {
  const weekdayShort = new Intl.DateTimeFormat("en-US", {
    timeZone: HUB_TIMEZONE, weekday: "short",
  }).format(new Date(date));
  const DAY_INDEX = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6};
  return DAY_INDEX[weekdayShort] ?? -1;
}

/**
 * Returns true if the booking start time falls on one of the amenity's
 * configured available days.  Reads top-level fields (availableDays) from the
 * amenity document.  Defaults to Mon–Fri when not set.
 * @param {string} startTime ISO start time
 * @param {Object} amenity Amenity Firestore document data
 * @return {boolean}
 */
function isOnAvailableDay(startTime, amenity) {
  const availableDays = Array.isArray(amenity && amenity.availableDays) ?
    amenity.availableDays : [1, 2, 3, 4, 5];
  return availableDays.includes(getDayNumber(startTime));
}

/**
 * @param {string} startTime ISO start time
 * @param {string} endTime ISO end time
 * @param {Object} amenity Amenity data with optional availability config
 * @return {boolean} True if within the amenity's configured hours and days
 */
function isWithinAmenityHours(startTime, endTime, amenity) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  // Read top-level amenity fields (not nested under amenity.availability)
  const avail = amenity || {};
  const startHour = typeof avail.startHour === "number" ?
    avail.startHour : BUSINESS_START_HOUR;
  const endHour = typeof avail.endHour === "number" ?
    avail.endHour : BUSINESS_END_HOUR;

  // Day check is handled by isOnAvailableDay; skip it here.
  if (!isOnAvailableDay(startTime, amenity)) return false;

  const fmt = (d) => new Intl.DateTimeFormat("en-CA", {
    timeZone: HUB_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  if (fmt(startDate) !== fmt(endDate)) return false;

  const startMins = getMinutesSinceMidnight(startDate, HUB_TIMEZONE);
  const endMins = getMinutesSinceMidnight(endDate, HUB_TIMEZONE);
  const openMins = startHour * 60;
  const closeMins = endHour * 60;
  if (endMins <= startMins) return false;
  return startMins >= openMins && endMins <= closeMins;
}

/**
 * @param {string} startTime ISO start time
 * @param {string} endTime ISO end time
 * @return {boolean} True if within 8am-6pm Mon–Fri Vietnam time, same day
 */
function isWithinBusinessHours(startTime, endTime) {
  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  if (!isWeekday(startDate)) return false;
  const fmt = (d) => new Intl.DateTimeFormat("en-CA", {
    timeZone: HUB_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  if (fmt(startDate) !== fmt(endDate)) return false;
  const startMins = getMinutesSinceMidnight(startDate, HUB_TIMEZONE);
  const endMins = getMinutesSinceMidnight(endDate, HUB_TIMEZONE);
  const openMins = BUSINESS_START_HOUR * 60;
  const closeMins = BUSINESS_END_HOUR * 60;
  if (endMins <= startMins) return false;
  return startMins >= openMins && endMins <= closeMins;
}

/**
 * Counts overlapping active bookings for an amenity/time-slot and derives
 * whether the slot is at capacity. Shared by checkBookingConflicts,
 * checkSlotAvailability, and the desk auto-approval trigger.
 * @param {object} params
 * @param {string} params.amenityId
 * @param {object|null} params.amenity Amenity doc data, or null if missing
 * @param {string} params.startTime ISO string
 * @param {string} params.endTime ISO string
 * @param {string} [params.excludeBookingId] Booking id to ignore (e.g. self)
 * @return {Promise<{hasConflicts: boolean, conflicts: Array}>}
 */
async function computeBookingAvailability({
  amenityId, amenity, startTime, endTime, excludeBookingId,
}) {
  const amenityType = amenity && amenity.type ? amenity.type : null;

  let amenityCapacityRaw = 1;
  if (amenity && typeof amenity.capacity === "number") {
    amenityCapacityRaw = amenity.capacity;
  }
  const amenityCapacity = amenityCapacityRaw > 0 ? amenityCapacityRaw : 1;

  const bookingsQuery = db.collection("bookings")
      .where("amenityId", "==", amenityId)
      .where("status", "in", ["pending", "approved", "checked-in"]);

  const snapshot = await bookingsQuery.get();
  const conflicts = [];
  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);

  snapshot.forEach((doc) => {
    if (excludeBookingId && doc.id === excludeBookingId) {
      return;
    }

    const booking = doc.data();
    const bookingStart = typeof booking.startTime.toDate === "function" ?
      booking.startTime.toDate() : new Date(booking.startTime);
    const bookingEnd = typeof booking.endTime.toDate === "function" ?
      booking.endTime.toDate() : new Date(booking.endTime);

    // Check for overlap
    if (
      (newStart >= bookingStart && newStart < bookingEnd) ||
      (newEnd > bookingStart && newEnd <= bookingEnd) ||
      (newStart <= bookingStart && newEnd >= bookingEnd)
    ) {
      conflicts.push({
        id: doc.id,
        startTime: bookingStart,
        endTime: bookingEnd,
      });
    }
  });

  const overlapCount = conflicts.length;
  let hasConflicts;

  if (
    amenityType &&
    AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY.includes(amenityType) &&
    amenityCapacity > 1
  ) {
    // Allow concurrent bookings up to capacity; block only when full
    hasConflicts = overlapCount >= amenityCapacity;
  } else {
    // For single-occupancy amenities, any overlap is a conflict
    hasConflicts = overlapCount > 0;
  }

  return {hasConflicts, conflicts};
}

// Check for booking conflicts
exports.checkBookingConflicts = onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated",
        );
      }

      const {amenityId, startTime, endTime, excludeBookingId} = request.data;

      try {
        const amenityRef = db.collection("amenities").doc(amenityId);
        const amenitySnap = await amenityRef.get();
        const amenity = amenitySnap.exists ? amenitySnap.data() : null;
        const amenityType = amenity && amenity.type ? amenity.type : null;

        // Always enforce available days for every amenity type
        // (including event-space)
        if (amenity && !isOnAvailableDay(startTime, amenity)) {
          throw new HttpsError(
              "invalid-argument",
              "Booking date is outside the amenity's available days.",
          );
        }

        // Enforce business hours only for desk/meeting-room/podcast-room
        const amenityNeedsHoursCheck =
          amenity && AMENITY_TYPES_WITH_BUSINESS_HOURS.includes(amenityType);
        if (amenityNeedsHoursCheck) {
          if (!isWithinAmenityHours(startTime, endTime, amenity)) {
            throw new HttpsError(
                "invalid-argument",
                "Booking time is outside the amenity's available hours.",
            );
          }
        }

        const {hasConflicts, conflicts} = await computeBookingAvailability({
          amenityId, amenity, startTime, endTime, excludeBookingId,
        });

        return {hasConflicts, conflicts};
      } catch (error) {
        console.error("Error checking booking conflicts:", error);
        throw new HttpsError(
            "internal",
            "Error checking conflicts",
        );
      }
    },
);

// Check slot availability - no auth (for chatbot, public availability)
exports.checkSlotAvailability = onCall(
    async (request) => {
      const {amenityId, startTime, endTime} = request.data;

      if (!amenityId || !startTime || !endTime) {
        throw new HttpsError(
            "invalid-argument",
            "amenityId, startTime, and endTime are required",
        );
      }

      try {
        const amenityRef = db.collection("amenities").doc(amenityId);
        const amenityDoc = await amenityRef.get();
        const amenity = amenityDoc.exists ? amenityDoc.data() : null;

        if (amenity) {
          // Always enforce available days for every amenity type
          if (!isOnAvailableDay(startTime, amenity)) {
            return {
              available: false,
              error: "This amenity is not available on that day.",
            };
          }

          if (AMENITY_TYPES_WITH_BUSINESS_HOURS.includes(amenity.type)) {
            if (!isWithinBusinessHours(startTime, endTime)) {
              return {
                available: false,
                error: "Desks, meeting rooms, and podcast rooms are only " +
                  "available Mon–Fri, 8 AM–6 PM (Vietnam time).",
              };
            }
          }
        }

        const {hasConflicts, conflicts} = await computeBookingAvailability({
          amenityId, amenity, startTime, endTime,
        });

        return {
          available: !hasConflicts,
          conflicts: conflicts.map((c) => ({
            id: c.id,
            startTime: c.startTime.toISOString(),
            endTime: c.endTime.toISOString(),
          })),
        };
      } catch (error) {
        console.error("Error checking slot availability:", error);
        throw new HttpsError(
            "internal",
            "Error checking availability",
        );
      }
    },
);

/**
 * Stores an unread notification with a stable document id. This prevents
 * duplicated notifications when a Firestore trigger retries.
 * @param {string} userId Notification recipient uid
 * @param {string} type Notification type
 * @param {string} subjectId Event, booking, or plan identifier
 * @param {Object} data Notification payload
 * @return {Promise<FirebaseFirestore.WriteResult>}
 */
async function createNotification(userId, type, subjectId, data) {
  const notificationId = `${type}_${userId}_${subjectId}`;
  return db.collection("notifications").doc(notificationId).set({
    ...data,
    userId,
    type,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Sends the same notification to every current admin.
 * @param {string} type Notification type
 * @param {string} subjectId Event, booking, or plan identifier
 * @param {Object} data Notification payload
 * @return {Promise<Array<FirebaseFirestore.WriteResult>>}
 */
async function notifyAdmins(type, subjectId, data) {
  const admins = await db.collection("members")
      .where("membershipType", "==", "admin").get();
  const writes = admins.docs.map((admin) =>
    createNotification(admin.id, type, subjectId, data),
  );
  return Promise.all(writes);
}

/**
 * @param {string} amenityId Amenity document id
 * @return {Promise<string>} Amenity name or id when unavailable
 */
async function getAmenityName(amenityId) {
  const amenityDoc = await db.collection("amenities").doc(amenityId).get();
  const amenity = amenityDoc.exists ? amenityDoc.data() : null;
  return amenity && amenity.name ? amenity.name : amenityId;
}

/**
 * @param {string} memberId Member document id
 * @return {Promise<string>} Member display name or empty string when missing
 */
async function getMemberName(memberId) {
  const memberDoc = await db.collection("members").doc(memberId).get();
  const member = memberDoc.exists ? memberDoc.data() : null;
  if (!member) return "";
  return member.displayName || member.email || "";
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {string} Stable id for a booking or its fixed-desk plan
 */
function getBookingSubjectId(booking, bookingId) {
  return booking.planGroupId || bookingId;
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {Promise<void>}
 */
async function notifyPendingBookingReview(booking, bookingId) {
  const [amenityName, memberName] = await Promise.all([
    getAmenityName(booking.amenityId),
    getMemberName(booking.memberId),
  ]);
  const subjectId = getBookingSubjectId(booking, bookingId);
  await notifyAdmins("booking_pending_review", subjectId, {
    bookingId,
    amenityName,
    memberName,
    planType: booking.planType || "standard",
    link: "/admin/bookings",
  });
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {Promise<FirebaseFirestore.WriteResult>}
 */
async function notifyBookingApproved(booking, bookingId) {
  const amenityName = await getAmenityName(booking.amenityId);
  return createNotification(
      booking.memberId,
      "booking_approved",
      getBookingSubjectId(booking, bookingId),
      {
        bookingId,
        amenityName,
        planType: booking.planType || "standard",
        link: "/member/bookings",
      },
  );
}

const HUB_UTC_OFFSET_HOURS = 7;

/**
 * Get start-of-day timestamp for today in hub timezone (Asia/Ho_Chi_Minh).
 * Bookings with startTime before this have a booking date that has passed.
 * @return {Timestamp}
 */
function getStartOfTodayHubTimezone() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year").value, 10);
  const month = parseInt(parts.find((p) => p.type === "month").value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day").value, 10);
  const midnightUtc = Date.UTC(year, month, day, 0, 0, 0, 0);
  const startOfTodayVN = new Date(
      midnightUtc - HUB_UTC_OFFSET_HOURS * 60 * 60 * 1000,
  );
  return Timestamp.fromDate(startOfTodayVN);
}

// Auto check-out expired bookings + auto-complete past-day bookings
exports.autoCheckoutExpiredBookings = onSchedule(
    "every 1 hours",
    async () => {
      try {
        const now = Timestamp.now();
        const oneHourAgo = Timestamp.fromMillis(
            now.toMillis() - 60 * 60 * 1000,
        );
        const startOfToday = getStartOfTodayHubTimezone();

        const toComplete = new Map(); // docRef -> update data

        // 1. Checked-in bookings past their end time: auto check-out
        const expiredCheckedIn = await db.collection("bookings")
            .where("status", "==", "checked-in")
            .where("endTime", "<=", oneHourAgo)
            .get();

        expiredCheckedIn.forEach((doc) => {
          toComplete.set(doc.ref.path, {
            status: "completed",
            checkOutTime: FieldValue.serverTimestamp(),
            updatedAt: new Date().toISOString(),
          });
        });

        // 2. Any pending/approved booking whose end time has passed:
        //    auto-complete. Covers past days AND same-day expired slots.
        const pendingApprovedStatuses = ["pending", "approved"];
        for (const status of pendingApprovedStatuses) {
          const expiredQuery = await db.collection("bookings")
              .where("status", "==", status)
              .where("endTime", "<=", now)
              .get();

          expiredQuery.forEach((doc) => {
            toComplete.set(doc.ref.path, {
              status: "completed",
              checkOutTime: FieldValue.serverTimestamp(),
              updatedAt: new Date().toISOString(),
            });
          });
        }

        // 3. Past-day checked-in bookings not caught by step 1
        //    (endTime within last hour but startTime before today)
        const pastDayCheckedIn = await db.collection("bookings")
            .where("status", "==", "checked-in")
            .where("startTime", "<", startOfToday)
            .get();

        pastDayCheckedIn.forEach((doc) => {
          toComplete.set(doc.ref.path, {
            status: "completed",
            checkOutTime: FieldValue.serverTimestamp(),
            updatedAt: new Date().toISOString(),
          });
        });

        const refs = Array.from(toComplete.keys()).map((path) =>
          db.doc(path),
        );
        const updates = Array.from(toComplete.values());
        const batchSize = 500;
        for (let i = 0; i < refs.length; i += batchSize) {
          const batch = db.batch();
          const chunk = refs.slice(i, i + batchSize);
          const chunkUpdates = updates.slice(i, i + batchSize);
          chunk.forEach((ref, idx) => {
            batch.update(ref, chunkUpdates[idx]);
          });
          await batch.commit();
        }
        if (toComplete.size > 0) {
          console.log(`Auto-completed ${toComplete.size} past/expired`);
        }

        return null;
      } catch (error) {
        console.error("Error in auto checkout:", error);
        return null;
      }
    });

// Send booking confirmation email
exports.sendBookingConfirmation = onDocumentCreated(
    "bookings/{bookingId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return null;
      const booking = snap.data();

      try {
        // Get member details (includes preferences.emailNotifications)
        const memberDoc = await db.collection("members")
            .doc(booking.memberId).get();
        const member = memberDoc.exists ? memberDoc.data() : null;
        const prefs = (member && member.preferences) || {};
        const sendEmail = prefs.emailNotifications !== false;

        // Get amenity details
        const amenityDoc = await db.collection("amenities")
            .doc(booking.amenityId).get();
        const amenity = amenityDoc.exists ? amenityDoc.data() : null;

        // TODO: Integrate with email service; only send if sendEmail is true
        console.log("Booking confirmation:", {
          memberEmail: member && member.email ? member.email : null,
          memberPhone: member && member.phone ? member.phone : null,
          amenityName: amenity && amenity.name ? amenity.name : null,
          startTime: booking.startTime,
          endTime: booking.endTime,
          sendEmail,
        });

        return null;
      } catch (error) {
        console.error("Error sending booking confirmation:", error);
        return null;
      }
    });

// Auto-approve desk bookings (excluding Fixed Desk plans) when the desk
// still has capacity for that time slot; otherwise leave pending for
// manual admin review.
exports.autoApproveDeskBooking = onDocumentCreated(
    "bookings/{bookingId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return null;
      const booking = snap.data();
      const bookingId = event.params.bookingId;

      if (booking.status === "approved") {
        await notifyBookingApproved(booking, bookingId);
        return null;
      }
      if (booking.status !== "pending") return null;

      try {
        const amenityDoc = await db.collection("amenities")
            .doc(booking.amenityId).get();
        const amenity = amenityDoc.exists ? amenityDoc.data() : null;

        if (amenity && amenity.type === "desk" &&
            booking.planType !== "fixed-desk") {
          const {hasConflicts} = await computeBookingAvailability({
            amenityId: booking.amenityId,
            amenity,
            startTime: booking.startTime.toDate().toISOString(),
            endTime: booking.endTime.toDate().toISOString(),
            excludeBookingId: bookingId,
          });

          if (!hasConflicts) {
            await snap.ref.update({
              status: "approved",
              updatedAt: new Date().toISOString(),
            });
            return null;
          }
        }

        await notifyPendingBookingReview(booking, bookingId);
        return null;
      } catch (error) {
        console.error("Error auto-approving desk booking:", error);
        return null;
      }
    });

// Notify members when an existing booking becomes approved. Fixed-desk plan
// bookings share a deterministic notification document, so bulk approval is
// represented by one message rather than one per working day.
exports.notifyBookingApproval = onDocumentUpdated(
    "bookings/{bookingId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();

      if (before.status === after.status || after.status !== "approved") {
        return null;
      }

      try {
        await notifyBookingApproved(after, event.params.bookingId);
        return null;
      } catch (error) {
        console.error("Error notifying booking approval:", error);
        return null;
      }
    });

// Notify admins when a member submits a new event for review.
exports.notifyEventPendingReview = onDocumentCreated(
    "events/{eventId}",
    async (event) => {
      const snap = event.data;
      if (!snap) return null;
      const eventData = snap.data();
      if (eventData.status !== "pending") return null;

      try {
        const organizerName = eventData.organizerDisplayName ||
          await getMemberName(eventData.organizerId);
        await notifyAdmins("event_pending_review", event.params.eventId, {
          eventId: event.params.eventId,
          eventTitle: eventData.title || eventData.name || "",
          organizerName,
          link: "/admin/events",
        });
        return null;
      } catch (error) {
        console.error("Error notifying event review:", error);
        return null;
      }
    });

// Update event capacity when attendees change
exports.updateEventCapacity = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();

      // Check if attendees array changed
      if (JSON.stringify(before.attendees) !==
          JSON.stringify(after.attendees)) {
        const currentAttendees = (after.attendees &&
            after.attendees.length) || 0;
        const capacity = after.capacity;

        if (capacity && currentAttendees >= capacity) {
          console.log(`Event ${event.params.eventId} is now full`);
        }
      }

      return null;
    });

// Clean up old completed bookings
exports.cleanupOldBookings = onSchedule(
    "every 24 hours",
    async () => {
      try {
        const thirtyDaysAgo = Timestamp.fromMillis(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
        );

        const oldBookings = await db.collection("bookings")
            .where("status", "==", "completed")
            .where("endTime", "<=", thirtyDaysAgo)
            .limit(100)
            .get();

        let count = 0;

        oldBookings.forEach((doc) => {
          // Optionally delete or archive old bookings
          console.log(`Old booking found: ${doc.id}`);
          count++;
        });

        console.log(`Found ${count} old bookings to clean up`);
        return null;
      } catch (error) {
        console.error("Error cleaning up old bookings:", error);
        return null;
      }
    });

// Generate a one-time nonce for wallet authentication
exports.generateWalletNonce = onCall(
    async (request) => {
      const {address, chain} = request.data;

      if (!address || typeof address !== "string") {
        throw new HttpsError(
            "invalid-argument",
            "Address is required",
        );
      }
      if (!chain || !["ethereum", "solana"].includes(chain)) {
        throw new HttpsError(
            "invalid-argument",
            "Chain must be ethereum or solana",
        );
      }

      const ethAddressRegex = /^0x[0-9a-fA-F]{40}$/;
      const solAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (chain === "ethereum" && !ethAddressRegex.test(address)) {
        throw new HttpsError(
            "invalid-argument",
            "Invalid Ethereum address format",
        );
      }
      if (chain === "solana" && !solAddressRegex.test(address)) {
        throw new HttpsError(
            "invalid-argument",
            "Invalid Solana address format",
        );
      }

      const nonce = crypto.randomBytes(32).toString("hex");
      const now = Date.now();
      const expiresAt = now + 5 * 60 * 1000;

      await db.collection("nonces").doc(address).set({
        nonce,
        createdAt: now,
        expiresAt,
      });

      return {nonce};
    },
);

// Verify wallet signature and return a Firebase custom token
exports.verifyWalletSignature = onCall(
    async (request) => {
      const {address, signature, chain} = request.data;

      if (!address || !signature || !chain) {
        throw new HttpsError(
            "invalid-argument",
            "address, signature, and chain are required",
        );
      }

      const nonceRef = db.collection("nonces").doc(address);
      let nonce;

      await db.runTransaction(async (tx) => {
        const nonceDoc = await tx.get(nonceRef);

        if (!nonceDoc.exists) {
          throw new HttpsError(
              "not-found",
              "Nonce not found. Please try again.",
          );
        }

        const {nonce: storedNonce, expiresAt} = nonceDoc.data();

        if (Date.now() > expiresAt) {
          tx.delete(nonceRef);
          throw new HttpsError(
              "deadline-exceeded",
              "Nonce expired. Please try again.",
          );
        }

        // Atomically consume the nonce to prevent replay attacks
        tx.delete(nonceRef);
        nonce = storedNonce;
      });

      const message = `Sign in to Da Nang Blockchain Hub\nNonce: ${nonce}`;
      let uid;

      if (chain === "ethereum") {
        let recoveredAddress;
        try {
          recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (err) {
          throw new HttpsError(
              "invalid-argument",
              "Invalid signature",
          );
        }
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          throw new HttpsError(
              "permission-denied",
              "Signature verification failed",
          );
        }
        uid = `eth_${address.toLowerCase()}`;
      } else if (chain === "solana") {
        try {
          const msgBytes = Buffer.from(message, "utf8");
          const sigBytes = Buffer.from(signature, "hex");
          const pubkeyBytes = bs58.decode(address);
          const valid = nacl.sign.detached.verify(
              msgBytes, sigBytes, pubkeyBytes,
          );
          if (!valid) {
            throw new HttpsError(
                "permission-denied",
                "Signature verification failed",
            );
          }
        } catch (err) {
          if (err instanceof HttpsError) throw err;
          throw new HttpsError(
              "invalid-argument",
              "Invalid signature",
          );
        }
        uid = `sol_${address}`;
      }

      const token = await getAuth().createCustomToken(uid);
      return {token};
    },
);

// Auto-promote from waitlist when spots open
exports.autoPromoteWaitlist = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();

      // Check if attendees decreased (someone unregistered)
      const beforeAttendees =
        (before.attendees && before.attendees.length) || 0;
      const afterAttendees =
        (after.attendees && after.attendees.length) || 0;
      const capacity = after.capacity;
      const waitlist = after.waitlist || [];

      // If someone left and there's space and waitlist members
      if (
        beforeAttendees > afterAttendees &&
        capacity &&
        afterAttendees < capacity &&
        waitlist.length > 0
      ) {
        try {
          const availableSpots = capacity - afterAttendees;
          const toPromote = Math.min(availableSpots, waitlist.length);
          const promoted = waitlist.slice(0, toPromote);
          const remaining = waitlist.slice(toPromote);

          await db.collection("events").doc(event.params.eventId).update({
            attendees: FieldValue.arrayUnion(...promoted),
            waitlist: remaining,
          });

          // TODO: Notify promoted members
          console.log(
              `Auto-promoted ${toPromote} member(s) from waitlist ` +
              `for event ${event.params.eventId}`,
          );

          return null;
        } catch (error) {
          console.error("Error auto-promoting waitlist:", error);
          return null;
        }
      }

      return null;
    });
