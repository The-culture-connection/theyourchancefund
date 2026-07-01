# The Your Chance Fund — Website + Admin Portal

Two small Node/Express apps that share one **Cloud Firestore** database (Firebase):

| Folder      | Railway service | What it does |
|-------------|-----------------|--------------|
| `website/`  | **website**     | Public landing page, funding **application form** (the 10 questions), and **"Become a Donor"** form. Writes submissions to Firestore. |
| `admin/`    | **admin**       | Password-protected portal. Lists applications **filterable by submission date and business type**, lists donor inquiries, and exports either to CSV. Reads from Firestore. |

Both apps run on **Railway**; the data lives in **Firestore** in a Google Firebase project. They talk to Firestore using the **Firebase Admin SDK**, authenticated by a service-account key you paste into each Railway service as an environment variable. No files are stored (pitch decks are links) and there are no Cloud Functions — the Express apps are the backend.

Brand colors are taken from `Homepage.pdf`: navy `#14315B`, green `#4A9A3F`, gold `#D8A22E`, purple `#6B3FA0`.

```
website/   -> Railway service "website"  ┐
admin/     -> Railway service "admin"    ├─ both use ->  Firestore (Firebase project)
firestore.rules / firestore.indexes.json -> deployed to Firebase
```

---

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `the-your-chance-fund`). Google Analytics is optional.
2. In the project, open **Build → Firestore Database → Create database**.
   - Start in **production mode** (our security rules lock down all direct client access; only the Admin SDK reaches the data).
   - Pick a location close to your users (e.g. `us-central`).
3. Create a **service account key** (this is how the apps authenticate):
   - **Project settings (gear) → Service accounts → Generate new private key** → downloads a JSON file.
   - Keep this file secret. **Do not commit it.** You'll paste its contents into Railway in step 3.

### Deploy the security rules and index
From this folder (one-time, requires the Firebase CLI — `npm i -g firebase-tools`, then `firebase login`):

```bash
firebase use <your-project-id>
firebase deploy --only firestore:rules,firestore:indexes
```

- `firestore.rules` denies all direct browser access (everything goes through the Admin SDK).
- `firestore.indexes.json` creates the composite index the admin filter needs (business type + date). *If you skip this, the combined "business type + date range" filter will error until the index exists; Firestore also prints a one-click link to create it.*

---

## 2. Push this code to GitHub

Railway deploys from a GitHub repo. This repo is already initialized; just push your latest changes:

```bash
git add .
git commit -m "Switch backend to Firestore"
git push
```

---

## 3. Deploy on Railway (two services, one project)

### Website service
1. **railway.app → New Project → Deploy from GitHub repo →** select this repo.
2. Open the service → **Settings → Root Directory** → `website`.
3. **Settings → Networking → Generate Domain** (this is your public site URL).
4. **Variables** → add:
   | Name | Value |
   |------|-------|
   | `FIREBASE_SERVICE_ACCOUNT` | Paste the **entire contents** of the service-account JSON from step 1. Railway accepts multi-line values. |

### Admin service
1. In the same project: **New → GitHub Repo →** the **same** repo again.
2. **Settings → Root Directory** → `admin`.
3. **Settings → Networking → Generate Domain** (admin URL — share only with the committee).
4. **Variables** → add:
   | Name | Value |
   |------|-------|
   | `FIREBASE_SERVICE_ACCOUNT` | The **same** service-account JSON (same Firebase project as the website). |
   | `ADMIN_PASSWORD` | A strong password for the committee to log in. |
   | `SESSION_SECRET` | Any long random string (keeps logins valid across restarts). |
   | `NODE_ENV` | `production` |

Start command (`npm start`) and health check (`/healthz`) are already set in each folder's `railway.json`.

### Verify
- Visit the **website** domain → submit a test application and a test donor inquiry.
- Visit the **admin** domain → log in with `ADMIN_PASSWORD` → your test entries appear. Try the **business type** and **date** filters and **Export CSV**.
- You can also see the raw records in **Firebase console → Firestore Database** (`applications` and `donors` collections).

---

## Run locally

You need Node 18+. Two options for the database:

### Option A — Firestore emulator (no real Firebase needed)
Requires the Firebase CLI and Java (for the emulator).

```bash
# Terminal 1 — start the emulator from this folder
firebase emulators:start --only firestore --project demo-tycf

# Terminal 2 — website
cd website && npm install
# PowerShell: $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="demo-tycf"
npm start                      # http://localhost:3000

# Terminal 3 — admin
cd admin && npm install
# PowerShell: $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"; $env:GCLOUD_PROJECT="demo-tycf"; $env:ADMIN_PASSWORD="test"
npm start                      # http://localhost:3001
```

### Option B — real Firebase
Set `FIREBASE_SERVICE_ACCOUNT` (the JSON contents) instead of the emulator variables, plus `ADMIN_PASSWORD` for the admin app.

See `website/.env.example` and `admin/.env.example`.

---

## Environment variables reference

**website**
| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ (prod) | Full service-account JSON. |
| `PORT` | auto | Set by Railway. |
| `FIRESTORE_EMULATOR_HOST` / `GCLOUD_PROJECT` | local only | Use the emulator instead of real Firebase. |

**admin**
| Variable | Required | Notes |
|----------|----------|-------|
| `FIREBASE_SERVICE_ACCOUNT` | ✅ (prod) | **Same** Firebase project as the website. |
| `ADMIN_PASSWORD` | ✅ | Committee login password. |
| `SESSION_SECRET` | recommended | Random string; persists sessions across restarts. |
| `NODE_ENV` | recommended | `production` enables secure cookies. |
| `PORT` | auto | Set by Railway. |
| `FIRESTORE_EMULATOR_HOST` / `GCLOUD_PROJECT` | local only | Use the emulator instead of real Firebase. |

---

## Data model (Firestore)

- **`applications`** — one document per applicant: identity/business fields + the 10 application questions (Q7 pitch deck and Q8 demo are stored as links). `created_at` is a server timestamp.
- **`donors`** — one document per "Become a Donor" inquiry: `name`, `email`, `phone`, `created_at`.

Data access lives in `store.js` (identical in both services); the Firebase connection is in `firestore.js`.

## Editing content
- Landing page copy/sections: `website/public/index.html`
- Application questions: `website/public/apply.html` (and the matching keys in `website/server.js`)
- Business-type options: the `<select id="business_type">` in `website/public/apply.html` **and** the `BUSINESS_TYPES` list in `admin/server.js` (keep them in sync)
- Brand colors: the `:root` block in `website/public/styles.css` and `admin/public/admin.css`
