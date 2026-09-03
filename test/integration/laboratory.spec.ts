import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { LaboratoryService } from '../../src/platform/laboratory/laboratory.service';
import { LaboratoryRepository } from '../../src/platform/laboratory/laboratory.repository';
import { ConfigService } from '../../src/core/config/config.service';
import { NotFoundProblem } from '../../src/core/errors/rfc7807.exception';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Laboratory Platform Context (Integration)', () => {
  let app: INestApplication;
  let laboratoryService: LaboratoryService;
  let laboratoryRepo: LaboratoryRepository;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const DEFAULT_ORG_ID = '01918000-0000-7000-8000-000000000000';

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

    laboratoryService = app.get(LaboratoryService);
    laboratoryRepo = app.get(LaboratoryRepository);
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  it('retrieves the seeded organization successfully', async () => {
    const org = await laboratoryRepo.findOrganizationById(DEFAULT_ORG_ID);
    expect(org).not.toBeNull();
    expect(org?.organizationId).toBe(DEFAULT_ORG_ID);
    expect(org?.legalName).toBe('Apex Scientific Holdings Inc');
    expect(org?.status).toBe('ACTIVE');
  });

  it('retrieves and verifies the active baseline testing laboratory', async () => {
    const lab = await laboratoryService.ensureActiveLaboratory(DEFAULT_LAB_ID);
    expect(lab).toBeDefined();
    expect(lab.laboratoryId).toBe(DEFAULT_LAB_ID);
    expect(lab.organizationId).toBe(DEFAULT_ORG_ID);
    expect(lab.accreditationNumber).toBe('AT-2941-ISO17025');
    expect(lab.status).toBe('ACTIVE');
  });

  it('throws NotFoundProblem when querying a non-existent laboratory', async () => {
    const nonExistentId = '01918000-0000-7000-8000-999999999999';
    await expect(laboratoryService.ensureActiveLaboratory(nonExistentId)).rejects.toThrow(
      NotFoundProblem,
    );
  });
});
