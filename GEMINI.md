# LabOS — Engineering Brain & AI Agent Rulebook

This document serves as the permanent architectural compass, engineering rulebook, and operational guide for all AI agents and engineers working on **LabOS**. Every contribution must comply with the principles and constraints outlined below.

---

## 1. Project Identity

**LabOS** (Laboratory Operating System) is a long-term, high-integrity Laboratory Information and Operations Management System.

- **Initial Domain Target:** **ISO/IEC 17025 analytical and testing laboratories** (specifically chemical, environmental, and food safety testing).
- **Long-Term Extensibility:** The core architecture and data model must remain extensible to support medical/clinical diagnostics (ISO 15189 / CLIA) and pharmaceutical biotechnology (GxP / 21 CFR Part 11) in future phases, without implementing their domain-specific features prematurely (*Ref: [ADR-001](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-001-ISO-17025-FIRST.md)*).
- **Core Purpose:** Orchestrate end-to-end laboratory operations—from sample intake to authorized scientific reporting—with uncompromising standards for data integrity, chain of custody, auditability, and regulatory readiness.

---

## 2. Long-Term Vision

The long-term goal of LabOS is to provide an end-to-end, unified platform for modern testing, analytical, and diagnostic laboratories:
- **Flawless Chain of Custody:** Seamless tracking of samples, aliquots, plates, reagents, and storage locations across their entire lifecycle.
- **Instrument & Assay Orchestration:** Structured capture of instrument outputs, assay execution parameters, and automated analysis pipelines.
- **Scientific Rigor & Trust:** Scientific calculations and observations are reproducible, immutable, exact, and verifiable.
- **Compliance by Design:** Regulatory compliance, electronic signatures, and tamper-evident audit trails are fundamental primitives embedded in the core architecture, rather than an afterthought.
- **Modular Evolution:** A cohesive modular monolith that maintains operational simplicity while expanding into rich laboratory automation.

---

## 3. Current Project Scope

The project has transitioned through Phase 1 (Platform Foundation) and Phase 2A (Platform Kernel) and is currently in **Phase 2: Core V1 Vertical Slice Implementation** (with SPEC-001 Customer Registration complete and verified).

- **Specification-Driven Delivery:** Features are implemented strictly according to approved vertical slice specifications under `specs/` (e.g. SPEC-001 completed, future specs queued in `specs/backlog/`).
- **No Premature Frameworks or Microservices:** Avoid out-of-scope scaffolding, Docker configurations, or microservice splits. Core laboratory business logic remains inside the modular monolith.
- **Documentation & Invariants First:** Domain modeling, database constraints, immutable audit trails, and data contracts under `docs/` and `specs/` govern all implementation steps.

---

## 4. Core Sample-to-Report Workflow

Every technical and data decision in LabOS must support the foundational **Sample-to-Report** lifecycle:

```text
[1. Sample Intake & Accessioning]
               │
               ▼
[2. Batching, Prep & Plating]
               │
               ▼
[3. Analytical Run & Assay Execution]
               │
               ▼
[4. Quality Control (QC) Evaluation]
               │
               ▼
[5. Result Calculation & Entry]
               │
               ▼
[6. Scientific & Technical Verification]
               │
               ▼
[7. Final Report Release (Certificate of Analysis)]
```

1. **Sample Accessioning & Intake:** Physical samples arrive, are inspected, barcoded, logged with metadata (collection time, matrix type, temperature condition), and assigned a unique accession number.
2. **Batching & Preparation:** Samples are pooled into batches, aliquotted, placed into plate wells/racks, and matched with requisite reagents and standard operating procedures (SOPs).
3. **Assay Execution & Analytical Run:** Batches are processed by instruments or manual protocols. Execution conditions, instrument IDs, and operator IDs are recorded.
4. **Quality Control (QC) Review:** Run validity is checked against blanks, calibration standards, matrix spikes, and reference materials before sample results are accepted.
5. **Result Entry & Computation:** Raw instrument metrics are converted into final calculated values. Values out of specification or detection limits are flagged.
6. **Verification & Sign-Off:** Authorized scientific personnel review results, QC flags, and chain-of-custody history before providing approval (with electronic sign-off where required).
7. **Report Release:** Immutable, versioned Certificates of Analysis (CoA) or scientific reports are generated, cryptographically stamped or archived, and released to clients.

---

## 5. Technology Principles

- **Stack Mandate:** **TypeScript with NestJS** running in strict TypeScript mode (*Ref: [ADR-002](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md)*).
- **Strict Type Checking:** `"strict": true`, `"strictNullChecks": true`, and `"noImplicitAny": true` must be enabled across all configuration files.
- **Runtime Input Validation:** Strict schema validation (e.g., via `class-validator` or `Zod`) is mandatory at all system boundaries (HTTP request payloads, instrument file parsing, queue messages). Unvalidated input must never enter domain services.
- **Scientific Numeric Rigor:**
  - Standard JavaScript binary floating-point (`number`) arithmetic must **never** be used for critical scientific calculations, assay results, limits of detection, calibration curves, or regulatory thresholds.
  - Dedicated arbitrary-precision decimal libraries (e.g., `decimal.js`, `bignumber.js`) must be used for all scientific calculations.
  - Calculation rules must be pure, deterministic, and thoroughly covered by automated unit tests.
- **Simplicity Over Cleverness:** Prefer simple, readable, maintainable solutions over clever, obfuscated abstractions.
- **Minimal External Dependencies:** Every third-party library is a maintenance and security liability. Do not introduce dependencies unless there is an overwhelming, documented justification.
- **Explain Decisions in Beginner-Friendly Language:** Avoid unnecessary jargon. Document *why* architectural choices are made using clear, intuitive reasoning so that beginners and domain experts alike can understand them.

---

## 6. Architecture Principles

- **Modular Monolith as Permanent Default:** 
  - LabOS commits to a **Modular Monolith** as its permanent default architecture (*Ref: [ADR-004](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-004-MODULAR-MONOLITH.md)*).
  - Microservices are **not** a planned destination. The core laboratory business logic, workflow state machines, and audit trail remain strictly inside the modular monolith.
- **Strict Exceptions for Satellite Workers:** External workers or auxiliary services may only be introduced under three documented conditions:
  1. *Extreme Isolated Compute Requirements* (e.g., intensive genomic alignment or molecular modeling).
  2. *Essential Technology Requiring a Different Runtime* (e.g., an instrument vendor SDK only available in C++ or Python).
  3. *Strong Security Sandboxing Requirements* (e.g., executing user-submitted custom calculation scripts).
  Such workers act only as non-authoritative compute satellites; the modular monolith remains the authoritative governor.
- **Domain-Driven Boundaries:** Isolate domain business logic from databases, external interfaces, and presentation layers using NestJS modules (`@Module()`).
- **Incremental Expansion:** Build software in small, verifiable, end-to-end vertical slices. Never attempt massive, sweeping rewrites.

---

## 7. Data Integrity Rules

Data integrity is the paramount rule of scientific software. Scientific trust and regulatory compliance depend on accurate, immutable records.

- **Never Silently Overwrite Scientific Results:** 
  - If a result is recalculated, re-run, or amended, the original measurement must be preserved.
  - Updates must produce a new version with an explicit timestamp, operator ID, and documented justification for the change.
- **Append-Only for Observations:** Raw instrument data, operator observations, and state transitions must be append-only records.
- **UUIDs for Stable Identifiers:** All primary domain entities must use UUIDs (e.g., UUIDv7 or UUIDv4) for stable, collision-free identification across distributed environments and audit trails (*Ref: [ADR-003](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md)*).
- **Deterministic State Machines:** Samples and batches transition through strict, validated lifecycle states (e.g., a sample cannot jump from `Registered` directly to `Reported` without passing through `Accessioned`, `In-Process`, etc.).
- **Strong Referential Integrity:** Avoid orphaned records. Use database-level constraints and foreign keys to enforce relationships.

---

## 8. Security Rules

- **Identity Standard:** **OpenID Connect (OIDC) and OAuth2** architecture (*Ref: [ADR-006](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-006-OIDC-IDENTITY.md)*).
- **Never Build Custom Password Authentication:** Delegated authentication to standards-based identity providers (e.g., Keycloak for local development, corporate Active Directory / Okta / Azure AD for enterprise SSO).
- **Strict Separation of Authentication and Authorization:**
  - *Authentication ("Who are you?"):* Managed by the OIDC Identity Provider.
  - *Authorization ("What can you do?"):* Managed entirely inside LabOS. LabOS maintains its own domain roles, permissions, laboratory section boundaries, and electronic signature workflows.
- **Never Hard-Code Secrets:** Passwords, API keys, tokens, encryption keys, and private certificates must **never** be committed to code or documentation. Always utilize secure environment variables.
- **Principle of Least Privilege:** Users and services must only possess the minimal permissions required to perform their explicit function.

---

## 9. Audit Trail Rules

- **Append-Only, Tamper-Evident Ledger:** Modeled as an append-only event ledger within PostgreSQL, protected against normal application `UPDATE` and `DELETE` operations (*Ref: [ADR-005](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-005-AUDIT-INTEGRITY.md)*).
- **Realistic Posture (Tamper-Evident & Verifiable):** We do not claim the system is "impossible to tamper with." The design goal is **tamper-evident and independently verifiable** history using deterministic event serialization and cryptographic hash chaining (e.g., SHA-256).
- **Never Silently Delete Audit History:** Audit logs are permanent and immutable.
- **The 5 W's of Auditing:** Every auditable event must capture:
  1. **Who (Actor):** Identity of the user, system agent, or automated process.
  2. **What (Action & Diff):** Domain action verb, target entity, stable entity UUID, correlation ID, and serialized before/after state diff.
  3. **When (Timestamp):** Immutable UTC timestamp.
  4. **Where:** Source IP, workstation ID, or API client.
  5. **Why (Reason):** Mandatory structured justification for any amendment, invalidation, or recalculation.
- **Traceability:** Any generated Certificate of Analysis must be traceable backward through every step, person, instrument, and QC standard that touched it.

---

## 10. Database Rules

- **PostgreSQL as System of Record:** PostgreSQL is the single system of record for both local development and production (*Ref: [ADR-003](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md)*).
- **ACID Transactions:** Multi-entity operations must execute inside strict database transactions. Partial writes are unacceptable.
- **Versioned Migrations:** All database schemas must be managed via version-controlled, reproducible, and reversible migration scripts. Never manually alter database tables.
- **Explicit Constraints & Foreign Keys:** Enforce data validity at the database layer (not-null constraints, unique constraints, foreign keys, check constraints) in addition to application-level validation.
- **PostgreSQL JSONB Strictly for Flexible Data:** `JSONB` is reserved exclusively for genuinely dynamic, heterogeneous data (such as variable instrument telemetry or ad-hoc assay parameters). Core entities and relationships must remain strictly relational.
- **Soft Deletes & State Flags:** Do not hard-delete business or scientific entities. Use state flags (e.g., `archived`, `cancelled`, `voided`) with required justification.

---

## 11. AI Agent Workflow

AI agents working on LabOS must follow a disciplined, transparent execution cycle:

1. **Pre-Implementation Plan:** Before modifying code or adding features, formulate and document a clear implementation plan detailing what will be done, why, and how it will be verified.
2. **Small Increments:** Implement one coherent change at a time rather than making sprawling modifications.
3. **Verify Thoroughly:** Verify every change with automated tests or concrete manual verification steps.
4. **Post-Implementation Explanation:** After completing work, clearly summarize:
   - What was discovered
   - What was changed
   - How the changes were verified
5. **No Assumptions:** Base all decisions on evidence from the codebase, documentation, and explicit user instructions rather than guesswork.

---

## 12. Testing Requirements

- **Important Features Require Automated Tests:** Any feature touching data processing, state transitions, scientific calculations, security, or audit logging must have automated tests.
- **Testing Pyramid:**
  - **Unit Tests:** Verify pure domain logic, unit conversions, formula calculations, and validation rules.
  - **Integration Tests:** Verify database interactions, transaction boundaries, and state transition workflows.
  - **End-to-End / Workflow Tests:** Validate complete journeys (e.g., Sample Accessioning -> QC -> Reporting).
- **Regression Tests:** When a bug is discovered, write a failing test reproducing the issue before implementing the fix.

---

## 13. Rules for Changing Code

- **Inspect Diffs Before Finalizing:** Review all changes to ensure no extraneous edits, leftover debug logs, commented-out dead code, or unintended formatting changes are present.
- **Preserve Documentation Integrity:** Whenever code changes impact architectural assumptions, update the corresponding documents in `docs/` and specifications in `specs/`.
- **Zero Regressions:** Never break existing tests or remove test assertions to make a pipeline pass.
- **Backwards Compatibility:** Changes to data structures or schemas must account for existing data.

---

## 14. Definition of Done (DoD)

A task or feature in LabOS is considered **Done** only when:

1. **Documented:** Relevant specifications in `specs/` or architecture docs in `docs/` are authored or updated.
2. **Planned & Reviewed:** Implementation followed an approved plan.
3. **Engineered:** Code adheres strictly to the modular monolith design, strict TypeScript rules, exact decimal calculations, and security/data integrity standards.
4. **Tested:** Unit and integration tests cover all critical paths and pass successfully.
5. **Audited:** Audit trail tracking and immutability invariants are satisfied.
6. **Explained:** A clear, beginner-friendly summary of changes and verification results is provided.

---

## 15. Current Project Phase

- **Current Status:** **Phase 2 — Core V1 Implementation (SPEC-001 Complete & Verified)**
- **Approved Architecture Decision Records:**
  - [ADR-001: Primary First Laboratory Domain — ISO/IEC 17025 Analytical & Testing Laboratories](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-001-ISO-17025-FIRST.md)
  - [ADR-002: Backend Technology Stack & Scientific Calculation Rigor — TypeScript with NestJS](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-002-TYPESCRIPT-NESTJS.md)
  - [ADR-003: Primary Database Engine & Persistence Strategy — PostgreSQL](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-003-POSTGRESQL.md)
  - [ADR-004: Core Architectural Strategy — Modular Monolith as Permanent Default](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-004-MODULAR-MONOLITH.md)
  - [ADR-005: Audit Trail & Historical Data Immutability Architecture](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-005-AUDIT-INTEGRITY.md)
  - [ADR-006: Identity, Authentication & Domain Authorization Architecture](file:///c:/Users/nikhil/Desktop/projects/labos/docs/07-decisions/ADR-006-OIDC-IDENTITY.md)
- **Completed Vertical Slices:**
  - [SPEC-001: Customer Registration with Primary Contact & Audit Trail](file:///c:/Users/nikhil/Desktop/projects/labos/specs/completed/001-first-vertical-slice.md)
- **Immediate Focus:** 
  1. Maintain verification gates across all platform layers.
  2. Scope and specify next vertical slices (Sample Intake & Accessioning).
- **Constraint Reminder:** Do not begin next vertical slice implementation until specification is approved.
