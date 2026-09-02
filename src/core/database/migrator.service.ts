import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { DatabaseService } from './database.service';

export interface MigrationRecord {
  id: number;
  name: string;
  checksum: string;
  applied_at: Date;
}

@Injectable()
export class MigratorService {
  private readonly logger = new Logger('MigratorService');

  constructor(private readonly db: DatabaseService) {}

  /**
   * Initializes the schema_migrations tracking table if it does not already exist.
   */
  async ensureMigrationTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  /**
   * Runs all pending migrations in sequential order inside transactions.
   */
  async migrate(migrationsDir?: string): Promise<string[]> {
    await this.ensureMigrationTable();

    const dir = migrationsDir ?? path.join(__dirname, 'migrations');
    if (!fs.existsSync(dir)) {
      this.logger.warn(`Migrations directory not found: ${dir}`);
      return [];
    }

    const files = fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    const appliedRecords = await this.db.query<MigrationRecord>(
      'SELECT name, checksum FROM schema_migrations ORDER BY id ASC;',
    );
    const appliedMap = new Map<string, string>(
      appliedRecords.rows.map((row) => [row.name, row.checksum]),
    );

    const newlyApplied: string[] = [];

    for (const file of files) {
      const filePath = path.join(dir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      if (appliedMap.has(file)) {
        const recordedChecksum = appliedMap.get(file);
        if (recordedChecksum !== checksum) {
          throw new Error(
            `[Migration Integrity Error] Migration '${file}' has been altered after execution! Recorded: ${recordedChecksum}, Actual: ${checksum}`,
          );
        }
        continue;
      }

      this.logger.log(`Applying migration: ${file}...`);
      await this.db.transaction(async (client) => {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2);', [
          file,
          checksum,
        ]);
      });
      this.logger.log(`Successfully applied migration: ${file}`);
      newlyApplied.push(file);
    }

    return newlyApplied;
  }
}
