import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './core/config/config.service';
import { ProblemDetailsFilter } from './core/errors/rfc7807.filter';
import { StructuredLoggerService } from './core/logging/logger.service';

export async function bootstrap() {
  // 1. Validate environment configuration first (fails fast if missing)
  const configService = new ConfigService();
  const logger = new StructuredLoggerService(configService.logLevel);

  logger.log('Bootstrapping LabOS Application Foundation...', 'Bootstrap');

  // 2. Initialize NestJS application
  const app = await NestFactory.create(AppModule, {
    logger,
  });

  // 3. Register global RFC 7807 exception filter
  app.useGlobalFilters(new ProblemDetailsFilter(configService));

  // 4. Enable graceful shutdown hooks
  app.enableShutdownHooks();

  // 5. Start listening
  await app.listen(configService.port);
  logger.log(
    `LabOS Foundation running on port ${configService.port} in [${configService.nodeEnv}] mode`,
    'Bootstrap',
  );

  return app;
}

// Auto-start if executed directly
if (require.main === module) {
  bootstrap().catch((err) => {
    console.error('[Fatal Bootstrap Error]:', err);
    process.exit(1);
  });
}
