// Emulator-only repro for the reviewEvent double-booking race: seeds pending
// events that request the same Event Hall slot, approves them concurrently,
// and counts the bookings each slot ends up with. Exits 1 if any slot is
// double-booked or any approval fails for a reason other than the conflict.
//
// Not part of `npm test` (pure helpers only): the race needs live Firestore
// transactions and the Functions emulator.
//
// Usage (from the repo root):
//   firebase emulators:exec --project demo-danang-hub-race \
//     --only firestore,functions \
//     "node functions/scripts/repro-reviewevent-race.js"
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, Timestamp} = require("firebase-admin/firestore");

const PROJECT_ID = process.env.GCLOUD_PROJECT || "";
const FUNCTIONS_HOST = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
const ROUNDS = 5;
const RACERS = 2;
const AMENITY_ID = "race-event-hall";
const ADMIN_UID = "race-admin";
const ACTIVE = ["pending", "approved", "checked-in"];

if (!PROJECT_ID.startsWith("demo-") || !process.env.FIRESTORE_EMULATOR_HOST) {
  console.error("Run this only inside `firebase emulators:exec` with a " +
    "demo- project and the firestore and functions emulators.");
  process.exit(1);
}

initializeApp({projectId: PROJECT_ID});
const db = getFirestore();

// The Functions emulator skips ID-token verification for callables, so an
// unsigned token carrying the admin uid is enough (no Auth emulator needed).
const getAdminIdToken = async () => {
  await db.collection("members").doc(ADMIN_UID)
      .set({membershipType: "admin", email: "race-admin@example.test"});
  const now = Math.floor(Date.now() / 1000);
  const encode = (part) =>
    Buffer.from(JSON.stringify(part)).toString("base64url");
  return `${encode({alg: "none", typ: "JWT"})}.${encode({
    iss: `https://securetoken.google.com/${PROJECT_ID}`,
    aud: PROJECT_ID,
    sub: ADMIN_UID,
    user_id: ADMIN_UID,
    iat: now,
    auth_time: now,
    exp: now + 3600,
    firebase: {sign_in_provider: "custom"},
  })}.`;
};

// Saturday 10:00 Hub time, `weeksAhead` weeks out: inside Event Hall hours.
const saturdayAt10 = (weeksAhead) => {
  const date = new Date(Date.now() + weeksAhead * 7 * 24 * 60 * 60 * 1000);
  const hubDay = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  hubDay.setUTCDate(hubDay.getUTCDate() + (6 - hubDay.getUTCDay()));
  return new Date(Date.UTC(hubDay.getUTCFullYear(), hubDay.getUTCMonth(),
      hubDay.getUTCDate(), 10 - 7));
};

const seedRound = async (round) => {
  const date = saturdayAt10(round + 2);
  const ids = [];
  for (let i = 0; i < RACERS; i++) {
    const ref = await db.collection("events").add({
      title: `Race round ${round} event ${i}`,
      organizerId: `race-organizer-${i}`,
      status: "pending",
      revision: 1,
      date: Timestamp.fromDate(date),
      duration: 120,
      capacity: 10,
      requestedAmenityId: AMENITY_ID,
      attendees: [],
      createdAt: new Date().toISOString(),
    });
    ids.push(ref.id);
  }
  return ids;
};

const approve = async (idToken, eventId) => {
  const res = await fetch(
      `http://${FUNCTIONS_HOST}/${PROJECT_ID}/us-central1/reviewEvent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          data: {eventId, expectedRevision: 1, action: "approved"},
        }),
      });
  const body = await res.json();
  return body.error ? {error: body.error.status} : {ok: true};
};

const countBookings = async (eventIds) => {
  const snap = await db.collection("bookings")
      .where("amenityId", "==", AMENITY_ID)
      .where("status", "in", ACTIVE).get();
  return snap.docs.filter((d) => eventIds.includes(d.data().eventId)).length;
};

const runRound = async (idToken, round) => {
  const eventIds = await seedRound(round);
  const results = await Promise.all(eventIds.map((id) => approve(idToken, id)));
  const bookings = await countBookings(eventIds);
  const approved = results.filter((r) => r.ok).length;
  const conflicts = results.filter((r) => r.error === "FAILED_PRECONDITION");
  const unexpected = results.filter((r) =>
    r.error && r.error !== "FAILED_PRECONDITION");
  console.log(`round ${round}: ${bookings} booking(s), ${approved} ` +
    `approved, ${conflicts.length} failed-precondition` +
    (unexpected.length ? `, unexpected: ${JSON.stringify(unexpected)}` : ""));
  return bookings === 1 && approved === 1 && unexpected.length === 0;
};

(async () => {
  await db.collection("amenities").doc(AMENITY_ID).set({
    name: "Race Event Hall",
    type: "event-space",
    isAvailable: true,
    capacity: 100,
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    startHour: 9,
    endHour: 22,
  });
  const idToken = await getAdminIdToken();
  let passed = 0;
  for (let round = 0; round < ROUNDS; round++) {
    if (await runRound(idToken, round)) passed++;
  }
  console.log(`${passed}/${ROUNDS} rounds created exactly one booking.`);
  process.exit(passed === ROUNDS ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
