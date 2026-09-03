import { Injectable } from '@nestjs/common';
import { DatabaseService, TransactionalContext } from '../../core/database/database.service';
import {
  TestRequestDetail,
  TestRequestEntity,
  TestRequestItemDetail,
  TestRequestListQuery,
  TestRequestStatus,
} from './test-request.types';

interface TestRequestRow {
  test_request_id: string;
  laboratory_id: string;
  customer_id: string;
  request_number: string;
  customer_reference: string | null;
  special_instructions: string | null;
  status: TestRequestStatus;
  requested_at: Date;
  cancellation_reason: string | null;
  cancelled_at: Date | null;
  created_by_user_id: string;
  created_at: Date;
  updated_at: Date;
}

interface TestRequestItemRow {
  test_request_item_id: string;
  method_version_id: string;
  method_code: string;
  method_name: string;
  version_number: number;
  revision_label: string;
  created_at: Date;
}

export interface CustomerLockResult {
  customerId: string;
  laboratoryId: string;
  clientCode: string;
  companyName: string;
  status: 'ACTIVE' | 'HOLD' | 'INACTIVE';
}

export interface MethodVersionLockResult {
  methodVersionId: string;
  testMethodId: string;
  versionNumber: number;
  revisionLabel: string;
  status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
  methodCode: string;
  methodName: string;
  laboratoryId: string;
}

@Injectable()
export class TestRequestRepository {
  private mapRequestRow(row: TestRequestRow): TestRequestEntity {
    return {
      testRequestId: row.test_request_id,
      laboratoryId: row.laboratory_id,
      customerId: row.customer_id,
      requestNumber: row.request_number,
      customerReference: row.customer_reference,
      specialInstructions: row.special_instructions,
      status: row.status,
      requestedAt: row.requested_at,
      cancellationReason: row.cancellation_reason,
      cancelledAt: row.cancelled_at,
      createdByUserId: row.created_by_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapItemRow(row: TestRequestItemRow): TestRequestItemDetail {
    return {
      testRequestItemId: row.test_request_item_id,
      methodVersionId: row.method_version_id,
      methodCode: row.method_code,
      methodName: row.method_name,
      versionNumber: row.version_number,
      revisionLabel: row.revision_label,
      createdAt: row.created_at,
    };
  }

  /**
   * Allocates the next gap-free sequential request number for the laboratory and year.
   * Leverages PostgreSQL row-level lock on test_request_counters(laboratory_id, year).
   */
  async allocateRequestNumber(
    tx: TransactionalContext,
    laboratoryId: string,
    year: number,
  ): Promise<string> {
    const result = await tx.query<{ last_value: string }>(
      `INSERT INTO test_request_counters (laboratory_id, year, last_value, updated_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (laboratory_id, year)
       DO UPDATE SET last_value = test_request_counters.last_value + 1, updated_at = NOW()
       RETURNING last_value;`,
      [laboratoryId, year],
    );

    const lastValue = parseInt(result.rows[0]?.last_value ?? '1', 10);
    const padded = String(lastValue).padStart(6, '0');
    return `TR-${year}-${padded}`;
  }

  /**
   * Acquires a shared lock (FOR SHARE) on the customer tuple to prevent concurrent status updates.
   */
  async lockAndFetchCustomer(
    tx: TransactionalContext,
    customerId: string,
    laboratoryId: string,
  ): Promise<CustomerLockResult | null> {
    const result = await tx.query<{
      customer_id: string;
      laboratory_id: string;
      client_code: string;
      company_name: string;
      status: 'ACTIVE' | 'HOLD' | 'INACTIVE';
    }>(
      `SELECT customer_id, laboratory_id, client_code, company_name, status
       FROM customers
       WHERE customer_id = $1 AND laboratory_id = $2
       FOR SHARE;`,
      [customerId, laboratoryId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      customerId: row.customer_id,
      laboratoryId: row.laboratory_id,
      clientCode: row.client_code,
      companyName: row.company_name,
      status: row.status,
    };
  }

  /**
   * Acquires a shared lock (FOR SHARE) on the method versions to serialize against concurrent supersession.
   */
  async lockAndFetchMethodVersions(
    tx: TransactionalContext,
    versionIds: string[],
    laboratoryId: string,
  ): Promise<MethodVersionLockResult[]> {
    const result = await tx.query<{
      method_version_id: string;
      test_method_id: string;
      version_number: number;
      revision_label: string;
      status: 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'RETIRED';
      method_code: string;
      method_name: string;
      laboratory_id: string;
    }>(
      `SELECT tmv.method_version_id, tmv.test_method_id, tmv.version_number, tmv.revision_label,
              tmv.status, tm.code AS method_code, tm.name AS method_name, tm.laboratory_id
       FROM test_method_versions tmv
       JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
       WHERE tmv.method_version_id = ANY($1::uuid[]) AND tm.laboratory_id = $2
       FOR SHARE OF tmv;`,
      [versionIds, laboratoryId],
    );

    return result.rows.map((row) => ({
      methodVersionId: row.method_version_id,
      testMethodId: row.test_method_id,
      versionNumber: row.version_number,
      revisionLabel: row.revision_label,
      status: row.status,
      methodCode: row.method_code,
      methodName: row.method_name,
      laboratoryId: row.laboratory_id,
    }));
  }

  async insertTestRequest(
    tx: TransactionalContext,
    data: {
      testRequestId: string;
      laboratoryId: string;
      customerId: string;
      requestNumber: string;
      customerReference?: string | null;
      specialInstructions?: string | null;
      createdByUserId: string;
      requestedAt?: Date;
    },
  ): Promise<TestRequestEntity> {
    const requestedAt = data.requestedAt ?? new Date();
    const result = await tx.query<TestRequestRow>(
      `INSERT INTO test_requests (
        test_request_id,
        laboratory_id,
        customer_id,
        request_number,
        customer_reference,
        special_instructions,
        status,
        requested_at,
        created_by_user_id,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7, $8, NOW(), NOW())
      RETURNING *;`,
      [
        data.testRequestId,
        data.laboratoryId,
        data.customerId,
        data.requestNumber,
        data.customerReference ?? null,
        data.specialInstructions ?? null,
        requestedAt,
        data.createdByUserId,
      ],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Test request insertion failed to return inserted record.');
    }
    return this.mapRequestRow(row);
  }

  async insertTestRequestItems(
    tx: TransactionalContext,
    items: {
      testRequestItemId: string;
      testRequestId: string;
      methodVersionId: string;
    }[],
  ): Promise<void> {
    for (const item of items) {
      await tx.query(
        `INSERT INTO test_request_items (
          test_request_item_id,
          test_request_id,
          method_version_id,
          created_at
        ) VALUES ($1, $2, $3, NOW());`,
        [item.testRequestItemId, item.testRequestId, item.methodVersionId],
      );
    }
  }

  async findRequestById(
    txOrDb: TransactionalContext | DatabaseService,
    requestId: string,
    laboratoryId: string,
  ): Promise<TestRequestDetail | null> {
    const requestResult = await txOrDb.query<TestRequestRow>(
      `SELECT * FROM test_requests
       WHERE test_request_id = $1 AND laboratory_id = $2;`,
      [requestId, laboratoryId],
    );

    const requestRow = requestResult.rows[0];
    if (!requestRow) {
      return null;
    }

    const itemsResult = await txOrDb.query<TestRequestItemRow>(
      `SELECT tri.test_request_item_id, tri.method_version_id, tm.code AS method_code,
              tm.name AS method_name, tmv.version_number, tmv.revision_label, tri.created_at
       FROM test_request_items tri
       JOIN test_method_versions tmv ON tmv.method_version_id = tri.method_version_id
       JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
       WHERE tri.test_request_id = $1
       ORDER BY tm.code ASC;`,
      [requestId],
    );

    return {
      ...this.mapRequestRow(requestRow),
      items: itemsResult.rows.map((row) => this.mapItemRow(row)),
    };
  }

  async findRequests(
    txOrDb: TransactionalContext | DatabaseService,
    laboratoryId: string,
    query: TestRequestListQuery,
  ): Promise<{ requests: TestRequestDetail[]; total: number }> {
    const conditions: string[] = ['tr.laboratory_id = $1'];
    const params: (string | number)[] = [laboratoryId];
    let paramIdx = 2;

    if (query.customerId) {
      conditions.push(`tr.customer_id = $${paramIdx}`);
      params.push(query.customerId);
      paramIdx++;
    }

    if (query.status) {
      conditions.push(`tr.status = $${paramIdx}`);
      params.push(query.status);
      paramIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countResult = await txOrDb.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM test_requests tr WHERE ${whereClause};`,
      params,
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0', 10);

    // Data query
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    params.push(limit, offset);

    const requestsResult = await txOrDb.query<TestRequestRow>(
      `SELECT tr.* FROM test_requests tr
       WHERE ${whereClause}
       ORDER BY tr.requested_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1};`,
      params,
    );

    const requests: TestRequestDetail[] = [];
    for (const reqRow of requestsResult.rows) {
      const itemsResult = await txOrDb.query<TestRequestItemRow>(
        `SELECT tri.test_request_item_id, tri.method_version_id, tm.code AS method_code,
                tm.name AS method_name, tmv.version_number, tmv.revision_label, tri.created_at
         FROM test_request_items tri
         JOIN test_method_versions tmv ON tmv.method_version_id = tri.method_version_id
         JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
         WHERE tri.test_request_id = $1
         ORDER BY tm.code ASC;`,
        [reqRow.test_request_id],
      );

      requests.push({
        ...this.mapRequestRow(reqRow),
        items: itemsResult.rows.map((r) => this.mapItemRow(r)),
      });
    }

    return { requests, total };
  }

  async lockRequestForUpdate(
    tx: TransactionalContext,
    requestId: string,
    laboratoryId: string,
  ): Promise<TestRequestEntity | null> {
    const result = await tx.query<TestRequestRow>(
      `SELECT * FROM test_requests
       WHERE test_request_id = $1 AND laboratory_id = $2
       FOR UPDATE;`,
      [requestId, laboratoryId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }
    return this.mapRequestRow(row);
  }

  async cancelTestRequest(
    tx: TransactionalContext,
    requestId: string,
    laboratoryId: string,
    reason: string,
  ): Promise<TestRequestEntity> {
    const result = await tx.query<TestRequestRow>(
      `UPDATE test_requests
       SET status = 'CANCELLED',
           cancellation_reason = $3,
           cancelled_at = NOW(),
           updated_at = NOW()
       WHERE test_request_id = $1 AND laboratory_id = $2
       RETURNING *;`,
      [requestId, laboratoryId, reason],
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('Test request cancellation failed to return updated record.');
    }
    return this.mapRequestRow(row);
  }
}
