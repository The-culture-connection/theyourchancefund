// Firebase Admin SDK connection (shared by both TYCF services).
//
// Production (Railway): set FIREBASE_SERVICE_ACCOUNT to the full service-account
//   JSON from Firebase console → Project settings → Service accounts.
// Local testing: set FIRESTORE_EMULATOR_HOST (e.g. 127.0.0.1:8080) and
//   GCLOUD_PROJECT; no real credentials are needed against the emulator.
const admin = require('firebase-admin');

function init() {
  if (admin.apps.length) return admin.firestore();

  if (process.env.FIRESTORE_EMULATOR_HOST) {
    const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-tycf';
    admin.initializeApp({ projectId });
    console.log('[firestore] using emulator at', process.env.FIRESTORE_EMULATOR_HOST);
  } else {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      console.error('FATAL: FIREBASE_SERVICE_ACCOUNT is not set. Paste the service-account JSON into this variable.');
      process.exit(1);
    }
    let creds;
    try {
      creds = JSON.parse(raw);
    } catch (e) {
      console.error('FATAL: FIREBASE_SERVICE_ACCOUNT is not valid JSON.', e.message);
      process.exit(1);
    }
    admin.initializeApp({
      credential: admin.credential.cert(creds),
      projectId: creds.project_id,
    });
    console.log('[firestore] connected to project', creds.project_id);
  }

  const db = admin.firestore();
  // Empty optional fields arrive as undefined; don't reject those writes.
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

const db = init();
module.exports = { admin, db };
