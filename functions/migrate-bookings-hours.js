/**
 * Migration: shift bookings that start before 9 AM (HCM time) to comply with new 9am–6pm hours.
 *
 * Usage:
 *   node migrate-bookings-hours.js            # dry run — prints what would change
 *   node migrate-bookings-hours.js --apply    # applies the changes to Firestore
 */

const admin = require("firebase-admin");

admin.initializeApp({ projectId: "danang-hub-app" });
const db = admin.firestore();

const HUB_TIMEZONE = "Asia/Ho_Chi_Minh";
const ACTIVE_STATUSES = ["pending", "approved"];
const NEW_START_HOUR = 9;
const END_HOUR = 18;

function toHCMDate(isoString) {
  // Returns a Date whose .getHours() reflects HCM local time by using
  // Intl.DateTimeFormat parts (avoids env TZ dependency).
  const d = new Date(isoString);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: HUB_TIMEZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parseInt(parts.find((p) => p.type === type).value);
  return {
    year: get("year"), month: get("month") - 1, day: get("day"),
    hour: get("hour"), minute: get("minute"), second: get("second"),
    originalUtcMs: d.getTime(),
  };
}

function buildHCMTimestamp(year, month, day, hour, minute, second) {
  // Build a UTC ms value for a given HCM local date/time.
  const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}+07:00`;
  return new Date(iso).getTime();
}

async function run() {
  const apply = process.argv.includes("--apply");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  const snap = await db.collection("bookings").get();
  const affected = [];

  for (const docSnap of snap.docs) {
    const booking = { id: docSnap.id, ...docSnap.data() };

    if (!ACTIVE_STATUSES.includes(booking.status)) continue;
    if (!booking.startTime) continue;

    // Skip bookings with Firestore Timestamps (convert) or unparseable values
    let startRaw = booking.startTime;
    if (startRaw && typeof startRaw === "object" && startRaw.toDate) {
      startRaw = startRaw.toDate().toISOString();
    }
    if (isNaN(new Date(startRaw).getTime())) {
      console.warn(`  [${booking.id}] skipping — invalid startTime: ${JSON.stringify(startRaw)}`);
      continue;
    }

    const start = toHCMDate(startRaw);
    if (start.hour >= NEW_START_HOUR) continue; // already within hours

    const newStartMs = buildHCMTimestamp(
      start.year, start.month, start.day,
      NEW_START_HOUR, 0, 0
    );
    const offsetMs = newStartMs - start.originalUtcMs;
    const newStartIso = new Date(newStartMs).toISOString();

    let newEndIso;
    if (booking.planType === "fixed-desk") {
      // Fixed desk: new product is exactly 9 AM–6 PM; preserve end at 18:00
      newEndIso = new Date(
        buildHCMTimestamp(start.year, start.month, start.day, END_HOUR, 0, 0)
      ).toISOString();
    } else {
      // Regular booking: preserve duration
      let endRaw = booking.endTime;
      if (endRaw && typeof endRaw === "object" && endRaw.toDate) {
        endRaw = endRaw.toDate().toISOString();
      }
      const end = toHCMDate(endRaw);
      newEndIso = new Date(end.originalUtcMs + offsetMs).toISOString();
    }

    affected.push({
      id: booking.id,
      memberId: booking.memberId,
      status: booking.status,
      planType: booking.planType || "regular",
      oldStart: startRaw,
      oldEnd: (booking.endTime && typeof booking.endTime === "object" && booking.endTime.toDate)
        ? booking.endTime.toDate().toISOString() : booking.endTime,
      newStart: newStartIso,
      newEnd: newEndIso,
    });
  }

  if (affected.length === 0) {
    console.log("No active bookings found with start time before 9 AM. Nothing to do.");
    return;
  }

  console.log(`Found ${affected.length} booking(s) to fix:\n`);
  for (const b of affected) {
    console.log(`  [${b.id}] status=${b.status} type=${b.planType}`);
    console.log(`    start: ${b.oldStart} → ${b.newStart}`);
    console.log(`    end:   ${b.oldEnd} → ${b.newEnd}`);
  }

  if (!apply) {
    console.log(`\nRun with --apply to commit these changes.`);
    return;
  }

  console.log("\nApplying...");
  const batch = db.batch();
  for (const b of affected) {
    batch.update(db.collection("bookings").doc(b.id), {
      startTime: b.newStart,
      endTime: b.newEnd,
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  console.log(`Done. ${affected.length} booking(s) updated.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
