export interface AuditEventInput {
  laboratoryId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  reason?: string | null;
  diffPayload: Record<string, unknown>;
}

export interface AuditEventRecord {
  auditEventId: string;
  laboratoryId: string;
  sequenceNumber: number;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  correlationId: string;
  reason: string | null;
  diffPayload: Record<string, unknown>;
  previousEventHash: string;
  currentEventHash: string;
  createdAt: Date;
}

export interface AuditVerificationResult {
  laboratoryId: string;
  isContinuous: boolean;
  totalEventsChecked: number;
  genesisHash: string;
  latestHash: string;
  brokenAtSequence?: number;
  reason?: string;
}
