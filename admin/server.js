// The Your Chance Fund — admin portal.
// Password-protected dashboard for reviewing applications (filterable by
// submission date and business type) and donor inquiries. Includes CSV export.
// Data is read from Cloud Firestore via ./store.
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const store = require('./store');

// Business-type options for the filter dropdown. Keep this in sync with the
// <select id="business_type"> in website/public/apply.html.
const BUSINESS_TYPES = [
  'Food & Beverage', 'Retail & E-commerce', 'Technology / Software',
  'Professional Services', 'Health & Wellness', 'Beauty & Personal Care',
  'Construction & Trades', 'Arts, Media & Entertainment', 'Education & Training',
  'Transportation & Logistics', 'Nonprofit / Community', 'Other',
];

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

// ---- Dashboard: applications --------------------------------------------
app.get('/', requireAuth, async (req, res) => {
  try {
    const filters = { type: req.query.type || '', from: req.query.from || '', to: req.query.to || '' };
    const rows = await store.listApplications(filters);
    res.render('dashboard', {
      tab: 'applications',
      rows,
      businessTypes: BUSINESS_TYPES,
      filters,
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
    const a = await store.getApplication(req.params.id);
    if (!a) return res.status(404).send('Application not found.');
    res.render('detail', { a });
  } catch (err) {
    console.error('GET /applications/:id failed:', err);
    res.status(500).send('Database error.');
  }
});

// ---- Donor inquiries ------------------------------------------------------
app.get('/donors', requireAuth, async (req, res) => {
  try {
    const filters = { from: req.query.from || '', to: req.query.to || '' };
    const rows = await store.listDonors(filters);
    res.render('donors', { tab: 'donors', rows, filters, count: rows.length });
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

const iso = (d) => (d ? new Date(d).toISOString() : '');

app.get('/export/applications.csv', requireAuth, async (req, res) => {
  const rows = await store.listApplications({ type: req.query.type, from: req.query.from, to: req.query.to });
  const headers = [
    'ID', 'Submitted', 'Applicant', 'Email', 'Phone', 'Business', 'Business Type',
    'Q1 Subscribers', 'Q2 Data Source', 'Q3 Costs', 'Q4 Growth Strategy',
    'Q5 Pricing Impact', 'Q6 Differentiation', 'Pitch Deck', 'Demo', 'Social Media', 'References',
  ];
  const records = rows.map((r) => [
    r.id, iso(r.created_at), r.applicant_name, r.email, r.phone,
    r.business_name, r.business_type, r.q1_subscribers, r.q2_data_source, r.q3_costs,
    r.q4_growth_strategy, r.q5_pricing_impact, r.q6_differentiation,
    r.pitch_deck_url, r.demo_url, r.social_media, r.references_text,
  ]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tycf-applications.csv"');
  res.send(toCsv(headers, records));
});

app.get('/export/donors.csv', requireAuth, async (req, res) => {
  const rows = await store.listDonors({ from: req.query.from, to: req.query.to });
  const headers = ['ID', 'Submitted', 'Name', 'Email', 'Phone'];
  const records = rows.map((r) => [r.id, iso(r.created_at), r.name, r.email, r.phone]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="tycf-donors.csv"');
  res.send(toCsv(headers, records));
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[admin] listening on ${PORT}`));
