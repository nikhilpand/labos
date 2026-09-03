import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService } from '../../core/database/database.service';
import { AuditService } from '../../platform/audit/audit.service';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import { generateUuidV7 } from '../../core/common/uuid';
import { BadRequestProblem, NotFoundProblem } from '../../core/errors/rfc7807.exception';
import { handlePersistenceError } from '../../core/database/persistence-error.handler';
import { TestRequestRepository } from './test-request.repository';
import {
  CancelTestRequestInput,
  CreateTestRequestInput,
  TestRequestDetail,
  TestRequestListQuery,
} from './test-request.types';

@Injectable()
export class TestRequestService {
  private readonly logger = new Logger('TestRequestService');

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(TestRequestRepository) private readonly testRequestRepo: TestRequestRepository,
  ) {}

  /**
   * Creates a new Test Request and permanently binds requested analytical items
   * to immutable test method versions inside a single ACID transaction.
   */
  async createTestRequest(
    input: CreateTestRequestInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<TestRequestDetail & { auditEventId: string }> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const testRequestId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        // 1. Lock and validate customer eligibility
        const customer = await this.testRequestRepo.lockAndFetchCustomer(
          tx,
          input.customerId,
          laboratoryId,
        );

        if (!customer) {
          // Tenant isolation: a customer from another laboratory is indistinguishable from nonexistent
          throw new NotFoundProblem('Customer', input.customerId);
        }

        if (customer.status === 'HOLD') {
          throw new BadRequestProblem(
            `Customer account '${customer.clientCode}' is currently on HOLD and cannot place new test requests.`,
          );
        }

        if (customer.status === 'INACTIVE') {
          throw new BadRequestProblem(
            `Customer account '${customer.clientCode}' is INACTIVE and cannot place new test requests.`,
          );
        }

        // 2. Lock and validate method version eligibility
        const versions = await this.testRequestRepo.lockAndFetchMethodVersions(
          tx,
          input.methodVersionIds,
          laboratoryId,
        );

        if (versions.length !== input.methodVersionIds.length) {
          throw new BadRequestProblem(
            'One or more referenced test method versions do not exist or belong to another laboratory.',
          );
        }

        for (const v of versions) {
          if (v.status !== 'ACTIVE') {
            throw new BadRequestProblem(
              `Method version '${v.methodCode}' (${v.revisionLabel}) is in '${v.status}' status. Only ACTIVE method versions can be bound to new test requests.`,
            );
          }
        }

        // 3. Allocate sequential, gap-free request number for UTC calendar year
        const year = new Date().getUTCFullYear();
        const requestNumber = await this.testRequestRepo.allocateRequestNumber(
          tx,
          laboratoryId,
          year,
        );

        // 4. Insert Test Request header
        await this.testRequestRepo.insertTestRequest(tx, {
          testRequestId,
          laboratoryId,
          customerId: input.customerId,
          requestNumber,
          customerReference: input.customerReference?.trim() ?? null,
          specialInstructions: input.specialInstructions?.trim() ?? null,
          createdByUserId: actorUserId,
        });

        // 5. Insert Test Request items
        const itemsToInsert = input.methodVersionIds.map((mvId) => ({
          testRequestItemId: generateUuidV7(),
          testRequestId,
          methodVersionId: mvId,
        }));
        await this.testRequestRepo.insertTestRequestItems(tx, itemsToInsert);

        // 6. Append audit event within the active transaction
        const auditRecord = await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_REQUEST_CREATED',
            entityType: 'TestRequest',
            entityId: testRequestId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              testRequestId,
              laboratoryId,
              customerId: input.customerId,
              clientCode: customer.clientCode,
              requestNumber,
              customerReference: input.customerReference?.trim() ?? null,
              specialInstructions: input.specialInstructions?.trim() ?? null,
              status: 'SUBMITTED',
              items: versions.map((v) => ({
                methodVersionId: v.methodVersionId,
                methodCode: v.methodCode,
                versionNumber: v.versionNumber,
                revisionLabel: v.revisionLabel,
              })),
            },
          },
          tx,
        );

        // 7. Load full representation with item details
        const fullRequest = await this.testRequestRepo.findRequestById(
          tx,
          testRequestId,
          laboratoryId,
        );
        if (!fullRequest) {
          throw new Error('Failed to load newly created test request.');
        }

        return {
          ...fullRequest,
          auditEventId: auditRecord.auditEventId,
        };
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  /**
   * Retrieves a single test request with item details for the authenticated laboratory.
   */
  async getRequestById(
    requestId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<TestRequestDetail> {
    const request = await this.testRequestRepo.findRequestById(
      this.db,
      requestId,
      principal.laboratoryId,
    );

    if (!request) {
      throw new NotFoundProblem('TestRequest', requestId);
    }

    return request;
  }

  /**
   * Lists test requests with optional filtering and pagination.
   */
  async getRequests(
    query: TestRequestListQuery,
    principal: AuthenticatedPrincipal,
  ): Promise<{ requests: TestRequestDetail[]; total: number }> {
    return this.testRequestRepo.findRequests(this.db, principal.laboratoryId, query);
  }

  /**
   * Cancels a submitted test request with documented justification.
   */
  async cancelTestRequest(
    requestId: string,
    input: CancelTestRequestInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<TestRequestDetail & { auditEventId: string }> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const reason = input.reason.trim();

    try {
      return await this.db.transaction(async (tx) => {
        // 1. Lock request row for update
        const existing = await this.testRequestRepo.lockRequestForUpdate(
          tx,
          requestId,
          laboratoryId,
        );

        if (!existing) {
          throw new NotFoundProblem('TestRequest', requestId);
        }

        if (existing.status === 'CANCELLED') {
          throw new BadRequestProblem(
            `Test request '${existing.requestNumber}' is already in CANCELLED status.`,
          );
        }

        if (existing.status !== 'SUBMITTED') {
          throw new BadRequestProblem(`Cannot cancel test request in '${existing.status}' status.`);
        }

        // 2. Perform cancellation
        await this.testRequestRepo.cancelTestRequest(tx, requestId, laboratoryId, reason);

        // 3. Append audit event
        const auditRecord = await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_REQUEST_CANCELLED',
            entityType: 'TestRequest',
            entityId: requestId,
            correlationId: effectiveCorrelationId,
            reason,
            diffPayload: {
              testRequestId: requestId,
              requestNumber: existing.requestNumber,
              previousStatus: existing.status,
              newStatus: 'CANCELLED',
              cancellationReason: reason,
            },
          },
          tx,
        );

        // 4. Return updated representation
        const updated = await this.testRequestRepo.findRequestById(tx, requestId, laboratoryId);
        if (!updated) {
          throw new Error('Failed to load cancelled test request.');
        }

        return {
          ...updated,
          auditEventId: auditRecord.auditEventId,
        };
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }
}
