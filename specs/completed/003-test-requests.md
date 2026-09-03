# SPEC-003: Test Request Creation and Immutable Method Version Binding

## 1. Overview & Objective

In ISO/IEC 17025 testing laboratories, commercial analytical requests (work orders) originate from registered customers and specify the analytical test methods required. 

The primary scientific objective of **SPEC-003** is to establish the **Test Request** domain and bind analytical services permanently to immutable test method versions. 

### Central Scientific Invariant
- **At Request Creation:** The selected method version must be in `ACTIVE` status and belong to the authenticated user's laboratory.
- **After Creation:** The binding to `method_version_id` is permanent, tamper-evident, and immutable.
- **Historical Reproducibility:** Subsequent activation of newer versions (e.g. v2) and supersession/retirement of the bound version (v1) must never mutate, delete, or invalidate the historical binding.

---

## 2. Domain Lifecycle

```text
       ┌────────────────────────┐
       │       SUBMITTED        │  (Initial state created by POST /api/v1/test-requests)
       └───────────┬────────────┘
                   │
                   │  POST /api/v1/test-requests/:id/cancel
                   │  (Requires mandatory cancellation reason)
                   ▼
       ┌────────────────────────┐
       │       CANCELLED        │  (Terminal state; permanently immutable)
       └────────────────────────┘

       [Future SPEC-004 Hook: SUBMITTED → ACCEPTED upon Physical Sample Accessioning]
```

- **`SUBMITTED`:** The test request is formally registered and waiting for physical sample delivery.
- **`CANCELLED`:** The client or laboratory cancels the request prior to sample accessioning/testing. Terminal state.
- **`ACCEPTED`:** Deferred to SPEC-004 when physical samples arrive and condition on receipt is inspected.

---

## 3. Database Architecture

### Tables
1. **`test_request_counters`:** Annual, per-laboratory counter table `(laboratory_id, year, last_value)` ensuring concurrency-safe, gap-free request numbering formatted as `TR-YYYY-NNNNNN`.
2. **`test_requests`:** Work order header with customer link, request number, optional customer reference / special instructions, UTC timestamps, and cancellation details.
3. **`test_request_items`:** Append-only junction binding `test_request_id` to `method_version_id`.

### Triggers & Integrity Guards
- **`trg_test_request_tenant_consistency`:** Asserts customer belongs to the same laboratory as the test request.
- **`trg_test_requests_immutability`:** Blocks deletion, blocks mutation of core identification fields, enforces status transitions, and automatically updates `updated_at`.
- **`trg_test_request_item_insert_eligibility`:** Asserts method version is `ACTIVE` and belongs to the same laboratory.
- **`trg_test_request_item_immutability`:** Blocks deletion and updates to `test_request_items`.
- **`chk_test_requests_cancellation_consistency`:** Declarative check constraint enforcing consistency between `status`, `cancellation_reason`, and `cancelled_at`.

---

## 4. API Endpoints

1. `POST /api/v1/test-requests` (`test_request:create`) — Creates request and binds items inside an ACID transaction.
2. `GET /api/v1/test-requests/:id` (`test_request:read`) — Retrieves request header and items (tenant-isolated).
3. `GET /api/v1/test-requests` (`test_request:read`) — Lists requests for caller's laboratory.
4. `POST /api/v1/test-requests/:id/cancel` (`test_request:cancel`) — Cancels request with mandatory reason.

---

## 5. Request Creation Transaction

The test request creation workflow executes within a single atomic PostgreSQL transaction (`DatabaseService.transaction`) orchestrating the following sequence:

1. **Open Transaction:** A single connection is leased from the pool, establishing transactional isolation.
2. **Validate & Lock Customer (`FOR SHARE`):**
   ```sql
   SELECT customer_id, laboratory_id, status
   FROM customers
   WHERE customer_id = $1 AND laboratory_id = $2
   FOR SHARE;
   ```
   - If not found: Throws `NotFoundProblem` (`404 Not Found`).
   - If `status != 'ACTIVE'`: Throws `BadRequestProblem` (`400 Bad Request`).
   - The `FOR SHARE` lock prevents concurrent transactions from moving the customer to `HOLD` or `INACTIVE` while the request is being created.
3. **Validate & Lock Method Versions (`FOR SHARE OF tmv`):**
   ```sql
   SELECT tmv.method_version_id, tmv.status, tm.laboratory_id
   FROM test_method_versions tmv
   JOIN test_methods tm ON tmv.test_method_id = tm.test_method_id
   WHERE tmv.method_version_id = ANY($1)
   FOR SHARE OF tmv;
   ```
   - Confirms all requested method version UUIDs exist (count match).
   - Asserts all requested method versions belong to the caller's laboratory (`tm.laboratory_id = caller.laboratory_id`).
   - Asserts each method version is in `ACTIVE` status. Non-active versions (`DRAFT`, `SUPERSEDED`, `RETIRED`) throw `BadRequestProblem` (`400 Bad Request`).
   - The `FOR SHARE OF tmv` lock prevents concurrent administrative transactions (`activateMethodVersion`) from superseding any of the methods during request creation.
4. **Allocate Request Number:**
   - Derives the current UTC calendar year: `const year = new Date().getUTCFullYear();`.
   - Executes an atomic PostgreSQL UPSERT on `test_request_counters` (detailed in Section 6).
   - Formats the sequential number: `TR-YYYY-NNNNNN`.
5. **Insert `test_requests` Header:**
   - Inserts UUIDv7 primary key, tenant ID, customer ID, request number, customer reference, special instructions, status (`SUBMITTED`), UTC timestamp `requested_at = now()`, and `created_by_user_id = principal.userId`.
6. **Insert Immutable `test_request_items`:**
   - Batch inserts one junction row per method version: `(test_request_item_id, test_request_id, method_version_id, created_at)`.
   - Protected by unique constraint `(test_request_id, method_version_id)` and immutability trigger `trg_test_request_item_immutability`.
7. **Append Audit Event in Same Transaction:**
   - Calls `AuditService.appendEvent` using the same transaction client `txClient`.
   - Records `TEST_REQUEST_CREATED`, entity `TEST_REQUEST`, entity ID `testRequestId`, actor `principal.userId`, and serialized before/after `diffPayload`.
8. **Commit or Roll Back Everything:**
   - If any validation fails, any database constraint/trigger raises an exception, or the audit ledger write fails, the entire transaction issues `ROLLBACK`.
   - No rows remain in `test_requests`, no rows remain in `test_request_items`, no audit row is persisted, and the counter is not incremented.

---

## 6. Request Number Rules

1. **Exact Source of `YYYY`:**
   - Derived strictly from the authoritative server's UTC time via JavaScript `new Date().getUTCFullYear()`.
   - Client-provided dates or local server timezone offsets are strictly ignored to prevent clock-skew or timezone inconsistencies across distributed clusters.
2. **Numbering Scope:**
   - Partitioned strictly **per laboratory, per UTC calendar year**: `(laboratory_id, year)`.
   - Different laboratory tenants maintain completely isolated, independent number sequences.
   - On January 1 at 00:00:00 UTC, the sequence starts fresh at `1` for the new year.
3. **PostgreSQL UPSERT Counter Behavior:**
   - Managed via a dedicated table `test_request_counters`:
     ```sql
     CREATE TABLE test_request_counters (
       laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
       year INT NOT NULL CHECK (year >= 2020 AND year <= 2100),
       last_value INT NOT NULL CHECK (last_value >= 1),
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (laboratory_id, year)
     );
     ```
   - Counter increment executes a single atomic SQL statement:
     ```sql
     INSERT INTO test_request_counters (laboratory_id, year, last_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (laboratory_id, year)
     DO UPDATE SET 
       last_value = test_request_counters.last_value + 1,
       updated_at = CURRENT_TIMESTAMP
     RETURNING last_value;
     ```
   - This statement acquires an exclusive row-level lock on the `(laboratory_id, year)` row, serializing all concurrent creation requests within that tenant and year.
4. **Uniqueness Invariant:**
   - Guaranteed by both the sequential row lock and a declarative unique constraint on the header table:
     ```sql
     CONSTRAINT uq_test_requests_lab_number UNIQUE (laboratory_id, request_number)
     ```
5. **Rollback Behavior:**
   - Because `test_request_counters` is updated within the transactional boundary (unlike PostgreSQL sequences `nextval()` which do not roll back), an aborted or rolled-back transaction unrolls the counter increment in WAL.
   - **Zero Sequence Gaps:** Failed creations do not burn or leak request numbers.
6. **Concurrency Test Expectations:**
   - Verified by launching 10 concurrent request creation promises against real PostgreSQL. All 10 succeed, generating 10 unique, strictly monotonic, sequential request numbers (`TR-YYYY-000001` through `TR-YYYY-000010`) with zero sequence gaps and zero deadlock errors.

---

## 7. Customer Eligibility Rules

1. **`ACTIVE` $\to$ Allowed:**
   - Test requests can be created for customers in `ACTIVE` status.
2. **`HOLD` $\to$ Rejected:**
   - Throws `BadRequestProblem` (`400 Bad Request`): `Customer '<customerId>' is currently on HOLD and cannot place new test requests.`
3. **`INACTIVE` $\to$ Rejected:**
   - Throws `BadRequestProblem` (`400 Bad Request`): `Customer '<customerId>' is INACTIVE and cannot place new test requests.`
4. **Cross-Tenant Customer $\to$ 404:**
   - When a user submits a customer ID belonging to another laboratory, the lookup query filters by `customer_id = $1 AND laboratory_id = $2`.
   - Returns `NotFoundProblem` (`404 Not Found`): `Customer '<customerId>' not found in laboratory '<labId>'`.
   - Prevents leaking customer existence or enumeration across tenants.
5. **Historical Requests Remain Valid After Later Customer Status Changes:**
   - Customer status changes (e.g. going from `ACTIVE` to `HOLD` or `INACTIVE` due to billing or compliance holds) affect only new test request creation.
   - Previously submitted `test_requests` remain in their current lifecycle state (`SUBMITTED`).
   - The foreign key `test_requests.customer_id REFERENCES customers(customer_id) ON DELETE RESTRICT` guarantees historical test requests can never be orphaned or deleted if a customer record is deactivated.

---

## 8. Concurrency Rules

1. **Concurrent Request Creation:**
   - Multiple concurrent creation requests for the same laboratory serialize at the row lock on `test_request_counters(laboratory_id, year)`.
   - Because transaction duration is minimal (in-memory validation + indexed inserts), serialization latency is negligible while guaranteeing strictly monotonic, gap-free numbering.
2. **Request-Number Allocation:**
   - The lock is acquired exclusively during the `INSERT ... ON CONFLICT ... DO UPDATE` step and held until transaction commit/rollback.
   - Guarantees deterministic, collision-free allocation without race conditions.
3. **Customer Status Changes During Creation:**
   - When creating a request, the customer row is locked with `FOR SHARE`.
   - If an administrator concurrently updates the customer status (`UPDATE customers SET status = 'HOLD'`), PostgreSQL requires an exclusive `FOR NO KEY UPDATE` lock.
   - The two transactions serialize:
     - If the creation transaction acquires `FOR SHARE` first, the hold update waits until the request commits.
     - If the hold update commits first, the creation transaction reads the new `HOLD` status and immediately aborts with `400 Bad Request`.
4. **Method Version Supersession During Creation:**
   - When creating a request, method versions are locked with `FOR SHARE OF tmv`.
   - When an authorized chemist/director activates a new method version (`activateMethodVersion`), the service locks the existing active version with `FOR UPDATE` to transition it to `SUPERSEDED`.
   - The locks conflict:
     - If request creation acquires `FOR SHARE` first, supersession waits for the request to commit. The request is permanently bound to the active version.
     - If supersession commits first, request creation reads status `SUPERSEDED` and immediately aborts with `400 Bad Request`.
5. **Audit Failure Rollback:**
   - If `AuditService.appendEvent` fails (e.g. disk full, audit ledger trigger failure, or simulated hardware fault), an unhandled exception triggers a complete PostgreSQL `ROLLBACK`.
   - Guarantees that no test request can ever exist without a corresponding, cryptographically chained audit log entry.

---

## 9. Audit Events

Every test request mutation records an immutable, cryptographically chained event in `audit_events`:

1. **Action Names:**
   - Creation: `'TEST_REQUEST_CREATED'`
   - Cancellation: `'TEST_REQUEST_CANCELLED'`
2. **Entity Type:**
   - `'TEST_REQUEST'`
3. **Entity ID:**
   - `test_request_id` (UUIDv7 string)
4. **Actor Identification:**
   - `actor_user_id = principal.userId`
   - Strictly references the internal LabOS user UUID resolved during authentication, satisfying ADR-006 (never the raw external OIDC subject).
5. **`diff_payload` Structure:**
   - For `TEST_REQUEST_CREATED`:
     ```json
     {
       "requestNumber": "TR-YYYY-NNNNNN",
       "customerId": "01918000-0000-7000-8000-000000000010",
       "customerReference": "PO-2026-HAPPY",
       "specialInstructions": "Process under standard priority.",
       "status": "SUBMITTED",
       "requestedAt": "2026-09-03T10:00:00.000Z",
       "methodVersionIds": [
         "01918000-0000-7000-8000-000000000101",
         "01918000-0000-7000-8000-000000000102"
       ]
     }
     ```
   - For `TEST_REQUEST_CANCELLED`:
     ```json
     {
       "requestNumber": "TR-YYYY-NNNNNN",
       "previousStatus": "SUBMITTED",
       "newStatus": "CANCELLED",
       "cancellationReason": "Client withdrew project due to budget adjustments.",
       "cancelledAt": "2026-09-03T10:30:00.000Z"
     }
     ```
6. **Cancellation Audit Event:**
   - Emits `TEST_REQUEST_CANCELLED` capturing the state transition, mandatory justification, and timestamp.
7. **Transaction Participation:**
   - Both creation and cancellation append audit events via `this.auditService.appendEvent(..., txClient)` inside the same PostgreSQL transaction before `COMMIT`.

---

## 10. Role-Based Access Control (RBAC)

### New Permissions Seeded in Migration `0006_test_requests.sql`
1. **`test_request:create`:** Authorizes creating new commercial test requests and binding method versions.
2. **`test_request:read`:** Authorizes viewing and listing test requests within the caller's laboratory.
3. **`test_request:cancel`:** Authorizes cancelling a submitted test request prior to accessioning/testing.

### Role Mappings
| Role | `test_request:create` | `test_request:read` | `test_request:cancel` | Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **`ADMIN`** | ✅ | ✅ | ✅ | Laboratory system administrator with full operational authority. |
| **`ACCESSIONER`** | ✅ | ✅ | ✅ | Sample intake and front-desk personnel managing customer test requests. |
| **`DIRECTOR`** | ✅ | ✅ | ✅ | Laboratory director supervising testing and work order management. |
| **`ANALYST`** | ❌ | ✅ | ❌ | Bench chemist/analyst needing visibility into work orders without commercial intake authority. |
| **`QA_MANAGER`** | ❌ | ❌ | ❌ | Quality assurance role managing catalogs and method validation (no operational intake). |

---

## 11. Final Test Plan & Verification Results

### A. Unit Test Suite (`test/unit/test-request.spec.ts` - 13 tests)
- **DTO Validation:**
  - Rejects empty request body and non-UUID customer ID.
  - Rejects empty `methodVersionIds` array.
  - Rejects duplicate method version UUIDs in the request array (`Duplicate method versions in request are not allowed`).
  - Rejects empty cancellation reason string.
- **Service Eligibility & Status Guards:**
  - Rejects non-existent customer with `NotFoundProblem` (`404 Not Found`).
  - Rejects customer with status `HOLD` with `BadRequestProblem` (`400 Bad Request`).
  - Rejects customer with status `INACTIVE` with `BadRequestProblem` (`400 Bad Request`).
  - Rejects when a requested method version is not found with `BadRequestProblem`.
  - Rejects when a requested method version is in non-`ACTIVE` status (`DRAFT`, `SUPERSEDED`, `RETIRED`).
  - Rejects cancelling an already `CANCELLED` request with `BadRequestProblem` (`400 Bad Request`).
  - Verifies audit event payload and actor user ID (`principal.userId`) binding.

### B. Real PostgreSQL Integration Test Suite (`test/integration/test-request.spec.ts` - 19 tests)
1. **Scenario 1 (Happy Path Creation):** Submits request with 2 active methods $\to$ `201 Created` with formatted `TR-YYYY-NNNNNN` and persisted audit event.
2. **Scenario 2 (Supersession Resilience):** Proves permanent method version binding remains valid and unchanged after a bound method version is superseded by v2.
3. **Scenario 3 (Trigger Immutability - Item Mutation):** Direct SQL `UPDATE test_request_items SET method_version_id = ...` is rejected with SQLSTATE `23514`.
4. **Scenario 4 (Trigger Immutability - Item Deletion):** Direct SQL `DELETE FROM test_request_items` is rejected with SQLSTATE `23514`.
5. **Scenario 5 (Trigger Immutability - Header Mutation):** Direct SQL `UPDATE test_requests SET request_number = ...` is rejected with SQLSTATE `23514`.
6. **Scenario 6 (Trigger Eligibility - Non-Active Method):** Direct SQL insert of item with `DRAFT` or `RETIRED` version is rejected with SQLSTATE `23514`.
7. **Scenario 7 (Cross-Tenant Customer API Guard):** Request creation with customer from another laboratory fails with `404 Not Found`.
8. **Scenario 8 (Cross-Tenant Method Version API Guard):** Request creation with method from another laboratory fails with `400 Bad Request`.
9. **Scenario 9 (Trigger Tenant Consistency - Customer):** Direct SQL insert of request with cross-tenant customer is rejected with SQLSTATE `23514`.
10. **Scenario 10 (Trigger Tenant Consistency - Method):** Direct SQL insert of item with cross-tenant method version is rejected with SQLSTATE `23514`.
11. **Scenario 11 (Cancellation Flow):** Successfully cancels request; persists reason and `cancelled_at`; rejects subsequent cancellation or edit attempts.
12. **Scenario 12 (Declarative Check Constraint):** Proves `chk_test_requests_cancellation_consistency` rejects rows where status is `CANCELLED` without reason, or `SUBMITTED` with reason.
13. **Scenario 13 (Concurrent Request Number Allocation):** 10 concurrent creation requests generate 10 unique, strictly monotonic, non-colliding numbers without gaps.
14. **Scenario 14 (Transaction Rollback on Audit Failure):** Proves that an audit ledger failure rolls back header, items, and counter increment completely.
15. **Scenario 15 (Cross-Tenant Read Isolation):** Proves Lab B cannot view or retrieve Lab A's test request (`404 Not Found`).
16. **Scenario 16 (RBAC Permissions Guard):** Proves user with `ANALYST` role receives `403 Forbidden` when attempting to create a test request.
17. **Scenario 17 (Continuous Cryptographic Audit Chain):** Proves `auditVerifier.verifyChain(laboratoryId)` passes across all test request events.
18. **Scenario 18 (Customer Eligibility Concurrency Race):** Proves `FOR SHARE` locks prevent placing an order against a customer undergoing a concurrent `HOLD` update.
19. **Scenario 19 (Method Supersession Concurrency Race):** Proves `FOR SHARE OF tmv` locks prevent binding a method version undergoing concurrent supersession.

### C. Verification Gate Summary
- `npm run typecheck` $\to$ **0 errors**
- `npm run lint` $\to$ **0 errors, 0 warnings**
- `npm run format:check` $\to$ **100% Prettier conformity**
- `npm run test` $\to$ **10 test suites (65 tests) passed**
- `npm run test:integration` $\to$ **9 test suites (68 tests) passed**
- `npm run test:all` $\to$ **19 test suites (133 tests) passed**
- `npm run build` $\to$ **Compiled cleanly to `dist/`**
