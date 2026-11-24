const {HttpsError} = require("firebase-functions/v2/https");
const {Timestamp} = require("firebase-admin/firestore");

// Read-only MCP view of the Hub's upcoming events (#299). Events are public in
// the portal, but attendee and waitlist arrays are member IDs, so only counts
// and the caller's own registration state leave the server.

const APP_URL = "https://app.danangblockchainhub.com";
const DESCRIPTION_LIMIT = 1000;
const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";

const toDate = (value) => value && typeof value.toDate === "function" ?
  value.toDate() : value instanceof Date ? value : new Date(value);
const positive = (value) =>
  Number.isFinite(value) && value > 0 ? value : null;
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" && value.trim() ?
  value.trim() : null;

const trimmed = (description) => {
  const full = text(description) || "";
  return full.length > DESCRIPTION_LIMIT ?
    {description: full.slice(0, DESCRIPTION_LIMIT).trimEnd() + "…",
      descriptionTruncated: true} :
    {description: full, descriptionTruncated: false};
};

const seats = (event, uid) => {
  const attendees = list(event.attendees);
  const waitlist = list(event.waitlist);
  const capacity = positive(event.capacity);
  return {capacity, attendeeCount: attendees.length,
    waitlistCount: waitlist.length,
    spotsLeft: capacity === null ? null :
      Math.max(0, capacity - attendees.length),
    registered: attendees.includes(uid), waitlisted: waitlist.includes(uid)};
};

const eventView = (doc, uid, venues) => {
  const event = doc.data();
  const start = toDate(event.date);
  const minutes = positive(event.duration);
  return {
    id: doc.id, title: text(event.title) || "Untitled event",
    ...trimmed(event.description),
    startTime: start.toISOString(),
    endTime: minutes === null ? null :
      new Date(start.getTime() + minutes * 60000).toISOString(),
    durationMinutes: minutes, timezone: HUB_TIMEZONE,
    organizer: text(event.organizerDisplayName),
    hostingProjects: text(event.hostingProjects),
    venue: venues.get(event.requestedAmenityId) || null,
    ...seats(event, uid),
    eventLink: text(event.eventLink),
    registerUrl: `${APP_URL}/member/events?action=register&eventId=` +
      encodeURIComponent(doc.id),
  };
};

// Amenity names for the page's venues, one read per distinct amenity.
const venueNames = async (db, docs) => {
  const ids = [...new Set(docs.map((d) => d.data().requestedAmenityId)
      .filter((id) => typeof id === "string" && id))];
  const snapshots = await Promise.all(ids.map((id) =>
    db.collection("amenities").doc(id).get()));
  return new Map(snapshots.filter((s) => s.exists)
      .map((s) => [s.id, text(s.data().name)]));
};

const cursorSnapshot = async (db, cursor) => {
  const snapshot = await db.collection("events").doc(cursor).get();
  if (!snapshot.exists || snapshot.data().status !== "approved") {
    throw new HttpsError("invalid-argument",
        "Unknown cursor; list again without one.");
  }
  return snapshot;
};

const createEventTools = (db, memberFor) => ({
  list_upcoming_events: async (principal, args) => {
    // Same token or grant re-check as every other tool.
    await db.runTransaction((tx) => memberFor(tx, principal));
    // Upcoming = starts after now, as on the portal's Events page. Uses the
    // existing (status, date ASC) index; ties break on document ID.
    let query = db.collection("events").where("status", "==", "approved")
        .where("date", ">", Timestamp.now()).orderBy("date")
        .limit(args.limit + 1);
    if (args.cursor) {
      query = query.startAfter(await cursorSnapshot(db, args.cursor));
    }
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, args.limit);
    const venues = await venueNames(db, docs);
    return {items: docs.map((d) => eventView(d, principal.uid, venues)),
      nextCursor: snapshot.size > args.limit ?
        docs[docs.length - 1].id : null};
  },
});

module.exports = {createEventTools, eventView, DESCRIPTION_LIMIT};
