const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();

const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
const BUSINESS_START_HOUR = 8;
const BUSINESS_END_HOUR = 18;

const AMENITY_TYPES_WITH_BUSINESS_HOURS = [
  "desk", "meeting-room", "podcast-room",
];

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
exports.checkBookingConflicts = functions.https.onCall(
    async (data, context) => {
      if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "User must be authenticated",
        );
      }

      const {amenityId, startTime, endTime, excludeBookingId} = data;

      try {
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

        return {hasConflicts: conflicts.length > 0, conflicts};
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
exports.checkSlotAvailability = functions.https.onCall(
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

        // Event Hall (event-space) requires booking at least 2 weeks in advance
        const amenityRef = db.collection("amenities").doc(amenityId);
        const amenityDoc = await amenityRef.get();
        if (amenityDoc.exists) {
          const amenity = amenityDoc.data();
          if (amenity.type === "event-space") {
            const minDate = new Date();
            minDate.setDate(minDate.getDate() + 14);
            minDate.setHours(0, 0, 0, 0);
            if (newStart < minDate) {
              return {
                available: false,
                error: "Event Hall requires 2-week advance booking.",
                minBookableDate: minDate.toISOString(),
              };
            }
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

        return {
          available: conflicts.length === 0,
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

// Auto check-out expired bookings
exports.autoCheckoutExpiredBookings = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      try {
        const now = admin.firestore.Timestamp.now();
        const oneHourAgo = admin.firestore.Timestamp.fromMillis(
            now.toMillis() - 60 * 60 * 1000,
        );

        const expiredBookings = await db.collection("bookings")
            .where("status", "==", "checked-in")
            .where("endTime", "<=", oneHourAgo)
            .get();

        const batch = db.batch();
        let count = 0;

        expiredBookings.forEach((doc) => {
          batch.update(doc.ref, {
            status: "completed",
            checkOutTime: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: new Date().toISOString(),
          });
          count++;
        });

        if (count > 0) {
          await batch.commit();
          console.log(`Auto-checked out ${count} expired bookings`);
        }

        return null;
      } catch (error) {
        console.error("Error in auto checkout:", error);
        return null;
      }
    });

// Send booking confirmation email
exports.sendBookingConfirmation = functions.firestore
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
exports.updateEventCapacity = functions.firestore
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
exports.cleanupOldBookings = functions.pubsub
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
exports.sendEventReminders = functions.pubsub
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

          // Resolve attendees who have eventReminders enabled
          const membersToRemind = [];
          for (const memberId of attendees) {
            const memberRef = db.collection("members").doc(memberId);
            const memberDoc = await memberRef.get();
            const member = memberDoc.exists ? memberDoc.data() : null;
            const prefs = (member && member.preferences) || {};
            if (prefs.eventReminders !== false) {
              membersToRemind.push({
                memberId,
                email: member && member.email ? member.email : null,
                displayName: member && member.displayName ?
                  member.displayName : null,
              });
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

// Auto-promote from waitlist when spots open
exports.autoPromoteWaitlist = functions.firestore
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
