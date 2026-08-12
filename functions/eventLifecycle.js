const EDITABLE_EVENT_FIELDS = [
  "title", "description", "date", "duration", "capacity", "bannerUrl",
  "hostingProjects", "eventLink", "requestedAmenityId", "amenityNote",
];

const MAX_EVENT_CAPACITY = 50;
const MIN_DURATION_MINUTES = 15;

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
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date <= now) {
    throw new Error("Event start must be in the future.");
  }
  return date;
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
};
