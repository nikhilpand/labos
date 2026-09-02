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

export async function startTestDatabase(): Promise<string> {
  return getTestDatabaseUrl();
}

export async function stopTestDatabase(): Promise<void> {
  // Global teardown handles stopping the cluster
}
