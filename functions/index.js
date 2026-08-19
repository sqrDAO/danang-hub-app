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
const {getMessaging} = require("firebase-admin/messaging");
const crypto = require("crypto");
const {ethers} = require("ethers");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const nodemailer = require("nodemailer");
const {
  getRevision, normalizeEditPayload, getBookingWindow,
  getNotificationSubjectId, getEventSpaceValidationError,
} = require("./eventLifecycle");
const {rangeOverlapsClosure} = require("./hubClosures");
const {getCancellationNotice} = require("./bookingNotifications");

initializeApp();

const db = getFirestore();

// Region for all deployed Cloud Functions. Pinned to us-central1 until the
// deploying service account is granted roles/cloudfunctions.admin (required
// to set the public invoker IAM policy in other regions).
const REGION = "us-central1";
setGlobalOptions({region: REGION});

// Transporter is created fresh each call so Secret Manager values
// (injected into process.env at runtime) are always current.
/**
 * Creates a Nodemailer SMTP transporter from environment config.
 * @return {object} Nodemailer transporter instance
 */
function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_SMTP_HOST,
    port: parseInt(process.env.EMAIL_SMTP_PORT || "465"),
    secure: process.env.EMAIL_SMTP_SECURE !== "false",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

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

      // Closures shut the whole Hub, so they are checked before any
      // per-amenity availability and regardless of amenity type. Kept outside
      // the try: its catch rewrites every error to "internal", which would
      // hide the reason the booking was refused.
      const closure = rangeOverlapsClosure(startTime, endTime);
      if (closure) {
        throw new HttpsError(
            "invalid-argument",
            `The Hub is closed ${closure.start} to ${closure.end} ` +
            `(${closure.label}).`,
        );
      }

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

const getEventError = (error) => {
  if (error instanceof HttpsError) return error;
  console.error("Event lifecycle error:", error);
  return new HttpsError(
      "invalid-argument", error.message || "Invalid event request.");
};

const requireAdmin = async (uid) => {
  const member = await db.collection("members").doc(uid).get();
  if (!member.exists || member.data().membershipType !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
};

const getActiveEventBookings = (snapshot) => snapshot.docs.filter((doc) => {
  const status = doc.data().status;
  return status === "pending" || status === "approved" ||
      status === "checked-in";
});

// Organizer content writes go through this callable so the status transition,
// revision check, and linked Event Hall cleanup are one server-authorized
// action.
exports.editOwnEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }

  const {eventId, expectedRevision, data} = request.data || {};
  if (typeof eventId !== "string" || !eventId) {
    throw new HttpsError("invalid-argument", "eventId is required.");
  }

  try {
    return await db.runTransaction(async (tx) => {
      const eventRef = db.collection("events").doc(eventId);
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) {
        throw new HttpsError("not-found", "Event not found.");
      }

      const event = eventSnap.data();
      if (event.organizerId !== request.auth.uid) {
        throw new HttpsError(
            "permission-denied", "Only the organizer can edit this event.");
      }
      const revision = getRevision(event);
      if (expectedRevision !== revision) {
        throw new HttpsError(
            "aborted", "This event changed. Refresh and try again.");
      }

      const normalized = normalizeEditPayload(data, event, new Date());
      const resubmitted = event.status === "approved" ||
          event.status === "rejected";
      const update = {
        ...normalized,
        date: Timestamp.fromDate(normalized.date),
        revision: revision + 1,
        updatedAt: new Date().toISOString(),
      };

      if (resubmitted) {
        update.status = "pending";
        update.resubmittedAt = new Date().toISOString();
        update.resubmittedFromStatus = event.status;
        update.approvedAt = FieldValue.delete();
        update.approvedRevision = FieldValue.delete();
        update.rejectedAt = FieldValue.delete();
        update.rejectionReason = FieldValue.delete();
      }
      if (event.status === "approved") update.everApproved = true;

      if (event.status === "approved") {
        const bookingQuery = db.collection("bookings")
            .where("eventId", "==", eventId);
        const bookingSnapshot = await tx.get(bookingQuery);
        getActiveEventBookings(bookingSnapshot).forEach((booking) => {
          tx.update(booking.ref, {
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          });
        });
        update.linkedAmenityId = FieldValue.delete();
        update.linkedAmenityStartTime = FieldValue.delete();
        update.linkedAmenityEndTime = FieldValue.delete();
      }

      tx.update(eventRef, update);
      return {
        eventId,
        status: update.status || event.status,
        revision: revision + 1,
        resubmitted,
      };
    });
  } catch (error) {
    throw getEventError(error);
  }
});

// Approval/rejection is a server-side transaction so Event Hall bookings cannot
// be best-effort follow-up writes after the event status has changed.
exports.reviewEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be authenticated.");
  }
  const {eventId, expectedRevision, action, reason = ""} = request.data || {};
  if (typeof eventId !== "string" || !eventId ||
      !["approved", "rejected"].includes(action)) {
    throw new HttpsError(
        "invalid-argument", "A valid event review is required.");
  }

  try {
    await requireAdmin(request.auth.uid);
    const eventRef = db.collection("events").doc(eventId);
    const initial = await eventRef.get();
    if (!initial.exists) {
      throw new HttpsError("not-found", "Event not found.");
    }
    const initialData = initial.data();
    const initialRevision = getRevision(initialData);
    if (expectedRevision !== initialRevision) {
      throw new HttpsError(
          "aborted", "This event changed. Refresh and try again.");
    }

    if (action === "approved" && initialData.requestedAmenityId) {
      const initialDate = initialData.date.toDate();
      const window = getBookingWindow(
          initialDate, initialData.duration || 60);
      const amenitySnap = await db.collection("amenities")
          .doc(initialData.requestedAmenityId).get();
      if (!amenitySnap.exists) {
        throw new HttpsError(
            "failed-precondition", "Requested amenity no longer exists.");
      }
      const amenity = amenitySnap.data();
      const eventSpaceError = getEventSpaceValidationError({
        eventDate: initialDate,
        duration: initialData.duration || 60,
        amenity,
      });
      if (eventSpaceError) {
        throw new HttpsError("failed-precondition", eventSpaceError);
      }
      const availability = await computeBookingAvailability({
        amenityId: initialData.requestedAmenityId,
        amenity,
        startTime: window.startTime.toISOString(),
        endTime: window.endTime.toISOString(),
      });
      if (availability.hasConflicts) {
        throw new HttpsError(
            "failed-precondition",
            "The requested Event Hall time is no longer available.");
      }
    }

    return await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (!eventSnap.exists) {
        throw new HttpsError("not-found", "Event not found.");
      }
      const event = eventSnap.data();
      const revision = getRevision(event);
      if (revision !== expectedRevision) {
        throw new HttpsError(
            "aborted", "This event changed. Refresh and try again.");
      }

      const eventDate = event.date.toDate();
      if (eventDate <= new Date()) {
        throw new HttpsError(
            "failed-precondition", "Past events cannot be reviewed.");
      }
      if (action === "approved" && event.status !== "pending") {
        throw new HttpsError(
            "failed-precondition", "Only pending events can be approved.");
      }
      if (action === "rejected" &&
          !["pending", "approved"].includes(event.status)) {
        throw new HttpsError(
            "failed-precondition", "This event cannot be rejected.");
      }

      const bookingQuery = db.collection("bookings")
          .where("eventId", "==", eventId);
      const bookingSnapshot = await tx.get(bookingQuery);
      const activeBookings = getActiveEventBookings(bookingSnapshot);
      const update = {status: action, updatedAt: new Date().toISOString()};

      if (action === "approved") {
        update.approvedAt = new Date().toISOString();
        update.approvedRevision = revision;
        update.everApproved = true;
        update.rejectedAt = FieldValue.delete();
        update.rejectionReason = FieldValue.delete();
        if (event.requestedAmenityId) {
          const window = getBookingWindow(eventDate, event.duration || 60);
          const existing = activeBookings[0];
          if (!existing) {
            const bookingRef = db.collection("bookings").doc();
            tx.create(bookingRef, {
              memberId: event.organizerId,
              amenityId: event.requestedAmenityId,
              startTime: Timestamp.fromDate(window.startTime),
              endTime: Timestamp.fromDate(window.endTime),
              eventId,
              status: "approved",
              createdAt: new Date().toISOString(),
            });
          }
          update.linkedAmenityId = event.requestedAmenityId;
          update.linkedAmenityStartTime = window.startTime.toISOString();
          update.linkedAmenityEndTime = window.endTime.toISOString();
        }
      } else {
        getActiveEventBookings(bookingSnapshot).forEach((booking) => {
          tx.update(booking.ref, {
            status: "cancelled",
            updatedAt: new Date().toISOString(),
          });
        });
        update.rejectionReason = typeof reason === "string" ?
          reason.trim() : "";
        update.rejectedAt = new Date().toISOString();
        update.linkedAmenityId = FieldValue.delete();
        update.linkedAmenityStartTime = FieldValue.delete();
        update.linkedAmenityEndTime = FieldValue.delete();
      }
      tx.update(eventRef, update);
      return {eventId, status: action, revision};
    });
  } catch (error) {
    throw getEventError(error);
  }
});

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

      const closure = rangeOverlapsClosure(startTime, endTime);
      if (closure) {
        return {
          available: false,
          error: `The Hub is closed ${closure.start} to ${closure.end} ` +
            `(${closure.label}).`,
        };
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

// Statuses that occupy a slot on the booking calendar.
const OCCUPYING_STATUSES = ["pending", "approved", "checked-in"];

// The calendar pads its visible week by -7/+15 days; anything beyond a
// couple of months is a scrape, not a calendar.
const MAX_RANGE_WINDOW_DAYS = 60;
const MAX_RANGE_WINDOW_MS = MAX_RANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * @param {*} value Firestore Timestamp or date-like value
 * @return {string} ISO-8601 string
 */
function toIsoString(value) {
  const date = value && typeof value.toDate === "function" ?
    value.toDate() : new Date(value);
  return date.toISOString();
}

// Occupancy for the booking calendar, stripped of who booked what.
//
// Members cannot run this query themselves: firestore.rules scopes their
// booking reads to their own documents, and rules are evaluated against the
// query rather than its results, so an amenity-scoped list is denied outright.
// The calendar needs other members' busy ranges to grey out taken slots, so it
// reads them here — start, end, and status only, never memberId or booking id.
exports.getAmenityBookingRanges = onCall(
    async (request) => {
      if (!request.auth) {
        throw new HttpsError(
            "unauthenticated",
            "User must be authenticated",
        );
      }

      const {amenityId, startTime, endTime} = request.data || {};

      if (typeof amenityId !== "string" || !amenityId) {
        throw new HttpsError("invalid-argument", "amenityId is required");
      }

      const windowStart = new Date(startTime);
      const windowEnd = new Date(endTime);

      if (isNaN(windowStart.getTime()) || isNaN(windowEnd.getTime())) {
        throw new HttpsError(
            "invalid-argument",
            "startTime and endTime must be valid dates",
        );
      }
      if (windowEnd <= windowStart) {
        throw new HttpsError(
            "invalid-argument",
            "endTime must be after startTime",
        );
      }
      if (windowEnd - windowStart > MAX_RANGE_WINDOW_MS) {
        throw new HttpsError(
            "invalid-argument",
            `Requested window exceeds ${MAX_RANGE_WINDOW_DAYS} days`,
        );
      }

      try {
        // Filters on startTime, matching the query the client used to run:
        // a booking starting just before the window is covered by the
        // calendar's own -7 day padding.
        const snapshot = await db.collection("bookings")
            .where("amenityId", "==", amenityId)
            .where("status", "in", OCCUPYING_STATUSES)
            .where("startTime", ">=", Timestamp.fromDate(windowStart))
            .where("startTime", "<=", Timestamp.fromDate(windowEnd))
            .get();

        const ranges = [];
        snapshot.forEach((doc) => {
          const booking = doc.data();
          ranges.push({
            startTime: toIsoString(booking.startTime),
            endTime: toIsoString(booking.endTime),
            status: booking.status,
          });
        });

        return {ranges};
      } catch (error) {
        console.error("Error loading amenity booking ranges:", error);
        throw new HttpsError(
            "internal",
            "Error loading availability",
        );
      }
    },
);

// Firestore doc ids used for notifications/push markers must be path-safe.
// Matches booking planGroupId rules (letters, digits, _-, length-capped).
const SAFE_DOC_ID_PART = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * @param {*} value Candidate document-id segment
 * @return {boolean} True when value is safe to embed in a Firestore doc path
 */
function isSafeDocIdPart(value) {
  return typeof value === "string" && SAFE_DOC_ID_PART.test(value);
}

/**
 * Coerces a subject id into a path-safe document-id segment.
 * @param {*} subjectId Event, booking, or plan identifier
 * @param {string} [fallback="default"] Used when subjectId is unsafe
 * @return {string} Safe subject id segment
 */
function toSafeSubjectId(subjectId, fallback = "default") {
  if (isSafeDocIdPart(subjectId)) return subjectId;
  console.error("Unsafe notification subject id; using fallback", {
    subjectId: String(subjectId || "").slice(0, 200),
    fallback,
  });
  return isSafeDocIdPart(fallback) ? fallback : "default";
}

/**
 * Stores a notification only if the deterministic document is absent.
 * @param {string} userId Notification recipient uid
 * @param {string} type Notification type
 * @param {string} subjectId Event, booking, or plan identifier
 * @param {Object} data Notification payload
 * @return {Promise<boolean>} True when a new notification was created
 */
async function createNotificationIfAbsent(userId, type, subjectId, data) {
  const safeSubjectId = toSafeSubjectId(subjectId);
  const notificationId = `${type}_${userId}_${safeSubjectId}`;
  try {
    await db.collection("notifications").doc(notificationId).create({
      ...data,
      userId,
      type,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
    return false;
  }
  return true;
}

/**
 * Writes a notification, re-surfacing it as unread if it already exists.
 *
 * Deliberately not createNotificationIfAbsent: that uses .create() and swallows
 * ALREADY_EXISTS, which is right for a once-per-subject event like approval but
 * wrong for cancellation. A fixed-desk plan can be cancelled in more than one
 * batch — three closure days now, the remaining days later — and the second
 * batch must still reach the member. Sharing the subject id keeps one batch
 * collapsed to a single message; the overwrite keeps later batches audible.
 * @param {string} userId Recipient member id
 * @param {string} type Notification type
 * @param {string} subjectId Booking or plan identifier
 * @param {Object} data Notification payload
 * @return {Promise<void>}
 */
async function upsertNotification(userId, type, subjectId, data) {
  const safeSubjectId = toSafeSubjectId(subjectId);
  const notificationId = `${type}_${userId}_${safeSubjectId}`;
  await db.collection("notifications").doc(notificationId).set({
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
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} [adminDocs]
 * Previously fetched admin documents
 * @return {Promise<Array<boolean>>}
 */
async function notifyAdmins(type, subjectId, data, adminDocs) {
  const admins = adminDocs || (await db.collection("members")
      .where("membershipType", "==", "admin").get()).docs;
  const writes = admins.map((admin) =>
    createNotificationIfAbsent(admin.id, type, subjectId, data),
  );
  return Promise.all(writes);
}

/**
 * @param {Object} member Member Firestore document data
 * @return {boolean} True if the member opted into push notifications
 */
function hasPushEnabled(member) {
  return Boolean(
      member &&
      member.preferences &&
      member.preferences.pushNotifications === true,
  );
}

/**
 * @param {string} memberId Member document id
 * @param {Object} member Member Firestore document data
 * @return {Promise<string>} Stored browser push token, if available
 */
async function getPushToken(memberId, member) {
  if (!hasPushEnabled(member)) return "";

  const tokenDoc = await db.collection("push_tokens").doc(memberId).get();
  if (!tokenDoc.exists) return "";

  const tokenData = tokenDoc.data();
  return tokenData && tokenData.token ? tokenData.token : "";
}

const PUSH_MARKER_TTL_DAYS = 90;
const PUSH_MARKER_TTL_MS = PUSH_MARKER_TTL_DAYS * 24 * 60 * 60 * 1000;
const PUSH_MARKER_PENDING_MS = 10 * 60 * 1000;

/**
 * @param {string} recipientId Member document id
 * @param {string} type Notification type
 * @param {string} subjectId Stable booking or plan identifier
 * @return {FirebaseFirestore.DocumentReference}
 */
function getPushMarkerRef(recipientId, type, subjectId) {
  const safeSubjectId = toSafeSubjectId(subjectId, "default");
  const markerId = `${type}_${recipientId}_${safeSubjectId}`;
  return db.collection("push_notifications").doc(markerId);
}

/**
 * @param {string} recipientId Member document id
 * @param {string} type Notification type
 * @param {string} subjectId Stable booking or plan identifier
 * @return {Promise<boolean>} True when this execution reserved the push send
 */
async function reservePushRecipient(recipientId, type, subjectId) {
  const markerRef = getPushMarkerRef(recipientId, type, subjectId);
  let reserved = false;
  await db.runTransaction(async (transaction) => {
    // Firestore may rerun this callback after contention.
    reserved = false;
    const markerDoc = await transaction.get(markerRef);
    const now = Date.now();

    if (markerDoc.exists) {
      const marker = markerDoc.data();
      const pendingUntil = marker && marker.pendingUntil ?
        marker.pendingUntil.toMillis() :
        0;
      if (marker.status !== "pending" || pendingUntil > now) {
        return;
      }
    }

    transaction.set(markerRef, {
      recipientId,
      type,
      subjectId: subjectId || "",
      status: "pending",
      createdAt: markerDoc.exists ?
        markerDoc.data().createdAt || FieldValue.serverTimestamp() :
        FieldValue.serverTimestamp(),
      pendingUntil: Timestamp.fromMillis(now + PUSH_MARKER_PENDING_MS),
      expiresAt: Timestamp.fromMillis(now + PUSH_MARKER_TTL_MS),
    }, {merge: true});
    reserved = true;
  });
  return reserved;
}

/**
 * @param {Error} error Firestore write error
 * @return {boolean} True when a dedupe marker already exists
 */
function isAlreadyExistsError(error) {
  return error && (
    error.code === 6 ||
    error.code === "already-exists" ||
    String(error.message || "").includes("ALREADY_EXISTS")
  );
}

/**
 * Marks a reserved dedupe marker after a push recipient was sent successfully.
 * @param {string} recipientId Member document id
 * @param {string} type Notification type
 * @param {string} subjectId Stable booking or plan identifier
 * @return {Promise<boolean>} True if the marker was created
 */
async function markPushRecipient(recipientId, type, subjectId) {
  const markerRef = getPushMarkerRef(recipientId, type, subjectId);
  await markerRef.set({
    recipientId,
    type,
    subjectId: subjectId || "",
    status: "sent",
    sentAt: FieldValue.serverTimestamp(),
    pendingUntil: FieldValue.delete(),
    expiresAt: Timestamp.fromMillis(Date.now() + PUSH_MARKER_TTL_MS),
  }, {merge: true});
  return true;
}

/**
 * Releases a reserved marker so failed sends can retry later.
 * @param {string} recipientId Member document id
 * @param {string} type Notification type
 * @param {string} subjectId Stable booking or plan identifier
 * @return {Promise<void>}
 */
async function releasePushRecipient(recipientId, type, subjectId) {
  await getPushMarkerRef(recipientId, type, subjectId).delete();
}

/**
 * @param {Error} error FCM per-token send error
 * @return {boolean} True when retrying this token cannot recover
 */
function isUnrecoverablePushTokenError(error) {
  const code = String(error && error.code ? error.code : "");
  const message = String(error && error.message ? error.message : "");
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token" ||
    message.includes("NOT_REGISTERED") ||
    message.includes("registration-token-not-registered") ||
    message.includes("invalid-registration-token")
  );
}

/**
 * @param {string} recipientId Member document id
 * @param {string} failedToken Token rejected by FCM
 * @return {Promise<void>}
 */
async function deleteStalePushToken(recipientId, failedToken) {
  const tokenRef = db.collection("push_tokens").doc(recipientId);
  const tokenDoc = await tokenRef.get();
  if (!tokenDoc.exists) return;

  const tokenData = tokenDoc.data();
  if (tokenData && tokenData.token === failedToken) {
    await tokenRef.delete();
    await db.collection("members").doc(recipientId).update({
      "preferences.pushNotifications": false,
    });
  }
}

// Push copy is localized per recipient. i18n lives in the browser
// (localStorage + react-i18next), which functions cannot read, so the member
// doc carries a `locale` mirror written by the language switcher.
const DEFAULT_PUSH_LOCALE = "en";
const SUPPORTED_PUSH_LOCALES = ["en", "vi"];

/**
 * Resolves a member's push locale, falling back to English for missing or
 * unrecognized values.
 * @param {Object} member Member document data
 * @return {string} A locale from SUPPORTED_PUSH_LOCALES
 */
function resolvePushLocale(member) {
  const raw = member && (member.locale ||
    (member.preferences && member.preferences.locale));
  if (typeof raw !== "string") return DEFAULT_PUSH_LOCALE;
  const normalized = raw.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_PUSH_LOCALES.includes(normalized) ?
    normalized :
    DEFAULT_PUSH_LOCALE;
}

/**
 * Picks the message for a locale, falling back to English.
 * @param {Object} messages Locale-keyed {title, body} map
 * @param {string} locale Resolved recipient locale
 * @return {Object} {title, body}
 */
function pickPushMessage(messages, locale) {
  const safe = messages || {};
  return safe[locale] || safe[DEFAULT_PUSH_LOCALE] || {};
}

const DEFAULT_APP_URL = "https://app.danangblockchainhub.com";

/**
 * Resolves APP_URL (or default) to origin for absolute push asset URLs.
 * Uses origin only so a path on APP_URL cannot break `/assets/...` resolution.
 * Malformed env must not throw — that would fail the whole multicast batch.
 * @return {string} Absolute origin URL (no trailing path)
 */
function resolvePushAppUrl() {
  const raw = process.env.APP_URL || DEFAULT_APP_URL;
  try {
    return new URL(raw).origin;
  } catch (error) {
    console.warn("Invalid APP_URL for push; using default", {raw});
    return DEFAULT_APP_URL;
  }
}

/**
 * Absolute URL under the push app base; falls back to base on bad paths.
 * @param {string} appUrl Resolved app base
 * @param {string} path Relative or absolute path
 * @return {string}
 */
function absolutePushUrl(appUrl, path) {
  try {
    return new URL(path || "/", appUrl).href;
  } catch (error) {
    console.warn("Invalid push URL path; using app base", {path});
    return appUrl;
  }
}

/**
 * Builds web-display fields so Chrome does not fall back to its default
 * "site updated in the background" shell when the SW cannot show custom UI.
 * @param {Object} data FCM data payload (title/body/link/tag as strings)
 * @return {Object} webpush config for sendEachForMulticast
 */
function buildWebPushConfig(data) {
  const appUrl = resolvePushAppUrl();
  const title = data.title || "Da Nang Blockchain Hub";
  const body = data.body || "";
  return {
    notification: {
      title,
      body,
      icon: absolutePushUrl(
          appUrl, "/assets/favicon/android-chrome-192x192.png"),
      badge: absolutePushUrl(appUrl, "/assets/favicon/favicon-32x32.png"),
      tag: data.tag || undefined,
      renotify: true,
    },
  };
}

/**
 * Sends one push payload and reconciles successful sends / dead tokens.
 * @param {Array<Object>} recipients Push recipients
 * @param {Object} data FCM data payload
 * @return {Promise<Array>}
 */
async function sendPushToRecipients(recipients, data) {
  if (!recipients.length) return [];

  const messaging = getMessaging();
  const results = [];
  const batchSize = 500;
  const webpush = buildWebPushConfig(data);

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batchRecipients = recipients.slice(i, i + batchSize);
    let response;
    try {
      response = await messaging.sendEachForMulticast({
        tokens: batchRecipients.map((recipient) => recipient.token),
        data,
        webpush,
      });
    } catch (error) {
      await Promise.all(batchRecipients.map((recipient) =>
        releasePushRecipient(
            recipient.memberId,
            recipient.type,
            recipient.subjectId,
        ),
      ));
      throw error;
    }
    results.push(response);

    const followUps = response.responses.map((sendResult, index) => {
      const recipient = batchRecipients[index];
      if (sendResult.success) {
        return markPushRecipient(
            recipient.memberId,
            recipient.type,
            recipient.subjectId,
        );
      }
      if (isUnrecoverablePushTokenError(sendResult.error)) {
        return Promise.all([
          deleteStalePushToken(recipient.memberId, recipient.token),
          releasePushRecipient(
              recipient.memberId,
              recipient.type,
              recipient.subjectId,
          ),
        ]);
      }
      return releasePushRecipient(
          recipient.memberId,
          recipient.type,
          recipient.subjectId,
      );
    });
    await Promise.all(followUps);
  }

  return results;
}

/**
 * Sends a push payload to member docs that have opted in.
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} docs Member docs
 * @param {Object} payload Notification payload
 * @return {Promise<Array>}
 */
async function sendPushToMembers(docs, payload) {
  const type = payload.type || "notification";
  const subjectId = payload.subjectId || "";

  const recipients = (await Promise.all(docs.map(async (doc) => {
    const member = doc.data();
    const pushToken = await getPushToken(doc.id, member);
    if (!pushToken) {
      return null;
    }
    // Fixed-desk plans generate one booking doc per working day. Use a
    // recipient/subject marker so push follows the same grouped behavior as
    // the in-app notification id.
    const shouldSend = await reservePushRecipient(
        doc.id,
        type,
        subjectId,
    );
    if (shouldSend) {
      return {
        memberId: doc.id,
        token: pushToken,
        type,
        subjectId,
        locale: resolvePushLocale(member),
      };
    }
    return null;
  }))).filter(Boolean);

  if (!recipients.length) return [];

  const baseData = {
    link: String(payload.link || "/"),
    type: String(type),
    subjectId: String(subjectId),
    tag: String(payload.tag ||
      `${type}-${subjectId || "default"}`),
  };

  // sendEachForMulticast carries one data payload for the whole batch, so
  // recipients are grouped by locale and each group sent with its own copy.
  const byLocale = new Map();
  recipients.forEach((recipient) => {
    const group = byLocale.get(recipient.locale) || [];
    group.push(recipient);
    byLocale.set(recipient.locale, group);
  });

  const results = [];
  for (const [locale, group] of byLocale) {
    const message = pickPushMessage(payload.messages, locale);
    const data = {
      ...baseData,
      title: String(message.title || payload.title || ""),
      body: String(message.body || payload.body || ""),
    };
    results.push(...await sendPushToRecipients(group, data));
  }
  return results;
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
  const planGroupId = booking && booking.planGroupId;
  if (isSafeDocIdPart(planGroupId)) return planGroupId;
  if (planGroupId) {
    console.error("Unsafe planGroupId on booking; falling back to bookingId", {
      bookingId,
      planGroupId: String(planGroupId).slice(0, 200),
    });
  }
  return bookingId;
}

/**
 * Sends browser push to opted-in admins (booking/event review, etc.).
 * @param {string} subjectId Stable subject identifier for dedupe markers
 * @param {Object} payload Push payload
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} [adminDocs]
 * Previously fetched admin documents
 * @return {Promise<Array>}
 */
async function notifyAdminsPush(subjectId, payload, adminDocs) {
  const admins = adminDocs || (await db.collection("members")
      .where("membershipType", "==", "admin").get()).docs;
  return sendPushToMembers(admins, {
    ...payload,
    subjectId,
  });
}

/**
 * Sends browser push to one opted-in member (booking/event status, etc.).
 * @param {string} memberId Member document id
 * @param {Object} payload Push payload
 * @param {FirebaseFirestore.DocumentSnapshot} [memberDocSnap] Optional
 *   pre-fetched members/{memberId} snap to avoid a second read
 * @return {Promise<Array>}
 */
async function notifyMemberPush(memberId, payload, memberDocSnap = null) {
  const memberDoc = memberDocSnap ||
      await db.collection("members").doc(memberId).get();
  if (!memberDoc.exists) return [];
  return sendPushToMembers([memberDoc], payload);
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {Promise<void>}
 */
async function notifyPendingBookingReview(booking, bookingId) {
  const [amenityName, memberName, admins] = await Promise.all([
    getAmenityName(booking.amenityId),
    getMemberName(booking.memberId),
    db.collection("members").where("membershipType", "==", "admin").get(),
  ]);
  const subjectId = getBookingSubjectId(booking, bookingId);
  await notifyAdmins("booking_pending_review", subjectId, {
    bookingId,
    amenityName,
    memberName,
    planType: booking.planType || "standard",
    link: "/admin/bookings",
  }, admins.docs);
  const isFixedDesk = booking.planType === "fixed-desk";
  const requesterName = memberName || "A member";
  const requesterNameVi = memberName || "Một thành viên";
  const reviewBodyEn = isFixedDesk ?
    `${requesterName} requested a fixed desk plan for "${amenityName}".` :
    `${requesterName} requested "${amenityName}".`;
  const reviewBodyVi = isFixedDesk ?
    `${requesterNameVi} đã yêu cầu gói bàn cố định cho "${amenityName}".` :
    `${requesterNameVi} đã yêu cầu "${amenityName}".`;
  try {
    await notifyAdminsPush(subjectId, {
      messages: {
        en: {title: "Booking needs review", body: reviewBodyEn},
        vi: {title: "Đặt chỗ cần duyệt", body: reviewBodyVi},
      },
      link: "/admin/bookings",
      type: "booking_pending_review",
    }, admins.docs);
  } catch (error) {
    console.error("Error sending booking review push:", error);
  }
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {Promise<void>}
 */
async function notifyBookingApproved(booking, bookingId) {
  const amenityName = await getAmenityName(booking.amenityId);
  const subjectId = getBookingSubjectId(booking, bookingId);
  await createNotificationIfAbsent(
      booking.memberId,
      "booking_approved",
      subjectId,
      {
        bookingId,
        amenityName,
        planType: booking.planType || "standard",
        link: "/member/bookings",
      },
  );
  try {
    const isFixedDesk = booking.planType === "fixed-desk";
    await notifyMemberPush(booking.memberId, {
      messages: {
        en: {
          title: "Booking approved",
          body: isFixedDesk ?
            `Your fixed desk plan for "${amenityName}" has been approved.` :
            `Your booking for "${amenityName}" has been approved.`,
        },
        vi: {
          title: "Đặt chỗ đã được duyệt",
          body: isFixedDesk ?
            `Gói bàn cố định cho "${amenityName}" đã được duyệt.` :
            `Đặt chỗ "${amenityName}" của bạn đã được duyệt.`,
        },
      },
      link: "/member/bookings",
      type: "booking_approved",
      subjectId,
    });
  } catch (error) {
    console.error("Error sending booking approval push:", error);
  }
}

/**
 * Push copy for a cancellation, in both locales.
 * @param {string} amenityName Resolved amenity name
 * @param {Object} notice Result of getCancellationNotice
 * @return {Object} {en, vi} title/body pair
 */
function getCancellationPushMessages(amenityName, notice) {
  const key = `${notice.isFixedDesk ? "plan" : "booking"}` +
    `${notice.isHubClosure ? "Closure" : ""}`;
  const bodies = {
    booking: {
      en: `Your booking for "${amenityName}" has been cancelled.`,
      vi: `Đặt chỗ "${amenityName}" của bạn đã bị huỷ.`,
    },
    bookingClosure: {
      en: `Your booking for "${amenityName}" has been cancelled — ` +
        "the Hub is closed on that date.",
      vi: `Đặt chỗ "${amenityName}" của bạn đã bị huỷ — ` +
        "Hub đóng cửa vào ngày đó.",
    },
    plan: {
      en: `Some days of your fixed desk plan for "${amenityName}" ` +
        "have been cancelled.",
      vi: `Một số ngày trong gói bàn cố định cho "${amenityName}" ` +
        "đã bị huỷ.",
    },
    planClosure: {
      en: `Some days of your fixed desk plan for "${amenityName}" ` +
        "have been cancelled — the Hub is closed.",
      vi: `Một số ngày trong gói bàn cố định cho "${amenityName}" ` +
        "đã bị huỷ — Hub đóng cửa.",
    },
  };
  return {
    en: {title: "Booking cancelled", body: bodies[key].en},
    vi: {title: "Đặt chỗ đã bị huỷ", body: bodies[key].vi},
  };
}

/**
 * Tells a member that someone else cancelled their booking. Fixed-desk plans
 * collapse to one message via the shared planGroupId subject, so cancelling
 * three days of a plan notifies once.
 * @param {Object} booking Booking document data after the write
 * @param {string} bookingId Booking document id
 * @param {Object} notice Result of getCancellationNotice
 * @return {Promise<void>}
 */
async function notifyBookingCancelled(booking, bookingId, notice) {
  const amenityName = await getAmenityName(booking.amenityId);
  const subjectId = getBookingSubjectId(booking, bookingId);
  await upsertNotification(
      booking.memberId,
      "booking_cancelled",
      subjectId,
      {
        bookingId,
        amenityName,
        planType: booking.planType || "standard",
        cancelledReason: notice.reason,
        isHubClosure: notice.isHubClosure,
        link: "/member/bookings",
      },
  );
  try {
    await notifyMemberPush(booking.memberId, {
      messages: getCancellationPushMessages(amenityName, notice),
      link: "/member/bookings",
      type: "booking_cancelled",
      subjectId,
    });
  } catch (error) {
    console.error("Error sending booking cancellation push:", error);
  }
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

// Remove expired browser push dedupe markers. The markers also carry
// expiresAt so a Firestore TTL policy can be enabled later as defense in depth.
exports.cleanupPushNotificationMarkers = onSchedule(
    "every 24 hours",
    async () => {
      try {
        let deletedCount = 0;
        let batches = 0;
        const maxBatches = 10;

        while (batches < maxBatches) {
          const expiredMarkers = await db.collection("push_notifications")
              .where("expiresAt", "<=", Timestamp.now())
              .limit(500)
              .get();

          if (expiredMarkers.empty) break;

          const batch = db.batch();
          expiredMarkers.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();

          deletedCount += expiredMarkers.size;
          batches++;
        }

        if (deletedCount > 0) {
          console.log(`Deleted ${deletedCount} push notification markers`);
        }

        return null;
      } catch (error) {
        console.error("Error cleaning push notification markers:", error);
        return null;
      }
    });

/**
 * Formats an event start as a hub-timezone 24h clock time (e.g. "18:00").
 * @param {*} date Firestore Timestamp, Date, or date-like value
 * @return {string} HH:mm in Asia/Ho_Chi_Minh, or "" when unparseable
 */
function formatHubTime(date) {
  const asDate = date && typeof date.toDate === "function" ?
    date.toDate() :
    new Date(date);
  if (Number.isNaN(asDate.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: HUB_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(asDate);
}

/**
 * Splits members into reminder segments for one event. Members who opted out
 * via preferences.eventReminders are dropped entirely.
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} memberDocs Members
 * @param {Array<string>} attendees Event attendee uids
 * @param {Array<string>} waitlist Event waitlist uids (order is position)
 * @return {Object} {attendee, waitlisted, other} arrays of member docs
 */
function segmentReminderRecipients(memberDocs, attendees, waitlist) {
  const attendeeSet = new Set(attendees);
  const waitlistSet = new Set(waitlist);
  const segments = {attendee: [], waitlisted: [], other: []};
  memberDocs.forEach((doc) => {
    const prefs = doc.data().preferences || {};
    if (prefs.eventReminders === false) return;
    if (attendeeSet.has(doc.id)) segments.attendee.push(doc);
    else if (waitlistSet.has(doc.id)) segments.waitlisted.push(doc);
    else segments.other.push(doc);
  });
  return segments;
}

/**
 * Builds the localized push copy for one segment of one event.
 * @param {string} segment "attendee" | "waitlisted" | "other"
 * @param {Object} ctx {title, time, taken, capacity, position}
 * @return {Object} Locale-keyed {title, body} map
 */
function buildReminderMessages(segment, ctx) {
  const {title, time, taken, capacity, position} = ctx;
  if (segment === "attendee") {
    return {
      en: {title: "Event tomorrow",
        body: `${title} starts tomorrow at ${time}.`},
      vi: {title: "Sự kiện ngày mai",
        body: `${title} bắt đầu vào ngày mai lúc ${time}.`},
    };
  }
  if (segment === "waitlisted") {
    return {
      en: {title: "Event tomorrow",
        body: `You're #${position} on the waitlist for ${title}.`},
      vi: {title: "Sự kiện ngày mai",
        body: `Bạn đang ở vị trí #${position} trong danh sách chờ ${title}.`},
    };
  }
  // A full event has no spots to advertise — point at the waitlist instead,
  // or the copy contradicts itself ("spots open ... 50 of 50 spots taken").
  if (capacity && taken >= capacity) {
    return {
      en: {title: "Event tomorrow — waitlist open",
        body: `${title} starts tomorrow at ${time}. ` +
          `All ${capacity} spots are taken — join the waitlist.`},
      vi: {title: "Sự kiện ngày mai — còn danh sách chờ",
        body: `${title} bắt đầu vào ngày mai lúc ${time}. ` +
          `Đã kín ${capacity} chỗ — tham gia danh sách chờ.`},
    };
  }
  const spotsEn = capacity ? ` ${taken} of ${capacity} spots taken.` : "";
  const spotsVi = capacity ? ` Đã nhận ${taken}/${capacity} chỗ.` : "";
  return {
    en: {title: "Event tomorrow — spots open",
      body: `${title} starts tomorrow at ${time}.${spotsEn} Register now.`},
    vi: {title: "Sự kiện ngày mai — còn chỗ",
      body: `${title} bắt đầu vào ngày mai lúc ${time}.` +
        `${spotsVi} Đăng ký ngay.`},
  };
}

/**
 * Delivers in-app + push reminders to one segment for one event.
 * @param {string} segment "attendee" | "waitlisted" | "other"
 * @param {Array<FirebaseFirestore.QueryDocumentSnapshot>} docs Segment members
 * @param {Object} ctx {eventId, title, time, taken, capacity, waitlist}
 * @return {Promise<number>} Count of members newly notified in-app
 */
async function deliverReminderSegment(segment, docs, ctx) {
  if (!docs.length) return 0;
  const created = await Promise.all(docs.map((doc) => {
    const position = segment === "waitlisted" ?
      ctx.waitlist.indexOf(doc.id) + 1 :
      null;
    return createNotificationIfAbsent(doc.id, "event_reminder", ctx.eventId, {
      eventId: ctx.eventId,
      eventTitle: ctx.title,
      eventTime: ctx.time,
      segment,
      attendeeCount: ctx.taken,
      capacity: ctx.capacity || null,
      waitlistPosition: position,
      link: "/member/events",
    });
  }));

  // Push copy differs per segment, and a waitlisted member's position differs
  // per member, so waitlisted push is sent one member at a time. The other two
  // segments share copy and go out as a single locale-grouped batch each.
  try {
    if (segment === "waitlisted") {
      for (const doc of docs) {
        await sendPushToMembers([doc], {
          messages: buildReminderMessages(segment, {
            ...ctx, position: ctx.waitlist.indexOf(doc.id) + 1,
          }),
          link: "/member/events",
          type: "event_reminder",
          subjectId: ctx.eventId,
        });
      }
    } else {
      await sendPushToMembers(docs, {
        messages: buildReminderMessages(segment, ctx),
        link: "/member/events",
        type: "event_reminder",
        subjectId: ctx.eventId,
      });
    }
  } catch (pushError) {
    console.error("Error sending event reminder push:", pushError);
  }
  return created.filter(Boolean).length;
}

// Remind every member about approved events starting in ~24h, so people who
// have not registered still hear about it in time to join or waitlist.
// Members who set preferences.eventReminders = false are excluded.
exports.sendEventReminders = onSchedule(
    "every 1 hours",
    async () => {
      try {
        const now = Timestamp.now();
        const in24Hours = Timestamp.fromMillis(
            now.toMillis() + 24 * 60 * 60 * 1000,
        );
        const in25Hours = Timestamp.fromMillis(
            now.toMillis() + 25 * 60 * 60 * 1000,
        );

        // Status is filtered below rather than in the query: adding an
        // equality on `status` to this range needs a composite
        // (status ASC, date ASC) index, and firestore.indexes.json only has
        // (status ASC, date DESC). Index deploys are manual-as-owner, so a
        // query-only change would fail in prod until someone deployed it.
        const upcomingEvents = await db.collection("events")
            .where("date", ">=", in24Hours)
            .where("date", "<=", in25Hours)
            .get();

        const approved = upcomingEvents.docs
            .filter((doc) => doc.data().status === "approved");
        if (!approved.length) {
          console.log("No approved events in the reminder window");
          return null;
        }

        const memberDocs = (await db.collection("members").get()).docs;
        let notifiedCount = 0;

        for (const eventDoc of approved) {
          const eventData = eventDoc.data();
          const attendees = [...new Set(eventData.attendees || [])];
          const waitlist = [...new Set(eventData.waitlist || [])];
          const ctx = {
            eventId: eventDoc.id,
            title: eventData.title || eventData.name || "",
            time: formatHubTime(eventData.date),
            taken: attendees.length,
            capacity: eventData.capacity || null,
            waitlist,
          };

          const segments = segmentReminderRecipients(
              memberDocs, attendees, waitlist,
          );
          for (const segment of ["attendee", "waitlisted", "other"]) {
            notifiedCount += await deliverReminderSegment(
                segment, segments[segment], ctx,
            );
          }

          console.log(`Event reminder sent for ${ctx.title}`, {
            eventId: ctx.eventId,
            attendees: segments.attendee.length,
            waitlisted: segments.waitlisted.length,
            other: segments.other.length,
          });
        }

        console.log(`Reminded ${notifiedCount} members across ` +
          `${approved.length} events`);
        return null;
      } catch (error) {
        console.error("Error sending event reminders:", error);
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

// Notify members when an existing booking becomes approved, or when someone
// else cancels it. Fixed-desk plan bookings share a deterministic notification
// document, so a bulk approval or a multi-day cancellation is represented by
// one message rather than one per working day.
//
// Both status changes live in this one trigger on purpose. A separate export
// would be a first-of-kind deploy, and the CI service account cannot set the
// Cloud Run invoker policy — that is how editOwnEvent and reviewEvent shipped
// unreachable on 2026-08-14. Extending an existing function keeps CI able to
// deploy this unaided.
exports.notifyBookingApproval = onDocumentUpdated(
    "bookings/{bookingId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      const bookingId = event.params.bookingId;

      if (before.status !== after.status && after.status === "approved") {
        try {
          await notifyBookingApproved(after, bookingId);
        } catch (error) {
          console.error("Error notifying booking approval:", error);
        }
        return null;
      }

      const notice = getCancellationNotice(before, after);
      if (!notice) return null;

      try {
        await notifyBookingCancelled(after, bookingId, notice);
      } catch (error) {
        console.error("Error notifying booking cancellation:", error);
      }
      return null;
    });

const notifyEventReviewRequest = async (eventId, eventData) => {
  const eventTitle = eventData.title || eventData.name || "";
  const revision = getRevision(eventData);
  const subjectId = getNotificationSubjectId(eventId, revision, "pending");
  const [organizerName, admins] = await Promise.all([
    eventData.organizerDisplayName ?
      Promise.resolve(eventData.organizerDisplayName) :
      getMemberName(eventData.organizerId),
    db.collection("members").where("membershipType", "==", "admin").get(),
  ]);
  await notifyAdmins("event_pending_review", subjectId, {
    eventId,
    eventTitle,
    organizerName,
    revision,
    resubmittedFromStatus: eventData.resubmittedFromStatus || null,
    link: "/admin/events",
  }, admins.docs);
  const orgEn = organizerName || "A member";
  const orgVi = organizerName || "Một thành viên";
  try {
    await notifyAdminsPush(subjectId, {
      messages: {
        en: {
          title: "Event needs review",
          body: `${orgEn} submitted "${eventTitle}" for approval.`,
        },
        vi: {
          title: "Sự kiện cần được duyệt",
          body: `${orgVi} đã gửi "${eventTitle}" để duyệt.`,
        },
      },
      link: "/admin/events",
      type: "event_pending_review",
    }, admins.docs);
  } catch (pushError) {
    console.error("Error sending event review push:", pushError);
  }
};

// Notify admins when a member creates or resubmits an event for review.
exports.notifyEventPendingReview = onDocumentCreated(
    "events/{eventId}",
    async (event) => {
      const snap = event.data;
      if (!snap || snap.data().status !== "pending") return null;
      try {
        await notifyEventReviewRequest(event.params.eventId, snap.data());
      } catch (error) {
        console.error("Error notifying event review:", error);
      }
      return null;
    });

exports.notifyEventResubmission = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (after.status !== "pending" ||
          !["approved", "rejected"].includes(before.status)) {
        return null;
      }
      try {
        await notifyEventReviewRequest(event.params.eventId, after);
      } catch (error) {
        console.error("Error notifying event resubmission:", error);
      }
      return null;
    });

// Notify event organizer when event status changes to approved or rejected.
exports.notifyEventStatusChange = onDocumentUpdated(
    {document: "events/{eventId}", secrets: ["EMAIL_PASS"]},
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();

      // Only act on status transitions.
      if (before.status === after.status) return null;
      if (!["approved", "rejected"].includes(after.status)) return null;

      const eventId = event.params.eventId;
      const eventTitle = after.title || after.name || "";
      const isApproved = after.status === "approved";
      const rejectionReason = after.rejectionReason || "";
      const subjectId = getNotificationSubjectId(
          eventId, getRevision(after), after.status,
      );

      try {
        await createNotificationIfAbsent(
            after.organizerId,
            "event_status",
            subjectId,
            {
              eventId,
              eventTitle,
              status: after.status,
              rejectionReason,
              link: "/member/events",
            },
        );

        const memberDoc = await db.collection("members")
            .doc(after.organizerId).get();
        const member = memberDoc.exists ? memberDoc.data() : null;

        try {
          await notifyMemberPush(after.organizerId, {
            messages: {
              en: isApproved ? {
                title: "Event approved",
                body: `Your event "${eventTitle}" has been approved.`,
              } : {
                title: "Event not approved",
                body: rejectionReason ?
                  `Your event "${eventTitle}" was not approved: ` +
                    `${rejectionReason}` :
                  `Your event "${eventTitle}" was not approved.`,
              },
              vi: isApproved ? {
                title: "Sự kiện đã được duyệt",
                body: `Sự kiện "${eventTitle}" của bạn đã được duyệt.`,
              } : {
                title: "Sự kiện chưa được duyệt",
                body: rejectionReason ?
                  `Sự kiện "${eventTitle}" của bạn chưa được duyệt: ` +
                    `${rejectionReason}` :
                  `Sự kiện "${eventTitle}" của bạn chưa được duyệt.`,
              },
            },
            link: "/member/events",
            type: "event_status",
            subjectId,
          }, memberDoc);
        } catch (pushError) {
          console.error("Error sending event status push:", pushError);
        }
        const prefs = (member && member.preferences) || {};
        const sendEmail = prefs.emailNotifications !== false;

        if (member && member.email && sendEmail && process.env.EMAIL_USER) {
          const displayName = member.displayName || member.email;
          const fromName =
            process.env.EMAIL_FROM_NAME || "Da Nang Blockchain Hub";
          const appUrl =
            process.env.APP_URL || "https://app.danangblockchainhub.com";

          const subject = isApproved ?
            `Your event "${eventTitle}" has been approved` :
            `Your event "${eventTitle}" was not approved`;

          const eventTitleHtml =
            `<strong style="color:#38bdf8;">"${eventTitle}"</strong>`;
          const statusHtml = isApproved ?
            `${eventTitleHtml} has been ` +
            `<strong style="color:#22c55e;">approved</strong>` +
            ` and is now live on the events calendar.` :
            `We're sorry, ${eventTitleHtml} was ` +
            `<strong style="color:#ef4444;">not approved</strong>` +
            ` at this time.`;
          const followUpHtml = isApproved ?
            `Members can now see and register for your event.` +
            ` You'll receive reminders as the date approaches.` :
            `You're welcome to submit a new event request` +
            ` after addressing the feedback above.`;
          /* eslint-disable max-len */
          const guidelinesHtml = isApproved ?
            `<p style="margin:20px 0 0;color:#94a3b8;font-size:14px;">` +
            `Please review our ` +
            `<a href="https://www.danangblockchainhub.com/event-guidelines.html" ` +
            `style="color:#38bdf8;text-decoration:none;">Event Guidelines</a>` +
            ` and ` +
            `<a href="https://www.danangblockchainhub.com/community-space-guidelines.html" ` +
            `style="color:#38bdf8;text-decoration:none;">Community Space Guidelines</a>` +
            ` before your event to ensure a smooth experience for all attendees.</p>` : "";
          /* eslint-enable max-len */

          const reasonText = rejectionReason || "No reason was provided.";
          const reasonHtml = isApproved ? "" :
            `<div style="margin:20px 0;padding:16px;` +
            `background:#fff1f2;border-left:4px solid #ef4444;` +
            `border-radius:6px;">` +
            `<p style="margin:0;font-size:14px;color:#991b1b;">` +
            `<strong>Reason:</strong> ${reasonText}</p></div>`;

          /* eslint-disable max-len */
          const bodyHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#1e293b;border-radius:16px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:linear-gradient(135deg,#0ea5e9,#6366f1);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">
              Da Nang Blockchain Hub
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#94a3b8;font-size:15px;">
              Hi ${displayName},
            </p>
            <p style="margin:0 0 20px;color:#e2e8f0;font-size:16px;line-height:1.6;">
              ${statusHtml}
            </p>
            ${reasonHtml}
            <p style="margin:20px 0 0;color:#94a3b8;font-size:14px;">
              ${followUpHtml}
            </p>
            ${guidelinesHtml}
            <div style="margin:32px 0;text-align:center;">
              <a href="${appUrl}/member/events"
                 style="display:inline-block;padding:12px 28px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                View My Events
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#475569;font-size:12px;">
              Da Nang Blockchain Hub &mdash; You're receiving this because you submitted an event request.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
          /* eslint-enable max-len */

          await getTransporter().sendMail({
            from: `"${fromName}" <${process.env.EMAIL_USER}>`,
            to: member.email,
            subject,
            html: bodyHtml,
          });

          console.log("Event status email sent:", {
            to: member.email,
            eventId,
            status: after.status,
          });
        }

        return null;
      } catch (error) {
        console.error("Error in notifyEventStatusChange:", error);
        return null;
      }
    });

// Existing participants need to know when a previously live event is taken down
// for revision and when that revision is approved or rejected. This is in-app
// only; organizer email/push remains owned by notifyEventStatusChange above.
exports.notifyEventRevisionParticipants = onDocumentUpdated(
    "events/{eventId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      // `everApproved` is set as part of an initial approval, so inspecting the
      // after snapshot would misclassify that first approval as a revision.
      // The prior snapshot is the source of truth; `before.status` also covers
      // legacy live events that predate the metadata field.
      const wasPreviouslyApproved = before.everApproved === true ||
          before.status === "approved";
      if (before.status === after.status || !wasPreviouslyApproved) return null;
      const transition = after.status;
      if (!["pending", "approved", "rejected"].includes(transition)) {
        return null;
      }

      const recipients = [...new Set([
        ...(after.attendees || []), ...(after.waitlist || []),
      ])].filter((uid) => uid !== after.organizerId);
      if (!recipients.length) return null;

      const eventId = event.params.eventId;
      const revision = getRevision(after);
      const subjectId = getNotificationSubjectId(eventId, revision, transition);
      try {
        await Promise.all(recipients.map((userId) => createNotificationIfAbsent(
            userId, "event_revision", subjectId, {
              eventId,
              eventTitle: after.title || after.name || "",
              reviewStatus: transition,
              revision,
              link: "/member/events",
            },
        )));
      } catch (error) {
        console.error("Error notifying event revision participants:", error);
      }
      return null;
    });

// Wallet address shapes, by chain. The address doubles as the nonces/{address}
// document id, so this is the only thing standing between request.data and a
// Firestore document path — validate before any read or write.
const WALLET_ADDRESS_RULES = {
  ethereum: {
    pattern: /^0x[0-9a-fA-F]{40}$/,
    message: "Invalid Ethereum address format",
  },
  solana: {
    pattern: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    message: "Invalid Solana address format",
  },
};

const WALLET_CHAINS = Object.keys(WALLET_ADDRESS_RULES);

/**
 * Rejects unknown chains and malformed addresses before the caller touches
 * Firestore. Without this, an unknown chain falls through both verify branches
 * in verifyWalletSignature, leaves uid undefined, and throws an opaque
 * "internal" — after the transaction has already consumed the nonce.
 * @param {*} address Claimed wallet address
 * @param {*} chain Claimed chain, one of WALLET_CHAINS
 * @throws {HttpsError} invalid-argument when either value is unusable
 */
function assertValidWalletInput(address, chain) {
  if (!address || typeof address !== "string") {
    throw new HttpsError(
        "invalid-argument",
        "Address is required",
    );
  }
  if (!chain || !WALLET_CHAINS.includes(chain)) {
    throw new HttpsError(
        "invalid-argument",
        "Chain must be ethereum or solana",
    );
  }
  const {pattern, message} = WALLET_ADDRESS_RULES[chain];
  if (!pattern.test(address)) {
    throw new HttpsError("invalid-argument", message);
  }
}

// Generate a one-time nonce for wallet authentication
exports.generateWalletNonce = onCall(
    async (request) => {
      const {address, chain} = request.data;

      assertValidWalletInput(address, chain);

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

      assertValidWalletInput(address, chain);

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

      // The snapshot decides only *whether* to look — someone left, so a spot
      // may have opened. It never decides how many to promote: the document can
      // have changed again since this snapshot, so attendees/waitlist/capacity
      // are re-read inside the transaction below. Keeping the guard here also
      // stops this function's own write from re-entering.
      const beforeAttendees =
        (before.attendees && before.attendees.length) || 0;
      const afterAttendees =
        (after.attendees && after.attendees.length) || 0;

      if (beforeAttendees <= afterAttendees) {
        return null;
      }

      const eventRef = db.collection("events").doc(event.params.eventId);

      try {
        const toPromote = await db.runTransaction(async (tx) => {
          const snapshot = await tx.get(eventRef);
          if (!snapshot.exists) return 0;

          const data = snapshot.data();
          // An event can move back to pending while this trigger is queued.
          // Registrations are frozen during review, so do not promote a
          // waitlisted member until the current revision is live again.
          if (data.status !== "approved") return 0;

          const attendees = data.attendees || [];
          const waitlist = data.waitlist || [];
          const capacity = data.capacity;

          if (!capacity || waitlist.length === 0) return 0;

          const availableSpots = capacity - attendees.length;
          if (availableSpots <= 0) return 0;

          const promoteCount = Math.min(availableSpots, waitlist.length);
          const promoted = waitlist.slice(0, promoteCount);

          tx.update(eventRef, {
            attendees: FieldValue.arrayUnion(...promoted),
            waitlist: waitlist.slice(promoteCount),
          });

          return promoteCount;
        });

        // TODO: Notify promoted members
        if (toPromote > 0) {
          console.log(
              `Auto-promoted ${toPromote} member(s) from waitlist ` +
              `for event ${event.params.eventId}`,
          );
        }

        return null;
      } catch (error) {
        console.error("Error auto-promoting waitlist:", error);
        return null;
      }
    });
