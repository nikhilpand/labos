# LabOS — Implementation Dependency Map

This document establishes the **exact topological build order** for LabOS Core V1 modules. No module may be implemented until all of its declared prerequisites are completed and verified.

---

## 1. Topological Build Graph

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        TOPOLOGICAL BUILD ORDER                         │
│                                                                        │
│   [ Layer 0: Platform Kernel ]                                         │
│   1. Database Kernel & Transaction Manager (PostgreSQL)                │
│   2. Audit Infrastructure (Append-Only SHA-256 Ledger)                 │
│   3. Identity & Access Control (OIDC JWT + RBAC)                       │
│                         │                                              │
│                         ▼                                              │
│   [ Layer 1: Facility & Commercial Master Data ]                       │
│   4. Laboratory Facility Context                                       │
│   5. Customer & Contact Management                                     │
│   6. Scientific Catalog (Units, Sample Types, Methods, Parameters)     │
│   7. Instrument Inventory Reference                                    │
│                         │                                              │
│                         ▼                                              │
│   [ Layer 2: Order & Sample Intake ]                                   │
│   8. Test Request (Work Order / Chain of Custody)                      │
│   9. Sample Accessioning & Condition Inspection                        │
│                         │                                              │
│                         ▼                                              │
│   [ Layer 3: Analytical Execution & Results ]                          │
│   10. Test Scheduling & Work Assignment                                │
│   11. Result Entry & Exact Decimal Calculation Engine                  │
│                         │                                              │
│                         ▼                                              │
│   [ Layer 4: Verification & Reporting ]                                │
│   12. Technical Peer Review & Managerial Authorization                 │
│   13. Certificate of Analysis (CoA) Release & Amendments               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Module Dependency Specifications

---

### Module 1: Database Kernel (`core/database`)
* **Prerequisites:** None.
* **Database Dependencies:** PostgreSQL connection pool, migration harness (Prisma/Drizzle), UUIDv7 generator function.
* **Domain Dependencies:** None.
* **API Dependencies:** None.
* **UI Dependencies:** None.
* **Critical Tests:**
  * Transaction rollback test: verify that when an error is thrown inside a multi-operation transaction, zero rows persist.
  * Transactional DDL migration test: verify migrations execute within transactions.

---

### Module 2: Audit Infrastructure (`core/audit`)
* **Prerequisites:** `core/database`.
* **Database Dependencies:** `audit_events` table (with database rules blocking `UPDATE` and `DELETE`).
* **Domain Dependencies:** None (foundational).
* **API Dependencies:** Internal `AuditService.recordEvent(tx, event)`.
* **UI Dependencies:** Read-only audit timeline component.
* **Critical Tests:**
  * Immutability test: verify direct `UPDATE` or `DELETE` on `audit_events` triggers a database error.
  * Cryptographic chaining test: verify $\text{SHA256}(\text{prev\_hash} + \text{canonical\_json})$ produces a mathematically continuous, verifiable chain.
  * Rollback test: verify business transaction fails completely if the audit event cannot be written.

---

### Module 3: Identity & Access Control (`core/identity`)
* **Prerequisites:** `core/database`, `core/audit`.
* **Database Dependencies:** `users`, `roles`, `permissions`, `user_roles` tables.
* **Domain Dependencies:** None.
* **API Dependencies:** Global `AuthGuard`, `@Roles(...)` decorator, `@CurrentUser()` parameter decorator.
* **UI Dependencies:** Session provider, login callback handler, token refresh interceptor.
* **Critical Tests:**
  * JWT signature validation test (valid token vs expired vs forged signature).
  * RBAC Guard test: user without `sample:accession` receives `403 Forbidden`.
  * User sync test: valid external OIDC token auto-provisions or updates internal `User` profile.

---

### Module 4: Laboratory Facility Context (`modules/laboratory`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`.
* **Database Dependencies:** `laboratories` table.
* **Domain Dependencies:** Validates user belongs to the active laboratory.
* **API Dependencies:** `GET /api/v1/laboratory/profile`, `PUT /api/v1/laboratory/profile`.
* **UI Dependencies:** Laboratory settings page, header accreditation badge.
* **Critical Tests:**
  * Accreditation validation: cannot save laboratory profile without accreditation body and number.
  * Audit test: profile updates generate `LABORATORY_PROFILE_UPDATED` audit record.

---

### Module 5: Customer & Contact Management (`modules/customer`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/laboratory`.
* **Database Dependencies:** `customers`, `contacts` tables.
* **Domain Dependencies:** Linked to `laboratory_id`.
* **API Dependencies:** `POST /api/v1/customers`, `GET /api/v1/customers/:id`, `POST /api/v1/customers/:id/contacts`.
* **UI Dependencies:** Customer directory, contact creation modal, client search autocomplete.
* **Critical Tests:**
  * Unique client code test: duplicate `client_code` within the same laboratory is rejected with `409 Conflict`.
  * Atomic creation test: creating a Customer with an initial Contact executes in a single transaction.

---

### Module 6: Scientific Catalog (`modules/catalog`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`.
* **Database Dependencies:** `units_of_measurement`, `sample_types`, `test_methods`, `test_parameters`, `specification_limits` tables.
* **Domain Dependencies:** Self-contained scientific reference library.
* **API Dependencies:** Catalog management endpoints (`/api/v1/catalog/...`).
* **UI Dependencies:** SOP manager, parameter configuration table, unit picker.
* **Critical Tests:**
  * Method parameter cascading: retiring a test method deactivates its parameter associations without breaking historical tests.
  * Decimal validation: limit values must be stored and returned as exact decimals.

---

### Module 7: Instrument Inventory Reference (`modules/instrument`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/laboratory`.
* **Database Dependencies:** `instruments` table.
* **Domain Dependencies:** Linked to `laboratory_id`.
* **API Dependencies:** `GET /api/v1/instruments`, `POST /api/v1/instruments`.
* **UI Dependencies:** Instrument registry list, operational status toggles.
* **Critical Tests:**
  * Status transition test: switching instrument to `OUT_OF_SERVICE` prevents its assignment to new tests.

---

### Module 8: Test Request / Work Order Intake (`modules/test-request`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/customer`, `modules/catalog`.
* **Database Dependencies:** `test_requests` table.
* **Domain Dependencies:** Requires active `Customer` and `Contact`.
* **API Dependencies:** `POST /api/v1/test-requests`, `GET /api/v1/test-requests/:id`.
* **UI Dependencies:** Work order intake wizard, Chain of Custody order form.
* **Critical Tests:**
  * Inactive customer block: cannot log a Test Request for a customer with `status = 'HOLD'`.
  * State transition test: `DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `ACCEPTED`.

---

### Module 9: Physical Sample Accessioning (`modules/sample`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/test-request`, `modules/catalog`.
* **Database Dependencies:** `samples` table.
* **Domain Dependencies:** Linked to `test_request_id` and `sample_type_id`.
* **API Dependencies:** `POST /api/v1/samples/accession`, `GET /api/v1/samples/:id`.
* **UI Dependencies:** Rapid accessioning form, barcode label printer integration view, temperature logging input.
* **Critical Tests:**
  * Qualified condition disclaimer: if received temperature $> 6^\circ\text{C}$ and user qualifies sample, verify `is_qualified = true` and `disclaimer_text` is permanently stored.
  * Accession sequence test: verify `SAM-YYYY-XXXXX` increments atomically without race conditions under concurrent requests.

---

### Module 10: Test Scheduling & Work Assignment (`modules/testing`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/sample`, `modules/catalog`, `modules/instrument`.
* **Database Dependencies:** `tests` table.
* **Domain Dependencies:** Binds `Sample` to `Test Method` and `Instrument`.
* **API Dependencies:** `POST /api/v1/tests/assign`, `GET /api/v1/tests/worklist`.
* **UI Dependencies:** Analyst bench worklist, test assignment modal.
* **Critical Tests:**
  * Compatibility check: assigning a test method that does not support the sample's matrix throws `422 Unprocessable Entity`.
  * Disposed guard: assigning a test to a `DISPOSED` or `REJECTED` sample is strictly blocked.

---

### Module 11: Exact Decimal Result Engine (`modules/result`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/testing`, `modules/catalog`.
* **Database Dependencies:** `results`, `result_versions` tables.
* **Domain Dependencies:** Binds to `test_id` and `test_parameter_id`.
* **API Dependencies:** `POST /api/v1/results/enter`, `POST /api/v1/results/:id/amend`.
* **UI Dependencies:** Spreadsheet-style result entry grid, dilution factor input, `< LOQ` checkbox.
* **Critical Tests:**
  * Binary floating-point prevention test: entering `0.1` and `0.2` dilution arithmetic verifies `0.3000` exact representation without `0.30000000000000004`.
  * Immutability test: amending an existing result creates `version_number = 2` and leaves `version_number = 1` unmodified.

---

### Module 12: Technical Review & Managerial Authorization (`modules/result` / `modules/report`)
* **Prerequisites:** `modules/result`, `core/identity`.
* **Database Dependencies:** Updates `results.status` to `TECHNICALLY_REVIEWED` and `AUTHORIZED`.
* **Domain Dependencies:** Evaluates Four-Eyes constraint.
* **API Dependencies:** `POST /api/v1/results/:id/review`, `POST /api/v1/results/:id/authorize`.
* **UI Dependencies:** Data review verification queue, signature confirmation modal.
* **Critical Tests:**
  * Four-Eyes Principle: analyst who submitted `RESULTS_ENTERED` cannot execute `TECHNICALLY_REVIEWED` (unless dev bypass active).
  * Completeness check: test cannot be marked authorized if any parameter result remains in `DRAFT`.

---

### Module 13: Certificate of Analysis Reporting (`modules/report`)
* **Prerequisites:** `core/database`, `core/audit`, `core/identity`, `modules/test-request`, `modules/sample`, `modules/result`, `modules/laboratory`.
* **Database Dependencies:** `reports`, `report_versions` tables.
* **Domain Dependencies:** Compiles authorized results into an official deliverable.
* **API Dependencies:** `POST /api/v1/reports/generate`, `POST /api/v1/reports/:id/release`, `GET /api/v1/reports/:id/pdf`.
* **UI Dependencies:** PDF previewer, report distribution button, amendment justification modal.
* **Critical Tests:**
  * Unaltered PDF snapshot test: amend a result post-release and verify previously released PDF report retains historical values.
  * Mandatory disclaimer test: report containing a qualified sample automatically renders the bold ISO 17025 warning statement.
  * Revision sequencing test: post-release amendment publishes `Rev 1` with documented reason.
