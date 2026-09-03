export type TestRequestStatus = 'SUBMITTED' | 'CANCELLED';

export interface TestRequestEntity {
  testRequestId: string;
  laboratoryId: string;
  customerId: string;
  requestNumber: string;
  customerReference: string | null;
  specialInstructions: string | null;
  status: TestRequestStatus;
  requestedAt: Date;
  cancellationReason: string | null;
  cancelledAt: Date | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestRequestItemEntity {
  testRequestItemId: string;
  testRequestId: string;
  methodVersionId: string;
  createdAt: Date;
}

export interface TestRequestItemDetail {
  testRequestItemId: string;
  methodVersionId: string;
  methodCode: string;
  methodName: string;
  versionNumber: number;
  revisionLabel: string;
  createdAt: Date;
}

export interface TestRequestDetail extends TestRequestEntity {
  items: TestRequestItemDetail[];
}

export interface CreateTestRequestInput {
  customerId: string;
  customerReference?: string;
  specialInstructions?: string;
  methodVersionIds: string[];
}

export interface CancelTestRequestInput {
  reason: string;
}

export interface TestRequestListQuery {
  customerId?: string;
  status?: TestRequestStatus;
  limit?: number;
  offset?: number;
}
