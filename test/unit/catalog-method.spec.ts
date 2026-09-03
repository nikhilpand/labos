import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateUnitSchema } from '@/modules/catalog/dto/create-unit.dto';
import { CreateSampleTypeSchema } from '@/modules/catalog/dto/create-sample-type.dto';
import { CreateParameterSchema } from '@/modules/catalog/dto/create-parameter.dto';
import { CreateMethodSchema } from '@/modules/catalog/dto/create-method.dto';
import { ConfigureMethodParametersSchema } from '@/modules/catalog/dto/configure-method-parameters.dto';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { DatabaseService } from '@/core/database/database.service';
import { AuditService } from '@/platform/audit/audit.service';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { AuthenticatedPrincipal } from '@/platform/auth/auth.types';
import { BadRequestProblem } from '@/core/errors/rfc7807.exception';

describe('Catalog & Versioned Method Unit Tests', () => {
  describe('Zod Validation: Units, Matrices & Analytes', () => {
    it('should validate valid Unit of Measurement DTO', () => {
      const valid = {
        symbol: 'mg/L',
        name: 'Milligrams per Liter',
        category: 'CONCENTRATION_MASS',
      };
      const parsed = CreateUnitSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject Unit with empty symbol or name', () => {
      expect(
        CreateUnitSchema.safeParse({ symbol: '', name: 'Test', category: 'MASS' }).success,
      ).toBe(false);
      expect(
        CreateUnitSchema.safeParse({ symbol: 'mg/L', name: '', category: 'MASS' }).success,
      ).toBe(false);
      expect(
        CreateUnitSchema.safeParse({ symbol: 'mg/L', name: 'Test', category: '' }).success,
      ).toBe(false);
    });

    it('should validate valid Sample Type DTO', () => {
      const valid = { code: 'DRINKING_WATER', name: 'Drinking / Potable Water' };
      const parsed = CreateSampleTypeSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject Sample Type with invalid code characters', () => {
      expect(CreateSampleTypeSchema.safeParse({ code: 'WATER 123', name: 'Water' }).success).toBe(
        false,
      );
      expect(CreateSampleTypeSchema.safeParse({ code: 'WATER@BAD', name: 'Water' }).success).toBe(
        false,
      );
    });

    it('should validate valid Parameter DTO with valid CAS number', () => {
      const valid = {
        code: 'LEAD_TOTAL',
        name: 'Lead, Total Recoverable',
        chemicalFormula: 'Pb',
        casNumber: '7439-92-1',
      };
      const parsed = CreateParameterSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('should reject invalid CAS registry numbers', () => {
      const invalidCases = [
        'invalid-cas',
        '123-45',
        '7439-92-12',
        '1-2-3',
        'CAS-7439-92-1',
        '7439 92 1',
      ];
      for (const cas of invalidCases) {
        const parsed = CreateParameterSchema.safeParse({
          code: 'PARAM_TEST',
          name: 'Test Param',
          casNumber: cas,
        });
        expect(parsed.success).toBe(false);
      }
    });

    it('should validate valid Method code and reject invalid characters', () => {
      expect(CreateMethodSchema.safeParse({ code: 'EPA_200.8', name: 'ICP-MS' }).success).toBe(
        true,
      );
      expect(CreateMethodSchema.safeParse({ code: 'SM_4500-NO3_F', name: 'Nitrate' }).success).toBe(
        true,
      );
      expect(CreateMethodSchema.safeParse({ code: 'ISO-17025', name: 'General' }).success).toBe(
        true,
      );

      // Invalid characters: spaces, @, #, $, /, quotes
      expect(CreateMethodSchema.safeParse({ code: 'EPA 200.8', name: 'ICP-MS' }).success).toBe(
        false,
      );
      expect(CreateMethodSchema.safeParse({ code: 'EPA@200.8', name: 'ICP-MS' }).success).toBe(
        false,
      );
      expect(CreateMethodSchema.safeParse({ code: 'EPA/200.8', name: 'ICP-MS' }).success).toBe(
        false,
      );
      expect(CreateMethodSchema.safeParse({ code: '', name: 'Empty' }).success).toBe(false);
    });
  });

  describe('Zod Validation: Method Parameters & Exact Decimals', () => {
    const validUuid1 = '018f0000-0000-7000-8000-000000000001';
    const validUuid2 = '018f0000-0000-7000-8000-000000000002';
    const validUnitId = '018f0000-0000-7000-8000-000000000010';

    it('should validate valid parameter configuration with exact decimal strings', () => {
      const input = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.00050000',
            reportingLimit: '0.00200000',
            decimalPrecision: 4,
            isMandatory: true,
          },
        ],
      };
      const parsed = ConfigureMethodParametersSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it('should reject when reporting limit is less than detection limit', () => {
      const input = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.0500',
            reportingLimit: '0.0100', // RL < DL
          },
        ],
      };
      const parsed = ConfigureMethodParametersSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(
          'Reporting limit must be greater than or equal to detection limit',
        );
      }
    });

    it('should allow reporting limit equal to detection limit', () => {
      const input = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.005',
            reportingLimit: '0.005', // RL == DL is valid
          },
        ],
      };
      const parsed = ConfigureMethodParametersSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it('should reject zero or negative detection and reporting limits', () => {
      const zeroDl = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.0000',
            reportingLimit: '0.005',
          },
        ],
      };
      expect(ConfigureMethodParametersSchema.safeParse(zeroDl).success).toBe(false);

      const negativeDl = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '-0.005',
            reportingLimit: '0.010',
          },
        ],
      };
      expect(ConfigureMethodParametersSchema.safeParse(negativeDl).success).toBe(false);

      const negativeRl = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.001',
            reportingLimit: '-0.001',
          },
        ],
      };
      expect(ConfigureMethodParametersSchema.safeParse(negativeRl).success).toBe(false);
    });

    it('should reject duplicate parameter IDs in configuration array', () => {
      const input = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
          {
            parameterId: validUuid1, // Duplicate ID
            unitId: validUnitId,
            detectionLimit: '0.002',
            reportingLimit: '0.010',
          },
        ],
      };
      const parsed = ConfigureMethodParametersSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain(
          'Duplicate parameter IDs are not permitted',
        );
      }
    });

    it('should accept distinct parameter IDs in configuration array', () => {
      const input = {
        parameters: [
          {
            parameterId: validUuid1,
            unitId: validUnitId,
            detectionLimit: '0.001',
            reportingLimit: '0.005',
          },
          {
            parameterId: validUuid2,
            unitId: validUnitId,
            detectionLimit: '0.002',
            reportingLimit: '0.010',
          },
        ],
      };
      const parsed = ConfigureMethodParametersSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });
  });

  describe('CatalogService: State Machine & Four-Eyes Approval Guards', () => {
    interface MockCatalogRepo {
      findMethodById: ReturnType<typeof vi.fn>;
      findMethodVersionById: ReturnType<typeof vi.fn>;
      lockMethodVersionForUpdate: ReturnType<typeof vi.fn>;
      findParametersByVersionId: ReturnType<typeof vi.fn>;
      findActiveVersionForMethod: ReturnType<typeof vi.fn>;
      updateMethodVersionStatus: ReturnType<typeof vi.fn>;
      [key: string]: ReturnType<typeof vi.fn>;
    }

    let service: CatalogService;
    let mockDb: { transaction: ReturnType<typeof vi.fn>; query: ReturnType<typeof vi.fn> };
    let mockAuditService: { appendEvent: ReturnType<typeof vi.fn> };
    let mockRepo: MockCatalogRepo;

    const mockPrincipal: AuthenticatedPrincipal = {
      userId: '01918000-0000-7000-8000-000000000021', // Author
      laboratoryId: '01918000-0000-7000-8000-000000000001',
      email: 'chemist@lab.com',
      fullName: 'Chemist Alice',
      roles: ['QA_MANAGER'],
      permissions: ['catalog:read', 'catalog:manage', 'method:approve', 'method:retire'],
      oidcSubject: 'auth0|chemist-1',
    };

    const approverPrincipal: AuthenticatedPrincipal = {
      userId: '01918000-0000-7000-8000-000000000022', // Director (Distinct Approver)
      laboratoryId: '01918000-0000-7000-8000-000000000001',
      email: 'director@lab.com',
      fullName: 'Dr. Bob Director',
      roles: ['DIRECTOR'],
      permissions: ['catalog:read', 'catalog:manage', 'method:approve', 'method:retire'],
      oidcSubject: 'auth0|director-1',
    };

    beforeEach(() => {
      mockDb = {
        transaction: vi.fn(async (cb) => cb({})),
        query: vi.fn(),
      };
      mockAuditService = {
        appendEvent: vi.fn(async () => ({ auditEventId: 'audit-1' })),
      };
      mockRepo = {
        insertUnit: vi.fn(),
        findUnits: vi.fn(),
        findUnitById: vi.fn(),
        findUnitBySymbol: vi.fn(),
        insertSampleType: vi.fn(),
        findSampleTypes: vi.fn(),
        findSampleTypeById: vi.fn(),
        findSampleTypesByIds: vi.fn(),
        insertParameter: vi.fn(),
        findParameters: vi.fn(),
        findParameterById: vi.fn(),
        findParametersByIds: vi.fn(),
        insertMethod: vi.fn(),
        findMethods: vi.fn(),
        findMethodById: vi.fn(),
        findMethodByCode: vi.fn(),
        insertMethodVersion: vi.fn(),
        findMethodVersionsByMethodId: vi.fn(),
        findMethodVersionById: vi.fn(),
        findMethodVersionByIdAndLab: vi.fn(),
        findActiveVersionForMethod: vi.fn(),
        lockMethodVersionForUpdate: vi.fn(),
        getNextVersionNumber: vi.fn(),
        updateMethodVersionStatus: vi.fn(),
        insertMethodVersionParameters: vi.fn(),
        deleteMethodVersionParameters: vi.fn(),
        findParametersByVersionId: vi.fn(),
        insertMethodVersionSampleTypes: vi.fn(),
        deleteMethodVersionSampleTypes: vi.fn(),
        findSampleTypeIdsByVersionId: vi.fn(),
      };

      service = new CatalogService(
        mockDb as unknown as DatabaseService,
        mockAuditService as unknown as AuditService,
        mockRepo as unknown as CatalogRepository,
      );
    });

    it('should reject configuring parameters on non-DRAFT method versions', async () => {
      mockRepo.findMethodById.mockResolvedValue({
        testMethodId: 'm-1',
        laboratoryId: mockPrincipal.laboratoryId,
        code: 'EPA_200_8',
        name: 'ICP-MS',
      });
      mockRepo.findMethodVersionById.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        status: 'ACTIVE', // Already ACTIVE
      });

      await expect(
        service.configureMethodParameters('m-1', 'v-1', { parameters: [] }, mockPrincipal),
      ).rejects.toThrow(BadRequestProblem);
    });

    it('should enforce Four-Eyes Separation of Duties: author cannot approve own version', async () => {
      mockRepo.lockMethodVersionForUpdate.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        versionNumber: 1,
        status: 'DRAFT',
        createdByUserId: mockPrincipal.userId, // Same user attempting activation!
      });
      mockRepo.findMethodById.mockResolvedValue({
        testMethodId: 'm-1',
        laboratoryId: mockPrincipal.laboratoryId,
      });

      await expect(service.activateMethodVersion('m-1', 'v-1', mockPrincipal)).rejects.toThrow(
        BadRequestProblem,
      );

      await expect(
        service.activateMethodVersion('m-1', 'v-1', mockPrincipal),
      ).rejects.toMatchObject({
        detail: expect.stringContaining('Four-eyes policy violation'),
      });
    });

    it('should reject activation of a DRAFT method version with zero parameters', async () => {
      mockRepo.lockMethodVersionForUpdate.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        versionNumber: 1,
        status: 'DRAFT',
        createdByUserId: mockPrincipal.userId, // Created by Alice
      });
      mockRepo.findMethodById.mockResolvedValue({
        testMethodId: 'm-1',
        laboratoryId: approverPrincipal.laboratoryId,
      });
      mockRepo.findParametersByVersionId.mockResolvedValue([]); // Zero parameters!

      // Approver is Bob (distinct user), but 0 parameters
      await expect(service.activateMethodVersion('m-1', 'v-1', approverPrincipal)).rejects.toThrow(
        BadRequestProblem,
      );

      await expect(
        service.activateMethodVersion('m-1', 'v-1', approverPrincipal),
      ).rejects.toMatchObject({
        detail: expect.stringContaining('zero configured parameters'),
      });
    });

    it('should successfully activate when approver is distinct and >=1 parameter exists', async () => {
      const now = new Date();
      mockRepo.lockMethodVersionForUpdate.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        versionNumber: 1,
        revisionLabel: 'Rev 1.0',
        status: 'DRAFT',
        createdByUserId: mockPrincipal.userId, // Alice
      });
      mockRepo.findMethodById.mockResolvedValue({
        testMethodId: 'm-1',
        laboratoryId: approverPrincipal.laboratoryId,
        code: 'EPA_200_8',
      });
      mockRepo.findParametersByVersionId.mockResolvedValue([
        { parameterId: 'p-1', detectionLimit: '0.001', reportingLimit: '0.005' },
      ]);
      mockRepo.findActiveVersionForMethod.mockResolvedValue(null); // No prior active version
      mockRepo.updateMethodVersionStatus.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        versionNumber: 1,
        revisionLabel: 'Rev 1.0',
        status: 'ACTIVE',
        effectiveFrom: now,
        approvedByUserId: approverPrincipal.userId, // Bob
      });

      const result = await service.activateMethodVersion('m-1', 'v-1', approverPrincipal);

      expect(result.status).toBe('ACTIVE');
      expect(result.approvedByUserId).toBe(approverPrincipal.userId);
      expect(mockAuditService.appendEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TEST_METHOD_VERSION_ACTIVATED',
          actorUserId: approverPrincipal.userId,
        }),
        expect.anything(),
      );
    });

    it('should reject retiring a DRAFT method version', async () => {
      mockRepo.findMethodById.mockResolvedValue({
        testMethodId: 'm-1',
        laboratoryId: mockPrincipal.laboratoryId,
      });
      mockRepo.lockMethodVersionForUpdate.mockResolvedValue({
        methodVersionId: 'v-1',
        testMethodId: 'm-1',
        status: 'DRAFT', // DRAFT cannot be retired
      });

      await expect(service.retireMethodVersion('m-1', 'v-1', mockPrincipal)).rejects.toThrow(
        BadRequestProblem,
      );

      await expect(service.retireMethodVersion('m-1', 'v-1', mockPrincipal)).rejects.toMatchObject({
        detail: expect.stringContaining('Only ACTIVE or SUPERSEDED method versions can be retired'),
      });
    });
  });
});
