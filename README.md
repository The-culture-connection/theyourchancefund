# The Your Chance Fund — Website + Admin Portal

Two small Node/Express apps that share one PostgreSQL database:

| Folder      | Railway service | What it does |
|-------------|-----------------|--------------|
| `website/`  | **website**     | Public landing page, funding **application form** (the 10 questions), and **"Become a Donor"** form. Writes submissions to the database. |
| `admin/`    | **admin**       | Password-protected portal. Lists applications **filterable by submission date and business type**, lists donor inquiries, and exports either to CSV. |
| `shared/`   | —               | The canonical `schema.sql` (each service also keeps a local copy so it deploys standalone). |

Brand colors are taken from `Homepage.pdf`: navy `#14315B`, green `#4A9A3F`, gold `#D8A22E`, purple `#6B3FA0`.

---

## Run locally

You need Node 18+ and a PostgreSQL database (local or a Railway one).

```bash
# Website
cd website
npm install
# PowerShell:  $env:DATABASE_URL="postgres://user:pass@localhost:5432/tycf"; $env:PGSSL="disable"
npm start                      # http://localhost:3000

# Admin (new terminal)
cd admin
npm install
# PowerShell:  $env:DATABASE_URL="postgres://user:pass@localhost:5432/tycf"; $env:PGSSL="disable"; $env:ADMIN_PASSWORD="choose-a-password"
npm start                      # http://localhost:3001
```

Both apps create their tables automatically on first boot. `PGSSL=disable` turns off TLS for a local Postgres; **do not set it on Railway** (Railway requires SSL).

---

## Deploy on Railway (step by step)

You'll create **one project** with **three components**: a database, the website, and the admin portal.

### 1. Push this code to GitHub
Railway deploys from a GitHub repo (easiest) or the Railway CLI. From this folder:

```bash
git init
git add .
git commit -m "TYCF website + admin portal"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/tycf.git
git push -u origin main
```

### 2. Create the project + database
1. Go to **railway.app → New Project → Deploy PostgreSQL**.
2. This gives you a Postgres service. Open it → **Variables** and note that it exposes `DATABASE_URL`. You don't need to copy it — you'll *reference* it in the next steps.

### 3. Add the **website** service
1. In the same project: **New → GitHub Repo →** select your repo.
2. Open the new service → **Settings → Root Directory** → set to `website`.
   *(This is what makes Railway build only the website folder. Repeat with `admin` for the other service.)*
3. **Settings → Networking → Generate Domain** (this is the public site URL).
4. **Variables → New Variable → Add Reference →** pick the Postgres service's `DATABASE_URL`.
   - Variable name: `DATABASE_URL`, value: reference to Postgres → `${{Postgres.DATABASE_URL}}`.
5. It will build and deploy. Start command (`npm start`) and health check (`/healthz`) are already set in `website/railway.json`.

### 4. Add the **admin** service
1. **New → GitHub Repo →** same repo again (yes, the same repo — Root Directory is what differs).
2. **Settings → Root Directory** → `admin`.
3. **Settings → Networking → Generate Domain** (admin URL — keep this one private / share only with the committee).
4. **Variables**, add:
   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Reference → `${{Postgres.DATABASE_URL}}` (the **same** database as the website) |
   | `ADMIN_PASSWORD` | A strong password for the committee to log in |
   | `SESSION_SECRET` | Any long random string (keeps login sessions valid across restarts) |
   | `NODE_ENV` | `production` |

5. Deploy.

### 5. Verify
- Visit the **website** domain → submit a test application and a test donor inquiry.
- Visit the **admin** domain → log in with `ADMIN_PASSWORD` → your test entries appear. Try the **business type** and **date** filters and the **Export CSV** button.

---

## Environment variables reference

**website**
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | Reference the shared Postgres. |
| `PORT` | auto | Set by Railway. |
| `PGSSL` | — | Set to `disable` only for a non-SSL local database. |

**admin**
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ | **Same** database as the website. |
| `ADMIN_PASSWORD` | ✅ | Committee login password. |
| `SESSION_SECRET` | recommended | Random string; persists sessions across restarts. |
| `NODE_ENV` | recommended | `production` enables secure cookies. |
| `PORT` | auto | Set by Railway. |

---

## Data model

`applications` — applicant/business identity + the 10 application questions (Q7 pitch deck and Q8 demo are stored as links).
`donors` — name, email, phone for "Become a Donor" inquiries.

Full definition: [`shared/schema.sql`](shared/schema.sql).

## Editing content
- Landing page copy/sections: `website/public/index.html`
- Application questions: `website/public/apply.html` (and the matching columns in `server.js` / `schema.sql` if you add/remove questions)
- Business-type dropdown options: the `<select id="business_type">` in `website/public/apply.html`
- Brand colors: the `:root` block in `website/public/styles.css` and `admin/public/admin.css`
