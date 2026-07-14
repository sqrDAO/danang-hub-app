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
 * Stores a notification only if the deterministic document is absent.
 * @param {string} userId Notification recipient uid
 * @param {string} type Notification type
 * @param {string} subjectId Event, booking, or plan identifier
 * @param {Object} data Notification payload
 * @return {Promise<boolean>} True when a new notification was created
 */
async function createNotificationIfAbsent(userId, type, subjectId, data) {
  const notificationId = `${type}_${userId}_${subjectId}`;
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

/**
 * @param {string} recipientId Member document id
 * @param {string} type Notification type
 * @param {string} subjectId Stable booking or plan identifier
 * @return {FirebaseFirestore.DocumentReference}
 */
function getPushMarkerRef(recipientId, type, subjectId) {
  const markerId = `${type}_${recipientId}_${subjectId || "default"}`;
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
  try {
    await markerRef.create({
      recipientId,
      type,
      subjectId: subjectId || "",
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + PUSH_MARKER_TTL_MS),
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
    code === "messaging/invalid-argument" ||
    code === "invalid-argument" ||
    message.includes("NOT_REGISTERED") ||
    message.includes("INVALID_ARGUMENT") ||
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
  }
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

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batchRecipients = recipients.slice(i, i + batchSize);
    let response;
    try {
      response = await messaging.sendEachForMulticast({
        tokens: batchRecipients.map((recipient) => recipient.token),
        data,
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
  const recipients = [];
  const type = payload.type || "notification";
  const subjectId = payload.subjectId || "";

  for (const doc of docs) {
    const member = doc.data();
    const pushToken = await getPushToken(doc.id, member);
    if (!pushToken) {
      continue;
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
      recipients.push({
        memberId: doc.id,
        token: pushToken,
        type,
        subjectId,
      });
    }
  }

  if (!recipients.length) return [];

  const data = {
    title: String(payload.title || ""),
    body: String(payload.body || ""),
    link: String(payload.link || "/"),
    type: String(type),
    subjectId: String(subjectId),
    tag: String(payload.tag ||
      `${type}-${subjectId || "default"}`),
  };

  return sendPushToRecipients(recipients, data);
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
 * Sends booking-review push notifications to opted-in admins.
 * @param {string} subjectId Stable booking or plan identifier
 * @param {Object} payload Push payload
 * @return {Promise<Array>}
 */
async function notifyAdminsPush(subjectId, payload) {
  const admins = await db.collection("members")
      .where("membershipType", "==", "admin").get();
  return sendPushToMembers(admins.docs, {
    ...payload,
    subjectId,
  });
}

/**
 * Sends a booking-approval push to the member who owns the booking.
 * @param {string} memberId Member document id
 * @param {Object} payload Push payload
 * @return {Promise<Array>}
 */
async function notifyMemberPush(memberId, payload) {
  const memberDoc = await db.collection("members").doc(memberId).get();
  if (!memberDoc.exists) return [];
  return sendPushToMembers([memberDoc], payload);
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
  const requesterName = memberName || "A member";
  const fixedDeskReviewBody =
    `${requesterName} requested a fixed desk plan for ` +
    `"${amenityName}".`;
  const standardReviewBody =
    `${requesterName} requested "${amenityName}".`;
  try {
    await notifyAdminsPush(subjectId, {
      title: "Booking needs review",
      body: booking.planType === "fixed-desk" ?
        fixedDeskReviewBody :
        standardReviewBody,
      link: "/admin/bookings",
      type: "booking_pending_review",
    });
  } catch (error) {
    console.error("Error sending booking review push:", error);
  }
}

/**
 * @param {Object} booking Booking Firestore document data
 * @param {string} bookingId Booking document id
 * @return {Promise<FirebaseFirestore.WriteResult>}
 */
async function notifyBookingApproved(booking, bookingId) {
  const amenityName = await getAmenityName(booking.amenityId);
  const subjectId = getBookingSubjectId(booking, bookingId);
  await createNotification(
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
    await notifyMemberPush(booking.memberId, {
      title: "Booking approved",
      body: booking.planType === "fixed-desk" ?
        `Your fixed desk plan for "${amenityName}" has been approved.` :
        `Your booking for "${amenityName}" has been approved.`,
      link: "/member/bookings",
      type: "booking_approved",
      subjectId,
    });
  } catch (error) {
    console.error("Error sending booking approval push:", error);
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
      const subjectId = `${eventId}_${after.status}`;

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
