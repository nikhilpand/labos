import { ConfigService } from '../config/config.service';
import { DatabaseService } from './database.service';
import { MigratorService } from './migrator.service';

async function run() {
  const config = new ConfigService();
  const db = new DatabaseService(config);
  const migrator = new MigratorService(db);

  const command = process.argv[2];

  if (command === 'migrate') {
    console.log('[LabOS Migration CLI] Starting database migrations...');
    try {
      const applied = await migrator.migrate();
      if (applied.length === 0) {
        console.log('[LabOS Migration CLI] Database schema is up to date.');
      } else {
        console.log(
          `[LabOS Migration CLI] Successfully applied ${applied.length} migration(s):`,
          applied,
        );
      }
    } catch (err) {
      console.error('[LabOS Migration CLI] Migration failed:', err);
      process.exit(1);
    } finally {
      await db.onApplicationShutdown();
    }
  } else {
    console.error(`Unknown command: ${command}. Available commands: migrate`);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}
