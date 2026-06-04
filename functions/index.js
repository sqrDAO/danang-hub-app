const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const {ethers} = require("ethers");
const nacl = require("tweetnacl");
const bs58 = require("bs58");
const nodemailer = require("nodemailer");

admin.initializeApp();

const db = admin.firestore();

// Region for all deployed Cloud Functions. Pinned to us-central1 until the
// deploying service account is granted roles/cloudfunctions.admin (required
// to set the public invoker IAM policy in other regions).
const REGION = "us-central1";

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
const BUSINESS_START_HOUR = 8;
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

// Check for booking conflicts
exports.checkBookingConflicts = functions.region(REGION).https.onCall(
    async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be authenticated",
        );
      }

      const {amenityId, startTime, endTime, excludeBookingId} = data;

      try {
        const amenityRef = db.collection("amenities").doc(amenityId);
        const amenitySnap = await amenityRef.get();
        const amenity = amenitySnap.exists ? amenitySnap.data() : null;
        const amenityType = amenity && amenity.type ? amenity.type : null;

        let amenityCapacityRaw = 1;
        if (amenity && typeof amenity.capacity === "number") {
          amenityCapacityRaw = amenity.capacity;
        }

        const amenityCapacity =
          amenityCapacityRaw > 0 ? amenityCapacityRaw : 1;

        // Always enforce available days for every amenity type
        // (including event-space)
        if (amenity && !isOnAvailableDay(startTime, amenity)) {
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Booking date is outside the amenity's available days.",
          );
        }

        // Enforce business hours only for desk/meeting-room/podcast-room
        const amenityNeedsHoursCheck =
          amenity && AMENITY_TYPES_WITH_BUSINESS_HOURS.includes(amenityType);
        if (amenityNeedsHoursCheck) {
          if (!isWithinAmenityHours(startTime, endTime, amenity)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Booking time is outside the amenity's available hours.",
            );
          }
        }

        const bookingsQuery = db.collection("bookings")
            .where("amenityId", "==", amenityId)
            .where("status", "in", ["pending", "approved", "checked-in"]);

        const snapshot = await bookingsQuery.get();
        const conflicts = [];

        snapshot.forEach((doc) => {
          if (excludeBookingId && doc.id === excludeBookingId) {
            return;
          }

          const booking = doc.data();
          const bookingStart = booking.startTime.toDate();
          const bookingEnd = booking.endTime.toDate();
          const newStart = new Date(startTime);
          const newEnd = new Date(endTime);

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
      } catch (error) {
        console.error("Error checking booking conflicts:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Error checking conflicts",
        );
      }
    },
);

// Check slot availability - no auth (for chatbot, public availability)
exports.checkSlotAvailability = functions.region(REGION).https.onCall(
    async (data, context) => {
      const {amenityId, startTime, endTime} = data;

      if (!amenityId || !startTime || !endTime) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "amenityId, startTime, and endTime are required",
        );
      }

      try {
        const newStart = new Date(startTime);

        const amenityRef = db.collection("amenities").doc(amenityId);
        const amenityDoc = await amenityRef.get();

        let amenityType = null;
        let amenityCapacity = 1;

        if (amenityDoc.exists) {
          const amenity = amenityDoc.data();
          amenityType = amenity.type || null;

          let amenityCapacityRaw = 1;
          if (typeof amenity.capacity === "number") {
            amenityCapacityRaw = amenity.capacity;
          }

          amenityCapacity =
            amenityCapacityRaw > 0 ? amenityCapacityRaw : 1;

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

        const bookingsQuery = db.collection("bookings")
            .where("amenityId", "==", amenityId)
            .where("status", "in", ["pending", "approved", "checked-in"]);

        const snapshot = await bookingsQuery.get();
        const conflicts = [];
        const newEnd = new Date(endTime);

        snapshot.forEach((doc) => {
          const booking = doc.data();
          const bookingStart = booking.startTime.toDate();
          const bookingEnd = booking.endTime.toDate();

          if (
            (newStart >= bookingStart && newStart < bookingEnd) ||
            (newEnd > bookingStart && newEnd <= bookingEnd) ||
            (newStart <= bookingStart && newEnd >= bookingEnd)
          ) {
            conflicts.push({
              id: doc.id,
              startTime: bookingStart.toISOString(),
              endTime: bookingEnd.toISOString(),
            });
          }
        });

        const overlapCount = conflicts.length;
        let available;

        if (
          amenityType &&
          AMENITY_TYPES_WITH_CAPACITY_CONCURRENCY.includes(amenityType) &&
          amenityCapacity > 1
        ) {
          // For shared-capacity amenities, mark unavailable when full
          available = overlapCount < amenityCapacity;
        } else {
          // For single-occupancy amenities, any overlap makes slot unavailable
          available = overlapCount === 0;
        }

        return {
          available,
          conflicts,
        };
      } catch (error) {
        console.error("Error checking slot availability:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Error checking availability",
        );
      }
    },
);

const HUB_UTC_OFFSET_HOURS = 7;

/**
 * Get start-of-day timestamp for today in hub timezone (Asia/Ho_Chi_Minh).
 * Bookings with startTime before this have a booking date that has passed.
 * @return {admin.firestore.Timestamp}
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
  return admin.firestore.Timestamp.fromDate(startOfTodayVN);
}

// Auto check-out expired bookings + auto-complete past-day bookings
exports.autoCheckoutExpiredBookings = functions.region(REGION).pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      try {
        const now = admin.firestore.Timestamp.now();
        const oneHourAgo = admin.firestore.Timestamp.fromMillis(
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
            checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
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
              checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
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
            checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
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
exports.sendBookingConfirmation = functions.region(REGION).firestore
    .document("bookings/{bookingId}")
    .onCreate(async (snap, context) => {
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

// Update event capacity when attendees change
exports.updateEventCapacity = functions.region(REGION).firestore
    .document("events/{eventId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();

      // Check if attendees array changed
      if (JSON.stringify(before.attendees) !==
          JSON.stringify(after.attendees)) {
        const currentAttendees = (after.attendees &&
            after.attendees.length) || 0;
        const capacity = after.capacity;

        if (capacity && currentAttendees >= capacity) {
          console.log(`Event ${context.params.eventId} is now full`);
        }
      }

      return null;
    });

// Clean up old completed bookings
exports.cleanupOldBookings = functions.region(REGION).pubsub
    .schedule("every 24 hours")
    .onRun(async (context) => {
      try {
        const thirtyDaysAgo = admin.firestore.Timestamp.fromMillis(
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

// Send event reminders (respects member preferences.eventReminders)
exports.sendEventReminders = functions.region(REGION).pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      try {
        const now = admin.firestore.Timestamp.now();
        const in24Hours = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 24 * 60 * 60 * 1000,
        );
        const in25Hours = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 25 * 60 * 60 * 1000,
        );

        // Find events happening in 24 hours
        const upcomingEvents = await db.collection("events")
            .where("date", ">=", in24Hours)
            .where("date", "<=", in25Hours)
            .get();

        let reminderCount = 0;

        for (const eventDoc of upcomingEvents.docs) {
          const event = eventDoc.data();
          const attendees = event.attendees || [];
          const waitlist = event.waitlist || [];

          // Resolve attendees who have eventReminders enabled.
          // Batched getAll instead of N sequential .get() calls.
          const uniqueAttendeeIds = [...new Set(attendees)];
          const membersToRemind = [];
          if (uniqueAttendeeIds.length > 0) {
            const memberRefs = uniqueAttendeeIds.map((id) =>
              db.collection("members").doc(id));
            const memberDocs = await db.getAll(...memberRefs);
            for (const memberDoc of memberDocs) {
              const member = memberDoc.exists ? memberDoc.data() : null;
              const prefs = (member && member.preferences) || {};
              if (prefs.eventReminders !== false) {
                membersToRemind.push({
                  memberId: memberDoc.id,
                  email: member && member.email ? member.email : null,
                  displayName: member && member.displayName ?
                    member.displayName : null,
                });
              }
            }
          }

          // TODO: Integrate with email/push notification service;
          // send only to membersToRemind
          console.log(`Event reminder for ${event.title}:`, {
            eventId: eventDoc.id,
            attendees: attendees.length,
            membersToRemind: membersToRemind.length,
            waitlist: waitlist.length,
            date: event.date,
          });

          reminderCount++;
        }

        console.log(`Sent ${reminderCount} event reminders`);
        return null;
      } catch (error) {
        console.error("Error sending event reminders:", error);
        return null;
      }
    });

// Notify event organizer when event status changes to approved or rejected
exports.notifyEventStatusChange = functions
    .region(REGION)
    .runWith({secrets: ["EMAIL_PASS"]})
    .firestore
    .document("events/{eventId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();

      // Only act on status transitions
      if (before.status === after.status) return null;
      if (!["approved", "rejected"].includes(after.status)) return null;

      const eventId = context.params.eventId;
      const eventTitle = after.title || after.name || "";
      const isApproved = after.status === "approved";
      const rejectionReason = after.rejectionReason || "";

      try {
        // 1. Write in-app notification
        await db.collection("notifications").add({
          userId: after.organizerId,
          type: "event_status",
          eventId,
          eventTitle,
          status: after.status,
          rejectionReason,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Send email if organizer has emailNotifications enabled
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
            `✅ Your event "${eventTitle}" has been approved` :
            `❌ Your event "${eventTitle}" was not approved`;

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

          // eslint-disable-next-line max-len
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

// Generate a one-time nonce for wallet authentication
exports.generateWalletNonce = functions.region(REGION).https.onCall(
    async (data, context) => {
      const {address, chain} = data;

      if (!address || typeof address !== "string") {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Address is required",
        );
      }
      if (!chain || !["ethereum", "solana"].includes(chain)) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Chain must be ethereum or solana",
        );
      }

      const ethAddressRegex = /^0x[0-9a-fA-F]{40}$/;
      const solAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
      if (chain === "ethereum" && !ethAddressRegex.test(address)) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Invalid Ethereum address format",
        );
      }
      if (chain === "solana" && !solAddressRegex.test(address)) {
        throw new functions.https.HttpsError(
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
exports.verifyWalletSignature = functions.region(REGION).https.onCall(
    async (data, context) => {
      const {address, signature, chain} = data;

      if (!address || !signature || !chain) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "address, signature, and chain are required",
        );
      }

      const nonceRef = db.collection("nonces").doc(address);
      let nonce;

      await db.runTransaction(async (tx) => {
        const nonceDoc = await tx.get(nonceRef);

        if (!nonceDoc.exists) {
          throw new functions.https.HttpsError(
              "not-found",
              "Nonce not found. Please try again.",
          );
        }

        const {nonce: storedNonce, expiresAt} = nonceDoc.data();

        if (Date.now() > expiresAt) {
          tx.delete(nonceRef);
          throw new functions.https.HttpsError(
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
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Invalid signature",
          );
        }
        if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
          throw new functions.https.HttpsError(
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
            throw new functions.https.HttpsError(
                "permission-denied",
                "Signature verification failed",
            );
          }
        } catch (err) {
          if (err instanceof functions.https.HttpsError) throw err;
          throw new functions.https.HttpsError(
              "invalid-argument",
              "Invalid signature",
          );
        }
        uid = `sol_${address}`;
      }

      const token = await admin.auth().createCustomToken(uid);
      return {token};
    },
);

// Auto-promote from waitlist when spots open
exports.autoPromoteWaitlist = functions.region(REGION).firestore
    .document("events/{eventId}")
    .onUpdate(async (change, context) => {
      const before = change.before.data();
      const after = change.after.data();

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

          await db.collection("events").doc(context.params.eventId).update({
            attendees: admin.firestore.FieldValue.arrayUnion(...promoted),
            waitlist: remaining,
          });

          // TODO: Notify promoted members
          console.log(
              `Auto-promoted ${toPromote} member(s) from waitlist ` +
              `for event ${context.params.eventId}`,
          );

          return null;
        } catch (error) {
          console.error("Error auto-promoting waitlist:", error);
          return null;
        }
      }

      return null;
    });
