const {HttpsError} = require("firebase-functions/v2/https");
const {Timestamp, FieldPath} = require("firebase-admin/firestore");
const {rangeOverlapsClosure} = require("./hubClosures");
const {usageByMonth, MONTHLY_DESK_HOURS} = require("./monthlyHours");
const {activeToken, hashToken, liveGrant} = require("./mcpTokens");
const {createEventTools} = require("./mcpEvents");
const {hubDay, countOpenPending, nextDailyQuota, MCP_OPEN_PENDING_LIMIT,
  MCP_DAILY_CREATE_LIMIT, MCP_PENDING_SCAN_LIMIT} = require("./mcpQuota");

const fail = (message) => {
  throw new HttpsError("failed-precondition", message);
};
// Mirrors REQUIRED_PROFILE_FIELDS in src/utils/profileFields.js; a test
// in test/mcp.test.js fails if the two lists drift.
const REQUIRED_PROFILE_KEYS = ["displayName", "company", "jobTitle"];
const assertComplete = (member) => {
  if (!REQUIRED_PROFILE_KEYS.every((key) =>
    typeof member[key] === "string" && member[key].trim())) {
    fail("Complete your name, company and role in your Hub profile first.");
  }
};
const assertAmenity = (amenity, member) => {
  if (!amenity || amenity.isAvailable === false) fail("Amenity unavailable.");
  if (amenity.type === "event-space") {
    fail("Use Events in the Hub portal to reserve an event space.");
  }
  if (amenity.reservedForPartnerId &&
      amenity.reservedForPartnerId !== member.partnerId) {
    fail("This amenity is reserved for another partner.");
  }
};
const assertRange = ({startTime, endTime}, now = Date.now()) => {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      end - start > 86400000 || start < now || start > now + 366 * 86400000) {
    fail("Choose a future slot within one year, no longer than 24 hours.");
  }
};
const assertCancellation = (booking, uid) => {
  if (!booking || booking.memberId !== uid || booking.status !== "pending" ||
      booking.planType || booking.planGroupId) {
    fail("Only your own pending individual bookings can be cancelled.");
  }
};
const assertNotEventSpace = (amenity) => {
  if (amenity && amenity.type === "event-space") {
    fail("Cancel event-space bookings from Events in the Hub portal.");
  }
};
const iso = (value) => value && typeof value.toDate === "function" ?
  value.toDate().toISOString() :
  value instanceof Date ? value.toISOString() : value;
const bookingView = (doc) => {
  const b = doc.data();
  return {id: doc.id, amenityId: b.amenityId, status: b.status,
    startTime: iso(b.startTime), endTime: iso(b.endTime),
    source: b.source || "portal"};
};
const amenityView = (doc) => {
  const a = doc.data();
  return {id: doc.id, name: a.name, type: a.type, capacity: a.capacity,
    isAvailable: a.isAvailable !== false, startHour: a.startHour,
    endHour: a.endHour, weekdayStartHour: a.weekdayStartHour,
    availableDays: a.availableDays, slotDuration: a.slotDuration,
    timezone: "Asia/Ho_Chi_Minh"};
};

const createBookingTools = (db, availability) => {
  // OAuth (dha_) principals re-check their grant; dhm_ their token doc.
  const memberFor = async (tx, principal) => {
    const ref = principal.grantId ?
      db.collection("oauthGrants").doc(principal.grantId) :
      db.collection("mcpTokens").doc(principal.hash);
    const token = (await tx.get(ref)).data();
    const live = principal.grantId ? liveGrant(token) : activeToken(token);
    if (!live || token.uid !== principal.uid) {
      throw new HttpsError("unauthenticated", "Token revoked or expired.");
    }
    const member = (await tx.get(db.collection("members")
        .doc(principal.uid))).data();
    if (!member) fail("Hub member profile not found.");
    return member;
  };
  const page = async (query, args, mapper) => {
    let q = query.orderBy(FieldPath.documentId()).limit(args.limit + 1);
    if (args.cursor) q = q.startAfter(args.cursor);
    const snapshot = await q.get();
    const docs = snapshot.docs.slice(0, args.limit);
    return {items: docs.map(mapper), nextCursor:
      snapshot.size > args.limit ? docs[docs.length - 1].id : null};
  };
  const check = async (tx, principal, args) => {
    assertRange(args);
    const member = await memberFor(tx, principal);
    const amenity = (await tx.get(db.collection("amenities")
        .doc(args.amenityId))).data();
    assertAmenity(amenity, member);
    if (rangeOverlapsClosure(args.startTime, args.endTime) ||
        !availability.isWithinAmenityHours(args.startTime,
            args.endTime, amenity)) {
      return {available: false, reason: "Outside Hub or amenity hours."};
    }
    // Use the same overlap/capacity and renewal logic as the portal callables.
    const result = await availability.computeBookingAvailability({
      ...args, amenity, readQuery: async (query) => {
        const snapshot = await tx.get(query.limit(1001));
        if (snapshot.size > 1000) fail("Too many active bookings to verify.");
        return snapshot;
      },
    });
    return {available: !result.hasConflicts, busyRanges:
      result.conflicts.map((b) => ({startTime: iso(b.startTime),
        endTime: iso(b.endTime)}))};
  };
  // Per-member caps (#301), read inside the create transaction. Returns the
  // quota write to apply with the booking.
  const reserveQuota = async (tx, principal, args) => {
    const now = Date.now();
    const quotaRef = db.collection("mcpMemberQuotas").doc(principal.uid);
    const next = nextDailyQuota((await tx.get(quotaRef)).data(), hubDay(now));
    if (!next) {
      fail(`You can make ${MCP_DAILY_CREATE_LIMIT} bookings a day through ` +
        "an AI agent; try again tomorrow (Hub time) or use the Hub portal.");
    }
    const amenity = (await tx.get(db.collection("amenities")
        .doc(args.amenityId))).data();
    if (amenity && amenity.type !== "desk") {
      const pending = await tx.get(db.collection("bookings")
          .where("memberId", "==", principal.uid)
          .where("source", "==", "mcp").where("status", "==", "pending")
          .where("endTime", ">", Timestamp.fromMillis(now))
          .limit(MCP_PENDING_SCAN_LIMIT + 1));
      if (pending.size > MCP_PENDING_SCAN_LIMIT) {
        fail("Too many pending bookings to verify; contact the Hub.");
      }
      const bookings = pending.docs.map((d) => d.data());
      const ids = [...new Set(bookings.map((b) => b.amenityId))];
      const amenities = new Map(await Promise.all(ids.map(async (id) =>
        [id, (await tx.get(db.collection("amenities").doc(id))).data()])));
      if (countOpenPending(bookings, amenities, now) >=
          MCP_OPEN_PENDING_LIMIT) {
        fail(`You already have ${MCP_OPEN_PENDING_LIMIT} pending non-desk ` +
          "bookings made through an AI agent. Wait for the Hub to review " +
          "them, or cancel one, before booking another.");
      }
    }
    return () => tx.set(quotaRef,
        {...next, updatedAt: new Date(now).toISOString()});
  };
  const create = (principal, args) => db.runTransaction(async (tx) => {
    const member = await memberFor(tx, principal);
    assertComplete(member);
    const id = "mcp_" + hashToken(principal.uid + ":" + args.requestId);
    const ref = db.collection("bookings").doc(id);
    const previous = await tx.get(ref);
    if (previous.exists) {
      const b = previous.data();
      if (b.memberId !== principal.uid || b.amenityId !== args.amenityId ||
          iso(b.startTime) !== new Date(args.startTime).toISOString() ||
          iso(b.endTime) !== new Date(args.endTime).toISOString()) {
        fail("requestId was already used for a different booking.");
      }
      return bookingView(previous);
    }
    const writeQuota = await reserveQuota(tx, principal, args);
    const lock = db.collection("mcpBookingLocks").doc(args.amenityId);
    await tx.get(lock);
    const result = await check(tx, principal, args);
    if (!result.available) fail(result.reason || "Slot is full.");
    writeQuota();
    const booking = {memberId: principal.uid, amenityId: args.amenityId,
      startTime: Timestamp.fromDate(new Date(args.startTime)),
      endTime: Timestamp.fromDate(new Date(args.endTime)), status: "pending",
      source: "mcp", createdAt: new Date().toISOString()};
    tx.set(lock, {updatedAt: booking.createdAt});
    tx.create(ref, booking);
    return {id, status: "pending", source: "mcp",
      note: "Approval and the monthly desk-hours limit run asynchronously."};
  });
  const cancel = (principal, args) => db.runTransaction(async (tx) => {
    await memberFor(tx, principal);
    const ref = db.collection("bookings").doc(args.bookingId);
    const booking = (await tx.get(ref)).data();
    assertCancellation(booking, principal.uid);
    // A booking with no amenityId can't be an event-space booking.
    if (booking.amenityId) {
      assertNotEventSpace((await tx.get(db.collection("amenities")
          .doc(booking.amenityId))).data());
    }
    tx.update(ref, {status: "cancelled", updatedAt: new Date().toISOString()});
    return {id: args.bookingId, status: "cancelled"};
  });
  const hours = async (principal, args) => {
    const member = await db.runTransaction((tx) => memberFor(tx, principal));
    // Admins are exempt from the limit (enforceMonthlyHours in index.js).
    if (member.membershipType === "admin") {
      return {month: args.month, exempt: true, hoursUsed: null,
        hoursLeft: null, limit: null, timezone: "Asia/Ho_Chi_Minh"};
    }
    const [bookings, amenities] = await Promise.all([
      db.collection("bookings").where("memberId", "==", principal.uid)
          .limit(2001).get(),
      db.collection("amenities").limit(501).get(),
    ]);
    if (bookings.size > 2000 || amenities.size > 500) {
      fail("History too large to calculate safely; contact the Hub.");
    }
    const usage = usageByMonth(bookings.docs.map((d) => d.data()),
        new Map(amenities.docs.map((d) => [d.id, d.data()])));
    const used = usage.get(args.month) || 0;
    return {month: args.month, exempt: false, hoursUsed: used,
      hoursLeft: Math.max(0, MONTHLY_DESK_HOURS - used),
      limit: MONTHLY_DESK_HOURS, timezone: "Asia/Ho_Chi_Minh"};
  };
  return {
    list_amenities: async (p, args) => {
      const member = await db.runTransaction((tx) => memberFor(tx, p));
      const result = await page(db.collection("amenities"), args, (d) => {
        const a = d.data();
        if (a.type === "event-space") return null;
        return a.reservedForPartnerId &&
          a.reservedForPartnerId !== member.partnerId ? null : amenityView(d);
      });
      return {...result, items: result.items.filter(Boolean)};
    },
    check_availability: (p, args) =>
      db.runTransaction((tx) => check(tx, p, args)),
    get_my_hours_left: hours,
    list_my_bookings: (p, args) => page(db.collection("bookings")
        .where("memberId", "==", p.uid), args, bookingView),
    create_booking: create,
    cancel_booking: cancel,
    ...createEventTools(db, memberFor),
  };
};

module.exports = {createBookingTools, assertComplete, assertAmenity,
  assertCancellation, REQUIRED_PROFILE_KEYS};
