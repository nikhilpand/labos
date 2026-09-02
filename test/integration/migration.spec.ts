import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DatabaseService } from '@/core/database/database.service';
import { MigratorService } from '@/core/database/migrator.service';
import { ConfigService } from '@/core/config/config.service';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';
import path from 'path';

describe('MigratorService Integration (Real PostgreSQL)', () => {
  let dbService: DatabaseService;
  let migrator: MigratorService;
  let configService: ConfigService;

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    configService = new ConfigService({
      DATABASE_URL: dbUrl,
      NODE_ENV: 'test',
    });
    dbService = new DatabaseService(configService);
    migrator = new MigratorService(dbService);
  }, 45000);

  afterAll(async () => {
    if (dbService) {
      await dbService.onApplicationShutdown();
    }
    await stopTestDatabase();
  });

  it('should successfully apply versioned migrations in strict transactions', async () => {
    const migrationsDir = path.resolve(__dirname, '../../src/core/database/migrations');
    const applied = await migrator.migrate(migrationsDir);

    expect(applied).toContain('0001_init_infrastructure.sql');

    // Verify schema_migrations table records
    const migrationRecords = await dbService.query(
      'SELECT name, checksum FROM schema_migrations WHERE name = $1;',
      ['0001_init_infrastructure.sql'],
    );
    expect(migrationRecords.rowCount).toBe(1);
    expect(migrationRecords.rows[0]?.checksum).toBeDefined();

    // Verify system_metadata table created by 0001 migration
    const metadata = await dbService.query(
      "SELECT value FROM system_metadata WHERE key = 'platform_version';",
    );
    expect(metadata.rowCount).toBe(1);
    expect(metadata.rows[0]?.value).toBe('0.1.0-foundation');
  });

  it('should be strictly idempotent when executed multiple times', async () => {
    const migrationsDir = path.resolve(__dirname, '../../src/core/database/migrations');
    const appliedAgain = await migrator.migrate(migrationsDir);

    // No new migrations should be applied
    expect(appliedAgain).toHaveLength(0);
  });
});
