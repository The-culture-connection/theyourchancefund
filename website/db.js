// Shared PostgreSQL connection for the website service.
// Uses the DATABASE_URL that Railway injects when you attach a Postgres plugin.
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Attach a PostgreSQL database in Railway.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Railway's managed Postgres uses TLS. Local dev without SSL still works because
  // rejectUnauthorized is false; set PGSSL=disable to turn SSL off entirely.
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

// Run the shared schema on boot so tables always exist. CREATE ... IF NOT EXISTS
// makes this safe to run every time either service starts.
async function initSchema() {
  const schemaPath = path.join(__dirname, '..', 'shared', 'schema.sql');
  let sql;
  try {
    sql = fs.readFileSync(schemaPath, 'utf8');
  } catch {
    // When each service is deployed on its own, it carries its own copy at ./schema.sql
    sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  }
  await pool.query(sql);
  console.log('[db] schema ready');
}

module.exports = { pool, initSchema };
