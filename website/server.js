// The Your Chance Fund — public website service.
// Serves the landing page, application form, and donor form, and writes
// submissions to Cloud Firestore.
const path = require('path');
const express = require('express');
const store = require('./store');

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

    const id = await store.addApplication({
      applicant_name, email, phone: str(b.phone, 60), business_name, business_type,
      q1_subscribers: str(b.q1_subscribers), q2_data_source: str(b.q2_data_source),
      q3_costs: str(b.q3_costs), q4_growth_strategy: str(b.q4_growth_strategy),
      q5_pricing_impact: str(b.q5_pricing_impact), q6_differentiation: str(b.q6_differentiation),
      pitch_deck_url: str(b.pitch_deck_url, 1000), demo_url: str(b.demo_url, 1000),
      social_media: str(b.social_media, 2000), references_text: str(b.references_text),
    });

    res.status(201).json({ ok: true, id });
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

    if (!name || (!email && !phone)) {
      return res.status(400).json({ error: 'Please include your name and an email or phone number.' });
    }
    if (email && !isEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const id = await store.addDonor({ name, email, phone });
    res.status(201).json({ ok: true, id });
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
app.listen(PORT, () => console.log(`[website] listening on ${PORT}`));
