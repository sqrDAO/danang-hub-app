// One-off backfill: the Hub-closure cancellations were applied on 2026-08-19,
// before booking_cancelled notifications existed, so four members lost bookings
// with no in-app trace. This creates the notifications they should have had.
//
// Idempotent by construction: createNotificationIfAbsent's document id is
// `${type}_${userId}_${subjectId}` written with .create(), and fixed-desk
// bookings share their planGroupId as the subject — so re-running is a no-op and
// three cancelled days of one plan produce one notification.
//
// Usage (from the repo root, as an owner):
//   node functions/scripts/backfill-closure-cancellation-notices.cjs          # dry run
//   node functions/scripts/backfill-closure-cancellation-notices.cjs --apply
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

const PROJECT_ID = "danang-hub-app";
const REASON_PREFIX = "hub-closure";
const SAFE_DOC_ID_PART = /^[A-Za-z0-9_-]{1,128}$/;
const APPLY = process.argv.includes("--apply");

initializeApp({credential: applicationDefault(), projectId: PROJECT_ID});
const db = getFirestore();

const subjectIdFor = (booking, bookingId) =>
  SAFE_DOC_ID_PART.test(booking.planGroupId || "") ?
    booking.planGroupId : bookingId;

(async () => {
  const snap = await db.collection("bookings")
      .where("status", "==", "cancelled").get();

  const targets = snap.docs.filter((d) => {
    const reason = d.data().cancelledReason;
    return typeof reason === "string" && reason.startsWith(REASON_PREFIX);
  });

  // Collapse to one notification per (member, subject) exactly as the trigger
  // would, so the dry-run count is the real number of notifications.
  const planned = new Map();
  for (const doc of targets) {
    const b = doc.data();
    const subjectId = subjectIdFor(b, doc.id);
    const id = `booking_cancelled_${b.memberId}_${subjectId}`;
    if (planned.has(id)) continue;
    const amenity = await db.collection("amenities").doc(b.amenityId).get();
    planned.set(id, {
      userId: b.memberId,
      type: "booking_cancelled",
      bookingId: doc.id,
      amenityName: amenity.exists && amenity.data().name ?
        amenity.data().name : b.amenityId,
      planType: b.planType || "standard",
      cancelledReason: b.cancelledReason,
      isHubClosure: true,
      link: "/member/bookings",
      read: false,
    });
  }

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${targets.length} cancelled ` +
    `booking(s) collapse to ${planned.size} notification(s)`);
  for (const id of planned.keys()) console.log(`  ${id}`);

  if (!APPLY) {
    console.log("\nre-run with --apply to write");
    return;
  }

  let created = 0;
  let existing = 0;
  for (const [id, data] of planned) {
    try {
      await db.collection("notifications").doc(id)
          .create({...data, createdAt: FieldValue.serverTimestamp()});
      created++;
    } catch (error) {
      if (error.code === 6 || /already exists/i.test(error.message || "")) {
        existing++;
        continue;
      }
      throw error;
    }
  }
  console.log(`created ${created}, already present ${existing}`);
})().catch((error) => {
  console.error("ERROR:", error.message);
  process.exit(1);
});
