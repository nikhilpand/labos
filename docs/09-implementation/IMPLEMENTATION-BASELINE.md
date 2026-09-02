# LabOS — Authoritative Implementation Baseline (Core V1)

- **Status:** Active Baseline
- **Date:** 2026-09-03
- **Applies to:** Core V1 Implementation

---

## 1. Executive Summary & Purpose

This document is the **single authoritative baseline** for the development of **LabOS Core V1**. Every implementation decision, interface contract, database schema, and test suite must comply with the specifications defined herein.

LabOS is a Laboratory Operating System for private analytical and testing laboratories, initially targeting **ISO/IEC 17025** standards (environmental, chemical, food safety, and materials testing).

Core V1 implements **one complete, coherent, production-grade sample-to-report laboratory workflow** with uncompromising standards for data integrity, exact decimal mathematics, and tamper-evident auditability.

---

## 2. Final Core V1 Product Scope

### In Scope for Core V1
1. **Single Laboratory Context:** Single accredited testing facility profile with address, accreditation credentials (ISO/IEC 17025), and designated technical director.
2. **Commercial & Client Management:** Customer accounts with contact persons, billing terms, and report distribution preferences.
3. **Test Request (Work Order) Intake:** Chain of Custody tracking, turnaround time tracking, client PO logging, and requested test assignments.
4. **Physical Sample Accessioning:** Courier tracking, receipt condition inspection (temperature, container integrity, preservation), auto-generation of unique accession numbers (`SAM-YYYY-00001`), and sample qualified condition handling per ISO 17025 Clause 7.4.3.
5. **Scientific Catalog:** Test Methods (SOPs), Test Parameters (analytes with CAS numbers), Units of Measurement, and optional Specification Limits.
6. **Instrument Reference Inventory:** Operational instruments tracked for metrological assignment to tests.
7. **Test Scheduling & Execution:** Work queue assignment binding samples to methods, instruments, and analysts.
8. **Scientific Result Engine:** Exact decimal calculation (`decimal.js`), dilution factors, `< LOQ` detection limit flagging, and immutable `Result Version` tracking.
9. **Two-Stage Review (Four-Eyes Principle):** Technical Review by a peer analyst, followed by Managerial Authorization by the Technical Director.
10. **Certificate of Analysis (CoA) Reporting:** Generation, cryptographic hashing, and issuance of immutable, versioned PDF reports with mandatory regulatory disclaimers and amendment workflows.
11. **Tamper-Evident Audit Trail:** Append-only event ledger with SHA-256 hash chaining capturing Who, What, When, Where, and Why (ADR-005).
12. **OIDC Authentication & Internal RBAC:** Token validation against external IdP and internal domain role/permission governance (ADR-006).

### Out of Scope for Core V1
* Multi-tenant enterprise corporate hierarchy (`Organization`).
* Multi-branch laboratory sites (`Laboratory Site`).
* Automated sub-container aliquot inventory and tube-level volume deduction.
* Direct instrument serial (RS-232) / TCP network streaming.
* Automated batch Quality Control acceptance engines and Shewhart control charts.
* Automated GUM measurement uncertainty statistical calculation engines.
* Patient medical diagnostic workflows (ISO 15189 / HIPAA / Patient MRNs).
* Pharmaceutical batch manufacturing release (GxP / 21 CFR Part 11).

---

## 3. Final 18 Core V1 Entities (+ 1 Platform Ledger)

Core V1 is strictly comprised of **18 domain entities** and **1 platform audit ledger**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        CORE V1 ENTITY REGISTER                         │
│                                                                        │
│   Facility & Security (3)      Catalog & Equipment (5)                 │
│   1. Laboratory                8. Sample Type                          │
│   2. User                      9. Test Method                          │
│   3. Role (with Permissions)   10. Test Parameter                      │
│                                11. Unit of Measurement                 │
│   Commercial Intake (3)        12. Specification Limit                 │
│   4. Customer                                                          │
│   5. Contact                   Analytical & Results (4)                │
│   6. Test Request              13. Instrument (Reference)              │
│                                14. Test                                │
│   Physical Sample (1)          15. Result                              │
│   7. Sample                    16. Result Version                      │
│                                                                        │
│   Reporting (2)                Cross-Cutting Platform Ledger (1)       │
│   17. Report                   19. Audit Event (Append-Only Ledger)    │
│   18. Report Version                                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Final Module Boundaries (Modular Monolith)

The NestJS backend is partitioned into 9 domain modules plus cross-cutting infrastructure:

```text
src/
├── core/                       # Cross-cutting platform kernel
│   ├── database/               # PostgreSQL connection & transaction manager
│   ├── audit/                  # Append-only SHA-256 audit ledger (ADR-005)
│   ├── identity/               # OIDC JWT validation & RBAC guards (ADR-006)
│   └── decimal/                # Arbitrary-precision math wrappers (ADR-002)
└── modules/
    ├── laboratory/             # Laboratory profile, accreditation, facility config
    ├── customer/               # Customer accounts & contacts
    ├── catalog/                # Sample types, methods, parameters, units, limits
    ├── instrument/             # Instrument reference inventory
    ├── test-request/           # Commercial orders & Chain of Custody intake
    ├── sample/                 # Physical accessioning, condition checks, barcodes
    ├── testing/                # Test assignment, bench queues, work status
    ├── result/                 # Exact decimal result entry, versions, review
    └── report/                 # Certificate of Analysis generation & amendments
```

### Interservice Communication Rules
1. **No Cross-Module Database Queries:** A module never accesses tables outside its domain.
2. **Strongly Typed Public Interfaces:** Modules communicate solely via exported NestJS Service classes.
3. **Atomic Multi-Module Transactions:** Cross-module workflows pass an active transactional context (e.g., Prisma/Drizzle transaction client) to guarantee single-commit ACID boundaries.

---

## 5. Technology Stack Mandate

* **Language:** TypeScript (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
* **Backend Framework:** NestJS (Modular Monolith architecture per ADR-004).
* **Database:** PostgreSQL (System of record per ADR-003, relational integrity, ACID transactions).
* **ORM / Database Layer:** Prisma or Drizzle ORM (type-safe queries, migration management, transactional DDL).
* **Validation Layer:** Zod or `class-validator` at all HTTP, messaging, and parsing boundaries.
* **Scientific Math Engine:** Dedicated decimal library (`decimal.js` or `bignumber.js`). **Zero JavaScript floating-point arithmetic on scientific results.**
* **Identity:** Standards-based OpenID Connect (OIDC) / OAuth2 with Keycloak (local dev) and enterprise IdPs (ADR-006).

---

## 6. Decoupled Lifecycle State Machines

LabOS explicitly rejects a single monolithic sample status, enforcing **four decoupled state machines** ([docs/01-domain/LIFECYCLE-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/LIFECYCLE-MODEL.md)):

```text
1. Physical Sample:
   EXPECTED ──► RECEIVED ──► ACCESSIONED (or QUALIFIED / REJECTED) ──► IN_STORAGE ──► DISPOSED

2. Test / Analysis:
   SCHEDULED ──► IN_PROGRESS ──► COMPLETED (or REPEAT_REQUIRED, CANCELLED)

3. Result:
   DRAFT ──► ENTERED ──► TECHNICALLY_REVIEWED ──► AUTHORIZED (or AMENDED, INVALIDATED)

4. Report:
   DRAFT ──► PENDING_AUTHORIZATION ──► RELEASED (or AMENDED, VOIDED)
```

---

## 7. Critical Business & Compliance Invariants

1. **Four-Eyes Principle (ISO/IEC 17025 Clause 7.8.2):** The user who enters analytical results (`entered_by_user_id`) cannot be the user who performs technical review or authorization. (Configurable dev-only bypass: `BYPASS_FOUR_EYES_FOR_DEV=true`).
2. **Compromised Sample Qualified Disclaimer (Clause 7.4.3):** If a sample is accepted with condition anomalies (e.g., temperature $>6^\circ\text{C}$), `is_qualified = true` is permanently set, and an inescapable bold disclaimer is rendered on the final Certificate of Analysis.
3. **No Silent Overwrite of Results (ADR-002 / ADR-005):** Numerical edits spawn an immutable `Result Version` with an incremented revision number and mandatory reason.
4. **Report Result Freezing:** A `Report Version` references immutable `Result Version` IDs, never active mutable result pointers.
5. **Post-Release Report Amendment (Clause 7.8.8):** A released report is never overwritten or deleted. Any post-release change requires generating a new `Report Version` (Rev 1, Rev 2) stating what was changed, the reason, and referencing the superseded document.

---

## 8. Data Integrity & Exact Decimal Rules

* **Database Columns:** Stored strictly as `NUMERIC(precision, scale)`, never `FLOAT` or `DOUBLE PRECISION`.
* **In-Memory Calculations:** Every mathematical operation (dilutions, conversions, averages) must use `Decimal(val).times(...)` or `.plus(...)`.
* **Detection Limits:** Analytes below detection limit are stored as `numeric_value = null`, `is_below_detection_limit = true`, and `qualifier = 'U'`. Reports render `< {LOQ} {unit}`.
* **UUIDv7 Identifiers:** All primary keys use time-ordered UUIDv7 for high-performance sequential B-Tree indexing.

---

## 9. Security & Identity Rules (ADR-006)

* **Zero Custom Credential Storage:** LabOS never stores passwords, hashes, or salt strings.
* **Separation of AuthN & AuthZ:**
  * Authentication (Who are you?): Verified by validating incoming OIDC Bearer JWTs signed by the Identity Provider.
  * Authorization (What can you do?): Governed internally by LabOS roles (`ACCESSIONER`, `ANALYST`, `REVIEWER`, `DIRECTOR`) mapped to permissions.
* **Least Privilege:** API routes protected by role-based guards rejecting unassigned scopes.

---

## 10. Audit Trail Requirements (ADR-005)

* **Append-Only Table:** Protected at the database level against `UPDATE` and `DELETE`.
* **The 5 W's:** Every event captures Actor (`user_id`), What (`action`, `entity_type`, `entity_id`, serialized state diff), When (`timestamp_utc`), Where (`client_ip`, `workstation_id`), and Why (`reason`).
* **Cryptographic Hash Chaining:**
  $$\text{current\_event\_hash} = \text{SHA-256}(\text{previous\_event\_hash} + \text{canonical\_event\_json})$$
* **Atomic Consistency:** The business state change and its audit event write execute within the same database transaction. If the audit log fails, the entire transaction rolls back.

---

## 11. API Conventions

* **Format:** RESTful JSON APIs prefixed with `/api/v1/`.
* **Input Validation:** Strict runtime schema validation (Zod/class-validator). Unvalidated requests fail with `400 Bad Request`.
* **Idempotency:** State-altering operations (e.g., sample accessioning, result authorization) support `Idempotency-Key` headers.
* **Error Representation:** RFC 7807 Problem Details envelope:
  ```json
  {
    "type": "https://labos.dev/errors/INVALID_TRANSITION",
    "title": "Invalid State Transition",
    "status": 409,
    "detail": "Sample SAM-2026-0001 is in DISPOSED state and cannot be assigned to a test.",
    "instance": "/api/v1/tests/assign",
    "timestamp": "2026-09-03T02:10:00Z"
  }
  ```

---

## 12. Frontend Principles (Future UI Integration)

* **Contract-Driven:** Frontend consumes auto-generated TypeScript contracts derived directly from NestJS DTOs.
* **No Business Rule Duplication:** Frontend performs UX validation for fast feedback, but the backend is the authoritative validator.
* **Clean Scientific Ergonomics:** Designed for high-speed barcode scanning, keyboard-only result entry tables, and clear visual flags for out-of-spec/compromised samples.

---

## 13. Testing Strategy

* **Testing Pyramid:**
  * **Unit Tests (70%):** Pure domain state machine transitions, exact decimal calculations, unit conversions, and validation schemas.
  * **Integration Tests (25%):** Database transaction boundaries, repository queries against real PostgreSQL (via Testcontainers), and OIDC guard verification.
  * **End-to-End Tests (5%):** Complete vertical slice execution (Accessioning $\rightarrow$ Testing $\rightarrow$ Review $\rightarrow$ Report).
* **Zero Regression Rule:** Bug fixes must include a failing test reproduced before the fix is applied.

---

## 14. Explicit Non-Goals for Core V1

* Do **not** build microservices or distributed service meshes.
* Do **not** build patient medical diagnostic or insurance billing features.
* Do **not** build automated instrument serial drivers or direct IoT telemetry readers.
* Do **not** build automated financial invoicing or credit-card processing.
* Do **not** implement public or private blockchain infrastructure.

---

## 15. Contradictions Identified & Authoritative Resolutions

| Contradiction Identified | Source A | Source B | Authoritative Resolution |
| :--- | :--- | :--- | :--- |
| **Module Naming (`calculation` vs. `result`)** | `ARCHITECTURE-OVERVIEW.md` uses `modules/calculation` | `CORE-V1-ENTITY-MODEL.md` uses `modules/result` | **`result` is Authoritative.** The `result` module encapsulates both the exact decimal calculation engine and the versioned result persistence. |
| **Lifecycle Representation** | `SAMPLE-LIFECYCLE.md` uses a single monolithic lifecycle | `LIFECYCLE-MODEL.md` uses 4 decoupled lifecycles | **`LIFECYCLE-MODEL.md` is Authoritative.** Physical samples, tests, results, and reports must have independent state machines to prevent deadlocks. |
| **Entity Count Ambiguity** | Early draft listed 26 entities across all phases | `CORE-V1-SCOPE.md` limits V1 | **18 Domain Entities + 1 Platform Audit Ledger are Authoritative for Core V1.** |

---

## 16. Exact Implementation Order

1. **Step 1: System Foundation:** Strict TypeScript config, NestJS core, PostgreSQL transaction harness, RFC 7807 error filters.
2. **Step 2: Platform Security & Audit:** OIDC token validator, internal RBAC guards, append-only SHA-256 audit engine.
3. **Step 3: Laboratory & Commercial Setup:** Laboratory facility profile, Customer & Contact entities.
4. **Step 4: Scientific Catalog:** Units of Measurement, Sample Types, Test Methods, Test Parameters, Specification Limits.
5. **Step 5: Instrument Reference:** Instrument inventory registry.
6. **Step 6: Work Order Intake:** Test Request (Chain of Custody) creation and validation.
7. **Step 7: Physical Accessioning:** Physical sample receipt, inspection, qualified condition flags, and barcode accessioning.
8. **Step 8: Testing & Execution:** Test assignment, analyst bench queue, work status transitions.
9. **Step 9: Exact Decimal Result Engine:** Result entry, dilution calculations, `< LOQ` flags, and immutable Result Versions.
10. **Step 10: Technical Review & Authorization:** Four-Eyes verification workflow and managerial electronic approval.
11. **Step 11: Certificate of Analysis Reporting:** PDF generation, checksumming, report release, and amendment revisions.
