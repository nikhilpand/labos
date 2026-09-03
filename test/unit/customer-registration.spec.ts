import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterCustomerSchema } from '../../src/modules/customer/dto/register-customer.dto';
import { CustomerService } from '../../src/modules/customer/customer.service';
import { CustomerRepository } from '../../src/modules/customer/customer.repository';
import { DatabaseService } from '../../src/core/database/database.service';
import { PoolClient } from 'pg';
import { AuditService } from '../../src/platform/audit/audit.service';
import { AuthenticatedPrincipal } from '../../src/platform/auth/auth.types';
import { ConflictProblem } from '../../src/core/errors/rfc7807.exception';

describe('Customer Registration — Unit & Schema Suite', () => {
  describe('RegisterCustomerSchema Validation', () => {
    it('accepts a fully compliant SPEC-001 registration payload', () => {
      const payload = {
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

      const result = RegisterCustomerSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clientCode).toBe('CUST-1042');
        expect(result.data.primaryContact.email).toBe('s.jenkins@acme-env.com');
      }
    });

    it('rejects an invalid email format in primary contact', () => {
      const payload = {
        clientCode: 'CUST-1042',
        companyName: 'Acme Environmental Services Ltd',
        primaryContact: {
          firstName: 'Sarah',
          lastName: 'Jenkins',
          email: 'invalid-email-string',
        },
      };

      const result = RegisterCustomerSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const emailError = result.error.errors.find(
          (e) => e.path.join('.') === 'primaryContact.email',
        );
        expect(emailError).toBeDefined();
        expect(emailError?.message).toContain('Invalid primary contact email format');
      }
    });

    it('rejects an empty or special-character client code', () => {
      const payloadEmpty = {
        clientCode: '  ',
        companyName: 'Acme Ltd',
        primaryContact: {
          firstName: 'Sarah',
          lastName: 'Jenkins',
          email: 'sarah@acme.com',
        },
      };

      const resultEmpty = RegisterCustomerSchema.safeParse(payloadEmpty);
      expect(resultEmpty.success).toBe(false);

      const payloadSpecial = {
        clientCode: 'CUST 100%!',
        companyName: 'Acme Ltd',
        primaryContact: {
          firstName: 'Sarah',
          lastName: 'Jenkins',
          email: 'sarah@acme.com',
        },
      };

      const resultSpecial = RegisterCustomerSchema.safeParse(payloadSpecial);
      expect(resultSpecial.success).toBe(false);
      if (!resultSpecial.success) {
        const codeError = resultSpecial.error.errors.find((e) => e.path.join('.') === 'clientCode');
        expect(codeError?.message).toContain('alphanumeric');
      }
    });

    it('rejects registration when primary contact is missing', () => {
      const payload = {
        clientCode: 'CUST-1042',
        companyName: 'Acme Ltd',
      };

      const result = RegisterCustomerSchema.safeParse(payload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const contactError = result.error.errors.find((e) => e.path.join('.') === 'primaryContact');
        expect(contactError).toBeDefined();
      }
    });
  });

  describe('CustomerService Invariant & Transaction Rollback Logic', () => {
    let mockDb: DatabaseService;
    let mockAuditService: AuditService;
    let mockCustomerRepo: CustomerRepository;
    let service: CustomerService;

    const mockPrincipal: AuthenticatedPrincipal = {
      userId: '01918000-0000-7000-8000-000000000099', // Internal LabOS User UUID
      laboratoryId: '01918000-0000-7000-8000-000000000001',
      oidcSubject: 'auth0|external-actor-12345',
      email: 'registrar@apexlabs.com',
      fullName: 'Chief Accessioner',
      roles: ['ACCESSIONER'],
      permissions: ['customer:create'],
    };

    beforeEach(() => {
      mockDb = {
        transaction: vi.fn(),
      } as unknown as DatabaseService;

      mockAuditService = {
        appendEvent: vi.fn(),
      } as unknown as AuditService;

      mockCustomerRepo = {
        findCustomerByClientCode: vi.fn(),
        insertCustomer: vi.fn(),
        insertContact: vi.fn(),
        findCustomerById: vi.fn(),
        findPrimaryContact: vi.fn(),
      } as unknown as CustomerRepository;

      service = new CustomerService(mockDb, mockAuditService, mockCustomerRepo);
    });

    it('enforces identity mapping: resolves audit actor strictly from internal LabOS user_id', async () => {
      vi.mocked(mockCustomerRepo.findCustomerByClientCode).mockResolvedValue(null);

      vi.mocked(mockCustomerRepo.insertCustomer).mockImplementation(async (_tx, cust) => {
        return {
          ...cust,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });

      vi.mocked(mockCustomerRepo.insertContact).mockImplementation(async (_tx, contact) => {
        return {
          ...contact,
          phone: contact.phone ?? null,
          roleTitle: contact.roleTitle ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      });
      vi.mocked(mockAuditService.appendEvent).mockResolvedValue({
        auditEventId: '01918000-0000-7000-8000-000000000333',
        laboratoryId: mockPrincipal.laboratoryId,
        sequenceNumber: 1,
        actorUserId: mockPrincipal.userId,
        action: 'CUSTOMER_REGISTERED',
        entityType: 'Customer',
        entityId: 'placeholder-customer-id',
        correlationId: 'corr-1',
        reason: null,
        diffPayload: {},
        previousEventHash: '000000',
        currentEventHash: 'abcdef',
        createdAt: new Date(),
      });

      // Execute transaction callback directly
      vi.mocked(mockDb.transaction).mockImplementation(async (callback) => {
        const fakeTx = {} as unknown as PoolClient;
        return callback(fakeTx);
      });

      const res = await service.registerCustomer(
        {
          clientCode: 'CUST-TEST-1',
          companyName: 'Test Corp',
          primaryContact: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@testcorp.com',
          },
        },
        mockPrincipal,
        'corr-1',
      );

      // Verify that audit event was invoked with actorUserId equal to internal LabOS user_id (NOT oidcSubject)
      expect(mockAuditService.appendEvent).toHaveBeenCalledTimes(1);
      const auditCall = vi.mocked(mockAuditService.appendEvent).mock.calls[0]![0];

      expect(auditCall.actorUserId).toBe(mockPrincipal.userId);
      expect(auditCall.actorUserId).not.toBe(mockPrincipal.oidcSubject);
      expect(auditCall.action).toBe('CUSTOMER_REGISTERED');
      expect(auditCall.entityType).toBe('Customer');
      expect(auditCall.entityId).toBe(res.customerId);
      expect(auditCall.laboratoryId).toBe(mockPrincipal.laboratoryId);
    });

    it('rejects registration if client code already exists in active laboratory', async () => {
      vi.mocked(mockCustomerRepo.findCustomerByClientCode).mockResolvedValue({
        customerId: 'existing-id',
        laboratoryId: mockPrincipal.laboratoryId,
        clientCode: 'DUPLICATE-CODE',
        companyName: 'Existing Co',
        billingAddress: {},
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.registerCustomer(
          {
            clientCode: 'DUPLICATE-CODE',
            companyName: 'New Attempt Co',
            primaryContact: {
              firstName: 'Sarah',
              lastName: 'Connor',
              email: 'sarah@skynet.com',
            },
          },
          mockPrincipal,
        ),
      ).rejects.toThrow(ConflictProblem);

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('rolls back the transaction when AuditService fails (Service-Level Rollback Test)', async () => {
      vi.mocked(mockCustomerRepo.findCustomerByClientCode).mockResolvedValue(null);

      // Simulate audit failure inside the transaction
      vi.mocked(mockDb.transaction).mockImplementation(async (callback) => {
        const fakeTx = {} as unknown as PoolClient;
        // The callback runs and re-throws if an error occurs
        return callback(fakeTx);
      });

      vi.mocked(mockCustomerRepo.insertCustomer).mockResolvedValue({
        customerId: 'cust-id-1',
        laboratoryId: mockPrincipal.laboratoryId,
        clientCode: 'CUST-FAIL',
        companyName: 'Fail Corp',
        billingAddress: {},
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.mocked(mockCustomerRepo.insertContact).mockResolvedValue({
        contactId: 'contact-id-1',
        customerId: 'cust-id-1',
        firstName: 'Fail',
        lastName: 'User',
        email: 'fail@fail.com',
        phone: null,
        roleTitle: null,
        isPrimaryContact: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Audit service throws an unhandled error
      vi.mocked(mockAuditService.appendEvent).mockRejectedValue(
        new Error('Audit ledger engine connection lost'),
      );

      await expect(
        service.registerCustomer(
          {
            clientCode: 'CUST-FAIL',
            companyName: 'Fail Corp',
            primaryContact: {
              firstName: 'Fail',
              lastName: 'User',
              email: 'fail@fail.com',
            },
          },
          mockPrincipal,
        ),
      ).rejects.toThrow('Audit ledger engine connection lost');
    });
  });
});
