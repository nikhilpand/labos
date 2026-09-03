import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const TEST_PORT = 54391;
const TEST_USER = 'postgres';
const TEST_PASSWORD = 'testpassword';
const TEST_DB = 'labos_test_db';

export function getTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return `postgresql://${TEST_USER}:${TEST_PASSWORD}@127.0.0.1:${TEST_PORT}/${TEST_DB}`;
}

export async function ensureMigrations(dbUrl: string): Promise<void> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsDir = path.resolve(__dirname, '../../src/core/database/migrations');
    if (!fs.existsSync(migrationsDir)) return;

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const appliedRes = await client.query('SELECT name FROM schema_migrations;');
    const appliedSet = new Set(appliedRes.rows.map((r: { name: string }) => r.name));

    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      await client.query('BEGIN;');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);',
          [file, checksum],
        );
        await client.query('COMMIT;');
      } catch (err) {
        await client.query('ROLLBACK;');
        throw err;
      }
    }
  } finally {
    await client.end();
  }
}

export async function startTestDatabase(): Promise<string> {
  const dbUrl = getTestDatabaseUrl();
  process.env.DATABASE_URL = dbUrl;
  process.env.NODE_ENV = 'test';
  process.env.PORT = process.env.PORT || '3099';

  await ensureMigrations(dbUrl);
  return dbUrl;
}

export async function stopTestDatabase(): Promise<void> {
  // Global teardown handles stopping the cluster
}

