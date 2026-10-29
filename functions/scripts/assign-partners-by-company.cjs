// One-off: attach existing members of partner orgs (9AM Games, DiiD) to their
// partner by matching the free-text `company` on their profile. Members type
// that field themselves, so it is unreliable — read the dry run before applying.
//
// Run after an admin has created the partners on /admin/members. Members who
// already have a partnerId are left alone; their fixed-desk plans are not
// touched (they expire on their own).
//
// Usage (from the repo root, as an owner):
//   node functions/scripts/assign-partners-by-company.cjs          # dry run
//   node functions/scripts/assign-partners-by-company.cjs --apply
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const {matchPartnerForCompany, unusedAliasKeys} = require("../partners");

const PROJECT_ID = "danang-hub-app";
const APPLY = process.argv.includes("--apply");

initializeApp({credential: applicationDefault(), projectId: PROJECT_ID});
const db = getFirestore();

async function run() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY RUN"}\n`);

  const partnersSnap = await db.collection("partners").get();
  const partners = partnersSnap.docs.map((d) => ({id: d.id, name: d.get("name")}));
  if (partners.length === 0) {
    console.log("No partners found. Create them on /admin/members first.");
    return;
  }
  console.log(`Partners: ${partners.map((p) => `${p.name} [${p.id}]`).join(", ")}\n`);
  const unused = unusedAliasKeys(partners);
  if (unused.length > 0) {
    console.log(`WARNING: PARTNER_ALIASES keys match no partner name (renamed?): ${unused.join(", ")}\n`);
  }

  const membersSnap = await db.collection("members").get();
  const affected = [];
  for (const docSnap of membersSnap.docs) {
    const member = docSnap.data();
    if (member.partnerId) continue;
    const partner = matchPartnerForCompany(member.company, partners);
    if (!partner) continue;
    affected.push({uid: docSnap.id, name: member.displayName, company: member.company, partner});
  }

  if (affected.length === 0) {
    console.log("No unattached members match a partner. Nothing to do.");
    return;
  }

  console.log(`Found ${affected.length} member(s) to attach:\n`);
  for (const a of affected) {
    console.log(`  [${a.uid}] ${JSON.stringify(a.name)} company=${JSON.stringify(a.company)}`);
    console.log(`    partnerId → ${a.partner.id} (${a.partner.name})`);
  }

  if (!APPLY) {
    console.log("\nRun with --apply to commit these changes.");
    return;
  }

  console.log("\nApplying...");
  const now = new Date().toISOString();
  const batch = db.batch();
  for (const a of affected) {
    batch.update(db.collection("members").doc(a.uid), {partnerId: a.partner.id, updatedAt: now});
  }
  await batch.commit();
  console.log(`Done. Attached ${affected.length} member(s).`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
