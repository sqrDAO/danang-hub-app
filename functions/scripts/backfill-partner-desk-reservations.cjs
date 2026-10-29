// One-off: mark each partner's desk as reserved for it
// (amenities.reservedForPartnerId), so other members can no longer see or
// book it. Desks picked on /admin/members after this change are reserved by
// the Partners panel itself; this covers the ones picked before it.
//
// Only amenities a partner points at through deskAmenityId are touched. A
// desk already reserved for the same partner is skipped; one reserved for a
// different partner, or claimed by two partners, is reported and left alone.
//
// Usage (from the repo root, as an owner):
//   node functions/scripts/backfill-partner-desk-reservations.cjs          # dry run
//   node functions/scripts/backfill-partner-desk-reservations.cjs --apply
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

const PROJECT_ID = "danang-hub-app";
const APPLY = process.argv.includes("--apply");

initializeApp({credential: applicationDefault(), projectId: PROJECT_ID});
const db = getFirestore();

// Partners grouped by the desk they point at.
function claimsByDesk(partners) {
  const claims = new Map();
  for (const partner of partners) {
    if (!partner.deskAmenityId) continue;
    claims.set(partner.deskAmenityId, [...(claims.get(partner.deskAmenityId) || []), partner]);
  }
  return claims;
}

async function planUpdates(claims) {
  const updates = [];
  for (const [amenityId, claimants] of claims) {
    const label = claimants.map((p) => `${p.name} [${p.id}]`).join(", ");
    if (claimants.length > 1) {
      console.log(`  SKIP ${amenityId}: claimed by several partners (${label})`);
      continue;
    }
    const partner = claimants[0];
    const amenity = await db.collection("amenities").doc(amenityId).get();
    if (!amenity.exists) {
      console.log(`  SKIP ${amenityId}: amenity not found (partner ${label})`);
      continue;
    }
    const current = amenity.get("reservedForPartnerId") ?? null;
    const name = JSON.stringify(amenity.get("name"));
    if (current === partner.id) {
      console.log(`  OK   [${amenityId}] ${name} already reserved for ${label}`);
      continue;
    }
    if (current !== null) {
      console.log(`  SKIP [${amenityId}] ${name}: reserved for another partner (${current})`);
      continue;
    }
    if (amenity.get("type") !== "desk") {
      console.log(`  WARN [${amenityId}] ${name} is type ${amenity.get("type")}, not desk`);
    }
    console.log(`  SET  [${amenityId}] ${name} reservedForPartnerId → ${partner.id} (${partner.name})`);
    updates.push({amenityId, partnerId: partner.id});
  }
  return updates;
}

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const partnersSnap = await db.collection("partners").get();
  const partners = partnersSnap.docs.map((d) => ({
    id: d.id,
    name: d.get("name"),
    deskAmenityId: d.get("deskAmenityId") || null,
  }));
  const claims = claimsByDesk(partners);
  if (claims.size === 0) {
    console.log("No partner has a desk. Nothing to do.");
    return;
  }

  const updates = await planUpdates(claims);
  if (updates.length === 0) {
    console.log("\nNo desk needs a reservation. Nothing to do.");
    return;
  }

  if (!APPLY) {
    console.log(`\n${updates.length} desk(s) would be reserved. Run with --apply to commit.`);
    return;
  }

  console.log("\nApplying...");
  const now = new Date().toISOString();
  const batch = db.batch();
  for (const u of updates) {
    batch.update(db.collection("amenities").doc(u.amenityId), {reservedForPartnerId: u.partnerId, updatedAt: now});
  }
  await batch.commit();
  console.log(`Done. Reserved ${updates.length} desk(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
