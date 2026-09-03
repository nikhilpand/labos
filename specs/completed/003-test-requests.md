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

## 5. Verification Results

All verification gates have passed:
1. `npm run typecheck`: 0 TypeScript errors.
2. `npm run lint`: 0 ESLint errors/warnings.
3. `npm run format:check`: 100% Prettier conformity.
4. `npm run test`: All 10 unit test suites (65 tests) passed.
5. `npm run test:integration`: All 9 integration test suites (68 tests) passed on real PostgreSQL, including all 19 mandated SPEC-003 verification scenarios.
6. `npm run test:all`: All 19 test suites (133 tests) passing.
7. `npm run build`: Production build cleanly emitted to `dist/`.
