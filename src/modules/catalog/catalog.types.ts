export type MethodVersionStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
export type AccreditationStatus = 'ACCREDITED' | 'NON_ACCREDITED';
export type CatalogItemStatus = 'ACTIVE' | 'INACTIVE';

export interface UnitOfMeasurementEntity {
  unitId: string;
  laboratoryId: string | null;
  symbol: string;
  name: string;
  category: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SampleTypeEntity {
  sampleTypeId: string;
  laboratoryId: string;
  code: string;
  name: string;
  description: string | null;
  status: CatalogItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestParameterEntity {
  parameterId: string;
  laboratoryId: string;
  code: string;
  name: string;
  chemicalFormula: string | null;
  casNumber: string | null;
  description: string | null;
  status: CatalogItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMethodEntity {
  testMethodId: string;
  laboratoryId: string;
  code: string;
  name: string;
  regulatoryAgency: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestMethodVersionEntity {
  methodVersionId: string;
  testMethodId: string;
  versionNumber: number;
  revisionLabel: string;
  status: MethodVersionStatus;
  accreditationStatus: AccreditationStatus;
  sopReference: string | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MethodVersionParameterEntity {
  methodVersionParameterId: string;
  methodVersionId: string;
  parameterId: string;
  unitId: string;
  detectionLimit: string;
  reportingLimit: string;
  decimalPrecision: number;
  isMandatory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MethodVersionParameterDetail extends MethodVersionParameterEntity {
  parameterCode: string;
  parameterName: string;
  chemicalFormula: string | null;
  casNumber: string | null;
  unitSymbol: string;
  unitName: string;
}

export interface MethodVersionDetail extends TestMethodVersionEntity {
  parameters: MethodVersionParameterDetail[];
  sampleTypeIds: string[];
}

export interface TestMethodSummary extends TestMethodEntity {
  activeVersion?: TestMethodVersionEntity | null;
}

export interface CreateUnitInput {
  symbol: string;
  name: string;
  category: string;
}

export interface CreateSampleTypeInput {
  code: string;
  name: string;
  description?: string;
}

export interface CreateParameterInput {
  code: string;
  name: string;
  chemicalFormula?: string;
  casNumber?: string;
  description?: string;
}

export interface MethodParameterConfigInput {
  parameterId: string;
  unitId: string;
  detectionLimit: string;
  reportingLimit: string;
  decimalPrecision?: number;
  isMandatory?: boolean;
}

export interface CreateMethodInput {
  code: string;
  name: string;
  regulatoryAgency?: string;
  description?: string;
  revisionLabel?: string;
  accreditationStatus?: AccreditationStatus;
  sopReference?: string;
  sampleTypeIds?: string[];
  parameters?: MethodParameterConfigInput[];
}

export interface CreateMethodVersionInput {
  revisionLabel: string;
  accreditationStatus?: AccreditationStatus;
  sopReference?: string;
  sampleTypeIds?: string[];
}

export interface ConfigureParametersInput {
  parameters: MethodParameterConfigInput[];
}
