import { Injectable, Inject, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import { AuditEventInput, AuditEventRecord } from './audit.types';
import { canonicalJson } from './canonical-json';
import { generateUuidV7 } from '../../core/common/uuid';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AuditService');

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /**
   * Computes the deterministic SHA-256 event digest over canonical audit properties.
   */
  static computeEventHash(params: {
    previousHash: string;
    sequenceNumber: number;
    laboratoryId: string;
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId: string;
    canonicalDiff: string;
  }): string {
    const rawContent = [
      params.previousHash,
      params.sequenceNumber.toString(),
      params.laboratoryId,
      params.actorUserId,
      params.action,
      params.entityType,
      params.entityId,
      params.correlationId,
      params.canonicalDiff,
    ].join('|');

    return crypto.createHash('sha256').update(rawContent).digest('hex');
  }

  /**
   * Appends an immutable, hash-chained audit event within the caller's active database transaction.
   * Acquires a row-level lock on audit_chain_heads to serialize concurrent appends per laboratory.
   */
  async appendEvent(
    input: AuditEventInput,
    context: TransactionalContext,
  ): Promise<AuditEventRecord> {
    const auditEventId = generateUuidV7();

    // 1. Ensure and lock the laboratory chain head for update
    let headResult = await context.query<{
      latest_event_hash: string;
      total_events: string;
    }>(
      `SELECT latest_event_hash, total_events
       FROM audit_chain_heads
       WHERE laboratory_id = $1
       FOR UPDATE;`,
      [input.laboratoryId],
    );

    if (headResult.rowCount === 0) {
      // Auto-initialize genesis head if not present
      await context.query(
        `INSERT INTO audit_chain_heads (laboratory_id, latest_event_hash, total_events)
         VALUES ($1, $2, 0)
         ON CONFLICT (laboratory_id) DO NOTHING;`,
        [input.laboratoryId, GENESIS_HASH],
      );

      headResult = await context.query<{
        latest_event_hash: string;
        total_events: string;
      }>(
        `SELECT latest_event_hash, total_events
         FROM audit_chain_heads
         WHERE laboratory_id = $1
         FOR UPDATE;`,
        [input.laboratoryId],
      );
    }

    const currentHead = headResult.rows[0]!;
    const previousHash = currentHead.latest_event_hash;
    const nextSequence = parseInt(currentHead.total_events, 10) + 1;

    // 2. Canonical serialization of diff payload
    const canonicalDiff = canonicalJson(input.diffPayload);

    // 3. Compute deterministic cryptographic hash
    const currentHash = AuditService.computeEventHash({
      previousHash,
      sequenceNumber: nextSequence,
      laboratoryId: input.laboratoryId,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId: input.correlationId,
      canonicalDiff,
    });

    // 4. Insert into append-only audit_events
    const insertResult = await context.query<{
      audit_event_id: string;
      created_at: Date;
    }>(
      `INSERT INTO audit_events (
        audit_event_id,
        laboratory_id,
        sequence_number,
        actor_user_id,
        action,
        entity_type,
        entity_id,
        correlation_id,
        reason,
        diff_payload,
        previous_event_hash,
        current_event_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING audit_event_id, created_at;`,
      [
        auditEventId,
        input.laboratoryId,
        nextSequence,
        input.actorUserId,
        input.action,
        input.entityType,
        input.entityId,
        input.correlationId,
        input.reason ?? null,
        JSON.stringify(input.diffPayload),
        previousHash,
        currentHash,
      ],
    );

    // 5. Advance chain head
    await context.query(
      `UPDATE audit_chain_heads
       SET latest_event_hash = $1, total_events = $2, updated_at = NOW()
       WHERE laboratory_id = $3;`,
      [currentHash, nextSequence, input.laboratoryId],
    );

    this.logger.debug(
      `[Audit] Appended #${nextSequence} [${input.action}] on ${input.entityType}:${input.entityId} (Hash: ${currentHash.substring(0, 8)}...)`,
    );

    const insertedRow = insertResult.rows[0]!;
    return {
      auditEventId,
      laboratoryId: input.laboratoryId,
      sequenceNumber: nextSequence,
      actorUserId: input.actorUserId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      correlationId: input.correlationId,
      reason: input.reason ?? null,
      diffPayload: input.diffPayload,
      previousEventHash: previousHash,
      currentEventHash: currentHash,
      createdAt: insertedRow.created_at,
    };
  }
}
