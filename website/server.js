// The Your Chance Fund — public website service.
// Serves the landing page, application form, and donor form, and accepts
// submissions into the shared PostgreSQL database.
const path = require('path');
const express = require('express');
const { pool, initSchema } = require('./db');

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// ---- Helpers -------------------------------------------------------------
const str = (v, max = 5000) =>
  (v == null ? '' : String(v)).trim().slice(0, max);

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ---- API: application submission ----------------------------------------
app.post('/api/apply', async (req, res) => {
  try {
    const b = req.body || {};
    const applicant_name = str(b.applicant_name, 200);
    const email = str(b.email, 200);
    const business_name = str(b.business_name, 200);
    const business_type = str(b.business_type, 120);

    if (!applicant_name || !email || !business_name || !business_type) {
      return res.status(400).json({ error: 'Name, email, business name, and business type are required.' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    await pool.query(
      `INSERT INTO applications
        (applicant_name, email, phone, business_name, business_type,
         q1_subscribers, q2_data_source, q3_costs, q4_growth_strategy,
         q5_pricing_impact, q6_differentiation, pitch_deck_url, demo_url,
         social_media, references_text)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [
        applicant_name, email, str(b.phone, 60), business_name, business_type,
        str(b.q1_subscribers), str(b.q2_data_source), str(b.q3_costs),
        str(b.q4_growth_strategy), str(b.q5_pricing_impact), str(b.q6_differentiation),
        str(b.pitch_deck_url, 1000), str(b.demo_url, 1000),
        str(b.social_media, 2000), str(b.references_text),
      ]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/apply failed:', err);
    res.status(500).json({ error: 'Could not save your application. Please try again.' });
  }
});

// ---- API: donor inquiry --------------------------------------------------
app.post('/api/donate', async (req, res) => {
  try {
    const b = req.body || {};
    const name = str(b.name, 200);
    const email = str(b.email, 200);
    const phone = str(b.phone, 60);

    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Name, email, and phone number are required.' });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    await pool.query(
      'INSERT INTO donors (name, email, phone) VALUES ($1,$2,$3)',
      [name, email, phone]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/donate failed:', err);
    res.status(500).json({ error: 'Could not save your inquiry. Please try again.' });
  }
});

// ---- Health check --------------------------------------------------------
app.get('/healthz', (_req, res) => res.json({ ok: true }));

// ---- Static site ---------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const PORT = process.env.PORT || 3000;
initSchema()
  .then(() => app.listen(PORT, () => console.log(`[website] listening on ${PORT}`)))
  .catch((err) => {
    console.error('Startup failed:', err);
    process.exit(1);
  });
