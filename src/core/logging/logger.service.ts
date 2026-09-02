import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino from 'pino';

@Injectable()
export class StructuredLoggerService implements NestLoggerService {
  private readonly logger: pino.Logger;

  constructor(logLevel = 'info') {
    this.logger = pino({
      level: logLevel,
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'token',
          'secret',
          'clientSecret',
        ],
        censor: '[REDACTED]',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  log(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.logger.info({ context, ...extra }, message);
  }

  error(message: string, trace?: string, context?: string, extra?: Record<string, unknown>): void {
    this.logger.error({ context, trace, ...extra }, message);
  }

  warn(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.logger.warn({ context, ...extra }, message);
  }

  debug(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.logger.debug({ context, ...extra }, message);
  }

  verbose(message: string, context?: string, extra?: Record<string, unknown>): void {
    this.logger.trace({ context, ...extra }, message);
  }
}
