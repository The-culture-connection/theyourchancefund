// The Your Chance Fund — admin portal.
// Password-protected dashboard for reviewing applications (filterable by
// submission date and business type) and donor inquiries. Includes CSV export.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const { pool, initSchema } = require('./db');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

// Trust Railway's proxy so secure cookies work behind HTTPS termination.
app.set('trust proxy', 1);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('FATAL: ADMIN_PASSWORD is not set. Set it in the admin service variables.');
  process.exit(1);
}

app.use(session({
  name: 'tycf_admin',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8, // 8 hours
  },
}));

// ---- Auth ----------------------------------------------------------------
function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.redirect('/login');
}

// Constant-time password comparison to avoid timing leaks.
function passwordOk(input) {
  const a = Buffer.from(String(input));
  const b = Buffer.from(String(ADMIN_PASSWORD));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

app.get('/login', (req, res) => {
  if (req.session && req.session.authed) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  if (passwordOk(req.body.password)) {
    req.session.authed = true;
    return res.redirect('/');
  }
  res.status(401).render('login', { error: 'Incorrect password. Please try again.' });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// ---- Query helpers -------------------------------------------------------
// Build a WHERE clause for the application filters. `from`/`to` are YYYY-MM-DD.
function applicationFilters(q) {
  const where = [];
  const params = [];
  if (q.type) {
    params.push(q.type);
    where.push(`business_type = $${params.length}`);
  }
  if (q.from) {
    params.push(q.from);
    where.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (q.to) {
    params.push(q.to);
    // inclusive of the whole "to" day (next midnight, exclusive)
    where.push(`created_at < ($${params.length}::timestamptz + INTERVAL '1 day')`);
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  return { clause, params };
}

// ---- Dashboard: applications --------------------------------------------
app.get('/', requireAuth, async (req, res) => {
  try {
    const { clause, params } = applicationFilters(req.query);
    const { rows } = await pool.query(
      `SELECT id, created_at, applicant_name, business_name, business_type, email, phone
         FROM applications ${clause}
        ORDER BY created_at DESC`,
      params
    );
    const types = await pool.query(
      'SELECT DISTINCT business_type FROM applications ORDER BY business_type'
    );
    res.render('dashboard', {
      tab: 'applications',
      rows,
      businessTypes: types.rows.map((r) => r.business_type),
      filters: { type: req.query.type || '', from: req.query.from || '', to: req.query.to || '' },
      count: rows.length,
    });
  } catch (err) {
    console.error('GET / failed:', err);
    res.status(500).send('Database error. Check the server logs.');
  }
});

// ---- Application detail ---------------------------------------------------
app.get('/applications/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM applications WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).send('Application not found.');
    res.render('detail', { a: rows[0] });
  } catch (err) {
    console.error('GET /applications/:id failed:', err);
    res.status(500).send('Database error.');
  }
});

// ---- Donor inquiries ------------------------------------------------------
app.get('/donors', requireAuth, async (req, res) => {
  try {
    const where = [];
    const params = [];
    if (req.query.from) { params.push(req.query.from); where.push(`created_at >= $${params.length}::timestamptz`); }
    if (req.query.to)   { params.push(req.query.to);   where.push(`created_at < ($${params.length}::timestamptz + INTERVAL '1 day')`); }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await pool.query(
      `SELECT id, created_at, name, email, phone FROM donors ${clause} ORDER BY created_at DESC`,
      params
    );
    res.render('donors', {
      tab: 'donors',
      rows,
      filters: { from: req.query.from || '', to: req.query.to || '' },
      count: rows.length,
    });
  } catch (err) {
    console.error('GET /donors failed:', err);
    res.status(500).send('Database error.');
  }
});

// ---- CSV export -----------------------------------------------------------
function toCsv(headers, records) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [headers.map(esc).join(',')];
  for (const rec of records) lines.push(rec.map(esc).join(','));
  return '﻿' + lines.join('\r\n'); // BOM so Excel reads UTF-8
}

app.get('/export/applications.csv', requireAuth, async (req, res) => {
  const { clause, params } = applicationFilters(req.query);
  const { rows } = await pool.query(
    `SELECT * FROM applications ${clause} ORDER BY created_at DESC`, params
  );
  const headers = [
    'ID', 'Submitted', 'Applicant', 'Email', 'Phone', 'Business', 'Business Type',
    'Q1 Subscribers', 'Q2 Data Source', 'Q3 Costs', 'Q4 Growth Strategy',
    'Q5 Pricing Impact', 'Q6 Differentiation', 'Pitch Deck', 'Demo', 'Social Media', 'References',
  ];
  const records = rows.map((r) => [
    r.id, new Date(r.created_at).toISOString(), r.applicant_name, r.email, r.phone,
    r.business_name, r.business_type, r.q1_subscribers, r.q2_data_source, r.q3_costs,
    r.q4_growth_strategy, r.q5_pricing_impact, r.q6_differentiation,
    r.pitch_deck_url, r.demo_url, r.social_media, r.references_text,
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tycf-applications.csv"');
  res.send(toCsv(headers, records));
});

app.get('/export/donors.csv', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM donors ORDER BY created_at DESC');
  const headers = ['ID', 'Submitted', 'Name', 'Email', 'Phone'];
  const records = rows.map((r) => [r.id, new Date(r.created_at).toISOString(), r.name, r.email, r.phone]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tycf-donors.csv"');
  res.send(toCsv(headers, records));
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
initSchema()
  .then(() => app.listen(PORT, () => console.log(`[admin] listening on ${PORT}`)))
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
