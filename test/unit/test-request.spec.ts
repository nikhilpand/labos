import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateTestRequestSchema } from '../../src/modules/test-request/dto/create-test-request.dto';
import { CancelTestRequestSchema } from '../../src/modules/test-request/dto/cancel-test-request.dto';
import { TestRequestService } from '../../src/modules/test-request/test-request.service';
import { AuthenticatedPrincipal } from '../../src/platform/auth/auth.types';
import { BadRequestProblem, NotFoundProblem } from '../../src/core/errors/rfc7807.exception';
import { DatabaseService } from '../../src/core/database/database.service';
import { AuditService } from '../../src/platform/audit/audit.service';
import { TestRequestRepository } from '../../src/modules/test-request/test-request.repository';

describe('SPEC-003: Test Request Creation & Method Binding Unit Tests', () => {
  const labId = '01918000-0000-7000-8000-000000000001';
  const customerId = '01918000-0000-7000-8000-000000000010';
  const validVersion1 = '01918000-0000-7000-8000-000000000101';
  const validVersion2 = '01918000-0000-7000-8000-000000000102';

  const mockPrincipal: AuthenticatedPrincipal = {
    userId: '01918000-0000-7000-8000-000000000020',
    laboratoryId: labId,
    email: 'accessioner@lab.com',
    fullName: 'Jane Accessioner',
    roles: ['ACCESSIONER'],
    permissions: ['test_request:create', 'test_request:read', 'test_request:cancel'],
    oidcSubject: 'auth0|jane-accessioner',
  };

  // ============================================================================
  // 1. DTO SCHEMA VALIDATION
  // ============================================================================
  describe('Zod DTO Validation', () => {
    it('should validate a complete, well-formed test request payload', () => {
      const validPayload = {
        customerId,
        customerReference: 'PO-2026-001',
        specialInstructions: 'Refrigerate upon delivery.',
        methodVersionIds: [validVersion1, validVersion2],
      };

      const parsed = CreateTestRequestSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it('should reject non-UUID customerId', () => {
      const invalid = {
        customerId: 'not-a-uuid',
        methodVersionIds: [validVersion1],
      };

      const result = CreateTestRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain('customerId must be a valid UUID');
      }
    });

    it('should reject empty methodVersionIds array', () => {
      const invalid = {
        customerId,
        methodVersionIds: [],
      };

      const result = CreateTestRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          'At least one methodVersionId must be specified',
        );
      }
    });

    it('should reject duplicate methodVersionIds in the same payload', () => {
      const duplicatePayload = {
        customerId,
        methodVersionIds: [validVersion1, validVersion1],
      };

      const result = CreateTestRequestSchema.safeParse(duplicatePayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0]?.message).toContain(
          'Duplicate methodVersionIds are not permitted',
        );
      }
    });

    it('should validate cancellation payload with non-empty reason', () => {
      const valid = { reason: 'Client requested cancellation.' };
      const parsed = CancelTestRequestSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject cancellation payload with whitespace-only reason', () => {
      const invalid = { reason: '   ' };
      const result = CancelTestRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  // ============================================================================
  // 2. SERVICE LAYER: CUSTOMER & METHOD ELIGIBILITY GUARDS
  // ============================================================================
  describe('TestRequestService Eligibility Guards', () => {
    interface MockTestRequestRepo {
      lockAndFetchCustomer: ReturnType<typeof vi.fn>;
      lockAndFetchMethodVersions: ReturnType<typeof vi.fn>;
      allocateRequestNumber: ReturnType<typeof vi.fn>;
      insertTestRequest: ReturnType<typeof vi.fn>;
      insertTestRequestItems: ReturnType<typeof vi.fn>;
      findRequestById: ReturnType<typeof vi.fn>;
      lockRequestForUpdate: ReturnType<typeof vi.fn>;
      cancelTestRequest: ReturnType<typeof vi.fn>;
      [key: string]: ReturnType<typeof vi.fn>;
    }

    let service: TestRequestService;
    let mockDb: { transaction: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
    let mockAuditService: { appendEvent: ReturnType<typeof vi.fn> };
    let mockRepo: MockTestRequestRepo;

    beforeEach(() => {
      mockDb = {
        transaction: vi.fn(async (cb) => cb({})),
        query: vi.fn(),
      };
      mockAuditService = {
        appendEvent: vi.fn(async () => ({ auditEventId: 'audit-event-1' })),
      };
      mockRepo = {
        lockAndFetchCustomer: vi.fn(),
        lockAndFetchMethodVersions: vi.fn(),
        allocateRequestNumber: vi.fn(async () => 'TR-2026-000001'),
        insertTestRequest: vi.fn(),
        insertTestRequestItems: vi.fn(),
        findRequestById: vi.fn(),
        lockRequestForUpdate: vi.fn(),
        cancelTestRequest: vi.fn(),
      };

      service = new TestRequestService(
        mockDb as unknown as DatabaseService,
        mockAuditService as unknown as AuditService,
        mockRepo as unknown as TestRequestRepository,
      );
    });

    it('should throw NotFoundProblem if customer does not exist in caller laboratory', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue(null);

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toThrow(NotFoundProblem);
    });

    it('should reject test request creation if customer is on HOLD', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue({
        customerId,
        laboratoryId: labId,
        clientCode: 'ACME-01',
        companyName: 'Acme Corp',
        status: 'HOLD',
      });

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toThrow(BadRequestProblem);

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toMatchObject({
        detail: expect.stringContaining('currently on HOLD'),
      });
    });

    it('should reject test request creation if customer is INACTIVE', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue({
        customerId,
        laboratoryId: labId,
        clientCode: 'ACME-01',
        companyName: 'Acme Corp',
        status: 'INACTIVE',
      });

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toThrow(BadRequestProblem);

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toMatchObject({
        detail: expect.stringContaining('is INACTIVE'),
      });
    });

    it('should reject creation if any method version does not belong to laboratory', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue({
        customerId,
        laboratoryId: labId,
        clientCode: 'ACME-01',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
      });
      // Repo returns only 1 version when 2 were requested
      mockRepo.lockAndFetchMethodVersions.mockResolvedValue([
        {
          methodVersionId: validVersion1,
          testMethodId: 'm-1',
          versionNumber: 1,
          revisionLabel: 'Rev 1.0',
          status: 'ACTIVE',
          methodCode: 'EPA-200.8',
          methodName: 'Trace Metals',
          laboratoryId: labId,
        },
      ]);

      await expect(
        service.createTestRequest(
          { customerId, methodVersionIds: [validVersion1, validVersion2] },
          mockPrincipal,
        ),
      ).rejects.toThrow(BadRequestProblem);
    });

    it('should reject creation if any referenced method version is DRAFT, SUPERSEDED, or RETIRED', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue({
        customerId,
        laboratoryId: labId,
        clientCode: 'ACME-01',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
      });
      mockRepo.lockAndFetchMethodVersions.mockResolvedValue([
        {
          methodVersionId: validVersion1,
          testMethodId: 'm-1',
          versionNumber: 1,
          revisionLabel: 'Rev 1.0',
          status: 'SUPERSEDED', // Ineligible
          methodCode: 'EPA-200.8',
          methodName: 'Trace Metals',
          laboratoryId: labId,
        },
      ]);

      await expect(
        service.createTestRequest({ customerId, methodVersionIds: [validVersion1] }, mockPrincipal),
      ).rejects.toMatchObject({
        detail: expect.stringContaining('Only ACTIVE method versions can be bound'),
      });
    });

    it('should use internal LabOS userId as audit actorUserId (not oidcSubject)', async () => {
      mockRepo.lockAndFetchCustomer.mockResolvedValue({
        customerId,
        laboratoryId: labId,
        clientCode: 'ACME-01',
        companyName: 'Acme Corp',
        status: 'ACTIVE',
      });
      mockRepo.lockAndFetchMethodVersions.mockResolvedValue([
        {
          methodVersionId: validVersion1,
          testMethodId: 'm-1',
          versionNumber: 1,
          revisionLabel: 'Rev 1.0',
          status: 'ACTIVE',
          methodCode: 'EPA-200.8',
          methodName: 'Trace Metals',
          laboratoryId: labId,
        },
      ]);
      mockRepo.findRequestById.mockResolvedValue({
        testRequestId: 'req-1',
        laboratoryId: labId,
        customerId,
        requestNumber: 'TR-2026-000001',
        status: 'SUBMITTED',
        items: [],
      });

      await service.createTestRequest(
        { customerId, methodVersionIds: [validVersion1] },
        mockPrincipal,
      );

      expect(mockAuditService.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: mockPrincipal.userId, // Internal UUID
          action: 'TEST_REQUEST_CREATED',
          entityType: 'TestRequest',
        }),
        expect.anything(),
      );
      expect(mockAuditService.appendEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: mockPrincipal.oidcSubject,
        }),
        expect.anything(),
      );
    });

    it('should reject cancellation of an already CANCELLED request', async () => {
      mockRepo.lockRequestForUpdate.mockResolvedValue({
        testRequestId: 'req-1',
        laboratoryId: labId,
        requestNumber: 'TR-2026-000001',
        status: 'CANCELLED',
      });

      await expect(
        service.cancelTestRequest('req-1', { reason: 'Customer changed mind' }, mockPrincipal),
      ).rejects.toThrow(BadRequestProblem);
    });
  });
});
