const {rangeOverlapsClosure} = require("./hubClosures");

const EDITABLE_EVENT_FIELDS = [
  "title", "description", "date", "duration", "capacity", "bannerUrl",
  "hostingProjects", "eventLink", "requestedAmenityId", "amenityNote",
];

const MAX_EVENT_CAPACITY = 50;
const MIN_DURATION_MINUTES = 15;
const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
const EVENT_SPACE_DEFAULTS = {
  weekdayStartHour: 18,
  weekendStartHour: 9,
  endHour: 22,
  availableDays: [0, 1, 2, 3, 4, 5, 6],
};

const getRevision = (event) => (
  Number.isInteger(event.revision) && event.revision > 0 ? event.revision : 1
);

const asRequiredString = (value, name) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
};

const asOptionalString = (value, name) => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${name} must be a string.`);
  return value.trim() || null;
};

const asFutureDate = (value, now) => {
  if (typeof value !== "string" ||
      !/(?:Z|[+-]\d{2}:?\d{2})$/.test(value)) {
    throw new Error("Event start must include a timezone offset.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= now) {
    throw new Error("Event start must be in the future.");
  }
  return date;
};

const getHubParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HUB_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type).value;
  return {
    weekday: get("weekday"),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
    day: `${get("year")}-${get("month")}-${get("day")}`,
  };
};

const getEventSpaceValidationError = ({eventDate, duration, amenity}) => {
  if (!amenity || amenity.type !== "event-space" ||
      amenity.isAvailable === false) {
    return "Requested amenity is not an available Event Hall.";
  }

  const start = eventDate instanceof Date ? eventDate : new Date(eventDate);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Event time is invalid.";
  }

  const closure = rangeOverlapsClosure(start, end);
  if (closure) {
    return `The Hub is closed ${closure.start} to ${closure.end} ` +
      `(${closure.label}).`;
  }

  const startParts = getHubParts(start);
  const endParts = getHubParts(end);
  const availableDays = Array.isArray(amenity.availableDays) ?
    amenity.availableDays : EVENT_SPACE_DEFAULTS.availableDays;
  const dayNumber = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      .indexOf(startParts.weekday);
  if (!availableDays.includes(dayNumber)) {
    return "Event Hall is not available on this day.";
  }
  if (startParts.day !== endParts.day) {
    return "Event must finish on the same Hub calendar day.";
  }

  const isWeekend = dayNumber === 0 || dayNumber === 6;
  const policyStartHour = isWeekend ? EVENT_SPACE_DEFAULTS.weekendStartHour :
    EVENT_SPACE_DEFAULTS.weekdayStartHour;
  const configuredStart = isWeekend ? amenity.startHour :
    amenity.weekdayStartHour;
  const startHour = Math.max(
      policyStartHour,
      typeof configuredStart === "number" ? configuredStart : policyStartHour);
  const configuredEnd = amenity.endHour;
  const endHour = Math.min(
      EVENT_SPACE_DEFAULTS.endHour,
      typeof configuredEnd === "number" ? configuredEnd :
        EVENT_SPACE_DEFAULTS.endHour);
  if (startParts.minutes < startHour * 60 || endParts.minutes > endHour * 60) {
    return "Event time is outside Event Hall availability.";
  }
  return null;
};

const asIntegerInRange = (value, name, min, max) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new Error(`${name} must be between ${min} and ${max}.`);
  }
  return number;
};

const normalizeEditPayload = (payload, event, now = new Date()) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Event data is required.");
  }
  const unknown = Object.keys(payload)
      .filter((key) => !EDITABLE_EVENT_FIELDS.includes(key));
  if (unknown.length) throw new Error("Event data includes protected fields.");

  const oldDate = event.date && typeof event.date.toDate === "function" ?
    event.date.toDate() : new Date(event.date);
  if (Number.isNaN(oldDate.getTime()) || oldDate <= now) {
    throw new Error("Started or past events cannot be edited.");
  }

  const date = asFutureDate(payload.date, now);
  const duration = asIntegerInRange(
      payload.duration, "Duration", MIN_DURATION_MINUTES, 1440);
  const capacity = asIntegerInRange(
      payload.capacity, "Capacity", 1, MAX_EVENT_CAPACITY);
  if (capacity < (event.attendees || []).length) {
    throw new Error("Capacity cannot be lower than the attendee count.");
  }

  return {
    title: asRequiredString(payload.title, "Title"),
    description: asRequiredString(payload.description, "Description"),
    date,
    duration,
    capacity,
    bannerUrl: asRequiredString(payload.bannerUrl, "Banner"),
    hostingProjects: asOptionalString(
        payload.hostingProjects, "Hosting projects"),
    eventLink: asOptionalString(payload.eventLink, "Event link"),
    requestedAmenityId: asOptionalString(
        payload.requestedAmenityId, "Requested amenity"),
    amenityNote: asOptionalString(payload.amenityNote, "Amenity note"),
  };
};

const getBookingWindow = (date, duration) => {
  const eventStart = new Date(date);
  const startTime = new Date(eventStart.getTime() - 60 * 60 * 1000);
  const endTime = new Date(eventStart.getTime() + (duration + 60) * 60 * 1000);
  return {startTime, endTime};
};

const getNotificationSubjectId = (eventId, revision, transition) =>
  `${eventId}_${revision}_${transition}`;

module.exports = {
  EDITABLE_EVENT_FIELDS,
  MAX_EVENT_CAPACITY,
  getRevision,
  normalizeEditPayload,
  getBookingWindow,
  getNotificationSubjectId,
  getEventSpaceValidationError,
};
