import { describe, it, expect } from 'vitest';
import { AuditService } from '../../src/platform/audit/audit.service';

describe('AuditService.computeEventHash', () => {
  const baseParams = {
    previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    sequenceNumber: 1,
    laboratoryId: '01918000-0000-7000-8000-000000000001',
    actorUserId: '01918000-0000-7000-8000-000000000099',
    action: 'CUSTOMER_REGISTERED',
    entityType: 'Customer',
    entityId: '019182ab-c012-789a-bcde-f0123456789a',
    correlationId: 'test-corr-1',
    canonicalDiff: '{"clientCode":"CUST-1042","companyName":"Acme"}',
  };

  it('produces a deterministic 64-character SHA-256 hex string', () => {
    const hash1 = AuditService.computeEventHash(baseParams);
    const hash2 = AuditService.computeEventHash(baseParams);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('produces completely different hashes for any subtle property alteration', () => {
    const originalHash = AuditService.computeEventHash(baseParams);

    const modifiedDiffHash = AuditService.computeEventHash({
      ...baseParams,
      canonicalDiff: '{"clientCode":"CUST-1043","companyName":"Acme"}',
    });
    expect(modifiedDiffHash).not.toBe(originalHash);

    const modifiedSeqHash = AuditService.computeEventHash({
      ...baseParams,
      sequenceNumber: 2,
    });
    expect(modifiedSeqHash).not.toBe(originalHash);

    const modifiedPrevHash = AuditService.computeEventHash({
      ...baseParams,
      previousHash: '1111111111111111111111111111111111111111111111111111111111111111',
    });
    expect(modifiedPrevHash).not.toBe(originalHash);
  });
});
