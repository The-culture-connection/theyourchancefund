-- The Your Chance Fund — schema (service-local copy, mirrors /shared/schema.sql).
-- Run automatically on boot by db.js. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS applications (
    id                SERIAL PRIMARY KEY,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    applicant_name    TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    business_name     TEXT NOT NULL,
    business_type     TEXT NOT NULL,
    q1_subscribers        TEXT,
    q2_data_source        TEXT,
    q3_costs              TEXT,
    q4_growth_strategy    TEXT,
    q5_pricing_impact     TEXT,
    q6_differentiation    TEXT,
    pitch_deck_url        TEXT,
    demo_url              TEXT,
    social_media          TEXT,
    references_text       TEXT
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
