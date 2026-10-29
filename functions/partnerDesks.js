// Pure planning for the Partner Desk sync, kept out of index.js so it can be
// unit-tested without firebase-admin (same split as bookingNotifications.js).
//
// A member attached to a partner org (members.partnerId) whose partner has a
// desk (partners.deskAmenityId) holds an approved booking on that desk for
// every working day PARTNER_DESK_DAYS_AHEAD days out. The hourly scheduler
// calls planPartnerDeskSync and applies the result.

const {getHubClosure, HUB_UTC_OFFSET_HOURS} = require("./hubClosures");
const {holdsSeat, toMs} = require("./renewals");

const PARTNER_DESK_DAYS_AHEAD = 28;
// Member detached, or the partner's desk cleared: they lose their desk and
// are told. A desk change instead moves them, silently (bookingNotifications).
const PARTNER_REMOVED_REASON = "partner-removed";
const PARTNER_DESK_MOVED_REASON = "partner-desk-moved";
const SYNC_CANCEL_REASONS = [PARTNER_REMOVED_REASON, PARTNER_DESK_MOVED_REASON];
const CANCELLABLE_STATUSES = ["pending", "approved"];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// Same window as a Fixed Desk day (src/utils/recurrence.js
// getFixedDeskPlanWindow): 09:00–18:00 hub time.
const DESK_START_HOUR = 9;
const DESK_END_HOUR = 18;

/**
 * Working days (Mon–Fri, Hub open) from today, hub time, that have not ended.
 * @param {number} startOfTodayMs Hub midnight today, as UTC epoch ms
 * @param {number} nowMs Current time, epoch ms
 * @param {number} [daysAhead] How many calendar days to cover
 * @return {Array<{dayKey: string, weekday: number, start: Date, end: Date}>}
 */
function partnerDeskDays(startOfTodayMs, nowMs,
    daysAhead = PARTNER_DESK_DAYS_AHEAD) {
  const days = [];
  for (let i = 0; i < daysAhead; i++) {
    const midnight = startOfTodayMs + i * DAY_MS;
    const hubDate = new Date(midnight + HUB_UTC_OFFSET_HOURS * HOUR_MS);
    const weekday = hubDate.getUTCDay();
    const start = new Date(midnight + DESK_START_HOUR * HOUR_MS);
    const end = new Date(midnight + DESK_END_HOUR * HOUR_MS);
    if (weekday === 0 || weekday === 6) continue;
    if (end.getTime() <= nowMs || getHubClosure(start)) continue;
    const dayKey = hubDate.toISOString().slice(0, 10).replace(/-/g, "");
    days.push({dayKey, weekday, start, end});
  }
  return days;
}

/**
 * @param {string} uid Member uid
 * @param {string} amenityId Desk amenity id
 * @param {string} dayKey Hub day, YYYYMMDD
 * @return {string} Deterministic booking doc id
 */
function partnerDeskBookingId(uid, amenityId, dayKey) {
  return `pd_${uid}_${amenityId}_${dayKey}`;
}

/**
 * @param {string} uid Member uid
 * @return {string} planGroupId shared by all of a member's partner days
 */
function partnerDeskPlanGroupId(uid) {
  return `partner_${uid}`;
}

/**
 * Whether a booking is a day this sync owns. Partner-desk bookings made any
 * other way (the manual plans of #115, a client-written planType) are not
 * touched by the sync and do not get its notification handling.
 * @param {Object} booking Booking data
 * @return {boolean}
 */
function isSyncedPartnerDay(booking) {
  return Boolean(booking) && booking.planType === "partner-desk" &&
    booking.planGroupId === partnerDeskPlanGroupId(booking.memberId);
}


/**
 * Desk each attached member is entitled to: uid -> {amenityId, partnerId}.
 * @param {Array<{id: string, partnerId: string}>} members Attached members
 * @param {Array<{id: string, deskAmenityId: string}>} partners Partner orgs
 * @param {Map<string, Object>} amenities id -> amenity (desks only count)
 * @return {Map<string, {amenityId: string, partnerId: string}>}
 */
function entitledDesks(members, partners, amenities) {
  const deskByPartner = new Map();
  partners.forEach((partner) => {
    const amenity = amenities.get(partner.deskAmenityId);
    if (amenity && amenity.type === "desk") {
      deskByPartner.set(partner.id, partner.deskAmenityId);
    }
  });
  const entitled = new Map();
  members.forEach((member) => {
    const amenityId = deskByPartner.get(member.partnerId);
    if (amenityId) {
      entitled.set(member.id, {amenityId, partnerId: member.partnerId});
    }
  });
  return entitled;
}

/**
 * Active bookings overlapping a desk day.
 * @param {Array<Object>} bookings Active bookings snapshot
 * @param {{start: Date, end: Date}} day Desk window
 * @return {Array<Object>}
 */
function overlapping(bookings, day) {
  const start = day.start.getTime();
  const end = day.end.getTime();
  return bookings.filter((b) =>
    toMs(b.startTime) < end && toMs(b.endTime) > start);
}

/**
 * Whether a desk takes bookings on a day: not switched off, and the day is
 * one of its availableDays when it lists them.
 * @param {Object} amenity Desk amenity
 * @param {{weekday: number}} day Desk day
 * @return {boolean}
 */
function isDeskOpen(amenity, day) {
  if (amenity.isAvailable === false) return false;
  return !Array.isArray(amenity.availableDays) ||
    amenity.availableDays.includes(day.weekday);
}

/**
 * Whether a partner day the sync cancelled may be brought back.
 * @param {Object} booking Existing booking
 * @return {boolean}
 */
function isReactivatable(booking) {
  return booking.status === "cancelled" &&
    SYNC_CANCEL_REASONS.includes(booking.cancelledReason);
}

/**
 * Seats on a desk, read exactly as computeBookingAvailability reads them
 * (index.js uses this too), so the sync and the conflict check agree.
 * @param {Object} amenity Amenity data
 * @return {number}
 */
function deskCapacity(amenity) {
  const raw = amenity && typeof amenity.capacity === "number" ?
    amenity.capacity : 1;
  return raw > 0 ? raw : 1;
}

/**
 * Synced days not yet started whose member no longer holds that desk. A day
 * already under way is left alone rather than pulled mid-session.
 * @param {Array<Object>} syncedDays Bookings the sync owns
 * @param {Map} entitled uid -> desk, from entitledDesks
 * @param {number} nowMs Current time, epoch ms
 * @return {Array<{id: string, reason: string}>} Bookings to cancel
 */
function bookingsToCancel(syncedDays, entitled, nowMs) {
  return syncedDays.filter((b) => {
    if (!CANCELLABLE_STATUSES.includes(b.status)) return false;
    if (toMs(b.startTime) <= nowMs) return false;
    const desk = entitled.get(b.memberId);
    return !desk || desk.amenityId !== b.amenityId;
  }).map((b) => ({
    id: b.id,
    reason: entitled.has(b.memberId) ?
      PARTNER_DESK_MOVED_REASON : PARTNER_REMOVED_REASON,
  }));
}

/**
 * What to do for one member on one desk day: "create", "reactivate" or null.
 * @param {Object} ctx
 * @param {Object} ctx.existing This day's synced booking, if any
 * @param {Array<Object>} ctx.sameDay Active bookings overlapping the day
 * @param {Object} ctx.desk {amenityId, capacity}
 * @param {string} ctx.uid Member uid
 * @param {Map<string, Object>} ctx.amenities id -> amenity
 * @return {string|null}
 */
function dayAction({existing, sameDay, desk, uid, amenities}) {
  if (existing && !isReactivatable(existing)) return null;
  // Already on a desk that day (a Fixed Desk day, a single desk booking):
  // a second booking would make one person hold two seats.
  const onADesk = sameDay.some((b) => b.memberId === uid &&
    (amenities.get(b.amenityId) || {}).type === "desk");
  if (onADesk) return null;
  const taken = sameDay.filter((b) => b.amenityId === desk.amenityId).length;
  if (taken >= desk.capacity) return null;
  return existing ? "reactivate" : "create";
}

/**
 * Decides what the sync writes. Cancellations are planned first so the seats
 * they free count for this run's new days.
 * @param {Object} input
 * @param {Array<{id: string, partnerId: string}>} input.members Attached
 * @param {Array<Object>} input.partners Partner orgs
 * @param {Map<string, Object>} input.amenities id -> amenity
 * @param {Array<Object>} input.bookings Bookings starting today or later,
 *   any status, each with its doc id
 * @param {Array<Object>} input.days Output of partnerDeskDays
 * @param {number} input.nowMs Current time, epoch ms
 * @return {{create: Array<Object>, reactivate: Array<string>,
 *   cancel: Array<{id: string, reason: string}>}}
 */
function planPartnerDeskSync({
  members, partners, amenities, bookings, days, nowMs,
}) {
  const entitled = entitledDesks(members, partners, amenities);
  const syncedDays = bookings.filter(isSyncedPartnerDay);
  const cancel = bookingsToCancel(syncedDays, entitled, nowMs);
  const cancelled = new Set(cancel.map((c) => c.id));
  const byId = new Map(bookings.map((b) => [b.id, b]));
  // A renewal waiting for an admin does not hold its seat (renewals.js).
  const active = bookings.filter((b) => holdsSeat(b) && !cancelled.has(b.id));

  const create = [];
  const reactivate = [];
  entitled.forEach(({amenityId, partnerId}, uid) => {
    const amenity = amenities.get(amenityId);
    const capacity = deskCapacity(amenity);
    days.filter((day) => isDeskOpen(amenity, day)).forEach((day) => {
      const id = partnerDeskBookingId(uid, amenityId, day.dayKey);
      const existing = byId.get(id);
      const action = dayAction({
        existing, sameDay: overlapping(active, day),
        desk: {amenityId, capacity}, uid, amenities,
      });
      if (!action) return;
      const booking = {
        id, memberId: uid, amenityId, partnerId,
        startTime: day.start, endTime: day.end,
      };
      active.push(booking);
      if (action === "reactivate") reactivate.push(id);
      else create.push(booking);
    });
  });
  return {create, reactivate, cancel};
}

module.exports = {
  PARTNER_DESK_DAYS_AHEAD,
  PARTNER_DESK_MOVED_REASON,
  PARTNER_REMOVED_REASON,
  deskCapacity,
  partnerDeskBookingId,
  partnerDeskDays,
  partnerDeskPlanGroupId,
  isSyncedPartnerDay,
  planPartnerDeskSync,
};
