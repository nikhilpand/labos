import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigService } from '@/core/config/config.service';
import { DatabaseService } from '@/core/database/database.service';
import { AuditService } from '@/platform/audit/audit.service';
import { AuditVerifierService } from '@/platform/audit/audit-verifier.service';
import { ProblemDetailsFilter } from '@/core/errors/rfc7807.filter';
import { generateUuidV7 } from '@/core/common/uuid';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Laboratory Catalog & Versioned Test Method Foundation (SPEC-002 Integration)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let auditVerifier: AuditVerifierService;
  let auditService: AuditService;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const SECOND_LAB_ID = '01918000-0000-7000-8000-000000000002';

  const DIRECTOR_ROLE_ID = '01918000-0000-7000-8000-000000000012';
  const ADMIN_ROLE_ID = '01918000-0000-7000-8000-000000000010';
  const ANALYST_ROLE_ID = '01918000-0000-7000-8000-000000000013';

  // Lab A Users
  const CHEMIST_ALICE_ID = generateUuidV7();
  const CHEMIST_ALICE_SUB = 'auth0|spec002-alice-chemist';

  const DIRECTOR_BOB_ID = generateUuidV7();
  const DIRECTOR_BOB_SUB = 'auth0|spec002-bob-director';

  const ANALYST_CHARLIE_ID = generateUuidV7();
  const ANALYST_CHARLIE_SUB = 'auth0|spec002-charlie-analyst';

  // Lab B User
  const LAB_B_DIRECTOR_ID = generateUuidV7();
  const LAB_B_DIRECTOR_SUB = 'auth0|spec002-labb-director';

  // Known global unit
  const GLOBAL_MG_L_ID = '018f0000-0000-7000-8000-000000000001';

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3098';

    const configService = new ConfigService();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new ProblemDetailsFilter(configService));
    await app.init();

    db = app.get(DatabaseService);
    auditVerifier = app.get(AuditVerifierService);
    auditService = app.get(AuditService);

    // 1. Seed Second Laboratory
    await db.query(
      `INSERT INTO laboratories (laboratory_id, organization_id, name, accreditation_number, accreditation_body, status)
       VALUES ($1, '01918000-0000-7000-8000-000000000000', 'Apex Chemical Testing Labs B', 'TEST-17025-LABB', 'A2LA', 'ACTIVE')
       ON CONFLICT (laboratory_id) DO NOTHING;`,
      [SECOND_LAB_ID],
    );

    // 2. Seed Alice (Chemist with ADMIN role in Lab A - can author & manage catalog)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [CHEMIST_ALICE_ID, DEFAULT_LAB_ID, CHEMIST_ALICE_SUB, 'alice@apexlabs.com', 'Alice Chemist'],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [CHEMIST_ALICE_ID, ADMIN_ROLE_ID],
    );

    // 3. Seed Bob (Director in Lab A - can approve & activate methods)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        DIRECTOR_BOB_ID,
        DEFAULT_LAB_ID,
        DIRECTOR_BOB_SUB,
        'bob.director@apexlabs.com',
        'Bob Director',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [DIRECTOR_BOB_ID, DIRECTOR_ROLE_ID],
    );

    // 4. Seed Charlie (Analyst in Lab A - read-only on catalog)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        ANALYST_CHARLIE_ID,
        DEFAULT_LAB_ID,
        ANALYST_CHARLIE_SUB,
        'charlie@apexlabs.com',
        'Charlie Analyst',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [ANALYST_CHARLIE_ID, ANALYST_ROLE_ID],
    );

    // 5. Seed Lab B Director
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [LAB_B_DIRECTOR_ID, SECOND_LAB_ID, LAB_B_DIRECTOR_SUB, 'director@labb.com', 'Lab B Director'],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [LAB_B_DIRECTOR_ID, DIRECTOR_ROLE_ID],
    );
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  // State shared across test stages
  let testMethodId: string;
  let v1Id: string;
  let v2Id: string;
  let parameterIdLead: string;
  let sampleTypeIdWater: string;
  let _customUnitId: string;

  // 1. Full happy-path method lifecycle
  it('1. Happy Path: Creates units, sample types, analytes, methods, parameters, and activates v1', async () => {
    // Step A: Create custom unit
    const unitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        symbol: 'µg/L-custom',
        name: 'Micrograms per Liter (Custom)',
        category: 'CONCENTRATION_MASS',
      });
    expect(unitRes.status).toBe(201);
    _customUnitId = unitRes.body.data.unitId;

    // Step B: Create sample type (matrix)
    const stRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/sample-types')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        code: 'POTABLE_WATER',
        name: 'Drinking / Potable Water',
        description: 'Municipal treated tap water',
      });
    expect(stRes.status).toBe(201);
    sampleTypeIdWater = stRes.body.data.sampleTypeId;

    // Step C: Create test parameter (analyte)
    const paramRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/parameters')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        code: 'LEAD_TOTAL',
        name: 'Lead, Total Recoverable',
        chemicalFormula: 'Pb',
        casNumber: '7439-92-1',
      });
    expect(paramRes.status).toBe(201);
    parameterIdLead = paramRes.body.data.parameterId;

    // Step D: Create method header and initial v1 DRAFT
    const methodRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/methods')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        code: 'EPA_200.8',
        name: 'Determination of Trace Elements in Waters by ICP-MS',
        regulatoryAgency: 'EPA',
        revisionLabel: 'Rev 5.4',
        accreditationStatus: 'ACCREDITED',
        sopReference: 'SOP-MET-2008',
        sampleTypeIds: [sampleTypeIdWater],
      });
    expect(methodRes.status).toBe(201);
    testMethodId = methodRes.body.data.method.testMethodId;
    v1Id = methodRes.body.data.version.methodVersionId;
    expect(methodRes.body.data.version.status).toBe('DRAFT');
    expect(methodRes.body.data.version.versionNumber).toBe(1);

    // Step E: Configure parameters on v1
    const configRes = await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${v1Id}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.00050000',
            reportingLimit: '0.00200000',
            decimalPrecision: 4,
            isMandatory: true,
          },
        ],
      });
    expect(configRes.status).toBe(200);
    expect(configRes.body.data.parameters).toHaveLength(1);
    expect(configRes.body.data.parameters[0].parameterCode).toBe('LEAD_TOTAL');
    expect(configRes.body.data.parameters[0].unitSymbol).toBe('mg/L');

    // Step F: Activate v1 by Director Bob (Four-Eyes principle)
    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${v1Id}/activate`)
      .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`);

    expect(activateRes.status).toBe(201);
    expect(activateRes.body.data.status).toBe('ACTIVE');
    expect(activateRes.body.data.approvedByUserId).toBe(DIRECTOR_BOB_ID);
    expect(activateRes.body.data.effectiveFrom).toBeDefined();

    // Verify GET /methods lists activeVersion
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/catalog/methods')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`);
    expect(listRes.status).toBe(200);
    const listed = listRes.body.data.find(
      (m: { testMethodId: string; activeVersion?: { methodVersionId: string; status: string } }) =>
        m.testMethodId === testMethodId,
    );
    expect(listed).toBeDefined();
    expect(listed.activeVersion).toBeDefined();
    expect(listed.activeVersion.methodVersionId).toBe(v1Id);
    expect(listed.activeVersion.status).toBe('ACTIVE');
  });

  // 2. Only one ACTIVE version can exist per method (Database partial index)
  it('2. Database partial index enforces at most ONE active version per method', async () => {
    // Attempting direct SQL insert of a second ACTIVE version for the same method
    const duplicateActiveInsert = db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status, created_by_user_id
       ) VALUES ($1, $2, 999, 'Rev 999', 'ACTIVE', $3);`,
      [generateUuidV7(), testMethodId, CHEMIST_ALICE_ID],
    );

    await expect(duplicateActiveInsert).rejects.toThrow(/uq_method_active_version/);
  });

  // 3. Activating v2 supersedes v1 atomically
  it('3. Activating revision v2 atomically supersedes v1', async () => {
    // Draft v2
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        revisionLabel: 'Rev 5.5',
        accreditationStatus: 'ACCREDITED',
        sopReference: 'SOP-MET-2008-B',
        sampleTypeIds: [sampleTypeIdWater],
      });
    expect(draftRes.status).toBe(201);
    v2Id = draftRes.body.data.methodVersionId;
    expect(draftRes.body.data.versionNumber).toBe(2);
    expect(draftRes.body.data.status).toBe('DRAFT');

    // Configure improved limits on v2
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${v2Id}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.00020000',
            reportingLimit: '0.00100000',
            decimalPrecision: 4,
          },
        ],
      });

    // Activate v2 by Director Bob
    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${v2Id}/activate`)
      .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`);
    expect(activateRes.status).toBe(201);
    expect(activateRes.body.data.status).toBe('ACTIVE');

    // Verify v1 is now SUPERSEDED
    const v1Query = await db.query(
      `SELECT status, effective_to FROM test_method_versions WHERE method_version_id = $1;`,
      [v1Id],
    );
    const v1Row = v1Query.rows[0];
    expect(v1Row).toBeDefined();
    expect(v1Row?.status).toBe('SUPERSEDED');
    expect(v1Row?.effective_to).not.toBeNull();

    // Verify GET /methods returns activeVersion = v2
    const listRes = await request(app.getHttpServer())
      .get('/api/v1/catalog/methods')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`);
    const listed = listRes.body.data.find(
      (m: {
        testMethodId: string;
        activeVersion: { methodVersionId: string; versionNumber: number };
      }) => m.testMethodId === testMethodId,
    );
    expect(listed.activeVersion.methodVersionId).toBe(v2Id);
    expect(listed.activeVersion.versionNumber).toBe(2);
  });

  // 4. Direct SQL mutation of ACTIVE method version scientific fields fails (Immutability Trigger)
  it('4. Database trigger prohibits modifying scientific/audit fields of ACTIVE version', async () => {
    // Attempt A: Direct update while retaining ACTIVE status (prohibited status transition)
    const activeUpdateAttempt = db.query(
      `UPDATE test_method_versions SET revision_label = 'ILLEGALLY_ALTERED' WHERE method_version_id = $1;`,
      [v2Id],
    );
    await expect(activeUpdateAttempt).rejects.toThrow(
      /Invalid status transition from ACTIVE to ACTIVE/,
    );

    // Attempt B: Transition to SUPERSEDED while trying to mutate scientific fields simultaneously
    const sneakyUpdateAttempt = db.query(
      `UPDATE test_method_versions 
       SET status = 'SUPERSEDED', revision_label = 'ILLEGALLY_ALTERED' 
       WHERE method_version_id = $1;`,
      [v2Id],
    );
    await expect(sneakyUpdateAttempt).rejects.toThrow(
      /Cannot modify scientific or audit fields of an ACTIVE test method version/,
    );
  });

  // 5. Direct SQL deletion of ACTIVE/SUPERSEDED method version configuration fails
  it('5. Database trigger prohibits deleting finalized method versions', async () => {
    // Attempt deleting SUPERSEDED v1
    await expect(
      db.query(`DELETE FROM test_method_versions WHERE method_version_id = $1;`, [v1Id]),
    ).rejects.toThrow(/Cannot delete test method version once finalized/);

    // Attempt deleting ACTIVE v2
    await expect(
      db.query(`DELETE FROM test_method_versions WHERE method_version_id = $1;`, [v2Id]),
    ).rejects.toThrow(/Cannot delete test method version once finalized/);
  });

  // 6. Direct modification of parameters belonging to non-DRAFT versions fails
  it('6. Database trigger prohibits modifying parameters of non-DRAFT method versions', async () => {
    // Attempting direct SQL insert into parameters of ACTIVE v2
    await expect(
      db.query(
        `INSERT INTO method_version_parameters (
          method_version_parameter_id, method_version_id, parameter_id, unit_id, detection_limit, reporting_limit
         ) VALUES ($1, $2, $3, $4, 0.01, 0.05);`,
        [generateUuidV7(), v2Id, parameterIdLead, GLOBAL_MG_L_ID],
      ),
    ).rejects.toThrow(/Cannot modify or add parameters to a finalized test method version/);

    // Attempting direct SQL delete of parameters of SUPERSEDED v1
    await expect(
      db.query(`DELETE FROM method_version_parameters WHERE method_version_id = $1;`, [v1Id]),
    ).rejects.toThrow(/Cannot delete parameters of a finalized test method version/);
  });

  // 7. Cross-tenant parameter injection is rejected
  it('7. Rejects cross-tenant parameter injection at service and database trigger levels', async () => {
    // Lab B creates parameter
    const labBParamRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/parameters')
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`)
      .send({
        code: 'LAB_B_ANALYTE',
        name: 'Lab B Specific Analyte',
      });
    expect(labBParamRes.status).toBe(201);
    const labBParamId = labBParamRes.body.data.parameterId;

    // Draft v3 in Lab A
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev 5.6' });
    const v3Id = draftRes.body.data.methodVersionId;

    // Service level rejection
    const configRes = await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${v3Id}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: labBParamId, // Cross-tenant!
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });
    expect(configRes.status).toBe(400);
    expect(configRes.body.detail).toContain('belong to another laboratory');

    // Database trigger rejection: trg_parameter_tenant_consistency
    await expect(
      db.query(
        `INSERT INTO method_version_parameters (
          method_version_parameter_id, method_version_id, parameter_id, unit_id, detection_limit, reporting_limit
         ) VALUES ($1, $2, $3, $4, 0.001, 0.005);`,
        [generateUuidV7(), v3Id, labBParamId, GLOBAL_MG_L_ID],
      ),
    ).rejects.toThrow(
      /Tenant isolation violation: parameter does not belong to the method laboratory/,
    );
  });

  // 8. Cross-tenant sample type injection is rejected
  it('8. Rejects cross-tenant sample type injection at service and database trigger levels', async () => {
    // Lab B creates sample type
    const labBMatrixRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/sample-types')
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`)
      .send({
        code: 'LAB_B_MATRIX',
        name: 'Hazardous Waste Sludge',
      });
    expect(labBMatrixRes.status).toBe(201);
    const labBMatrixId = labBMatrixRes.body.data.sampleTypeId;

    // Service level rejection when drafting version in Lab A
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        revisionLabel: 'Rev Invalid Matrix',
        sampleTypeIds: [labBMatrixId],
      });
    expect(draftRes.status).toBe(400);
    expect(draftRes.body.detail).toContain('belong to another laboratory');

    // Draft clean version
    const cleanDraft = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Temp' });
    const cleanDraftId = cleanDraft.body.data.methodVersionId;

    // Database trigger rejection: trg_sample_type_tenant_consistency
    await expect(
      db.query(
        `INSERT INTO method_version_sample_types (method_version_id, sample_type_id)
         VALUES ($1, $2);`,
        [cleanDraftId, labBMatrixId],
      ),
    ).rejects.toThrow(
      /Tenant isolation violation: sample type does not belong to the method laboratory/,
    );
  });

  // 9. Cross-tenant custom unit injection is rejected
  it('9. Rejects cross-tenant custom unit injection at service and database trigger levels', async () => {
    // Lab B creates custom unit
    const labBUnitRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/units')
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`)
      .send({
        symbol: 'ppb-labb',
        name: 'Parts per Billion Lab B',
        category: 'CONCENTRATION_RATIO',
      });
    expect(labBUnitRes.status).toBe(201);
    const labBUnitId = labBUnitRes.body.data.unitId;

    // Draft clean version in Lab A
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Unit Test' });
    const vUnitId = draftRes.body.data.methodVersionId;

    // Service level rejection
    const configRes = await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${vUnitId}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: labBUnitId, // Lab B custom unit!
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });
    expect(configRes.status).toBe(400);
    expect(configRes.body.detail).toContain('belongs to another laboratory');

    // Database trigger rejection
    await expect(
      db.query(
        `INSERT INTO method_version_parameters (
          method_version_parameter_id, method_version_id, parameter_id, unit_id, detection_limit, reporting_limit
         ) VALUES ($1, $2, $3, $4, 0.001, 0.005);`,
        [generateUuidV7(), vUnitId, parameterIdLead, labBUnitId],
      ),
    ).rejects.toThrow(/Tenant isolation violation: custom unit belongs to another laboratory/);
  });

  // 10. Global units are allowed across laboratories, but cannot be deleted
  it('10. Global standard units are shared across tenants, and protected from deletion', async () => {
    // Lab A can list global units
    const labAUnits = await request(app.getHttpServer())
      .get('/api/v1/catalog/units')
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`);
    expect(
      labAUnits.body.data.some(
        (u: { symbol: string; laboratoryId: string | null }) =>
          u.symbol === 'mg/L' && u.laboratoryId === null,
      ),
    ).toBe(true);

    // Lab B can also list global units
    const labBUnits = await request(app.getHttpServer())
      .get('/api/v1/catalog/units')
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`);
    expect(labBUnits.status).toBe(200);
    expect(
      labBUnits.body.data.some(
        (u: { symbol: string; laboratoryId: string | null }) =>
          u.symbol === 'mg/L' && u.laboratoryId === null,
      ),
    ).toBe(true);

    // But global units can NEVER be deleted (trigger trg_protect_global_units)
    await expect(
      db.query(`DELETE FROM units_of_measurement WHERE unit_id = $1;`, [GLOBAL_MG_L_ID]),
    ).rejects.toThrow(/Cannot delete platform-standard global unit of measurement/);
  });

  // 11. A method author cannot approve their own version (Four-eyes policy)
  it('11. Enforces Four-Eyes separation of duties: author cannot approve own version', async () => {
    // Alice drafts v_four_eyes
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Four-Eyes' });
    const vFourEyesId = draftRes.body.data.methodVersionId;

    // Configure parameter
    await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${vFourEyesId}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });

    // Alice attempts to approve her own draft
    const approveAttempt = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${vFourEyesId}/activate`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`);

    expect(approveAttempt.status).toBe(400);
    expect(approveAttempt.body.detail).toContain('Four-eyes policy violation');

    // Database trigger also rejects if attempted via direct SQL
    await expect(
      db.query(
        `UPDATE test_method_versions 
         SET status = 'ACTIVE', approved_by_user_id = $2
         WHERE method_version_id = $1;`,
        [vFourEyesId, CHEMIST_ALICE_ID], // approved_by == created_by!
      ),
    ).rejects.toThrow(/Four-eyes policy violation: author cannot approve own method version/);
  });

  // 12. A method version cannot activate with zero parameters
  it('12. Rejects activation of a method version with zero configured parameters', async () => {
    // Alice drafts a version without configuring parameters
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Zero Param' });
    const zeroParamVersionId = draftRes.body.data.methodVersionId;

    // Director Bob attempts to activate
    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${zeroParamVersionId}/activate`)
      .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`);

    expect(activateRes.status).toBe(400);
    expect(activateRes.body.detail).toContain('zero configured parameters');
  });

  // 13. Audit failure rolls back activation completely
  it('13. Audit failure rolls back method version activation completely', async () => {
    // Draft and configure a valid version
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Audit Rollback' });
    const rollbackVersionId = draftRes.body.data.methodVersionId;

    await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${rollbackVersionId}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });

    // Spy on AuditService to throw on activation
    const originalAppend = auditService.appendEvent.bind(auditService);
    vi.spyOn(auditService, 'appendEvent').mockImplementation(async (input, tx) => {
      if (input.action === 'TEST_METHOD_VERSION_ACTIVATED') {
        throw new Error('Simulated hardware failure on audit ledger');
      }
      return originalAppend(input, tx);
    });

    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${rollbackVersionId}/activate`)
      .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`);

    expect(activateRes.status).toBe(500);

    // Verify rollback: rollbackVersionId is STILL in DRAFT
    const versionRow = await db.query(
      `SELECT status FROM test_method_versions WHERE method_version_id = $1;`,
      [rollbackVersionId],
    );
    const row = versionRow.rows[0];
    expect(row).toBeDefined();
    expect(row?.status).toBe('DRAFT');

    vi.restoreAllMocks();
  });

  // 14. Concurrent activation attempts cannot produce two ACTIVE versions
  it('14. Concurrent activation attempts cannot produce multiple ACTIVE versions', async () => {
    // Draft version A
    const draftA = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Conc A' });
    const versionAId = draftA.body.data.methodVersionId;

    await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${versionAId}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });

    // Draft version B
    const draftB = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({ revisionLabel: 'Rev Conc B' });
    const versionBId = draftB.body.data.methodVersionId;

    await request(app.getHttpServer())
      .put(`/api/v1/catalog/methods/${testMethodId}/versions/${versionBId}/parameters`)
      .set('Authorization', `Bearer dev-token:${CHEMIST_ALICE_SUB}`)
      .send({
        parameters: [
          {
            parameterId: parameterIdLead,
            unitId: GLOBAL_MG_L_ID,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
        ],
      });

    // Launch concurrent activations
    await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/catalog/methods/${testMethodId}/versions/${versionAId}/activate`)
        .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`),
      request(app.getHttpServer())
        .post(`/api/v1/catalog/methods/${testMethodId}/versions/${versionBId}/activate`)
        .set('Authorization', `Bearer dev-token:${DIRECTOR_BOB_SUB}`),
    ]);

    // Both may succeed sequentially (with one superseding the other), but exactly ONE can be ACTIVE in the database
    const activeVersions = await db.query(
      `SELECT method_version_id, version_number FROM test_method_versions 
       WHERE test_method_id = $1 AND status = 'ACTIVE';`,
      [testMethodId],
    );

    expect(activeVersions.rowCount).toBe(1);
  });

  // 15. Laboratory A cannot read or mutate Laboratory B's catalog
  it('15. Cross-tenant catalog isolation: Lab B cannot view or mutate Lab A methods', async () => {
    // Lab B tries to fetch Lab A's method
    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/catalog/methods/${testMethodId}`)
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`);
    expect(getRes.status).toBe(404);

    // Lab B tries to draft a version on Lab A's method
    const draftRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions`)
      .set('Authorization', `Bearer dev-token:${LAB_B_DIRECTOR_SUB}`)
      .send({ revisionLabel: 'Rev Attack' });
    expect(draftRes.status).toBe(404);
  });

  // 16. RBAC correctly rejects unauthorized roles
  it('16. RBAC Guard rejects non-privileged roles from mutating catalog', async () => {
    // Charlie (Analyst) lacks catalog:manage
    const postMethodRes = await request(app.getHttpServer())
      .post('/api/v1/catalog/methods')
      .set('Authorization', `Bearer dev-token:${ANALYST_CHARLIE_SUB}`)
      .send({
        code: 'ANALYST_UNAUTHORIZED',
        name: 'Should Fail',
      });
    expect(postMethodRes.status).toBe(403);
    expect(postMethodRes.body.detail).toContain('Access denied');

    // Charlie lacks method:approve
    const activateRes = await request(app.getHttpServer())
      .post(`/api/v1/catalog/methods/${testMethodId}/versions/${v2Id}/activate`)
      .set('Authorization', `Bearer dev-token:${ANALYST_CHARLIE_SUB}`);
    expect(activateRes.status).toBe(403);
  });

  // 17. Cryptographic audit chain remains valid after catalog lifecycle events
  it('17. Cryptographic audit chain is continuous and valid across all catalog operations', async () => {
    const labAVerification = await auditVerifier.verifyChain(DEFAULT_LAB_ID);
    expect(labAVerification.isContinuous).toBe(true);
    expect(labAVerification.totalEventsChecked).toBeGreaterThanOrEqual(5);

    const labBVerification = await auditVerifier.verifyChain(SECOND_LAB_ID);
    expect(labBVerification.isContinuous).toBe(true);
  });
});
