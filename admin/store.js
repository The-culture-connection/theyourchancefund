// Data access for TYCF, backed by Cloud Firestore.
// Two collections: `applications` and `donors`. Each document carries a
// server-set `created_at` Timestamp. All functions return plain objects with
// `id` and a JavaScript Date for `created_at`, so templates/CSV work unchanged.
const { admin, db } = require('./firestore');
const { Timestamp, FieldValue } = admin.firestore;

const APPLICATIONS = 'applications';
const DONORS = 'donors';

// Convert YYYY-MM-DD filter strings into an inclusive day window.
// `to` is inclusive of the whole day, so the upper bound is the next midnight (exclusive).
function dayWindow(from, to) {
  const w = {};
  if (from) w.start = Timestamp.fromDate(new Date(from + 'T00:00:00Z'));
  if (to) {
    const d = new Date(to + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    w.endExclusive = Timestamp.fromDate(d);
  }
  return w;
}

function toPlain(doc) {
  const d = doc.data();
  const created = d.created_at && d.created_at.toDate ? d.created_at.toDate() : (d.created_at || null);
  return { ...d, id: doc.id, created_at: created };
}

async function addApplication(data) {
  const ref = await db.collection(APPLICATIONS).add({ ...data, created_at: FieldValue.serverTimestamp() });
  return ref.id;
}

async function addDonor(data) {
  const ref = await db.collection(DONORS).add({ ...data, created_at: FieldValue.serverTimestamp() });
  return ref.id;
}

// Applications, newest first, filtered by business type and/or date range.
async function listApplications({ type, from, to } = {}) {
  let q = db.collection(APPLICATIONS);
  if (type) q = q.where('business_type', '==', type);
  const { start, endExclusive } = dayWindow(from, to);
  if (start) q = q.where('created_at', '>=', start);
  if (endExclusive) q = q.where('created_at', '<', endExclusive);
  const snap = await q.orderBy('created_at', 'desc').get();
  return snap.docs.map(toPlain);
}

async function getApplication(id) {
  const doc = await db.collection(APPLICATIONS).doc(id).get();
  return doc.exists ? toPlain(doc) : null;
}

// Donor inquiries, newest first, optionally filtered by date range.
async function listDonors({ from, to } = {}) {
  let q = db.collection(DONORS);
  const { start, endExclusive } = dayWindow(from, to);
  if (start) q = q.where('created_at', '>=', start);
  if (endExclusive) q = q.where('created_at', '<', endExclusive);
  const snap = await q.orderBy('created_at', 'desc').get();
  return snap.docs.map(toPlain);
}

module.exports = { addApplication, addDonor, listApplications, getApplication, listDonors };
