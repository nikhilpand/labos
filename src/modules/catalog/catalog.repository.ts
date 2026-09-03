import { Injectable } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import {
  UnitOfMeasurementEntity,
  SampleTypeEntity,
  TestParameterEntity,
  TestMethodEntity,
  TestMethodVersionEntity,
  MethodVersionParameterEntity,
  MethodVersionParameterDetail,
  MethodVersionStatus,
  AccreditationStatus,
  CatalogItemStatus,
} from './catalog.types';

interface UnitRow {
  unit_id: string;
  laboratory_id: string | null;
  symbol: string;
  name: string;
  category: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface SampleTypeRow {
  sample_type_id: string;
  laboratory_id: string;
  code: string;
  name: string;
  description: string | null;
  status: CatalogItemStatus;
  created_at: Date;
  updated_at: Date;
}

interface ParameterRow {
  parameter_id: string;
  laboratory_id: string;
  code: string;
  name: string;
  chemical_formula: string | null;
  cas_number: string | null;
  description: string | null;
  status: CatalogItemStatus;
  created_at: Date;
  updated_at: Date;
}

interface MethodRow {
  test_method_id: string;
  laboratory_id: string;
  code: string;
  name: string;
  regulatory_agency: string | null;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MethodVersionRow {
  method_version_id: string;
  test_method_id: string;
  version_number: number;
  revision_label: string;
  status: MethodVersionStatus;
  accreditation_status: AccreditationStatus;
  sop_reference: string | null;
  effective_from: Date | null;
  effective_to: Date | null;
  created_by_user_id: string;
  approved_by_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface MethodVersionParameterDetailRow {
  method_version_parameter_id: string;
  method_version_id: string;
  parameter_id: string;
  unit_id: string;
  detection_limit: string;
  reporting_limit: string;
  decimal_precision: number;
  is_mandatory: boolean;
  created_at: Date;
  updated_at: Date;
  parameter_code: string;
  parameter_name: string;
  chemical_formula: string | null;
  cas_number: string | null;
  unit_symbol: string;
  unit_name: string;
}

@Injectable()
export class CatalogRepository {
  private mapUnitRow(row: UnitRow): UnitOfMeasurementEntity {
    return {
      unitId: row.unit_id,
      laboratoryId: row.laboratory_id,
      symbol: row.symbol,
      name: row.name,
      category: row.category,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSampleTypeRow(row: SampleTypeRow): SampleTypeEntity {
    return {
      sampleTypeId: row.sample_type_id,
      laboratoryId: row.laboratory_id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapParameterRow(row: ParameterRow): TestParameterEntity {
    return {
      parameterId: row.parameter_id,
      laboratoryId: row.laboratory_id,
      code: row.code,
      name: row.name,
      chemicalFormula: row.chemical_formula,
      casNumber: row.cas_number,
      description: row.description,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMethodRow(row: MethodRow): TestMethodEntity {
    return {
      testMethodId: row.test_method_id,
      laboratoryId: row.laboratory_id,
      code: row.code,
      name: row.name,
      regulatoryAgency: row.regulatory_agency,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMethodVersionRow(row: MethodVersionRow): TestMethodVersionEntity {
    return {
      methodVersionId: row.method_version_id,
      testMethodId: row.test_method_id,
      versionNumber: row.version_number,
      revisionLabel: row.revision_label,
      status: row.status,
      accreditationStatus: row.accreditation_status,
      sopReference: row.sop_reference,
      effectiveFrom: row.effective_from,
      effectiveTo: row.effective_to,
      createdByUserId: row.created_by_user_id,
      approvedByUserId: row.approved_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMethodVersionParameterDetailRow(
    row: MethodVersionParameterDetailRow,
  ): MethodVersionParameterDetail {
    return {
      methodVersionParameterId: row.method_version_parameter_id,
      methodVersionId: row.method_version_id,
      parameterId: row.parameter_id,
      unitId: row.unit_id,
      detectionLimit: row.detection_limit,
      reportingLimit: row.reporting_limit,
      decimalPrecision: row.decimal_precision,
      isMandatory: row.is_mandatory,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      parameterCode: row.parameter_code,
      parameterName: row.parameter_name,
      chemicalFormula: row.chemical_formula,
      casNumber: row.cas_number,
      unitSymbol: row.unit_symbol,
      unitName: row.unit_name,
    };
  }

  // ============================================================================
  // UNITS OF MEASUREMENT
  // ============================================================================

  async insertUnit(
    txOrDb: TransactionalContext | DatabaseService,
    unit: Omit<UnitOfMeasurementEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<UnitOfMeasurementEntity> {
    const result = await txOrDb.query<UnitRow>(
      `INSERT INTO units_of_measurement (
        unit_id,
        laboratory_id,
        symbol,
        name,
        category,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;`,
      [unit.unitId, unit.laboratoryId, unit.symbol, unit.name, unit.category, unit.isActive],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Unit insertion failed to return inserted record.');
    }
    return this.mapUnitRow(row);
  }

  async findUnits(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
  ): Promise<UnitOfMeasurementEntity[]> {
    const result = await txOrDb.query<UnitRow>(
      `SELECT * FROM units_of_measurement
       WHERE (laboratory_id IS NULL OR laboratory_id = $1) AND is_active = TRUE
       ORDER BY category ASC, symbol ASC;`,
      [laboratoryId],
    );
    return result.rows.map((r) => this.mapUnitRow(r));
  }

  async findUnitById(
    txOrDb: TransactionalContext | DatabaseService,
    unitId: string,
  ): Promise<UnitOfMeasurementEntity | null> {
    const result = await txOrDb.query<UnitRow>(
      `SELECT * FROM units_of_measurement WHERE unit_id = $1;`,
      [unitId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapUnitRow(result.rows[0]);
  }

  // ============================================================================
  // SAMPLE TYPES
  // ============================================================================

  async insertSampleType(
    txOrDb: TransactionalContext | DatabaseService,
    sampleType: Omit<SampleTypeEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<SampleTypeEntity> {
    const result = await txOrDb.query<SampleTypeRow>(
      `INSERT INTO sample_types (
        sample_type_id,
        laboratory_id,
        code,
        name,
        description,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;`,
      [
        sampleType.sampleTypeId,
        sampleType.laboratoryId,
        sampleType.code,
        sampleType.name,
        sampleType.description,
        sampleType.status,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Sample type insertion failed to return inserted record.');
    }
    return this.mapSampleTypeRow(row);
  }

  async findSampleTypes(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
  ): Promise<SampleTypeEntity[]> {
    const result = await txOrDb.query<SampleTypeRow>(
      `SELECT * FROM sample_types
       WHERE laboratory_id = $1 AND status = 'ACTIVE'
       ORDER BY code ASC;`,
      [laboratoryId],
    );
    return result.rows.map((r) => this.mapSampleTypeRow(r));
  }

  async findSampleTypeById(
    txOrDb: TransactionalContext | DatabaseService,
    sampleTypeId: string,
    laboratoryId: string,
  ): Promise<SampleTypeEntity | null> {
    const result = await txOrDb.query<SampleTypeRow>(
      `SELECT * FROM sample_types WHERE sample_type_id = $1 AND laboratory_id = $2;`,
      [sampleTypeId, laboratoryId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapSampleTypeRow(result.rows[0]);
  }

  async findSampleTypesByIds(
    txOrDb: TransactionalContext | DatabaseService,
    sampleTypeIds: string[],
    laboratoryId: string,
  ): Promise<SampleTypeEntity[]> {
    if (sampleTypeIds.length === 0) return [];
    const result = await txOrDb.query<SampleTypeRow>(
      `SELECT * FROM sample_types
       WHERE sample_type_id = ANY($1::uuid[]) AND laboratory_id = $2;`,
      [sampleTypeIds, laboratoryId],
    );
    return result.rows.map((r) => this.mapSampleTypeRow(r));
  }

  // ============================================================================
  // TEST PARAMETERS (ANALYTES)
  // ============================================================================

  async insertParameter(
    txOrDb: TransactionalContext | DatabaseService,
    parameter: Omit<TestParameterEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<TestParameterEntity> {
    const result = await txOrDb.query<ParameterRow>(
      `INSERT INTO test_parameters (
        parameter_id,
        laboratory_id,
        code,
        name,
        chemical_formula,
        cas_number,
        description,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;`,
      [
        parameter.parameterId,
        parameter.laboratoryId,
        parameter.code,
        parameter.name,
        parameter.chemicalFormula,
        parameter.casNumber,
        parameter.description,
        parameter.status,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Parameter insertion failed to return inserted record.');
    }
    return this.mapParameterRow(row);
  }

  async findParameters(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
  ): Promise<TestParameterEntity[]> {
    const result = await txOrDb.query<ParameterRow>(
      `SELECT * FROM test_parameters
       WHERE laboratory_id = $1 AND status = 'ACTIVE'
       ORDER BY code ASC;`,
      [laboratoryId],
    );
    return result.rows.map((r) => this.mapParameterRow(r));
  }

  async findParameterById(
    txOrDb: TransactionalContext | DatabaseService,
    parameterId: string,
    laboratoryId: string,
  ): Promise<TestParameterEntity | null> {
    const result = await txOrDb.query<ParameterRow>(
      `SELECT * FROM test_parameters WHERE parameter_id = $1 AND laboratory_id = $2;`,
      [parameterId, laboratoryId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapParameterRow(result.rows[0]);
  }

  async findParametersByIds(
    txOrDb: TransactionalContext | DatabaseService,
    parameterIds: string[],
    laboratoryId: string,
  ): Promise<TestParameterEntity[]> {
    if (parameterIds.length === 0) return [];
    const result = await txOrDb.query<ParameterRow>(
      `SELECT * FROM test_parameters
       WHERE parameter_id = ANY($1::uuid[]) AND laboratory_id = $2;`,
      [parameterIds, laboratoryId],
    );
    return result.rows.map((r) => this.mapParameterRow(r));
  }

  // ============================================================================
  // TEST METHODS (PARENT HEADERS)
  // ============================================================================

  async insertMethod(
    txOrDb: TransactionalContext | DatabaseService,
    method: Omit<TestMethodEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<TestMethodEntity> {
    const result = await txOrDb.query<MethodRow>(
      `INSERT INTO test_methods (
        test_method_id,
        laboratory_id,
        code,
        name,
        regulatory_agency,
        description
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;`,
      [
        method.testMethodId,
        method.laboratoryId,
        method.code,
        method.name,
        method.regulatoryAgency,
        method.description,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Method insertion failed to return inserted record.');
    }
    return this.mapMethodRow(row);
  }

  async findMethods(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
  ): Promise<{ method: TestMethodEntity; activeVersion: TestMethodVersionEntity | null }[]> {
    const query = `
      SELECT 
        tm.*,
        tmv.method_version_id AS v_method_version_id,
        tmv.version_number AS v_version_number,
        tmv.revision_label AS v_revision_label,
        tmv.status AS v_status,
        tmv.accreditation_status AS v_accreditation_status,
        tmv.sop_reference AS v_sop_reference,
        tmv.effective_from AS v_effective_from,
        tmv.effective_to AS v_effective_to,
        tmv.created_by_user_id AS v_created_by_user_id,
        tmv.approved_by_user_id AS v_approved_by_user_id,
        tmv.created_at AS v_created_at,
        tmv.updated_at AS v_updated_at
      FROM test_methods tm
      LEFT JOIN test_method_versions tmv 
        ON tmv.test_method_id = tm.test_method_id AND tmv.status = 'ACTIVE'
      WHERE tm.laboratory_id = $1
      ORDER BY tm.code ASC;
    `;

    const result = await txOrDb.query<
      MethodRow & {
        v_method_version_id: string | null;
        v_version_number: number | null;
        v_revision_label: string | null;
        v_status: MethodVersionStatus | null;
        v_accreditation_status: AccreditationStatus | null;
        v_sop_reference: string | null;
        v_effective_from: Date | null;
        v_effective_to: Date | null;
        v_created_by_user_id: string | null;
        v_approved_by_user_id: string | null;
        v_created_at: Date | null;
        v_updated_at: Date | null;
      }
    >(query, [laboratoryId]);

    return result.rows.map((row) => {
      const method = this.mapMethodRow(row);
      const activeVersion: TestMethodVersionEntity | null = row.v_method_version_id
        ? {
            methodVersionId: row.v_method_version_id,
            testMethodId: row.test_method_id,
            versionNumber: row.v_version_number ?? 1,
            revisionLabel: row.v_revision_label ?? '',
            status: row.v_status ?? 'ACTIVE',
            accreditationStatus: row.v_accreditation_status ?? 'ACCREDITED',
            sopReference: row.v_sop_reference,
            effectiveFrom: row.v_effective_from,
            effectiveTo: row.v_effective_to,
            createdByUserId: row.v_created_by_user_id ?? '',
            approvedByUserId: row.v_approved_by_user_id,
            createdAt: row.v_created_at ?? new Date(),
            updatedAt: row.v_updated_at ?? new Date(),
          }
        : null;
      return { method, activeVersion };
    });
  }

  async findMethodById(
    txOrDb: TransactionalContext | DatabaseService,
    testMethodId: string,
    laboratoryId: string,
  ): Promise<TestMethodEntity | null> {
    const result = await txOrDb.query<MethodRow>(
      `SELECT * FROM test_methods WHERE test_method_id = $1 AND laboratory_id = $2;`,
      [testMethodId, laboratoryId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapMethodRow(result.rows[0]);
  }

  async findMethodByCode(
    txOrDb: TransactionalContext | DatabaseService,
    code: string,
    laboratoryId: string,
  ): Promise<TestMethodEntity | null> {
    const result = await txOrDb.query<MethodRow>(
      `SELECT * FROM test_methods WHERE code = $1 AND laboratory_id = $2;`,
      [code, laboratoryId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapMethodRow(result.rows[0]);
  }

  // ============================================================================
  // TEST METHOD VERSIONS
  // ============================================================================

  async insertMethodVersion(
    txOrDb: TransactionalContext | DatabaseService,
    version: Omit<TestMethodVersionEntity, 'createdAt' | 'updatedAt'>,
  ): Promise<TestMethodVersionEntity> {
    const result = await txOrDb.query<MethodVersionRow>(
      `INSERT INTO test_method_versions (
        method_version_id,
        test_method_id,
        version_number,
        revision_label,
        status,
        accreditation_status,
        sop_reference,
        effective_from,
        effective_to,
        created_by_user_id,
        approved_by_user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;`,
      [
        version.methodVersionId,
        version.testMethodId,
        version.versionNumber,
        version.revisionLabel,
        version.status,
        version.accreditationStatus,
        version.sopReference,
        version.effectiveFrom,
        version.effectiveTo,
        version.createdByUserId,
        version.approvedByUserId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Method version insertion failed to return inserted record.');
    }
    return this.mapMethodVersionRow(row);
  }

  async findMethodVersionsByMethodId(
    txOrDb: TransactionalContext | DatabaseService,
    testMethodId: string,
  ): Promise<TestMethodVersionEntity[]> {
    const result = await txOrDb.query<MethodVersionRow>(
      `SELECT * FROM test_method_versions
       WHERE test_method_id = $1
       ORDER BY version_number DESC;`,
      [testMethodId],
    );
    return result.rows.map((r) => this.mapMethodVersionRow(r));
  }

  async findMethodVersionById(
    txOrDb: TransactionalContext | DatabaseService,
    methodVersionId: string,
  ): Promise<TestMethodVersionEntity | null> {
    const result = await txOrDb.query<MethodVersionRow>(
      `SELECT * FROM test_method_versions WHERE method_version_id = $1;`,
      [methodVersionId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapMethodVersionRow(result.rows[0]);
  }

  async findMethodVersionByIdAndLab(
    txOrDb: TransactionalContext | DatabaseService,
    methodVersionId: string,
    laboratoryId: string,
  ): Promise<{ version: TestMethodVersionEntity; method: TestMethodEntity } | null> {
    const result = await txOrDb.query<MethodVersionRow & MethodRow>(
      `SELECT tmv.*, tm.laboratory_id, tm.code, tm.name, tm.regulatory_agency, tm.description
       FROM test_method_versions tmv
       JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
       WHERE tmv.method_version_id = $1 AND tm.laboratory_id = $2;`,
      [methodVersionId, laboratoryId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    const row = result.rows[0];
    return {
      version: this.mapMethodVersionRow(row),
      method: this.mapMethodRow(row),
    };
  }

  async findActiveVersionForMethod(
    txOrDb: TransactionalContext | DatabaseService,
    testMethodId: string,
    forUpdate = false,
  ): Promise<TestMethodVersionEntity | null> {
    const query = `
      SELECT * FROM test_method_versions
      WHERE test_method_id = $1 AND status = 'ACTIVE'
      ${forUpdate ? 'FOR UPDATE' : ''};
    `;
    const result = await txOrDb.query<MethodVersionRow>(query, [testMethodId]);
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapMethodVersionRow(result.rows[0]);
  }

  async lockMethodVersionForUpdate(
    tx: TransactionalContext,
    methodVersionId: string,
  ): Promise<TestMethodVersionEntity | null> {
    const result = await tx.query<MethodVersionRow>(
      `SELECT * FROM test_method_versions WHERE method_version_id = $1 FOR UPDATE;`,
      [methodVersionId],
    );
    if (result.rowCount === 0 || !result.rows[0]) {
      return null;
    }
    return this.mapMethodVersionRow(result.rows[0]);
  }

  async getNextVersionNumber(
    txOrDb: TransactionalContext | DatabaseService,
    testMethodId: string,
  ): Promise<number> {
    const result = await txOrDb.query<{ next_num: string }>(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_num
       FROM test_method_versions
       WHERE test_method_id = $1;`,
      [testMethodId],
    );
    return parseInt(result.rows[0]?.next_num ?? '1', 10);
  }

  async updateMethodVersionStatus(
    tx: TransactionalContext,
    methodVersionId: string,
    status: MethodVersionStatus,
    effectiveFrom?: Date | null,
    effectiveTo?: Date | null,
    approvedByUserId?: string | null,
  ): Promise<TestMethodVersionEntity> {
    const result = await tx.query<MethodVersionRow>(
      `UPDATE test_method_versions
       SET status = $2,
           effective_from = COALESCE($3, effective_from),
           effective_to = COALESCE($4, effective_to),
           approved_by_user_id = COALESCE($5, approved_by_user_id),
           updated_at = NOW()
       WHERE method_version_id = $1
       RETURNING *;`,
      [
        methodVersionId,
        status,
        effectiveFrom ?? null,
        effectiveTo ?? null,
        approvedByUserId ?? null,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(`Failed to update method version status: ${methodVersionId}`);
    }
    return this.mapMethodVersionRow(row);
  }

  // ============================================================================
  // METHOD VERSION PARAMETERS
  // ============================================================================

  async insertMethodVersionParameters(
    tx: TransactionalContext,
    methodVersionId: string,
    params: Omit<
      MethodVersionParameterEntity,
      'methodVersionParameterId' | 'methodVersionId' | 'createdAt' | 'updatedAt'
    >[],
    generateId: () => string,
  ): Promise<void> {
    for (const param of params) {
      await tx.query(
        `INSERT INTO method_version_parameters (
          method_version_parameter_id,
          method_version_id,
          parameter_id,
          unit_id,
          detection_limit,
          reporting_limit,
          decimal_precision,
          is_mandatory
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          generateId(),
          methodVersionId,
          param.parameterId,
          param.unitId,
          param.detectionLimit,
          param.reportingLimit,
          param.decimalPrecision,
          param.isMandatory,
        ],
      );
    }
  }

  async deleteMethodVersionParameters(
    tx: TransactionalContext,
    methodVersionId: string,
  ): Promise<void> {
    await tx.query(`DELETE FROM method_version_parameters WHERE method_version_id = $1;`, [
      methodVersionId,
    ]);
  }

  async findParametersByVersionId(
    txOrDb: TransactionalContext | DatabaseService,
    methodVersionId: string,
  ): Promise<MethodVersionParameterDetail[]> {
    const query = `
      SELECT 
        mvp.*,
        tp.code AS parameter_code,
        tp.name AS parameter_name,
        tp.chemical_formula,
        tp.cas_number,
        uom.symbol AS unit_symbol,
        uom.name AS unit_name
      FROM method_version_parameters mvp
      JOIN test_parameters tp ON tp.parameter_id = mvp.parameter_id
      JOIN units_of_measurement uom ON uom.unit_id = mvp.unit_id
      WHERE mvp.method_version_id = $1
      ORDER BY tp.code ASC;
    `;
    const result = await txOrDb.query<MethodVersionParameterDetailRow>(query, [methodVersionId]);
    return result.rows.map((r) => this.mapMethodVersionParameterDetailRow(r));
  }

  // ============================================================================
  // METHOD VERSION SAMPLE TYPES
  // ============================================================================

  async insertMethodVersionSampleTypes(
    tx: TransactionalContext,
    methodVersionId: string,
    sampleTypeIds: string[],
  ): Promise<void> {
    for (const sampleTypeId of sampleTypeIds) {
      await tx.query(
        `INSERT INTO method_version_sample_types (
          method_version_id,
          sample_type_id
        ) VALUES ($1, $2)
        ON CONFLICT DO NOTHING;`,
        [methodVersionId, sampleTypeId],
      );
    }
  }

  async deleteMethodVersionSampleTypes(
    tx: TransactionalContext,
    methodVersionId: string,
  ): Promise<void> {
    await tx.query(`DELETE FROM method_version_sample_types WHERE method_version_id = $1;`, [
      methodVersionId,
    ]);
  }

  async findSampleTypeIdsByVersionId(
    txOrDb: TransactionalContext | DatabaseService,
    methodVersionId: string,
  ): Promise<string[]> {
    const result = await txOrDb.query<{ sample_type_id: string }>(
      `SELECT sample_type_id FROM method_version_sample_types WHERE method_version_id = $1;`,
      [methodVersionId],
    );
    return result.rows.map((r) => r.sample_type_id);
  }
}
