// One-off backfill: members.email now mirrors the Firebase Auth email
// (AuthContext syncs it whenever a profile loads), but members who don't sign
// in again keep the address they once typed. This copies every Auth email onto
// its profile. An account with no Auth email (a wallet account) types its own
// contact address, so it is left alone, as the login sync does.
//
// Idempotent: a profile that already matches is left alone, so re-running
// writes nothing. Profiles with no Auth account are reported, not changed.
//
// Usage (from the repo root, as an owner):
//   node functions/scripts/sync-member-emails.cjs          # dry run
//   node functions/scripts/sync-member-emails.cjs --apply
const {initializeApp, applicationDefault} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore} = require("firebase-admin/firestore");

const PROJECT_ID = "danang-hub-app";
const APPLY = process.argv.includes("--apply");
const BATCH_LIMIT = 500;

initializeApp({credential: applicationDefault(), projectId: PROJECT_ID});
const db = getFirestore();

// Enough to recognise an address in the log without printing it whole.
const mask = (email) => {
  if (!email) return "''";
  const [name, domain] = email.split("@");
  return `${name.slice(0, 2)}***@${domain}`;
};

const listAuthEmails = async () => {
  const emails = new Map();
  let pageToken;
  do {
    const page = await getAuth().listUsers(1000, pageToken);
    for (const user of page.users) emails.set(user.uid, user.email || "");
    pageToken = page.pageToken;
  } while (pageToken);
  return emails;
};

(async () => {
  const authEmails = await listAuthEmails();
  const members = await db.collection("members").get();

  const changes = [];
  const noAuthAccount = [];
  for (const doc of members.docs) {
    if (!authEmails.has(doc.id)) {
      noAuthAccount.push(doc.id);
      continue;
    }
    const current = doc.data().email || "";
    const next = authEmails.get(doc.id);
    if (!next || current === next) continue;
    changes.push({ref: doc.ref, uid: doc.id, current, next});
  }

  console.log(`${APPLY ? "APPLY" : "DRY RUN"}: ${members.size} profile(s), ` +
    `${changes.length} to change to the sign-in email, ` +
    `${noAuthAccount.length} without an Auth account (left alone)`);
  for (const c of changes) {
    const uid = c.uid.slice(0, 10);
    console.log(`  ${uid}…  ${mask(c.current)} -> ${mask(c.next)}`);
  }

  if (!APPLY) {
    console.log("\nre-run with --apply to write");
    return;
  }

  const updatedAt = new Date().toISOString();
  for (let i = 0; i < changes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const c of changes.slice(i, i + BATCH_LIMIT)) {
      batch.update(c.ref, {email: c.next, updatedAt});
    }
    await batch.commit();
  }
  console.log(`\nupdated ${changes.length} profile(s)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
