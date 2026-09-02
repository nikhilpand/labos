import { describe, it, expect } from 'vitest';
import { validateEnv } from '@/core/config/env.schema';
import { ConfigService } from '@/core/config/config.service';

describe('ConfigService & Environment Validation', () => {
  it('should successfully validate a complete, valid environment', () => {
    const raw = {
      NODE_ENV: 'development',
      PORT: '4000',
      DATABASE_URL: 'postgresql://testuser:testpass@localhost:5432/labos_test',
      DATABASE_MAX_CONNECTIONS: '5',
      LOG_LEVEL: 'debug',
      OIDC_ISSUER_URL: 'http://localhost:8080/realms/labos',
      OIDC_AUDIENCE: 'labos-api',
      BYPASS_FOUR_EYES_FOR_DEV: 'true',
    };

    const config = validateEnv(raw);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(4000);
    expect(config.DATABASE_URL).toBe('postgresql://testuser:testpass@localhost:5432/labos_test');
    expect(config.BYPASS_FOUR_EYES_FOR_DEV).toBe(true);
  });

  it('should fail fast with descriptive error if DATABASE_URL is missing', () => {
    const raw = {
      NODE_ENV: 'development',
      PORT: '3000',
    };

    expect(() => validateEnv(raw)).toThrowError(/DATABASE_URL/);
  });

  it('should fail fast if BYPASS_FOUR_EYES_FOR_DEV is enabled in production', () => {
    const raw = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:prod@db.internal:5432/labos_prod',
      BYPASS_FOUR_EYES_FOR_DEV: 'true', // VIOLATION!
    };

    expect(() => validateEnv(raw)).toThrowError(
      /BYPASS_FOUR_EYES_FOR_DEV cannot be enabled in production/,
    );
  });

  it('should use default values for optional environment variables', () => {
    const raw = {
      DATABASE_URL: 'postgresql://localhost:5432/labos',
    };

    const config = validateEnv(raw);
    expect(config.NODE_ENV).toBe('development');
    expect(config.PORT).toBe(3000);
    expect(config.DATABASE_MAX_CONNECTIONS).toBe(10);
    expect(config.BYPASS_FOUR_EYES_FOR_DEV).toBe(false);
  });

  it('should instantiate ConfigService with custom environment dictionary', () => {
    const service = new ConfigService({
      DATABASE_URL: 'postgresql://localhost:5432/custom_db',
      PORT: '5500',
    });

    expect(service.port).toBe(5500);
    expect(service.isProduction).toBe(false);
    expect(service.isDevelopment).toBe(true);
  });
});
