const {HttpsError} = require("firebase-functions/v2/https");
const {Timestamp, FieldPath} = require("firebase-admin/firestore");

// Read-only MCP view of the Hub's upcoming events (#299). It shows a member
// what the portal's member view shows (src/components/event/eventFields.js):
// no venue (admin-only) and no attendee or waitlist counts or IDs, only
// whether a Hub sign-up is full and the caller's own registration state.

const APP_URL = "https://app.danangblockchainhub.com";
const DESCRIPTION_LIMIT = 1000;
const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
// Same test as the portal's isWebLink: anything else is never handed out.
const WEB_LINK = /^https?:\/\//i;
// nextCursor = "<seconds>_<nanos>_<eventId>": the last event's start as it
// was listed, so moving that event later can't skip or repeat a page.
const CURSOR = /^(\d{1,12})_(\d{1,9})_([A-Za-z0-9_-]{1,100})$/;

const toDate = (value) => value && typeof value.toDate === "function" ?
  value.toDate() : value instanceof Date ? value : new Date(value);
const positive = (value) =>
  Number.isFinite(value) && value > 0 ? value : null;
const list = (value) => Array.isArray(value) ? value : [];
const text = (value) => typeof value === "string" && value.trim() ?
  value.trim() : null;
const webLink = (value) => {
  const link = text(value);
  return link && WEB_LINK.test(link) ? link : null;
};

// Cut by code point, so an emoji is never split in half.
const trimmed = (description) => {
  const chars = Array.from(text(description) || "");
  return chars.length > DESCRIPTION_LIMIT ?
    {description: chars.slice(0, DESCRIPTION_LIMIT).join("").trimEnd() + "…",
      descriptionTruncated: true} :
    {description: chars.join(""), descriptionTruncated: false};
};

// An event with its own page (Luma, a form…) takes sign-ups there, and Hub
// capacity never applies, as on the portal (hasEventPage). Otherwise the
// portal's register link signs the member up as soon as it opens.
const signUp = (event, eventLink, id) => {
  if (eventLink) {
    return {signUp: "event-page", registerUrl: eventLink, isFull: null};
  }
  const capacity = positive(event.capacity);
  return {signUp: "hub",
    registerUrl: `${APP_URL}/member/events?action=register&eventId=` +
      encodeURIComponent(id),
    isFull: capacity !== null && list(event.attendees).length >= capacity};
};

const eventView = (doc, uid, organizers) => {
  const event = doc.data();
  const start = toDate(event.date);
  const minutes = positive(event.duration);
  const eventLink = webLink(event.eventLink);
  return {
    id: doc.id, title: text(event.title) || "Untitled event",
    ...trimmed(event.description),
    startTime: start.toISOString(),
    endTime: minutes === null ? null :
      new Date(start.getTime() + minutes * 60000).toISOString(),
    durationMinutes: minutes, timezone: HUB_TIMEZONE,
    organizer: text(event.organizerDisplayName) ||
      organizers.get(event.organizerId) || null,
    hostingProjects: text(event.hostingProjects),
    eventLink,
    ...signUp(event, eventLink, doc.id),
    registered: list(event.attendees).includes(uid),
    waitlisted: list(event.waitlist).includes(uid),
  };
};

// Older events carry only organizerId; the portal looks the name up too.
const organizerNames = async (db, docs) => {
  const ids = [...new Set(docs.map((d) => d.data())
      .filter((e) => !text(e.organizerDisplayName))
      .map((e) => e.organizerId)
      .filter((id) => typeof id === "string" && id))];
  const snapshots = await Promise.all(ids.map((id) =>
    db.collection("members").doc(id).get()));
  return new Map(snapshots.filter((s) => s.exists)
      .map((s) => [s.id, text(s.data().displayName)]));
};

const encodeCursor = (doc) => {
  const date = doc.data().date;
  return `${date.seconds}_${date.nanoseconds}_${doc.id}`;
};
const decodeCursor = (cursor) => {
  const match = CURSOR.exec(cursor);
  if (!match) {
    throw new HttpsError("invalid-argument",
        "Unknown cursor; list again without one.");
  }
  return [new Timestamp(Number(match[1]), Number(match[2])), match[3]];
};

const createEventTools = (db, memberFor) => ({
  list_upcoming_events: async (principal, args) => {
    // Same token or grant re-check as every other tool.
    await db.runTransaction((tx) => memberFor(tx, principal));
    // Upcoming = starts after now, as on the portal's Events page. Uses the
    // existing (status, date ASC) index; ties break on document ID.
    let query = db.collection("events").where("status", "==", "approved")
        .where("date", ">", Timestamp.now())
        .orderBy("date").orderBy(FieldPath.documentId())
        .limit(args.limit + 1);
    if (args.cursor) query = query.startAfter(...decodeCursor(args.cursor));
    const snapshot = await query.get();
    const docs = snapshot.docs.slice(0, args.limit);
    const organizers = await organizerNames(db, docs);
    return {items: docs.map((d) => eventView(d, principal.uid, organizers)),
      nextCursor: snapshot.size > args.limit ?
        encodeCursor(docs[docs.length - 1]) : null};
  },
});

module.exports = {createEventTools, eventView, DESCRIPTION_LIMIT};
