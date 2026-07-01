// PostgreSQL connection for the admin service. Points at the SAME database
// as the website service (share the DATABASE_URL via a Railway reference variable).
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is not set. Reference the Postgres database in Railway.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

async function initSchema() {
  let sql;
  try {
    sql = fs.readFileSync(path.join(__dirname, '..', 'shared', 'schema.sql'), 'utf8');
  } catch {
    sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  }
  await pool.query(sql);
  console.log('[db] schema ready');
}

module.exports = { pool, initSchema };
