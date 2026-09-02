import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigService } from '@/core/config/config.service';
import { ProblemDetailsFilter } from '@/core/errors/rfc7807.filter';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Application Health Verification Integration', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3099';

    configService = new ConfigService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter(configService));
    await app.init();
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  it('should respond with healthy status on /health', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 'healthy',
      environment: 'test',
      checks: {
        database: 'connected',
        config: 'loaded',
      },
    });
    expect(response.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('should respond with healthy status on /api/v1/health', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body.checks.database).toBe('connected');
    expect(response.headers['x-correlation-id']).toBeDefined();
  });

  it('should return 404 in RFC 7807 Problem Details format for non-existent routes', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/non-existent-endpoint');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({
      status: 404,
      code: 'HTTP_404',
      instance: '/api/v1/non-existent-endpoint',
    });
    expect(response.body.correlationId).toBeDefined();
  });
});
