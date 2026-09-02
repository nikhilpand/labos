import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { MigratorService } from './migrator.service';
import { ConfigModule } from '../config/config.module';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService, MigratorService],
  exports: [DatabaseService, MigratorService],
})
export class DatabaseModule {}
