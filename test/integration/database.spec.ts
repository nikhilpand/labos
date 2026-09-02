import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '@/core/database/database.service';
import { ConfigService } from '@/core/config/config.service';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('DatabaseService Integration (Real PostgreSQL)', () => {
  let dbService: DatabaseService;
  let configService: ConfigService;

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    configService = new ConfigService({
      DATABASE_URL: dbUrl,
      NODE_ENV: 'test',
    });
    dbService = new DatabaseService(configService);
  }, 45000);

  afterAll(async () => {
    if (dbService) {
      await dbService.onApplicationShutdown();
    }
    await stopTestDatabase();
  });

  it('should successfully connect to a genuine PostgreSQL instance', async () => {
    const isHealthy = await dbService.checkHealth();
    expect(isHealthy).toBe(true);

    const versionResult = await dbService.query('SELECT version();');
    expect(versionResult.rows[0]?.version).toContain('PostgreSQL');
  });

  it('should successfully commit an atomic transaction', async () => {
    await dbService.query(`
      CREATE TABLE IF NOT EXISTS test_transaction_commit (
        id INT PRIMARY KEY,
        val TEXT
      );
    `);

    await dbService.transaction(async (client) => {
      await client.query('INSERT INTO test_transaction_commit (id, val) VALUES ($1, $2)', [
        1,
        'committed_value',
      ]);
    });

    const res = await dbService.query('SELECT val FROM test_transaction_commit WHERE id = 1;');
    expect(res.rows[0]?.val).toBe('committed_value');
  });

  it('should rollback all operations in a transaction if an error is thrown', async () => {
    await dbService.query(`
      CREATE TABLE IF NOT EXISTS test_transaction_rollback (
        id INT PRIMARY KEY,
        val TEXT
      );
    `);

    const failedTx = dbService.transaction(async (client) => {
      await client.query('INSERT INTO test_transaction_rollback (id, val) VALUES ($1, $2)', [
        100,
        'will_be_rolled_back',
      ]);
      throw new Error('Simulated failure during multi-entity operation');
    });

    await expect(failedTx).rejects.toThrowError(/Simulated failure/);

    const res = await dbService.query('SELECT 1 FROM test_transaction_rollback WHERE id = 100;');
    expect(res.rowCount).toBe(0);
  });
});
