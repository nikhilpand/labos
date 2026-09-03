import { Injectable, Inject, Logger } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import { AuditVerificationResult } from './audit.types';
import { AuditService, GENESIS_HASH } from './audit.service';
import { canonicalJson } from './canonical-json';

@Injectable()
export class AuditVerifierService {
  private readonly logger = new Logger('AuditVerifierService');

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /**
   * Independently verifies the complete, unbroken continuity of the cryptographic
   * audit hash chain for a specific laboratory.
   * Recalculates all SHA-256 hashes and verifies monotonic sequence numbering.
   */
  async verifyChain(
    laboratoryId: string,
    context?: TransactionalContext,
  ): Promise<AuditVerificationResult> {
    const executor = context ?? this.db;

    // Fetch chain head
    const headResult = await executor.query<{
      latest_event_hash: string;
      total_events: string;
    }>(
      `SELECT latest_event_hash, total_events
       FROM audit_chain_heads
       WHERE laboratory_id = $1;`,
      [laboratoryId],
    );

    if (headResult.rowCount === 0) {
      return {
        laboratoryId,
        isContinuous: true,
        totalEventsChecked: 0,
        genesisHash: GENESIS_HASH,
        latestHash: GENESIS_HASH,
      };
    }

    const head = headResult.rows[0];
    if (!head) {
      return {
        laboratoryId,
        isContinuous: false,
        totalEventsChecked: 0,
        genesisHash: GENESIS_HASH,
        latestHash: GENESIS_HASH,
        reason: 'Audit chain head record could not be read.',
      };
    }
    const expectedTotal = parseInt(head.total_events, 10);

    // Fetch all events ordered by sequence
    const eventsResult = await executor.query<{
      audit_event_id: string;
      sequence_number: string;
      actor_user_id: string;
      action: string;
      entity_type: string;
      entity_id: string;
      correlation_id: string;
      diff_payload: Record<string, unknown>;
      previous_event_hash: string;
      current_event_hash: string;
    }>(
      `SELECT audit_event_id, sequence_number, actor_user_id, action, entity_type, entity_id, correlation_id, diff_payload, previous_event_hash, current_event_hash
       FROM audit_events
       WHERE laboratory_id = $1
       ORDER BY sequence_number ASC;`,
      [laboratoryId],
    );

    const events = eventsResult.rows;
    if (events.length !== expectedTotal) {
      return {
        laboratoryId,
        isContinuous: false,
        totalEventsChecked: events.length,
        genesisHash: GENESIS_HASH,
        latestHash: head.latest_event_hash,
        reason: `Event count mismatch: Chain head declares ${expectedTotal} events, but found ${events.length} records.`,
      };
    }

    let expectedPreviousHash = GENESIS_HASH;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      if (!event) {
        continue;
      }
      const seq = parseInt(event.sequence_number, 10);

      // 1. Verify sequence order
      if (seq !== i + 1) {
        return {
          laboratoryId,
          isContinuous: false,
          totalEventsChecked: i,
          genesisHash: GENESIS_HASH,
          latestHash: expectedPreviousHash,
          brokenAtSequence: seq,
          reason: `Sequence numbering anomaly: Expected sequence #${i + 1}, found #${seq}.`,
        };
      }

      // 2. Verify previous hash pointer
      if (event.previous_event_hash !== expectedPreviousHash) {
        return {
          laboratoryId,
          isContinuous: false,
          totalEventsChecked: i,
          genesisHash: GENESIS_HASH,
          latestHash: expectedPreviousHash,
          brokenAtSequence: seq,
          reason: `Broken hash pointer at #${seq}: Expected previous hash '${expectedPreviousHash.substring(0, 10)}...', found '${event.previous_event_hash.substring(0, 10)}...'.`,
        };
      }

      // 3. Recalculate deterministic current hash
      const canonicalDiff = canonicalJson(event.diff_payload);
      const recomputedHash = AuditService.computeEventHash({
        previousHash: event.previous_event_hash,
        sequenceNumber: seq,
        laboratoryId,
        actorUserId: event.actor_user_id,
        action: event.action,
        entityType: event.entity_type,
        entityId: event.entity_id,
        correlationId: event.correlation_id,
        canonicalDiff,
      });

      if (recomputedHash !== event.current_event_hash) {
        return {
          laboratoryId,
          isContinuous: false,
          totalEventsChecked: i,
          genesisHash: GENESIS_HASH,
          latestHash: expectedPreviousHash,
          brokenAtSequence: seq,
          reason: `Digest tampering detected at #${seq}: Recomputed hash does not match stored event hash.`,
        };
      }

      expectedPreviousHash = event.current_event_hash;
    }

    // 4. Verify head alignment
    if (expectedPreviousHash !== head.latest_event_hash) {
      return {
        laboratoryId,
        isContinuous: false,
        totalEventsChecked: events.length,
        genesisHash: GENESIS_HASH,
        latestHash: head.latest_event_hash,
        reason: `Chain head divergence: Calculated terminal hash '${expectedPreviousHash.substring(0, 10)}...' does not match head record '${head.latest_event_hash.substring(0, 10)}...'.`,
      };
    }

    return {
      laboratoryId,
      isContinuous: true,
      totalEventsChecked: events.length,
      genesisHash: GENESIS_HASH,
      latestHash: expectedPreviousHash,
    };
  }
}
