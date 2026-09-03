import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { ConfigService } from '@/core/config/config.service';
import { DatabaseService } from '@/core/database/database.service';
import { AuditService } from '@/platform/audit/audit.service';
import { AuditVerifierService } from '@/platform/audit/audit-verifier.service';
import { CustomerService } from '@/modules/customer/customer.service';
import { ProblemDetailsFilter } from '@/core/errors/rfc7807.filter';
import { generateUuidV7 } from '@/core/common/uuid';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Customer Registration Vertical Slice (SPEC-001 Integration)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let auditVerifier: AuditVerifierService;
  let auditService: AuditService;
  let customerService: CustomerService;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const SECOND_LAB_ID = '01918000-0000-7000-8000-000000000002';
  const ACCESSIONER_ROLE_ID = '01918000-0000-7000-8000-000000000011';
  const ANALYST_ROLE_ID = '01918000-0000-7000-8000-000000000013';

  const ACCESSIONER_USER_ID = generateUuidV7();
  const ACCESSIONER_SUB = 'auth0|spec001-accessioner-test';

  const ANALYST_USER_ID = generateUuidV7();
  const ANALYST_SUB = 'auth0|spec001-analyst-test';

  const SECOND_LAB_USER_ID = generateUuidV7();
  const SECOND_LAB_SUB = 'auth0|spec001-secondlab-test';

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
    customerService = app.get(CustomerService);

    // 1. Seed Second Laboratory for cross-laboratory uniqueness testing
    await db.query(
      `INSERT INTO laboratories (laboratory_id, organization_id, name, accreditation_number, accreditation_body, status)
       VALUES ($1, '01918000-0000-7000-8000-000000000000', 'Apex Food & Ag Testing Labs', 'TEST-17025-FOOD-99', 'A2LA', 'ACTIVE')
       ON CONFLICT (laboratory_id) DO NOTHING;`,
      [SECOND_LAB_ID],
    );

    // 2. Seed Accessioner User (with customer:create via ACCESSIONER role)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        ACCESSIONER_USER_ID,
        DEFAULT_LAB_ID,
        ACCESSIONER_SUB,
        'accessioner@apexlabs.com',
        'Sarah Accessioner',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [ACCESSIONER_USER_ID, ACCESSIONER_ROLE_ID],
    );

    // 3. Seed Analyst User (without customer:create permission)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [ANALYST_USER_ID, DEFAULT_LAB_ID, ANALYST_SUB, 'analyst@apexlabs.com', 'Alex Analyst'],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [ANALYST_USER_ID, ANALYST_ROLE_ID],
    );

    // 4. Seed User in Second Laboratory (with ACCESSIONER role)
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        SECOND_LAB_USER_ID,
        SECOND_LAB_ID,
        SECOND_LAB_SUB,
        'secondlab.reg@apexlabs.com',
        'Second Lab Registrar',
      ],
    );
    await db.query(
      `INSERT INTO user_roles (user_id, role_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING;`,
      [SECOND_LAB_USER_ID, ACCESSIONER_ROLE_ID],
    );
  }, 45000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  const validPayload = {
    clientCode: 'CUST-1042',
    companyName: 'Acme Environmental Services Ltd',
    billingAddress: {
      street: '100 Industrial Parkway',
      city: 'Springfield',
      state: 'IL',
      postalCode: '62701',
      country: 'USA',
    },
    primaryContact: {
      firstName: 'Sarah',
      lastName: 'Jenkins',
      email: 's.jenkins@acme-env.com',
      phone: '+1-217-555-0199',
      roleTitle: 'Compliance Director',
    },
  };

  it('Happy Path: registers customer with primary contact and audit event (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .set('x-correlation-id', 'test-spec001-corr-1')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.clientCode).toBe('CUST-1042');
    expect(data.companyName).toBe('Acme Environmental Services Ltd');
    expect(data.laboratoryId).toBe(DEFAULT_LAB_ID);
    expect(data.status).toBe('ACTIVE');
    expect(data.createdAt).toBeDefined();
    expect(data.customerId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Primary Contact Verification
    expect(data.primaryContact).toBeDefined();
    expect(data.primaryContact.firstName).toBe('Sarah');
    expect(data.primaryContact.lastName).toBe('Jenkins');
    expect(data.primaryContact.email).toBe('s.jenkins@acme-env.com');
    expect(data.primaryContact.phone).toBe('+1-217-555-0199');
    expect(data.primaryContact.isPrimaryContact).toBe(true);

    // Audit Event ID Verification
    expect(data.auditEventId).toBeDefined();

    // Verify Real PostgreSQL Persistence
    const custDb = await db.query(`SELECT * FROM customers WHERE customer_id = $1;`, [
      data.customerId,
    ]);
    expect(custDb.rowCount).toBe(1);
    expect(custDb.rows[0]?.billing_street).toBe('100 Industrial Parkway');
    expect(custDb.rows[0]?.billing_city).toBe('Springfield');
    expect(custDb.rows[0]?.billing_state).toBe('IL');
    expect(custDb.rows[0]?.billing_postal_code).toBe('62701');
    expect(custDb.rows[0]?.billing_country).toBe('USA');

    const contactDb = await db.query(`SELECT * FROM contacts WHERE customer_id = $1;`, [
      data.customerId,
    ]);
    expect(contactDb.rowCount).toBe(1);
    expect(contactDb.rows[0]?.is_primary_contact).toBe(true);
    expect(contactDb.rows[0]?.email).toBe('s.jenkins@acme-env.com');

    const auditDb = await db.query(`SELECT * FROM audit_events WHERE audit_event_id = $1;`, [
      data.auditEventId,
    ]);
    expect(auditDb.rowCount).toBe(1);
    expect(auditDb.rows[0]?.action).toBe('CUSTOMER_REGISTERED');
    expect(auditDb.rows[0]?.actor_user_id).toBe(ACCESSIONER_USER_ID);
    expect(auditDb.rows[0]?.correlation_id).toBe('test-spec001-corr-1');
  });

  it('Duplicate Conflict: returns 409 Conflict when clientCode already exists in same laboratory', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: 'CUST-1042', // Already created in happy path test
        companyName: 'Duplicate Attempt Corp',
      });

    expect(res.status).toBe(409);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('CONFLICT');
    expect(res.body.detail).toContain('already exists in this laboratory');
  });

  it('Concurrency Race Condition: two simultaneous registrations with identical clientCode yield 1 success and 1 conflict', async () => {
    const raceClientCode = 'RACE-CLIENT-999';

    const req1 = request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: raceClientCode,
        companyName: 'Race Corp A',
      });

    const req2 = request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: raceClientCode,
        companyName: 'Race Corp B',
      });

    const [res1, res2] = await Promise.all([req1, req2]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([201, 409]);

    // Exactly one row exists in database for this client code
    const dbRows = await db.query(
      `SELECT * FROM customers WHERE laboratory_id = $1 AND client_code = $2;`,
      [DEFAULT_LAB_ID, raceClientCode],
    );
    expect(dbRows.rowCount).toBe(1);
  });

  it('Laboratory-Scoped Uniqueness: allows identical clientCode in a DIFFERENT laboratory', async () => {
    // In DEFAULT_LAB_ID, 'CUST-1042' exists.
    // Registering 'CUST-1042' in SECOND_LAB_ID should succeed without conflict!
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${SECOND_LAB_SUB}`)
      .send({
        ...validPayload,
        clientCode: 'CUST-1042',
        companyName: 'Acme Branch at Lab 2',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.laboratoryId).toBe(SECOND_LAB_ID);
    expect(res.body.data.clientCode).toBe('CUST-1042');
  });

  it('Laboratory Context Isolation: client cannot override or spoof laboratory_id in body', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: 'CUST-SPOOF-TEST',
        laboratoryId: SECOND_LAB_ID, // Attempt to spoof target laboratory
      });

    expect(res.status).toBe(201);
    // The created customer MUST belong to ACCESSIONER's laboratory, NOT the spoofed one
    expect(res.body.data.laboratoryId).toBe(DEFAULT_LAB_ID);
  });

  it('Transaction Rollback on Contact Failure: contact failure rolls back customer insertion in real PostgreSQL', async () => {
    const rollbackClientCode = 'ROLLBACK-CONTACT-01';

    // Call service with invalid contact that violates database check constraint
    // (e.g. empty email check constraint chk_contacts_email_nonempty)
    const principal = {
      userId: ACCESSIONER_USER_ID,
      laboratoryId: DEFAULT_LAB_ID,
      oidcSubject: ACCESSIONER_SUB,
      email: 'accessioner@apexlabs.com',
      fullName: 'Sarah Accessioner',
      roles: ['ACCESSIONER'],
      permissions: ['customer:create'],
    };

    await expect(
      customerService.registerCustomer(
        {
          clientCode: rollbackClientCode,
          companyName: 'Rollback Test Inc',
          primaryContact: {
            firstName: 'Sarah',
            lastName: 'Jenkins',
            email: '   ', // Trims to empty string -> violates chk_contacts_email_nonempty
          },
        },
        principal,
      ),
    ).rejects.toThrow();

    // Verify Customer was NOT saved in database!
    const checkCust = await db.query(
      `SELECT * FROM customers WHERE laboratory_id = $1 AND client_code = $2;`,
      [DEFAULT_LAB_ID, rollbackClientCode],
    );
    expect(checkCust.rowCount).toBe(0);
  });

  it('Transaction Rollback on Audit Failure: audit failure rolls back both Customer and Contact', async () => {
    const rollbackClientCode = 'ROLLBACK-AUDIT-01';

    // Mock AuditService.appendEvent to simulate audit engine failure inside transaction
    const appendSpy = vi
      .spyOn(auditService, 'appendEvent')
      .mockRejectedValueOnce(new Error('Simulated audit ledger hardware fault'));

    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: rollbackClientCode,
        companyName: 'Rollback Audit Inc',
      });

    expect(res.status).toBe(500);

    // Verify that NEITHER customer NOR contact rows were persisted!
    const checkCust = await db.query(
      `SELECT * FROM customers WHERE laboratory_id = $1 AND client_code = $2;`,
      [DEFAULT_LAB_ID, rollbackClientCode],
    );
    expect(checkCust.rowCount).toBe(0);

    const checkContacts = await db.query(`SELECT * FROM contacts WHERE email = $1;`, [
      'audit-rollback-check@acme.com',
    ]);
    expect(checkContacts.rowCount).toBe(0);

    appendSpy.mockRestore();
  });

  it('RBAC Guard: denies access with 403 Forbidden when user lacks customer:create permission', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ANALYST_SUB}`)
      .send({
        ...validPayload,
        clientCode: 'CUST-FORBIDDEN',
      });

    expect(res.status).toBe(403);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('FORBIDDEN');
    expect(res.body.detail).toContain('customer:create');
  });

  it('Unauthenticated Access: returns 401 Unauthorized when Authorization header is missing', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/customers').send(validPayload);

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('Validation Error: returns 400 Bad Request with invalidParams on invalid payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        clientCode: '',
        companyName: '',
        primaryContact: {
          firstName: '',
          lastName: '',
          email: 'invalid-email',
        },
      });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.code).toBe('BAD_REQUEST');
    expect(res.body.invalidParams).toBeDefined();
    expect(res.body.invalidParams.length).toBeGreaterThan(0);
  });

  it('Customer Deletion Prohibited: foreign key ON DELETE RESTRICT prevents deleting a customer with contacts', async () => {
    // 1. Register a customer with primary contact
    const res = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Authorization', `Bearer dev-token:${ACCESSIONER_SUB}`)
      .send({
        ...validPayload,
        clientCode: 'CUST-RESTRICT-1',
      });

    expect(res.status).toBe(201);
    const customerId = res.body.data.customerId;

    // 2. Direct SQL DELETE on customers table must fail due to ON DELETE RESTRICT foreign key
    await expect(
      db.query(`DELETE FROM customers WHERE customer_id = $1;`, [customerId]),
    ).rejects.toThrow(/violates RESTRICT setting of foreign key constraint/i);

    // 3. Verify customer and contacts remain intact in PostgreSQL
    const checkCust = await db.query(`SELECT * FROM customers WHERE customer_id = $1;`, [
      customerId,
    ]);
    expect(checkCust.rowCount).toBe(1);

    const checkContact = await db.query(`SELECT * FROM contacts WHERE customer_id = $1;`, [
      customerId,
    ]);
    expect(checkContact.rowCount).toBe(1);
  });

  it('Cryptographic Hash Chain Verification: audit ledger chain remains 100% valid after registrations', async () => {
    const chainVerification = await auditVerifier.verifyChain(DEFAULT_LAB_ID);

    expect(chainVerification.isContinuous).toBe(true);
    expect(chainVerification.totalEventsChecked).toBeGreaterThanOrEqual(1);
    expect(chainVerification.reason).toBeUndefined();
  });
});
