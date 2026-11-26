// Per-member limits on bookings made through MCP (#301). The 60/min rate
// limit is per token or grant; these hold across all of a member's
// credentials, so N connected apps can't hold N times as many rooms.
const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
// Future pending non-desk MCP bookings a member may hold at once. Desks are
// left out: the 40 h monthly limit already caps them.
const MCP_OPEN_PENDING_LIMIT = 5;
// MCP creates per member per Hub day, desks included.
const MCP_DAILY_CREATE_LIMIT = 20;
// Above this many pending MCP bookings the cap can't be counted safely.
const MCP_PENDING_SCAN_LIMIT = 100;

const hubDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: HUB_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
});
/**
 * Hub calendar day as YYYY-MM-DD.
 * @param {number} ms Epoch milliseconds
 * @return {string}
 */
const hubDay = (ms) => hubDayFormat.format(new Date(ms));

const toMillis = (value) => value && typeof value.toMillis === "function" ?
  value.toMillis() :
  value instanceof Date ? value.getTime() : Date.parse(value);

/**
 * Counts future pending non-desk bookings. Unknown amenities count, so a
 * deleted amenity can't hide a booking from the cap.
 * @param {Array<Object>} bookings Pending MCP booking data
 * @param {Map<string, Object|undefined>} amenities Amenity data by ID
 * @param {number} now Epoch milliseconds
 * @return {number}
 */
const countOpenPending = (bookings, amenities, now) => bookings.filter((b) =>
  b.status === "pending" && toMillis(b.endTime) > now &&
  (amenities.get(b.amenityId) || {}).type !== "desk").length;

/**
 * The member's counter after one more create today, or null once the daily
 * limit is reached. A counter from an earlier day starts over.
 * @param {Object|undefined} quota Stored mcpMemberQuotas data
 * @param {string} day Today's Hub day
 * @return {{day: string, creates: number}|null}
 */
const nextDailyQuota = (quota, day) => {
  const used = quota && quota.day === day ? Number(quota.creates) || 0 : 0;
  return used >= MCP_DAILY_CREATE_LIMIT ? null : {day, creates: used + 1};
};

module.exports = {hubDay, countOpenPending, nextDailyQuota,
  MCP_OPEN_PENDING_LIMIT, MCP_DAILY_CREATE_LIMIT, MCP_PENDING_SCAN_LIMIT};
