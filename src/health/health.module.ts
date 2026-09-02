import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseModule } from '../core/database/database.module';
import { ConfigModule } from '../core/config/config.module';

@Module({
  imports: [DatabaseModule, ConfigModule],
  controllers: [HealthController],
})
export class HealthModule {}
