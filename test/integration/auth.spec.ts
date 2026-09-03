import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AuthService } from '../../src/platform/auth/auth.service';
import { DatabaseService } from '../../src/core/database/database.service';
import { ConfigService } from '../../src/core/config/config.service';
import { UnauthorizedProblem } from '../../src/core/errors/rfc7807.exception';
import { generateUuidV7 } from '../../src/core/common/uuid';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Auth & Permission Resolution (Integration)', () => {
  let app: INestApplication;
  let authService: AuthService;
  let db: DatabaseService;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const ACCESSIONER_ROLE_ID = '01918000-0000-7000-8000-000000000011';
  const TEST_USER_ID = generateUuidV7();
  const TEST_OIDC_SUB = 'auth0|test-accessioner-123';

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3099';

    const configService = new ConfigService();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    authService = app.get(AuthService);
    db = app.get(DatabaseService);

    // Seed test accessioner user
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, job_title, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        TEST_USER_ID,
        DEFAULT_LAB_ID,
        TEST_OIDC_SUB,
        'accessioner.test@apexlabs.com',
        'Sarah Accessioner',
        'Sample Registrar',
      ],
    );

    // Assign ACCESSIONER role
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, role_id) DO NOTHING;`,
      [TEST_USER_ID, ACCESSIONER_ROLE_ID],
    );
  }, 45000);

  afterAll(async () => {
    // Cleanup seeded user
    if (db) {
      await db.query(`DELETE FROM user_roles WHERE user_id = $1;`, [TEST_USER_ID]);
      await db.query(`DELETE FROM users WHERE user_id = $1;`, [TEST_USER_ID]);
    }
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  it('resolves authenticated principal with roles and granular permissions', async () => {
    const principal = await authService.resolvePrincipalBySubject(TEST_OIDC_SUB);
    expect(principal).not.toBeNull();
    expect(principal?.userId).toBe(TEST_USER_ID);
    expect(principal?.laboratoryId).toBe(DEFAULT_LAB_ID);
    expect(principal?.roles).toContain('ACCESSIONER');
    expect(principal?.permissions).toContain('customer:create');
  });

  it('authenticates valid dev bearer token', async () => {
    const principal = await authService.authenticateHeader(`Bearer dev-token:${TEST_OIDC_SUB}`);
    expect(principal).toBeDefined();
    expect(principal.email).toBe('accessioner.test@apexlabs.com');
  });

  it('throws UnauthorizedProblem for unknown or unmapped OIDC subjects', async () => {
    await expect(
      authService.authenticateHeader('Bearer dev-token:unknown-subject-999'),
    ).rejects.toThrow(UnauthorizedProblem);
  });

  it('throws UnauthorizedProblem when Authorization header is absent or invalid', async () => {
    await expect(authService.authenticateHeader(undefined)).rejects.toThrow(
      UnauthorizedProblem,
    );
    await expect(authService.authenticateHeader('Basic invalid-credentials')).rejects.toThrow(
      UnauthorizedProblem,
    );
  });
});
