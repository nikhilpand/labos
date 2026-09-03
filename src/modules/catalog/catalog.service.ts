import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import { AuditService } from '../../platform/audit/audit.service';
import { CatalogRepository } from './catalog.repository';
import { AuthenticatedPrincipal } from '../../platform/auth/auth.types';
import {
  UnitOfMeasurementEntity,
  SampleTypeEntity,
  TestParameterEntity,
  TestMethodEntity,
  TestMethodVersionEntity,
  MethodVersionDetail,
  TestMethodSummary,
  CreateUnitInput,
  CreateSampleTypeInput,
  CreateParameterInput,
  CreateMethodInput,
  CreateMethodVersionInput,
  ConfigureParametersInput,
} from './catalog.types';
import { generateUuidV7 } from '../../core/common/uuid';
import { BadRequestProblem, NotFoundProblem } from '../../core/errors/rfc7807.exception';
import { handlePersistenceError } from '../../core/database/persistence-error.handler';
import { toDecimal } from '../../core/common/decimal';

@Injectable()
export class CatalogService {
  private readonly logger = new Logger('CatalogService');

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly auditService: AuditService,
    @Inject(CatalogRepository) private readonly catalogRepo: CatalogRepository,
  ) {}

  // ============================================================================
  // UNITS OF MEASUREMENT
  // ============================================================================

  async createUnit(
    input: CreateUnitInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<UnitOfMeasurementEntity> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const unitId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const unit = await this.catalogRepo.insertUnit(tx, {
          unitId,
          laboratoryId,
          symbol: input.symbol.trim(),
          name: input.name.trim(),
          category: input.category.trim(),
          isActive: true,
        });

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'UNIT_CREATED',
            entityType: 'UnitOfMeasurement',
            entityId: unitId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              symbol: unit.symbol,
              name: unit.name,
              category: unit.category,
            },
          },
          tx,
        );

        return unit;
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async getUnits(principal: AuthenticatedPrincipal): Promise<UnitOfMeasurementEntity[]> {
    return this.catalogRepo.findUnits(this.db, principal.laboratoryId);
  }

  // ============================================================================
  // SAMPLE TYPES (MATRICES)
  // ============================================================================

  async createSampleType(
    input: CreateSampleTypeInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<SampleTypeEntity> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const sampleTypeId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const sampleType = await this.catalogRepo.insertSampleType(tx, {
          sampleTypeId,
          laboratoryId,
          code: input.code.trim(),
          name: input.name.trim(),
          description: input.description?.trim() ?? null,
          status: 'ACTIVE',
        });

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'SAMPLE_TYPE_CREATED',
            entityType: 'SampleType',
            entityId: sampleTypeId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              code: sampleType.code,
              name: sampleType.name,
              description: sampleType.description,
            },
          },
          tx,
        );

        return sampleType;
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async getSampleTypes(principal: AuthenticatedPrincipal): Promise<SampleTypeEntity[]> {
    return this.catalogRepo.findSampleTypes(this.db, principal.laboratoryId);
  }

  // ============================================================================
  // TEST PARAMETERS (ANALYTES)
  // ============================================================================

  async createParameter(
    input: CreateParameterInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<TestParameterEntity> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const parameterId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const parameter = await this.catalogRepo.insertParameter(tx, {
          parameterId,
          laboratoryId,
          code: input.code.trim(),
          name: input.name.trim(),
          chemicalFormula: input.chemicalFormula?.trim() ?? null,
          casNumber: input.casNumber?.trim() ?? null,
          description: input.description?.trim() ?? null,
          status: 'ACTIVE',
        });

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'PARAMETER_CREATED',
            entityType: 'TestParameter',
            entityId: parameterId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              code: parameter.code,
              name: parameter.name,
              chemicalFormula: parameter.chemicalFormula,
              casNumber: parameter.casNumber,
            },
          },
          tx,
        );

        return parameter;
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async getParameters(principal: AuthenticatedPrincipal): Promise<TestParameterEntity[]> {
    return this.catalogRepo.findParameters(this.db, principal.laboratoryId);
  }

  // ============================================================================
  // TEST METHODS
  // ============================================================================

  async createMethod(
    input: CreateMethodInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<{ method: TestMethodEntity; version: MethodVersionDetail }> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const testMethodId = generateUuidV7();
    const methodVersionId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        // 1. Insert parent method header
        const method = await this.catalogRepo.insertMethod(tx, {
          testMethodId,
          laboratoryId,
          code: input.code.trim(),
          name: input.name.trim(),
          regulatoryAgency: input.regulatoryAgency?.trim() ?? null,
          description: input.description?.trim() ?? null,
        });

        // 2. Insert initial draft version (v1)
        const version = await this.catalogRepo.insertMethodVersion(tx, {
          methodVersionId,
          testMethodId,
          versionNumber: 1,
          revisionLabel: input.revisionLabel?.trim() || 'Rev 1.0',
          status: 'DRAFT',
          accreditationStatus: input.accreditationStatus ?? 'ACCREDITED',
          sopReference: input.sopReference?.trim() ?? null,
          effectiveFrom: null,
          effectiveTo: null,
          createdByUserId: actorUserId,
          approvedByUserId: null,
        });

        // 3. Handle sample types if provided
        if (input.sampleTypeIds && input.sampleTypeIds.length > 0) {
          const sampleTypes = await this.catalogRepo.findSampleTypesByIds(
            tx,
            input.sampleTypeIds,
            laboratoryId,
          );
          if (sampleTypes.length !== input.sampleTypeIds.length) {
            throw new BadRequestProblem(
              'One or more referenced sample types do not exist or belong to another laboratory.',
            );
          }
          await this.catalogRepo.insertMethodVersionSampleTypes(
            tx,
            methodVersionId,
            input.sampleTypeIds,
          );
        }

        // 4. Handle initial parameters if provided
        if (input.parameters && input.parameters.length > 0) {
          await this.validateAndPersistParameters(
            tx,
            methodVersionId,
            laboratoryId,
            input.parameters,
          );
        }

        // 5. Append audit event
        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_METHOD_CREATED',
            entityType: 'TestMethod',
            entityId: testMethodId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              code: method.code,
              name: method.name,
              initialVersionId: methodVersionId,
              revisionLabel: version.revisionLabel,
            },
          },
          tx,
        );

        const versionDetail = await this.loadVersionDetail(tx, methodVersionId, version);

        return { method, version: versionDetail };
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async getMethods(principal: AuthenticatedPrincipal): Promise<TestMethodSummary[]> {
    const list = await this.catalogRepo.findMethods(this.db, principal.laboratoryId);
    return list.map(({ method, activeVersion }) => ({
      ...method,
      activeVersion,
    }));
  }

  async getMethodById(
    testMethodId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<{ method: TestMethodEntity; versions: TestMethodVersionEntity[] }> {
    const method = await this.catalogRepo.findMethodById(
      this.db,
      testMethodId,
      principal.laboratoryId,
    );
    if (!method) {
      throw new NotFoundProblem('TestMethod', testMethodId);
    }

    const versions = await this.catalogRepo.findMethodVersionsByMethodId(this.db, testMethodId);
    return { method, versions };
  }

  async getMethodVersionDetail(
    testMethodId: string,
    versionId: string,
    principal: AuthenticatedPrincipal,
  ): Promise<MethodVersionDetail> {
    const method = await this.catalogRepo.findMethodById(
      this.db,
      testMethodId,
      principal.laboratoryId,
    );
    if (!method) {
      throw new NotFoundProblem('TestMethod', testMethodId);
    }

    const version = await this.catalogRepo.findMethodVersionById(this.db, versionId);
    if (!version || version.testMethodId !== testMethodId) {
      throw new NotFoundProblem('TestMethodVersion', versionId);
    }

    return this.loadVersionDetail(this.db, versionId, version);
  }

  async draftNewMethodVersion(
    testMethodId: string,
    input: CreateMethodVersionInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<MethodVersionDetail> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();
    const methodVersionId = generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const method = await this.catalogRepo.findMethodById(tx, testMethodId, laboratoryId);
        if (!method) {
          throw new NotFoundProblem('TestMethod', testMethodId);
        }

        const nextVersionNumber = await this.catalogRepo.getNextVersionNumber(tx, testMethodId);

        const version = await this.catalogRepo.insertMethodVersion(tx, {
          methodVersionId,
          testMethodId,
          versionNumber: nextVersionNumber,
          revisionLabel: input.revisionLabel.trim(),
          status: 'DRAFT',
          accreditationStatus: input.accreditationStatus ?? 'ACCREDITED',
          sopReference: input.sopReference?.trim() ?? null,
          effectiveFrom: null,
          effectiveTo: null,
          createdByUserId: actorUserId,
          approvedByUserId: null,
        });

        if (input.sampleTypeIds && input.sampleTypeIds.length > 0) {
          const sampleTypes = await this.catalogRepo.findSampleTypesByIds(
            tx,
            input.sampleTypeIds,
            laboratoryId,
          );
          if (sampleTypes.length !== input.sampleTypeIds.length) {
            throw new BadRequestProblem(
              'One or more referenced sample types do not exist or belong to another laboratory.',
            );
          }
          await this.catalogRepo.insertMethodVersionSampleTypes(
            tx,
            methodVersionId,
            input.sampleTypeIds,
          );
        }

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_METHOD_VERSION_DRAFTED',
            entityType: 'TestMethodVersion',
            entityId: methodVersionId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              testMethodId,
              versionNumber: nextVersionNumber,
              revisionLabel: version.revisionLabel,
            },
          },
          tx,
        );

        return this.loadVersionDetail(tx, methodVersionId, version);
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async configureMethodParameters(
    testMethodId: string,
    versionId: string,
    input: ConfigureParametersInput,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<MethodVersionDetail> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const method = await this.catalogRepo.findMethodById(tx, testMethodId, laboratoryId);
        if (!method) {
          throw new NotFoundProblem('TestMethod', testMethodId);
        }

        const version = await this.catalogRepo.findMethodVersionById(tx, versionId);
        if (!version || version.testMethodId !== testMethodId) {
          throw new NotFoundProblem('TestMethodVersion', versionId);
        }

        if (version.status !== 'DRAFT') {
          throw new BadRequestProblem(
            `Cannot modify parameters of a finalized method version (status: ${version.status}). Parameters can only be configured when status is DRAFT.`,
          );
        }

        // Validate and atomically replace parameters
        await this.catalogRepo.deleteMethodVersionParameters(tx, versionId);
        await this.validateAndPersistParameters(tx, versionId, laboratoryId, input.parameters);

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_METHOD_VERSION_CONFIGURED',
            entityType: 'TestMethodVersion',
            entityId: versionId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              testMethodId,
              parametersCount: input.parameters.length,
            },
          },
          tx,
        );

        return this.loadVersionDetail(tx, versionId, version);
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async activateMethodVersion(
    testMethodId: string,
    versionId: string,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<TestMethodVersionEntity> {
    const laboratoryId = principal.laboratoryId;
    const approverUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        // Step 1: Lock target version
        const version = await this.catalogRepo.lockMethodVersionForUpdate(tx, versionId);
        if (!version || version.testMethodId !== testMethodId) {
          throw new NotFoundProblem('TestMethodVersion', versionId);
        }

        // Step 2: Verify laboratory ownership
        const method = await this.catalogRepo.findMethodById(tx, testMethodId, laboratoryId);
        if (!method) {
          throw new NotFoundProblem('TestMethod', testMethodId);
        }

        // Step 3: Verify it is DRAFT
        if (version.status !== 'DRAFT') {
          throw new BadRequestProblem(
            `Only DRAFT method versions can be activated. Current status: ${version.status}.`,
          );
        }

        // Step 4: Verify four-eyes approval (Separation of duties)
        if (version.createdByUserId === approverUserId) {
          throw new BadRequestProblem(
            'Four-eyes policy violation: the author of a method version cannot approve or activate their own version.',
          );
        }

        // Step 5: Verify it has at least one configured parameter
        const configuredParams = await this.catalogRepo.findParametersByVersionId(tx, versionId);
        if (configuredParams.length === 0) {
          throw new BadRequestProblem(
            'Cannot activate a method version with zero configured parameters.',
          );
        }

        // Step 7: Lock and transition currently active version if one exists
        const currentActive = await this.catalogRepo.findActiveVersionForMethod(
          tx,
          testMethodId,
          true,
        );

        if (currentActive) {
          // Step 8: Supersede previous active version
          await this.catalogRepo.updateMethodVersionStatus(
            tx,
            currentActive.methodVersionId,
            'SUPERSEDED',
            null,
            new Date(),
          );

          await this.auditService.appendEvent(
            {
              laboratoryId,
              actorUserId: approverUserId,
              action: 'TEST_METHOD_VERSION_SUPERSEDED',
              entityType: 'TestMethodVersion',
              entityId: currentActive.methodVersionId,
              correlationId: effectiveCorrelationId,
              diffPayload: {
                testMethodId,
                supersededVersionNumber: currentActive.versionNumber,
                replacedByVersionId: versionId,
              },
            },
            tx,
          );
        }

        // Step 9: Activate target version
        const now = new Date();
        const activatedVersion = await this.catalogRepo.updateMethodVersionStatus(
          tx,
          versionId,
          'ACTIVE',
          now,
          null,
          approverUserId,
        );

        // Step 10: Append activation audit event
        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId: approverUserId,
            action: 'TEST_METHOD_VERSION_ACTIVATED',
            entityType: 'TestMethodVersion',
            entityId: versionId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              testMethodId,
              versionNumber: activatedVersion.versionNumber,
              revisionLabel: activatedVersion.revisionLabel,
              approvedByUserId: approverUserId,
              effectiveFrom: now.toISOString(),
            },
          },
          tx,
        );

        this.logger.log(
          `[Method Version Activation] Method '${method.code}' version ${activatedVersion.versionNumber} activated by ${approverUserId} in lab ${laboratoryId}`,
        );

        return activatedVersion;
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  async retireMethodVersion(
    testMethodId: string,
    versionId: string,
    principal: AuthenticatedPrincipal,
    correlationId?: string,
  ): Promise<TestMethodVersionEntity> {
    const laboratoryId = principal.laboratoryId;
    const actorUserId = principal.userId;
    const effectiveCorrelationId = correlationId || generateUuidV7();

    try {
      return await this.db.transaction(async (tx) => {
        const method = await this.catalogRepo.findMethodById(tx, testMethodId, laboratoryId);
        if (!method) {
          throw new NotFoundProblem('TestMethod', testMethodId);
        }

        const version = await this.catalogRepo.lockMethodVersionForUpdate(tx, versionId);
        if (!version || version.testMethodId !== testMethodId) {
          throw new NotFoundProblem('TestMethodVersion', versionId);
        }

        if (version.status !== 'ACTIVE' && version.status !== 'SUPERSEDED') {
          throw new BadRequestProblem(
            `Only ACTIVE or SUPERSEDED method versions can be retired. Current status: ${version.status}.`,
          );
        }

        const retiredVersion = await this.catalogRepo.updateMethodVersionStatus(
          tx,
          versionId,
          'RETIRED',
          null,
          new Date(),
        );

        await this.auditService.appendEvent(
          {
            laboratoryId,
            actorUserId,
            action: 'TEST_METHOD_VERSION_RETIRED',
            entityType: 'TestMethodVersion',
            entityId: versionId,
            correlationId: effectiveCorrelationId,
            diffPayload: {
              testMethodId,
              versionNumber: retiredVersion.versionNumber,
            },
          },
          tx,
        );

        return retiredVersion;
      });
    } catch (error) {
      handlePersistenceError(error, { correlationId: effectiveCorrelationId });
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async validateAndPersistParameters(
    tx: TransactionalContext,
    methodVersionId: string,
    laboratoryId: string,
    params: {
      parameterId: string;
      unitId: string;
      detectionLimit: string;
      reportingLimit: string;
      decimalPrecision?: number;
      isMandatory?: boolean;
    }[],
  ): Promise<void> {
    // 1. Validate parameter existence and tenant ownership
    const paramIds = params.map((p) => p.parameterId);
    const existingParams = await this.catalogRepo.findParametersByIds(tx, paramIds, laboratoryId);
    if (existingParams.length !== paramIds.length) {
      throw new BadRequestProblem(
        'One or more referenced parameters do not exist or belong to another laboratory.',
      );
    }

    // 2. Validate unit existence and tenant ownership (must be global or owned by this lab)
    for (const p of params) {
      const unit = await this.catalogRepo.findUnitById(tx, p.unitId);
      if (!unit) {
        throw new BadRequestProblem(`Referenced unit '${p.unitId}' does not exist.`);
      }
      if (unit.laboratoryId !== null && unit.laboratoryId !== laboratoryId) {
        throw new BadRequestProblem(
          `Tenant isolation violation: custom unit '${p.unitId}' belongs to another laboratory.`,
        );
      }

      // 3. Exact decimal limits validation
      const dl = toDecimal(p.detectionLimit);
      const rl = toDecimal(p.reportingLimit);
      if (!dl.isPositive() || dl.isZero()) {
        throw new BadRequestProblem(
          `Detection limit must be strictly positive: ${p.detectionLimit}`,
        );
      }
      if (!rl.isPositive() || rl.isZero()) {
        throw new BadRequestProblem(
          `Reporting limit must be strictly positive: ${p.reportingLimit}`,
        );
      }
      if (rl.lessThan(dl)) {
        throw new BadRequestProblem(
          `Reporting limit (${p.reportingLimit}) cannot be less than detection limit (${p.detectionLimit}).`,
        );
      }
    }

    await this.catalogRepo.insertMethodVersionParameters(
      tx,
      methodVersionId,
      params.map((p) => ({
        parameterId: p.parameterId,
        unitId: p.unitId,
        detectionLimit: p.detectionLimit,
        reportingLimit: p.reportingLimit,
        decimalPrecision: p.decimalPrecision ?? 2,
        isMandatory: p.isMandatory ?? true,
      })),
      generateUuidV7,
    );
  }

  private async loadVersionDetail(
    txOrDb: TransactionalContext | DatabaseService,
    versionId: string,
    version: TestMethodVersionEntity,
  ): Promise<MethodVersionDetail> {
    const parameters = await this.catalogRepo.findParametersByVersionId(txOrDb, versionId);
    const sampleTypeIds = await this.catalogRepo.findSampleTypeIdsByVersionId(txOrDb, versionId);

    return {
      ...version,
      parameters,
      sampleTypeIds,
    };
  }
}
