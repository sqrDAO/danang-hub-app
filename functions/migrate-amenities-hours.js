/**
 * Migration: set startHour to 9 on amenity docs still storing an earlier hour.
 *
 * Commit 1b276d5 moved the code defaults to 9am–6pm and migrated bookings,
 * but amenity docs created before it still store startHour: 8 — and the
 * stored value overrides the default in BookingCalendar and
 * checkBookingConflicts.
 *
 * Usage:
 *   node migrate-amenities-hours.js            # dry run — prints what would change
 *   node migrate-amenities-hours.js --apply    # applies the changes to Firestore
 */

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ projectId: "danang-hub-app" });
const db = getFirestore();

const NEW_START_HOUR = 9;

async function run() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  const snap = await db.collection("amenities").get();
  const affected = [];

  for (const docSnap of snap.docs) {
    const amenity = { id: docSnap.id, ...docSnap.data() };
    if (typeof amenity.startHour !== "number") continue; // missing → code default (9) already applies
    if (amenity.startHour >= NEW_START_HOUR) continue;

    affected.push({
      id: amenity.id,
      name: amenity.name,
      type: amenity.type,
      oldStartHour: amenity.startHour,
    });
  }

  if (affected.length === 0) {
    console.log("No amenities found with startHour before 9 AM. Nothing to do.");
    return;
  }

  console.log(`Found ${affected.length} amenity(ies) to fix:\n`);
  for (const a of affected) {
    console.log(`  [${a.id}] type=${a.type} name=${JSON.stringify(a.name)}`);
    console.log(`    startHour: ${a.oldStartHour} → ${NEW_START_HOUR}`);
  }

  if (!apply) {
    console.log(`\nRun with --apply to commit these changes.`);
    return;
  }

  console.log("\nApplying...");
  const batch = db.batch();
  for (const a of affected) {
    batch.update(db.collection("amenities").doc(a.id), {
      startHour: NEW_START_HOUR,
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  console.log(`Done. ${affected.length} amenity(ies) updated.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
