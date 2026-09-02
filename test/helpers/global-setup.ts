import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';
import path from 'path';
import fs from 'fs';

const TEST_PORT = 54391;
const TEST_USER = 'postgres';
const TEST_PASSWORD = 'testpassword';
const TEST_DB = 'labos_test_db';

let globalPgInstance: EmbeddedPostgres | null = null;

export async function setup(): Promise<void> {
  // If an external database URL is provided, use it instead of launching local cluster
  if (process.env.TEST_DATABASE_URL) {
    return;
  }

  const databaseDir = path.resolve(__dirname, '../../.test-pg-cluster');
  if (fs.existsSync(databaseDir)) {
    try {
      fs.rmSync(databaseDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }

  globalPgInstance = new EmbeddedPostgres({
    port: TEST_PORT,
    user: TEST_USER,
    password: TEST_PASSWORD,
    databaseDir,
    persistent: false,
  });

  await globalPgInstance.initialise();
  await globalPgInstance.start();

  // Create our target test database inside the newly started cluster
  const adminClient = new Client({
    connectionString: `postgresql://${TEST_USER}:${TEST_PASSWORD}@127.0.0.1:${TEST_PORT}/postgres`,
  });
  await adminClient.connect();
  const dbCheck = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = '${TEST_DB}';`,
  );
  if (dbCheck.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE ${TEST_DB};`);
  }
  await adminClient.end();
}

export async function teardown(): Promise<void> {
  if (globalPgInstance) {
    try {
      await globalPgInstance.stop();
    } catch {
      // Ignored during teardown
    }
    globalPgInstance = null;
  }

  const databaseDir = path.resolve(__dirname, '../../.test-pg-cluster');
  if (fs.existsSync(databaseDir)) {
    try {
      fs.rmSync(databaseDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  }
}
