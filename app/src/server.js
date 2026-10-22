import { Pool } from 'pg';
import { createApp } from './app.js';

const pool = new Pool({
  host: process.env.PGHOST || 'postgres',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'notes',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || process.env.POSTGRES_DB || 'notes',
  connectionTimeoutMillis: 5000,
  query_timeout: 10000,
});
pool.on('error', () => console.error('Unexpected idle database connection error'));

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notes (
      id BIGSERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
} catch (error) {
  console.error('Database initialization failed:', error.message);
  await pool.end();
  process.exit(1);
}

const app = createApp(pool);
const server = app.listen(Number(process.env.PORT || 3000), '0.0.0.0', () => {
  console.log(`Notes API listening on port ${process.env.PORT || 3000}`);
});

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
