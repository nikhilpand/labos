# LabOS (Laboratory Operating System)

> **A high-integrity Laboratory Operating System engineered for analytical and testing laboratories.**

---

## 1. What is LabOS?

**LabOS** is an open, modern Laboratory Information and Operations Management System (LIMS + Lab OS). 

Its purpose is to orchestrate and track laboratory operations from physical sample accessioning to authorized analytical reporting (Certificate of Analysis). LabOS is designed from the ground up to support scientific reproducibility, chain of custody, data immutability, and auditable laboratory workflows.

---

## 2. Current Project Status

* **Current Stage:** **Phase 2 — Core V1 Implementation (SPEC-001 Complete)**
* **Readiness:** **Vertical Slice 1 Verified on Real PostgreSQL**
* **Verification Status:** 66 automated tests passing across 15 test suites (34 unit tests, 32 real PostgreSQL integration tests).

### Completed Capabilities

1. **Platform Foundations (Phase 1):**
   - Strict TypeScript (`strict: true`, `noImplicitAny: true`) running on NestJS.
   - Zero-dependency transactional database migration engine ([`migrator.service.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/database/migrator.service.ts)).
   - Arbitrary-precision decimal arithmetic via `decimal.js` ([`decimal.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/common/decimal.ts)). Standard JS floating-point numbers are prohibited for scientific calculations.
   - RFC 9562-compliant time-ordered UUIDv7 generator ([`uuid.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/common/uuid.ts)).
   - Standardized RFC 7807 Problem Details error envelopes with structured validation errors.
   - Structured JSON logging with per-request correlation ID propagation.

2. **Platform Kernel (Phase 2A):**
   - Multi-tenant laboratory context with strict database-level isolation ([`0002_laboratory_and_auth_context.sql`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/database/migrations/0002_laboratory_and_auth_context.sql)). Clients can never supply or override tenant IDs.
   - Role-Based Access Control (RBAC) permission guards separating external OIDC subjects from internal LabOS User UUIDs ([`permissions.guard.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/platform/auth/guards/permissions.guard.ts)).
   - Append-only, tamper-evident audit ledger with SHA-256 cryptographic hash chaining and database triggers prohibiting `UPDATE` and `DELETE` operations ([`0003_audit_ledger.sql`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/database/migrations/0003_audit_ledger.sql)).
   - Automated cryptographic audit chain verification service ([`audit-verifier.service.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/platform/audit/audit-verifier.service.ts)).

3. **Customer Registration Vertical Slice (SPEC-001 / Phase 2B):**
   - Commercial Customer Registration endpoint (`POST /api/v1/customers`).
   - Normalized relational schema for customer and contact entities ([`0004_customer_and_contact.sql`](file:///c:/Users/nikhil/Desktop/projects/labos/src/core/database/migrations/0004_customer_and_contact.sql)).
   - Atomic multi-entity transaction: Customer, primary Contact, and Audit Event are committed or rolled back together in a single ACID transaction ([`customer.service.ts`](file:///c:/Users/nikhil/Desktop/projects/labos/src/modules/customer/customer.service.ts)).
   - Database-level unique index on `(laboratory_id, client_code)` and partial unique index on `contacts(customer_id) WHERE is_primary_contact = TRUE`.
   - Foreign key protection using `ON DELETE RESTRICT` preventing destructive deletion of customer records.
   - Centralized persistence error handler translating PostgreSQL SQLSTATE codes (`23505` $\to$ `409 Conflict`, `23503`/`23514` $\to$ `400 Bad Request`).

---

## 3. Initial Target Market

* **Primary Focus:** **ISO/IEC 17025 Analytical & Testing Laboratories** (specifically environmental water/soil testing, analytical chemistry, food safety, and materials testing).
* **Future Extensibility:** The architecture is designed to accommodate medical diagnostic laboratories (ISO 15189) and pharmaceutical biotechnology (GxP / 21 CFR Part 11) in future phases without structural redesign ([ADR-001](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-001-ISO-17025-FIRST.md)).

---

## 4. Core Architectural Principles

* **Modular Monolith as Default:** Built as a single cohesive modular monolith in NestJS. Microservices are explicitly not an architectural destination ([ADR-004](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-004-MODULAR-MONOLITH.md)).
* **Tamper-Evident Audit Ledger:** Modeled as an append-only event ledger in PostgreSQL with SHA-256 cryptographic hash chaining ([ADR-005](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-005-AUDIT-INTEGRITY.md)).
* **Strict Scientific Numeric Rigor:** Native JavaScript binary floating-point math (`number`) is strictly prohibited for analytical calculations. All measurements, limits, and dilutions use arbitrary-precision decimal representations ([ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md)).
* **Immutable Scientific Results:** Scientific results are never silently overwritten. Corrections generate new immutable result versions with documented justification.
* **Separation of Authentication & Authorization:** Authentication is delegated to standards-based OpenID Connect (OIDC) providers (Keycloak / corporate SSO), while laboratory-specific roles, permissions, and electronic signatures are governed inside LabOS ([ADR-006](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-006-OIDC-IDENTITY.md)).

---

## 5. Technology Stack Decisions

| Dimension | Decision | Reference |
| :--- | :--- | :--- |
| **Backend Runtime** | TypeScript on Node.js (Strict Mode, `noImplicitAny: true`) | [ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md) |
| **Framework** | NestJS (Modular Monolith) | [ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md), [ADR-004](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-004-MODULAR-MONOLITH.md) |
| **Primary Database** | PostgreSQL (System of record, ACID, transactional DDL migrations) | [ADR-003](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md) |
| **Identity Standard**| OpenID Connect (OIDC) & OAuth2 (Keycloak for local dev) | [ADR-006](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-006-OIDC-IDENTITY.md) |
| **Decimal Engine** | Arbitrary-precision decimal library (`decimal.js`) | [ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md) |
| **Identifiers** | Time-ordered UUIDv7 | [ADR-003](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md) |

---

## 6. Project Structure

```text
labos/
├── GEMINI.md                          # Permanent engineering brain & rulebook
├── README.md                          # Project overview & documentation index
├── docs/                              # Architecture blueprints & domain specifications
│   ├── 00-product/                    # Product scope & roadmaps
│   ├── 01-domain/                     # ISO 17025 domain modeling & state machines
│   ├── 02-architecture/               # System blueprints
│   ├── 07-decisions/                  # Architecture Decision Records (ADR-001 to ADR-006)
│   └── 09-implementation/             # Authoritative implementation baselines
├── specs/
│   ├── active/                        # Active feature specifications under development
│   ├── backlog/                       # Future specifications
│   └── completed/                     # Implemented and verified specifications
│       └── 001-first-vertical-slice.md# SPEC-001: Customer registration & audit
├── src/
│   ├── core/                          # Cross-cutting platform foundations
│   │   ├── common/                    # Decimal arithmetic, UUIDv7 utilities
│   │   ├── config/                    # Zod-validated environment config
│   │   ├── database/                  # PostgreSQL service & transactional migrations
│   │   ├── errors/                    # RFC 7807 problem details exception filter
│   │   └── logging/                   # Correlation ID middleware & structured logger
│   ├── platform/                      # Platform kernel services
│   │   ├── audit/                     # Append-only SHA-256 hash-chained audit ledger
│   │   ├── auth/                      # OIDC principal resolution & RBAC guards
│   │   └── laboratory/                # Multi-tenant laboratory context service
│   └── modules/                       # Domain business modules
│       └── customer/                  # SPEC-001 Customer & Contact registration
└── test/
    ├── helpers/                       # Embedded PostgreSQL test runner & global setup
    ├── unit/                          # Pure unit test suites (Decimal, UUID, Zod, etc.)
    └── integration/                   # Real PostgreSQL integration test suites
```

---

## 7. Documentation Index

To explore the design and specifications, consult the following key entry points:

1. **[GEMINI.md](file:///c:/Users/nikhil/Desktop/projects/labos/GEMINI.md):** Permanent engineering rulebook, coding standards, and invariant rules.
2. **[IMPLEMENTATION-BASELINE.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/09-implementation/IMPLEMENTATION-BASELINE.md):** The single authoritative blueprint for the Core V1 implementation.
3. **[CORE-V1-SCOPE.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/00-product/CORE-V1-SCOPE.md):** Detailed product scope and boundary definitions.
4. **[LIFECYCLE-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/LIFECYCLE-MODEL.md):** Formal specifications of the four decoupled state machines (Sample, Test, Result, Report).
5. **[CORE-V1-ENTITY-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/CORE-V1-ENTITY-MODEL.md):** Specifications for all 18 Core V1 entities.
6. **[001-first-vertical-slice.md](file:///c:/Users/nikhil/Desktop/projects/labos/specs/completed/001-first-vertical-slice.md):** Completed first vertical slice specification.

---

## 8. Development & Verification

All code changes are governed by automated verification gates running against strict TypeScript and real local PostgreSQL instances.

### Prerequisites
- Node.js >= 20
- npm >= 10

### Verification Commands

```bash
# 1. Type check (Strict mode, zero errors allowed)
npm run typecheck

# 2. Code linting (ESLint)
npm run lint

# 3. Code formatting verification (Prettier)
npm run format:check

# 4. Unit tests (Vitest)
npm run test

# 5. Real PostgreSQL integration tests (Embedded Postgres)
npm run test:integration

# 6. Complete test suite (All 66 unit + integration tests)
npm run test:all

# 7. Production build compilation
npm run build
```

---

## 9. Safety & Regulatory Compliance Notice

> [!CAUTION]
> **DEVELOPMENT & ARCHITECTURE NOTICE:**  
> LabOS is currently an active software engineering project in **Phase 2 (Core V1 Vertical Slice Implementation)**. It is **not** certified, accredited, validated, or approved for production laboratory operations, clinical diagnostic use, patient care, pharmaceutical batch release, or formal regulatory filings under ISO/IEC 17025, ISO 15189, CLIA, CAP, or 21 CFR Part 11.
> 
> LabOS architecture is designed to support and facilitate compliance with these standards, but software alone cannot claim compliance. Any laboratory deploying this software in the future is solely responsible for performing its own formal Computer System Validation (CSV), standard operating procedure (SOP) qualification, and analytical method verification in accordance with applicable regional and international regulatory mandates.

---

## 10. Contribution & Governance Status

LabOS is maintained under strict architectural governance. 

* **Rule of Phasing:** Domain features are built incrementally through approved specifications in `specs/active/` following strict vertical slices.
* **Invariant Protection:** Changes to core domain entities, calculation rules, or audit invariants require an approved Architecture Decision Record (ADR).