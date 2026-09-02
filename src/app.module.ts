import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { HealthModule } from './health/health.module';
import { CorrelationIdMiddleware } from './core/logging/correlation-id.middleware';

@Module({
  imports: [ConfigModule, DatabaseModule, HealthModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
