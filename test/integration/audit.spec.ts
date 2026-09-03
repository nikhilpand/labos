import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { AuditService } from '../../src/platform/audit/audit.service';
import { AuditVerifierService } from '../../src/platform/audit/audit-verifier.service';
import { DatabaseService } from '../../src/core/database/database.service';
import { ConfigService } from '../../src/core/config/config.service';
import { generateUuidV7 } from '../../src/core/common/uuid';
import { startTestDatabase, stopTestDatabase } from '../helpers/test-db';

describe('Audit Ledger & Immutability (Integration)', () => {
  let app: INestApplication;
  let auditService: AuditService;
  let verifierService: AuditVerifierService;
  let db: DatabaseService;

  const DEFAULT_LAB_ID = '01918000-0000-7000-8000-000000000001';
  const TEST_ACTOR_ID = generateUuidV7();
  const TEST_OIDC_SUB = 'auth0|test-audit-actor-999';

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

    auditService = app.get(AuditService);
    verifierService = app.get(AuditVerifierService);
    db = app.get(DatabaseService);

    // Seed test actor user
    await db.query(
      `INSERT INTO users (user_id, laboratory_id, oidc_subject_id, email, full_name, status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (oidc_subject_id) DO NOTHING;`,
      [
        TEST_ACTOR_ID,
        DEFAULT_LAB_ID,
        TEST_OIDC_SUB,
        'actor.test@apexlabs.com',
        'Audit Test Actor',
      ],
    );
  }, 45000);

  afterAll(async () => {
    // Note: Due to the trigger on audit_events, audit rows cannot be deleted!
    // In our test suite, they persist in the ephemeral test database, which is discarded on teardown.
    if (app) {
      await app.close();
    }
    await stopTestDatabase();
  });

  it('appends an audit event inside an ACID transaction and updates the chain head', async () => {
    const entityId = generateUuidV7();
    const correlationId = 'test-corr-reg-1';

    const eventRecord = await db.transaction(async (tx) => {
      return auditService.appendEvent(
        {
          laboratoryId: DEFAULT_LAB_ID,
          actorUserId: TEST_ACTOR_ID,
          action: 'CUSTOMER_REGISTERED',
          entityType: 'Customer',
          entityId,
          correlationId,
          diffPayload: {
            clientCode: 'CUST-1042',
            companyName: 'Acme Testing Ltd',
            status: 'ACTIVE',
          },
        },
        tx,
      );
    });

    expect(eventRecord).toBeDefined();
    expect(eventRecord.sequenceNumber).toBeGreaterThan(0);
    expect(eventRecord.currentEventHash).toHaveLength(64);
    expect(eventRecord.action).toBe('CUSTOMER_REGISTERED');

    // Verify row persisted
    const res = await db.query<{ audit_event_id: string }>(
      `SELECT audit_event_id FROM audit_events WHERE audit_event_id = $1;`,
      [eventRecord.auditEventId],
    );
    expect(res.rows).toHaveLength(1);
  });

  it('rolls back audit event writes if the enclosing database transaction fails', async () => {
    const entityId = generateUuidV7();

    // Attempt a transaction that writes an audit event then throws
    await expect(
      db.transaction(async (tx) => {
        await auditService.appendEvent(
          {
            laboratoryId: DEFAULT_LAB_ID,
            actorUserId: TEST_ACTOR_ID,
            action: 'CUSTOMER_REGISTERED',
            entityType: 'Customer',
            entityId,
            correlationId: 'test-corr-fail-rollback',
            diffPayload: { clientCode: 'CUST-ROLLBACK' },
          },
          tx,
        );

        throw new Error('Simulated domain failure after audit append');
      }),
    ).rejects.toThrow('Simulated domain failure after audit append');

    // Confirm that the audit event was rolled back completely
    const res = await db.query(
      `SELECT audit_event_id FROM audit_events WHERE correlation_id = 'test-corr-fail-rollback';`,
    );
    expect(res.rows).toHaveLength(0);
  });

  it('enforces database-level immutability: triggers reject UPDATE and DELETE operations', async () => {
    // 1. Append a valid event
    const event = await db.transaction(async (tx) => {
      return auditService.appendEvent(
        {
          laboratoryId: DEFAULT_LAB_ID,
          actorUserId: TEST_ACTOR_ID,
          action: 'TEST_EVENT',
          entityType: 'TestEntity',
          entityId: generateUuidV7(),
          correlationId: 'test-immutability-check',
          diffPayload: { sample: 'val' },
        },
        tx,
      );
    });

    // 2. Attempt direct SQL UPDATE on the audit event
    await expect(
      db.query(
        `UPDATE audit_events SET action = 'TAMPERED' WHERE audit_event_id = $1;`,
        [event.auditEventId],
      ),
    ).rejects.toThrow(/Audit Invariant Violation.*prohibited/i);

    // 3. Attempt direct SQL DELETE on the audit event
    await expect(
      db.query(`DELETE FROM audit_events WHERE audit_event_id = $1;`, [
        event.auditEventId,
      ]),
    ).rejects.toThrow(/Audit Invariant Violation.*prohibited/i);
  });

  it('verifies unbroken cryptographic chain continuity via AuditVerifierService', async () => {
    const result = await verifierService.verifyChain(DEFAULT_LAB_ID);
    expect(result.isContinuous).toBe(true);
    expect(result.totalEventsChecked).toBeGreaterThanOrEqual(2);
    expect(result.latestHash).toHaveLength(64);
  });

  it('safely handles concurrent audit appends without breaking the hash chain', async () => {
    const concurrency = 5;
    const promises = Array.from({ length: concurrency }).map((_, index) =>
      db.transaction(async (tx) => {
        return auditService.appendEvent(
          {
            laboratoryId: DEFAULT_LAB_ID,
            actorUserId: TEST_ACTOR_ID,
            action: 'CONCURRENT_TEST',
            entityType: 'Sample',
            entityId: generateUuidV7(),
            correlationId: `corr-concurrent-${index}`,
            diffPayload: { worker: index },
          },
          tx,
        );
      }),
    );

    const results = await Promise.all(promises);
    expect(results).toHaveLength(concurrency);

    // Verify all sequence numbers are distinct and sequential
    const seqs = results.map((r) => r.sequenceNumber).sort((a, b) => a - b);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]!).toBe(seqs[i - 1]! + 1);
    }

    // Verify unbroken chain across all events
    const verification = await verifierService.verifyChain(DEFAULT_LAB_ID);
    expect(verification.isContinuous).toBe(true);
  });
});
