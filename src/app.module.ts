import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { HealthModule } from './health/health.module';
import { CorrelationIdMiddleware } from './core/logging/correlation-id.middleware';

import { LaboratoryModule } from './platform/laboratory/laboratory.module';
import { AuthModule } from './platform/auth/auth.module';
import { AuditModule } from './platform/audit/audit.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    LaboratoryModule,
    AuthModule,
    AuditModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
