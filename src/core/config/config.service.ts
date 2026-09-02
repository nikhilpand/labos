import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { EnvConfig, validateEnv } from './env.schema';

@Injectable()
export class ConfigService {
  private readonly config: EnvConfig;

  constructor(customEnv?: Record<string, unknown>) {
    // Load .env if present and no customEnv provided
    if (!customEnv) {
      dotenv.config();
    }
    const envSource = customEnv ?? process.env;
    this.config = validateEnv(envSource);
  }

  get nodeEnv(): 'development' | 'test' | 'production' {
    return this.config.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.config.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.config.NODE_ENV === 'development';
  }

  get isTest(): boolean {
    return this.config.NODE_ENV === 'test';
  }

  get port(): number {
    return this.config.PORT;
  }

  get databaseUrl(): string {
    return this.config.DATABASE_URL;
  }

  get databaseMaxConnections(): number {
    return this.config.DATABASE_MAX_CONNECTIONS;
  }

  get databaseIdleTimeoutMs(): number {
    return this.config.DATABASE_IDLE_TIMEOUT_MS;
  }

  get databaseConnectionTimeoutMs(): number {
    return this.config.DATABASE_CONNECTION_TIMEOUT_MS;
  }

  get logLevel(): string {
    return this.config.LOG_LEVEL;
  }

  get oidcIssuerUrl(): string {
    return this.config.OIDC_ISSUER_URL;
  }

  get oidcAudience(): string {
    return this.config.OIDC_AUDIENCE;
  }

  get bypassFourEyesForDev(): boolean {
    return this.config.BYPASS_FOUR_EYES_FOR_DEV;
  }
}
