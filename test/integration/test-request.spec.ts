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
import { Client } from 'pg';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('SPEC-003: Test Request Creation and Immutable Method Binding (Integration)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let auditVerifier: AuditVerifierService;
  let auditService: AuditService;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const SECOND_LAB_ID = '01918000-0000-7000-8000-000000000002';

  const ACCESSIONER_ROLE_ID = '01918000-0000-7000-8000-000000000011';
  const DIRECTOR_ROLE_ID = '01918000-0000-7000-8000-000000000012';
  const ANALYST_ROLE_ID = '01918000-0000-7000-8000-000000000013';

  // Lab A Users
  const ACCESSIONER_JANE_ID = generateUuidV7();
  const ACCESSIONER_JANE_SUB = 'auth0|spec003-jane-accessioner';

  const DIRECTOR_BOB_ID = generateUuidV7();
  const DIRECTOR_BOB_SUB = 'auth0|spec003-bob-director';

  const ANALYST_CHARLIE_ID = generateUuidV7();
  const ANALYST_CHARLIE_SUB = 'auth0|spec003-charlie-analyst';

  // Lab B User
  const LAB_B_USER_ID = generateUuidV7();
  const LAB_B_USER_SUB = 'auth0|spec003-labb-user';

  // Customer IDs
  const CUSTOMER_ACTIVE_ID = generateUuidV7();
  const CUSTOMER_HOLD_ID = generateUuidV7();
  const CUSTOMER_INACTIVE_ID = generateUuidV7();
  const CUSTOMER_LAB_B_ID = generateUuidV7();

  // Method Version IDs
  const METHOD_1_ID = generateUuidV7();
  const METHOD_1_V1_ID = generateUuidV7();
  const METHOD_1_V2_ID = generateUuidV7();

  const METHOD_2_ID = generateUuidV7();
  const METHOD_2_V1_ID = generateUuidV7();

  const METHOD_LAB_B_ID = generateUuidV7();
  const METHOD_LAB_B_V1_ID = generateUuidV7();

  beforeAll(async () => {
    const dbUrl = await startTestDatabase();
    process.env.DATABASE_URL = dbUrl;
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3099';

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

    // 2. Seed Users
    // Jane (Accessioner, Lab A)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        ACCESSIONER_JANE_ID,
        DEFAULT_LAB_ID,
        ACCESSIONER_JANE_SUB,
        'jane.spec3@apexlabs.com',
        'Jane Accessioner',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [ACCESSIONER_JANE_ID, ACCESSIONER_ROLE_ID],
    );

    // Bob (Director, Lab A)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [DIRECTOR_BOB_ID, DEFAULT_LAB_ID, DIRECTOR_BOB_SUB, 'bob.spec3@apexlabs.com', 'Bob Director'],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [DIRECTOR_BOB_ID, DIRECTOR_ROLE_ID],
    );

    // Charlie (Analyst, Lab A - Read only)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        ANALYST_CHARLIE_ID,
        DEFAULT_LAB_ID,
        ANALYST_CHARLIE_SUB,
        'charlie.spec3@apexlabs.com',
        'Charlie Analyst',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [ANALYST_CHARLIE_ID, ANALYST_ROLE_ID],
    );

    // Lab B User
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [LAB_B_USER_ID, SECOND_LAB_ID, LAB_B_USER_SUB, 'labb.spec3@apexlabs.com', 'Lab B User'],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
      [LAB_B_USER_ID, ACCESSIONER_ROLE_ID],
    );

    // 3. Seed Customers in Lab A
    await db.query(
      `INSERT INTO customers (customer_id, laboratory_id, client_code, company_name, status)
       VALUES 
        ($1, $4, 'CUST-ACT', 'Active Water Corp', 'ACTIVE'),
        ($2, $4, 'CUST-HLD', 'Hold Chemical Ltd', 'HOLD'),
        ($3, $4, 'CUST-INA', 'Inactive Mining LLC', 'INACTIVE')
       ON CONFLICT DO NOTHING;`,
      [CUSTOMER_ACTIVE_ID, CUSTOMER_HOLD_ID, CUSTOMER_INACTIVE_ID, DEFAULT_LAB_ID],
    );

    // Seed Customer in Lab B
    await db.query(
      `INSERT INTO customers (customer_id, laboratory_id, client_code, company_name, status)
       VALUES ($1, $2, 'CUST-LABB', 'Lab B Client Inc', 'ACTIVE')
       ON CONFLICT DO NOTHING;`,
      [CUSTOMER_LAB_B_ID, SECOND_LAB_ID],
    );

    // 4. Seed Test Methods in Lab A
    // Method 1: EPA-200.8 (v1 ACTIVE, v2 DRAFT)
    await db.query(
      `INSERT INTO test_methods (test_method_id, laboratory_id, code, name)
       VALUES ($1, $2, 'EPA-200.8-SPEC3', 'Trace Metals in Drinking Water')
       ON CONFLICT DO NOTHING;`,
      [METHOD_1_ID, DEFAULT_LAB_ID],
    );
    await db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status,
        accreditation_status, created_by_user_id, approved_by_user_id, effective_from
       ) VALUES 
        ($1, $2, 1, 'Rev 1.0', 'ACTIVE', 'ACCREDITED', $3, $4, NOW()),
        ($5, $2, 2, 'Rev 2.0', 'DRAFT', 'ACCREDITED', $3, null, null)
       ON CONFLICT DO NOTHING;`,
      [METHOD_1_V1_ID, METHOD_1_ID, ACCESSIONER_JANE_ID, DIRECTOR_BOB_ID, METHOD_1_V2_ID],
    );

    // Method 2: SM-4500 (v1 ACTIVE)
    await db.query(
      `INSERT INTO test_methods (test_method_id, laboratory_id, code, name)
       VALUES ($1, $2, 'SM-4500-SPEC3', 'Nitrate in Water')
       ON CONFLICT DO NOTHING;`,
      [METHOD_2_ID, DEFAULT_LAB_ID],
    );
    await db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status,
        accreditation_status, created_by_user_id, approved_by_user_id, effective_from
       ) VALUES ($1, $2, 1, 'Rev 1.0', 'ACTIVE', 'ACCREDITED', $3, $4, NOW())
       ON CONFLICT DO NOTHING;`,
      [METHOD_2_V1_ID, METHOD_2_ID, ACCESSIONER_JANE_ID, DIRECTOR_BOB_ID],
    );

    // Lab B Method: METHOD-LAB-B (v1 ACTIVE)
    await db.query(
      `INSERT INTO test_methods (test_method_id, laboratory_id, code, name)
       VALUES ($1, $2, 'METHOD-LABB', 'Lab B Proprietary Test')
       ON CONFLICT DO NOTHING;`,
      [METHOD_LAB_B_ID, SECOND_LAB_ID],
    );
    await db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status,
        accreditation_status, created_by_user_id, approved_by_user_id, effective_from
       ) VALUES ($1, $2, 1, 'Rev 1.0', 'ACTIVE', 'ACCREDITED', $3, $3, NOW())
       ON CONFLICT DO NOTHING;`,
      [METHOD_LAB_B_V1_ID, METHOD_LAB_B_ID, LAB_B_USER_ID],
    );
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  // ============================================================================
  // 1. HAPPY PATH CREATION & NUMBERING
  // ============================================================================
  it('Scenario 1: creates a test request with multiple active method versions and returns sequential number', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        customerReference: 'PO-2026-HAPPY',
        specialInstructions: 'Process under standard priority.',
        methodVersionIds: [METHOD_1_V1_ID, METHOD_2_V1_ID],
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.status).toBe('SUBMITTED');
    expect(res.body.data.requestNumber).toMatch(/^TR-\d{4}-\d{6}$/);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.auditEventId).toBeDefined();

    // Verify audit event in DB
    const auditRes = await db.query(`SELECT * FROM audit_events WHERE audit_event_id = $1;`, [
      res.body.data.auditEventId,
    ]);
    expect(auditRes.rows).toHaveLength(1);
    expect(auditRes.rows[0]?.action).toBe('TEST_REQUEST_CREATED');
    expect(auditRes.rows[0]?.actor_user_id).toBe(ACCESSIONER_JANE_ID);
  });

  // ============================================================================
  // 2. IMMUTABLE SCIENTIFIC VERSION BINDING & RESILIENCE TO SUPERSEDING
  // ============================================================================
  it('Scenario 2: proves permanent version binding remains valid and unchanged after method version supersession', async () => {
    const dedicatedMethodId = generateUuidV7();
    const dedicatedVersionId = generateUuidV7();

    // 1. Create a dedicated method and active version
    await db.query(
      `INSERT INTO test_methods (test_method_id, laboratory_id, code, name)
       VALUES ($1, $2, 'SUP-TEST-METHOD', 'Dedicated Method for Supersession Test');`,
      [dedicatedMethodId, DEFAULT_LAB_ID],
    );
    await db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status,
        accreditation_status, created_by_user_id, approved_by_user_id, effective_from
       ) VALUES ($1, $2, 1, 'Rev 1.0', 'ACTIVE', 'ACCREDITED', $3, $4, NOW());`,
      [dedicatedVersionId, dedicatedMethodId, ACCESSIONER_JANE_ID, DIRECTOR_BOB_ID],
    );

    // 2. Create request bound to this method version
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [dedicatedVersionId],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    // 3. Directly supersede the version in test_method_versions
    await db.query(
      `UPDATE test_method_versions
       SET status = 'SUPERSEDED', effective_to = NOW()
       WHERE method_version_id = $1;`,
      [dedicatedVersionId],
    );

    // 4. Query the historical test request via GET /api/v1/test-requests/:id
    const fetchRes = await request(app.getHttpServer())
      .get(`/api/v1/test-requests/${requestId}`)
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`);

    expect(fetchRes.status).toBe(200);
    expect(fetchRes.body.data.items).toHaveLength(1);
    // The historical request continues to reference dedicatedVersionId even though it is now SUPERSEDED
    expect(fetchRes.body.data.items[0].methodVersionId).toBe(dedicatedVersionId);
  });

  // ============================================================================
  // 3. TRIGGER GUARDS (DIRECT SQL TAMPERING PROTECTION)
  // ============================================================================
  it('Scenario 3: trigger blocks direct SQL update of method_version_id on test_request_items', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_2_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data.items[0].testRequestItemId;

    // Attempt direct SQL update of method_version_id
    await expect(
      db.query(
        `UPDATE test_request_items SET method_version_id = $1 WHERE test_request_item_id = $2;`,
        [METHOD_1_V1_ID, itemId],
      ),
    ).rejects.toThrow(/Cannot modify immutable test request item/);
  });

  it('Scenario 4: trigger blocks direct SQL delete of test_request_items', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_2_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data.items[0].testRequestItemId;

    await expect(
      db.query(`DELETE FROM test_request_items WHERE test_request_item_id = $1;`, [itemId]),
    ).rejects.toThrow(/Cannot delete test request items once recorded/);
  });

  it('Scenario 5: trigger blocks direct SQL update of core request header fields', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_2_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    // Attempt to mutate customer_id
    await expect(
      db.query(`UPDATE test_requests SET customer_id = $1 WHERE test_request_id = $2;`, [
        CUSTOMER_HOLD_ID,
        requestId,
      ]),
    ).rejects.toThrow(/Cannot modify core identification fields/);
  });

  it('Scenario 6: trigger blocks inserting request items referencing a non-ACTIVE version', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_2_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    // Direct SQL attempt to insert DRAFT version (METHOD_1_V2_ID is DRAFT)
    await expect(
      db.query(
        `INSERT INTO test_request_items (test_request_item_id, test_request_id, method_version_id)
         VALUES ($1, $2, $3);`,
        [generateUuidV7(), requestId, METHOD_1_V2_ID],
      ),
    ).rejects.toThrow(/only ACTIVE versions can be bound to new test requests/);
  });

  // ============================================================================
  // 4. CROSS-TENANT INTEGRITY GUARDS
  // ============================================================================
  it('Scenario 7: rejects request creation with customer from another laboratory', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_LAB_B_ID, // Belongs to Lab B
        methodVersionIds: [METHOD_1_V1_ID],
      });

    expect(res.status).toBe(404);
  });

  it('Scenario 8: rejects request creation with method version from another laboratory', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_LAB_B_V1_ID], // Belongs to Lab B
      });

    expect(res.status).toBe(400);
    expect(res.body.detail).toContain(
      'One or more referenced test method versions do not exist or belong to another laboratory',
    );
  });

  it('Scenario 9: trigger blocks direct SQL insert of customer from another laboratory', async () => {
    const fakeRequestId = generateUuidV7();

    await expect(
      db.query(
        `INSERT INTO test_requests (
          test_request_id, laboratory_id, customer_id, request_number, status, created_by_user_id
        ) VALUES ($1, $2, $3, 'TR-CROSS-01', 'SUBMITTED', $4);`,
        [fakeRequestId, DEFAULT_LAB_ID, CUSTOMER_LAB_B_ID, ACCESSIONER_JANE_ID],
      ),
    ).rejects.toThrow(
      /Tenant integrity violation: customer does not belong to the test request laboratory/,
    );
  });

  it('Scenario 10: trigger blocks direct SQL insert of item with method from another laboratory', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_1_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    await expect(
      db.query(
        `INSERT INTO test_request_items (test_request_item_id, test_request_id, method_version_id)
         VALUES ($1, $2, $3);`,
        [generateUuidV7(), requestId, METHOD_LAB_B_V1_ID],
      ),
    ).rejects.toThrow(
      /Tenant integrity violation: method version does not belong to the test request laboratory/,
    );
  });

  // ============================================================================
  // 5. CANCELLATION FLOW & DECLARATIVE CHECK CONSTRAINTS
  // ============================================================================
  it('Scenario 11: cancels a test request with mandatory reason and verifies terminal state', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_1_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    // Cancel request
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/test-requests/${requestId}/cancel`)
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        reason: 'Sampling site inaccessible due to severe flood warning.',
      });

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('CANCELLED');
    expect(cancelRes.body.data.cancellationReason).toBe(
      'Sampling site inaccessible due to severe flood warning.',
    );
    expect(cancelRes.body.data.cancelledAt).toBeDefined();

    // Verify terminal state: second cancellation attempt returns 400
    const secondCancel = await request(app.getHttpServer())
      .post(`/api/v1/test-requests/${requestId}/cancel`)
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({ reason: 'Duplicate attempt' });

    expect(secondCancel.status).toBe(400);

    // Direct SQL update on CANCELLED row is rejected by trigger
    await expect(
      db.query(
        `UPDATE test_requests SET special_instructions = 'tamper' WHERE test_request_id = $1;`,
        [requestId],
      ),
    ).rejects.toThrow(/Cannot modify test request in CANCELLED status/);
  });

  it('Scenario 12: declarative table check constraint prevents invalid cancellation states', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_1_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const requestId = createRes.body.data.testRequestId;

    // Attempt to set status = 'CANCELLED' without setting cancellation_reason or cancelled_at
    await expect(
      db.query(`UPDATE test_requests SET status = 'CANCELLED' WHERE test_request_id = $1;`, [
        requestId,
      ]),
    ).rejects.toThrow(/chk_test_requests_cancellation_consistency/);
  });

  // ============================================================================
  // 6. CONCURRENCY TESTS
  // ============================================================================
  it('Scenario 13: 10 concurrent creation requests generate 10 unique, non-colliding request numbers', async () => {
    const promises = Array.from({ length: 10 }).map((_, i) =>
      request(app.getHttpServer())
        .post('/api/v1/test-requests')
        .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
        .send({
          customerId: CUSTOMER_ACTIVE_ID,
          customerReference: `PO-CONCURRENT-${i}`,
          methodVersionIds: [METHOD_1_V1_ID],
        }),
    );

    const responses = await Promise.all(promises);
    for (const res of responses) {
      expect(res.status).toBe(201);
    }

    const requestNumbers = responses.map((r) => r.body.data.requestNumber as string);
    const uniqueNumbers = new Set(requestNumbers);

    // Must have exactly 10 unique numbers (zero collisions)
    expect(uniqueNumbers.size).toBe(10);
    for (const num of requestNumbers) {
      expect(num).toMatch(/^TR-\d{4}-\d{6}$/);
    }

    // Numerically verify no sequence gaps: parse numeric suffixes, sort, and assert contiguous progression
    const suffixes = requestNumbers
      .map((num) => {
        const parts = num.split('-');
        const part = parts[2];
        return part ? parseInt(part, 10) : 0;
      })
      .sort((a, b) => a - b);

    expect(suffixes).toHaveLength(10);
    const baseSuffix = suffixes[0] ?? 0;
    for (let i = 0; i < suffixes.length; i++) {
      expect(suffixes[i]).toBe(baseSuffix + i);
    }
  });

  // ============================================================================
  // 7. TRANSACTION ROLLBACK ON AUDIT FAILURE
  // ============================================================================
  it('Scenario 14: transaction rolls back completely when audit logging fails', async () => {
    // Inject controlled failure into AuditService.appendEvent
    const auditSpy = vi
      .spyOn(auditService, 'appendEvent')
      .mockRejectedValueOnce(new Error('Simulated audit ledger hardware fault'));

    const res = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        customerReference: 'PO-ROLLBACK-TEST',
        methodVersionIds: [METHOD_1_V1_ID],
      });

    expect(res.status).toBe(500);

    // Verify that NO test request with this reference exists in the database
    const dbCheck = await db.query(
      `SELECT * FROM test_requests WHERE customer_reference = 'PO-ROLLBACK-TEST';`,
    );
    expect(dbCheck.rows).toHaveLength(0);

    auditSpy.mockRestore();
  });

  // ============================================================================
  // 8. CONCURRENCY RACE TESTS (FOR SHARE ROW LOCKING VALIDATION)
  // ============================================================================
  it('Scenario 18: customer eligibility race - FOR SHARE prevents committing orders against concurrent HOLD status', async () => {
    const raceCustomerId = generateUuidV7();
    await db.query(
      `INSERT INTO customers (customer_id, laboratory_id, client_code, company_name, status)
       VALUES ($1, $2, 'CUST-RACE-1', 'Race Customer Inc', 'ACTIVE');`,
      [raceCustomerId, DEFAULT_LAB_ID],
    );

    const dbUrl = app.get(ConfigService).databaseUrl;
    const clientA = new Client({ connectionString: dbUrl });
    const clientB = new Client({ connectionString: dbUrl });
    await clientA.connect();
    await clientB.connect();

    try {
      // 1. Transaction A starts and obtains FOR SHARE lock on customer (as in TestRequestService)
      await clientA.query('BEGIN;');
      const selectRes = await clientA.query(
        `SELECT customer_id, status FROM customers WHERE customer_id = $1 FOR SHARE;`,
        [raceCustomerId],
      );
      expect(selectRes.rows[0]?.status).toBe('ACTIVE');

      // 2. Transaction B starts and attempts conflicting UPDATE to move customer to HOLD
      await clientB.query('BEGIN;');
      let bCompleted = false;
      const updatePromise = clientB
        .query(`UPDATE customers SET status = 'HOLD', updated_at = NOW() WHERE customer_id = $1;`, [
          raceCustomerId,
        ])
        .then((res) => {
          bCompleted = true;
          return res;
        });

      // 3. Deterministically prove Transaction B is blocked by Transaction A's FOR SHARE lock
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(bCompleted).toBe(false);

      // 4. Transaction A commits and releases its lock
      await clientA.query('COMMIT;');

      // 5. Transaction B proceeds, unblocks, and completes its update
      await updatePromise;
      expect(bCompleted).toBe(true);
      await clientB.query('COMMIT;');

      // 6. Verify customer status in database is now HOLD
      const finalCheck = await db.query(`SELECT status FROM customers WHERE customer_id = $1;`, [
        raceCustomerId,
      ]);
      expect(finalCheck.rows[0]?.status).toBe('HOLD');
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  it('Scenario 19: method supersession race - FOR SHARE OF tmv prevents binding superseded version concurrently', async () => {
    const raceMethodId = generateUuidV7();
    const raceVersionId = generateUuidV7();

    await db.query(
      `INSERT INTO test_methods (test_method_id, laboratory_id, code, name)
       VALUES ($1, $2, 'RACE-METHOD', 'Method Supersession Race Test');`,
      [raceMethodId, DEFAULT_LAB_ID],
    );
    await db.query(
      `INSERT INTO test_method_versions (
        method_version_id, test_method_id, version_number, revision_label, status,
        accreditation_status, created_by_user_id, approved_by_user_id, effective_from
       ) VALUES ($1, $2, 1, 'Rev 1.0', 'ACTIVE', 'ACCREDITED', $3, $4, NOW());`,
      [raceVersionId, raceMethodId, ACCESSIONER_JANE_ID, DIRECTOR_BOB_ID],
    );

    const dbUrl = app.get(ConfigService).databaseUrl;
    const clientA = new Client({ connectionString: dbUrl });
    const clientB = new Client({ connectionString: dbUrl });
    await clientA.connect();
    await clientB.connect();

    try {
      // 1. Transaction A starts and obtains FOR SHARE OF tmv lock (as in TestRequestService)
      await clientA.query('BEGIN;');
      const selectRes = await clientA.query(
        `SELECT tmv.method_version_id, tmv.status 
         FROM test_method_versions tmv
         WHERE tmv.method_version_id = $1
         FOR SHARE OF tmv;`,
        [raceVersionId],
      );
      expect(selectRes.rows[0]?.status).toBe('ACTIVE');

      // 2. Transaction B starts and attempts conflicting supersession update
      await clientB.query('BEGIN;');
      let bCompleted = false;
      const supersessionPromise = clientB
        .query(
          `UPDATE test_method_versions 
           SET status = 'SUPERSEDED', effective_to = NOW(), updated_at = NOW()
           WHERE method_version_id = $1;`,
          [raceVersionId],
        )
        .then((res) => {
          bCompleted = true;
          return res;
        });

      // 3. Deterministically prove Transaction B is blocked by Transaction A's FOR SHARE OF tmv lock
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(bCompleted).toBe(false);

      // 4. Transaction A commits and releases its lock
      await clientA.query('COMMIT;');

      // 5. Transaction B proceeds, unblocks, and completes its supersession
      await supersessionPromise;
      expect(bCompleted).toBe(true);
      await clientB.query('COMMIT;');

      // 6. Verify method version in database is now SUPERSEDED
      const finalCheck = await db.query(
        `SELECT status FROM test_method_versions WHERE method_version_id = $1;`,
        [raceVersionId],
      );
      expect(finalCheck.rows[0]?.status).toBe('SUPERSEDED');
    } finally {
      await clientA.end();
      await clientB.end();
    }
  });

  // ============================================================================
  // 8. TENANT ISOLATION ON READ
  // ============================================================================
  it('Scenario 15: Laboratory B cannot read a test request belonging to Laboratory A', async () => {
    // Create in Lab A
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_JANE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_1_V1_ID],
      });
    expect(createRes.status).toBe(201);
    const labARequestId = createRes.body.data.testRequestId;

    // Lab B attempts to read it
    const readRes = await request(app.getHttpServer())
      .get(`/api/v1/test-requests/${labARequestId}`)
      .set('Authorization', `Bearer dev-token:${LAB_B_USER_SUB}`);

    expect(readRes.status).toBe(404);
  });

  // ============================================================================
  // 9. RBAC PERMISSIONS GUARD
  // ============================================================================
  it('Scenario 16: Analyst role receives 403 Forbidden when attempting to create test request', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/test-requests')
      .set('Authorization', `Bearer dev-token:${ANALYST_CHARLIE_SUB}`)
      .send({
        customerId: CUSTOMER_ACTIVE_ID,
        methodVersionIds: [METHOD_1_V1_ID],
      });

    expect(res.status).toBe(403);
  });

  // ============================================================================
  // 10. CONTINUOUS CRYPTOGRAPHIC AUDIT CHAIN VERIFICATION
  // ============================================================================
  it('Scenario 17: verifies continuous cryptographic audit chain across all test request events', async () => {
    const result = await auditVerifier.verifyChain(DEFAULT_LAB_ID);
    expect(result.isContinuous).toBe(true);
  });
});
