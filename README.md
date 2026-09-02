# LabOS (Laboratory Operating System)

> **A high-integrity Laboratory Operating System engineered for analytical and testing laboratories.**

---

## 1. What is LabOS?

**LabOS** is an open, modern Laboratory Information and Operations Management System (LIMS + Lab OS). 

Its purpose is to orchestrate and track laboratory operations from physical sample accessioning to certified analytical reporting. LabOS is designed from the ground up to support scientific reproducibility, chain of custody, data immutability, and auditable laboratory workflows.

---

## 2. Current Project Status

* **Current Stage:** **Phase 0 — Documentation, Domain Modeling, & Architecture Blueprinting**
* **Readiness:** **Pre-Implementation Baseline Frozen**
* **Application Code:** None. No backend services, frontend user interfaces, or database migrations have been implemented yet.

All current project assets are dedicated to formal domain modeling, lifecycle state machine design, architectural specifications, and implementation gating under [`docs/`](file:///c:/Users/nikhil/Desktop/projects/labos/docs/) and [`specs/`](file:///c:/Users/nikhil/Desktop/projects/labos/specs/).

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
| **Decimal Engine** | Arbitrary-precision decimal library (e.g., `decimal.js`) | [ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md) |
| **Identifiers** | Time-ordered UUIDv7 | [ADR-003](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md) |

---

## 6. High-Level Project Structure

```text
labos/
├── .gitignore                         # Version control exclusions
├── GEMINI.md                          # Permanent engineering brain & rulebook
├── README.md                          # Project overview & documentation index
├── docs/
│   ├── 00-product/                    # Product scope & roadmaps
│   │   └── CORE-V1-SCOPE.md           # Core V1 boundary & 12-step workflow
│   ├── 01-domain/                     # ISO 17025 domain modeling & state machines
│   │   ├── CORE-ENTITIES.md           # 26 entities cataloged across phases
│   │   ├── CORE-V1-ENTITY-MODEL.md    # 18 Core V1 entity specifications
│   │   ├── DOMAIN-BOUNDARIES.md       # Module encapsulation & contracts
│   │   ├── DOMAIN-GLOSSARY.md         # Scientific & laboratory terminology
│   │   ├── ENTITY-RELATIONSHIPS.md    # Relational mapping & cardinality
│   │   ├── LIFECYCLE-MODEL.md         # 4 decoupled lifecycle state machines
│   │   ├── PENDING-DECISIONS.md       # Architectural decisions awaiting approval
│   │   └── SAMPLE-LIFECYCLE.md        # Comprehensive sample progression analysis
│   ├── 02-architecture/               # System blueprints
│   │   └── ARCHITECTURE-OVERVIEW.md   # Unified modular monolith architecture
│   ├── 07-decisions/                  # Architecture Decision Records (ADRs)
│   │   ├── ADR-001-ISO-17025-FIRST.md # Domain: ISO/IEC 17025 testing laboratories
│   │   ├── ADR-002-TYPESCRIPT-NESTJS.md # Stack: TypeScript + NestJS + Exact Decimals
│   │   ├── ADR-003-POSTGRESQL.md      # DB: PostgreSQL system of record
│   │   ├── ADR-004-MODULAR-MONOLITH.md # Architecture: Modular Monolith default
│   │   ├── ADR-005-AUDIT-INTEGRITY.md # Audit: Append-only SHA-256 hash chaining
│   │   └── ADR-006-OIDC-IDENTITY.md   # Auth: Standards-based OIDC / OAuth2
│   └── 09-implementation/             # Pre-implementation engineering baselines
│       ├── IMPLEMENTATION-BASELINE.md # Authoritative implementation blueprint
│       ├── IMPLEMENTATION-DEPENDENCIES.md # Topological module build graph
│       └── IMPLEMENTATION-GATE.md     # Mandatory quality & readiness gates
└── specs/
    ├── active/                        # Active feature specifications
    │   └── 001-first-vertical-slice.md# SPEC-001: Customer registration & audit
    ├── backlog/                       # Future specifications
    └── completed/                     # Implemented and verified specifications
```

---

## 7. Documentation Index

To explore the design and specifications, consult the following key entry points:

1. **[GEMINI.md](file:///c:/Users/nikhil/Desktop/projects/labos/GEMINI.md):** Permanent engineering rulebook, coding standards, and invariant rules.
2. **[IMPLEMENTATION-BASELINE.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/09-implementation/IMPLEMENTATION-BASELINE.md):** The single authoritative blueprint for the Core V1 implementation.
3. **[CORE-V1-SCOPE.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/00-product/CORE-V1-SCOPE.md):** Detailed product scope and boundary definitions.
4. **[LIFECYCLE-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/LIFECYCLE-MODEL.md):** Formal specifications of the four decoupled state machines (Sample, Test, Result, Report).
5. **[CORE-V1-ENTITY-MODEL.md](file:///c:/Users/nikhil/Desktop/projects/labos/docs/01-domain/CORE-V1-ENTITY-MODEL.md):** Specifications for all 18 Core V1 entities.
6. **[001-first-vertical-slice.md](file:///c:/Users/nikhil/Desktop/projects/labos/specs/active/001-first-vertical-slice.md):** The initial vertical slice specification ready for engineering execution.

---

## 8. Quickstart & Foundation Verification

LabOS backend foundation is scaffolded with strict TypeScript, NestJS, and PostgreSQL.

### Prerequisites
- Node.js >= 20
- npm >= 10

### Development Scripts

```bash
# 1. Type check
npm run typecheck

# 2. Code linting
npm run lint

# 3. Format verification
npm run format:check

# 4. Unit tests
npm run test

# 5. Integration tests (runs against real local PostgreSQL instance)
npm run test:integration

# 6. Full test suite with code coverage
npm run test:coverage

# 7. Production build
npm run build
```

---

## 9. Safety & Compliance Disclaimer

> [!CAUTION]
> **DEVELOPMENT & ARCHITECTURE NOTICE:**  
> LabOS is currently an early-stage software design and development project in **Phase 1 (Foundation Scaffolding)**. It is **not** certified, validated, or approved for production laboratory operations, clinical diagnostic use, patient care, pharmaceutical batch release, or formal regulatory filings under ISO/IEC 17025, ISO 15189, CLIA, CAP, or 21 CFR Part 11.
> 
> No claim of standards compliance or production readiness is made or implied at this stage. Any laboratory deploying this software in the future is solely responsible for performing its own formal Computer System Validation (CSV) and method verification in accordance with applicable regional and international regulatory mandates.

---

## 10. Contribution & Governance Status

LabOS is maintained under strict architectural governance. 

* **Rule of Phasing:** Domain features are built incrementally through approved specifications in `specs/active/` following strict vertical slices.
* **Invariant Protection:** Changes to core domain entities, calculation rules, or audit invariants require an approved Architecture Decision Record (ADR).
