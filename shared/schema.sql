-- The Your Chance Fund (TYCF) — shared database schema.
-- Both the `website` and `admin` services connect to this same database
-- and run these statements on boot (CREATE ... IF NOT EXISTS), so no
-- manual migration step is required.

CREATE TABLE IF NOT EXISTS applications (
    id                SERIAL PRIMARY KEY,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Applicant / business identity
    applicant_name    TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    business_name     TEXT NOT NULL,
    business_type     TEXT NOT NULL,

    -- The 10 application questions (from Questions.txt)
    q1_subscribers        TEXT,   -- monthly/annual paying subscribers so far
    q2_data_source        TEXT,   -- data from AI/Internet vs interview questions
    q3_costs              TEXT,   -- ongoing costs / self-sustaining?
    q4_growth_strategy    TEXT,   -- growth strategy & pricing structure
    q5_pricing_impact     TEXT,   -- pricing tiers vs sustainability
    q6_differentiation    TEXT,   -- differ from "Voice of Your Customer"
    pitch_deck_url        TEXT,   -- Q7 pitch deck link
    demo_url              TEXT,   -- Q8 demo or product link
    social_media          TEXT,   -- Q9 social medias
    references_text       TEXT    -- Q10 references
);

CREATE INDEX IF NOT EXISTS idx_applications_created_at    ON applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_business_type ON applications (business_type);

CREATE TABLE IF NOT EXISTS donors (
    id          SERIAL PRIMARY KEY,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    name        TEXT NOT NULL,
    email       TEXT NOT NULL,
    phone       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_donors_created_at ON donors (created_at DESC);
