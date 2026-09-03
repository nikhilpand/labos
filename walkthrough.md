# SPEC-003 Walkthrough — Test Request Creation & Immutable Method Version Binding

## Overview
SPEC-003 implements the commercial analytical work order intake foundation for LabOS:
- Permitting laboratory staff to create a `Test Request` for an active customer.
- Binding analytical services permanently and immutably to exact `test_method_version`s.
- Enforcing that future activation, supersession, or retirement of method versions never invalidates historical work orders.
- Allocating tenant-isolated, sequential, gap-free request numbers (`TR-YYYY-NNNNNN`).
- Protecting data integrity using database triggers, declarative cross-column check constraints, row-level locks, and append-only cryptographic audit logging.

---

## Changes Made

### 1. Database Schema & Migration (`0006_test_requests.sql`)
- [0006_test_requests.sql](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/database/migrations/0006_test_requests.sql):
  - `test_request_counters`: Per-laboratory, per-UTC-year sequential counters with row locks.
  - `test_requests`: Header with customer link, unique request number per laboratory, UTC timestamps, and cancellation consistency constraint `chk_test_requests_cancellation_consistency`.
  - `test_request_items`: Immutable junction referencing `method_version_id` with unique constraint `(test_request_id, method_version_id)`.
  - Database triggers:
    - `trg_test_request_tenant_consistency`: Blocks cross-tenant customer assignment.
    - `trg_test_requests_immutability`: Prohibits deletion, enforces valid lifecycle transitions, blocks editing cancelled requests.
    - `trg_test_request_item_insert_eligibility`: Enforces version is `ACTIVE` and belongs to the request laboratory.
    - `trg_test_request_item_immutability`: Prohibits deletion and updates on items.
  - Granular RBAC permissions seeded: `test_request:create`, `test_request:read`, `test_request:cancel`.

### 2. Application Domain Module (`src/modules/test-request/`)
- [test-request.types.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/test-request.types.ts): Entity, DTO, and query contracts.
- [create-test-request.dto.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/dto/create-test-request.dto.ts): Zod validation preventing empty items and duplicate method versions.
- [cancel-test-request.dto.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/dto/cancel-test-request.dto.ts): Zod validation for mandatory cancellation reason.
- [test-request.repository.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/test-request.repository.ts): SQL queries with `FOR SHARE` customer/version locks, annual counter UPSERT, and query filters.
- [test-request.service.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/test-request.service.ts): Single ACID transaction orchestration, business validation, and audit ledger integration.
- [test-request.controller.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/test-request.controller.ts): REST endpoints (`POST /`, `GET /:id`, `GET /`, `POST /:id/cancel`).
- [test-request.module.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/test-request/test-request.module.ts): Module definition wired into [app.module.ts](file:///c:/Users/nikhil/Desktop/projects/labos/src/app.module.ts).

### 3. Specifications & Architecture Documentation
- [003-test-requests.md](file:///c:/Users/nikhil/Desktop/projects/labos/specs/completed/003-test-requests.md): Completed vertical slice specification with verification results.
- [CORE-V1-ENTITY-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/CORE-V1-ENTITY-MODEL.md): Updated Section 6 with Test Request and Test Request Item entity definitions.
- [GEMINI.md](file:///c:/Users/nikhil/Desktop/projects/labos/GEMINI.md): Recorded SPEC-003 completion and Phase 2 status.

---

## Verification Results

### Verification Gates Passed (100%)
1. **TypeScript Typecheck:** `npm run typecheck` $\to$ 0 errors.
2. **ESLint Linting:** `npm run lint` $\to$ 0 errors, 0 warnings.
3. **Prettier Formatting:** `npm run format:check` $\to$ 100% matched files.
4. **Unit Test Suite:** `npm run test` $\to$ 10 test suites (65 tests) passed.
5. **Real PostgreSQL Integration Suite:** `npm run test:integration` $\to$ 9 test suites (68 tests) passed.
6. **Complete Test Suite:** `npm run test:all` $\to$ 19 test files (133 tests) passed.
7. **Production Build:** `npm run build` $\to$ Cleanly emitted to `dist/`.

### Verified SPEC-003 Scenarios on Real PostgreSQL:
- **Scenario 1:** Request creation with multiple active methods $\to$ `201 Created` with formatted `TR-YYYY-NNNNNN` and audit record.
- **Scenario 2:** Permanent version binding remains valid and unchanged after method version supersession.
- **Scenario 3:** Trigger blocks direct SQL update of `method_version_id` on items.
- **Scenario 4:** Trigger blocks direct SQL deletion of items.
- **Scenario 5:** Trigger blocks direct SQL update of core request header fields.
- **Scenario 6:** Trigger blocks inserting items referencing a non-`ACTIVE` version.
- **Scenario 7 & 9:** Service and trigger block request creation with customer from another laboratory.
- **Scenario 8 & 10:** Service and trigger block request creation with method from another laboratory.
- **Scenario 11:** Cancelling request updates status to `CANCELLED`, records reason and `cancelled_at`, and blocks subsequent edits.
- **Scenario 12:** Declarative check constraint `chk_test_requests_cancellation_consistency` blocks invalid cancellation states.
- **Scenario 13:** 10 concurrent requests produce 10 distinct, non-colliding numbers without sequence gaps.
- **Scenario 14:** Transaction rolls back completely when audit logging fails.
- **Scenario 15:** Tenant isolation on read (Lab B cannot access Lab A's request).
- **Scenario 16:** RBAC permissions guard rejects `ANALYST` role with `403 Forbidden`.
- **Scenario 17:** Continuous cryptographic audit chain (`verifyChain()`) verified across all events.
- **Scenario 18:** Customer eligibility race: `FOR SHARE` locks prevent committing against concurrent `HOLD` status.
- **Scenario 19:** Method supersession race: `FOR SHARE OF tmv` prevents binding superseded versions concurrently.
