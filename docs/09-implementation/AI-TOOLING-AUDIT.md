# LabOS — AI Tooling & Environment Audit

**Document ID:** TOOLING-AUDIT-001  
**Phase:** Pre-Phase 1 Implementation Gate  
**Status:** Complete  
**Date:** 2026-09-03  
**Auditor:** Antigravity AI Engineering Assistant  
**Target Environment:** LabOS Backend (TypeScript / NestJS / PostgreSQL / ISO 17025)

---

## 1. Executive Summary

This audit evaluates the active Antigravity AI engineering environment (`C:\Users\nikhil\.gemini\config` and `c:\Users\nikhil\Desktop\projects\labos\.agents`) prior to beginning feature development on **SPEC-001 (Customer Registration & Audit Trail)**.

The current environment contains:
- **10 installed plugins** (exposing 106 skills)
- **6 standalone global skills**
- **4 global subagent definitions**
- **0 configured MCP servers** (`mcp_config.json` is empty)
- **0 workspace-specific skills** (`.agents/` not yet created)

### Key Audit Findings:
1. **High-Value Quality & Security Foundations Already Present:** The 6 standalone global skills (`review`, `security-review`, `verification`, `implement`, `debug`, `debugging`) and 4 subagents (`reviewer`, `verifier`, `architect`, `researcher`) are top-tier engineering assets. They directly support LabOS architectural invariants, code quality, and adversarial verification.
2. **Substantial Context Clutter from Unrelated Stacks:** More than 80% of currently installed plugin skills belong to Flutter/Dart, Android CLI, BigQuery/GCP data warehousing, and Firebase. These increase prompt token consumption and risk generating irrelevant abstractions. They should be strictly avoided during LabOS development.
3. **Missing Core Backend & Scientific Capabilities:** The environment has no skills for NestJS modular architecture, PostgreSQL transaction management, database migration safety, Vitest/PostgreSQL testing, exact decimal math (`decimal.js`), RFC 7807 API design, or ISO 17025 audit trail immutability.
4. **Actionable Roadmap:** 7 dedicated, lightweight workspace skills should be added directly under `labos/.agents/skills/` to provide repeatable runbooks for LabOS engineers and AI agents without polluting global user configurations.

---

## 2. Current Environment Inventory

### 2.1 Workspace Configuration (`labos/.agents`)
* **Status:** Empty / Not initialized.
* **Impact:** No workspace-specific skills, project rules, or local MCP configurations currently exist.

### 2.2 Global Configuration (`C:\Users\nikhil\.gemini\config`)
* **Installed Plugins (`plugins/`):**
  1. `android-cli-plugin` (1 skill: `android-cli`)
  2. `chrome-devtools-plugin` (5 skills: `chrome-devtools`, `a11y-debugging`, `debug-optimize-lcp`, `memory-leak-debugging`, `troubleshooting`)
  3. `data-agent-kit-plugin` (25 skills: BigQuery, dbt, Dataform, Spark, Composer, Beam, GCS)
  4. `firebase` (11 skills: Firestore, Firebase Auth, App Hosting, Remote Config, Security Rules)
  5. `flutter` (22 skills: Dart testing, Flutter widgets, layout, routing, ffigen)
  6. `gemini-api` (2 skills: `gemini-interactions-api`, `gemini-live-api-dev`)
  7. `google-antigravity-sdk` (1 skill: `google-antigravity-sdk`)
  8. `google_maps_platform` (1 skill: `google-maps-platform`)
  9. `modern-web-guidance-plugin` (2 skills: `modern-web-guidance`, `chrome-extensions`)
  10. `science` (38 skills: bioinformatics databases, molecular modeling, literature search)
* **Standalone Skills (`skills/`):**
  - `debug` & `debugging`: Structured troubleshooting workflow (Reproduce → Trace → Root Cause → Fix → Verify).
  - `implement`: Feature development lifecycle (Understand → Explore → Plan → Implement → Verify → Review).
  - `review`: Multi-phase adversarial code review (Diff, Correctness, Reliability, Security, Maintainability).
  - `security-review`: Security audit runbook (secrets, injection, auth, input validation).
  - `verification`: Strongest available verification selection and gate enforcement.
* **Global Agents (`agents/`):**
  - `architect.md`: Architecture design and module boundary oversight.
  - `researcher.md`: Codebase and documentation discovery.
  - `reviewer.md`: Adversarial code review subagent.
  - `verifier.md`: Test execution and proof verification subagent.
* **MCP Server Configuration (`mcp_config.json`):** Empty (0 bytes).

---

## 3. Tooling Categorization

### 3.1 Category 1: KEEP — Genuinely Useful for LabOS

These tools and skills directly enforce LabOS quality, security, and verification requirements.

| Tool / Skill / Agent | Source | Why It Must Be Kept | Scope |
| :--- | :--- | :--- | :--- |
| `review` | Global (`skills/review`) | Multi-phase adversarial diff audits covering correctness, reliability, security, maintainability, and regression detection. | Global |
| `security-review` | Global (`skills/security-review`) | Directly enforces LabOS security invariants: secret leakage prevention, parameterized SQL queries, server-side authorization, and safe deserialization. | Global |
| `verification` | Global (`skills/verification`) | Mandates execution of the strongest available verification before any task is marked complete. | Global |
| `implement` | Global (`skills/implement`) | Enforces structured execution: Explore → Plan → Implement → Verify → Review. | Global |
| `debug` & `debugging` | Global (`skills/debug*`) | Systematic symptom-to-root-cause troubleshooting runbooks. | Global |
| `reviewer.md` (Agent) | Global (`agents/reviewer.md`) | Pro-model adversarial review subagent operating in a sandbox. | Global |
| `verifier.md` (Agent) | Global (`agents/verifier.md`) | Autonomous test executor and proof verifier. | Global |
| `architect.md` (Agent) | Global (`agents/architect.md`) | Ensures modular monolithic boundaries and ADR compliance. | Global |
| `chrome-devtools` | Plugin (`chrome-devtools-plugin`) | Essential for future frontend browser interaction, accessibility audits, and memory leak analysis. (Retain for Phase 2). | Global |

---

### 3.2 Category 2: REMOVE / AVOID — Redundant, Irrelevant, or Low Value for LabOS

These plugins belong to completely different technology stacks or cloud database ecosystems. They should be avoided or disabled during LabOS backend engineering to reduce prompt overhead and prevent hallucinations.

| Plugin / Skill | Source | Why It Should Be Avoided / Removed for LabOS | Risk Level | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| `flutter` (22 skills) | Global Plugin | LabOS backend is TypeScript/NestJS, and future frontend is modern Web (React/Vite). Dart and Flutter mobile tools are completely irrelevant. | Low | **Avoid / Disable for LabOS** |
| `android-cli-plugin` (1 skill) | Global Plugin | LabOS does not target native Android APKs. | Low | **Avoid / Disable for LabOS** |
| `data-agent-kit-plugin` (25 skills) | Global Plugin | BigQuery, dbt, Spark, Dataproc, and Dataform are OLAP/analytics data warehousing tools. LabOS uses PostgreSQL as its authoritative OLTP transactional system of record (*ADR-003*). Risk of generating cloud pipeline boilerplate instead of relational PostgreSQL migrations. | Medium | **Avoid / Disable for LabOS** |
| `firebase` (11 skills) | Global Plugin | LabOS mandates PostgreSQL and standards-based OpenID Connect (*ADR-003*, *ADR-006*). Firebase Auth and Firestore NoSQL violate our architectural decisions. | High (architectural drift) | **Avoid / Disable for LabOS** |
| `google_maps_platform` (1 skill) | Global Plugin | Mapping SDKs are irrelevant for Core V1 sample-to-report laboratory workflows. | Low | **Avoid** |
| `science` (38 skills) | Global Plugin | While LabOS is a laboratory system, these 38 skills focus on bioinformatics (AlphaFold, UniProt, PDB, variant calling) and academic literature retrieval. LabOS Core V1 targets ISO/IEC 17025 chemical and food safety testing (sample intake, aliquoting, calibration, result calculation, CoA reporting). | Low | **Keep dormant; avoid invoking during Core V1** |

---

### 3.3 Category 3: MISSING — Critical Capabilities to Add

The following capabilities are currently absent from the environment and should be created as **LabOS Workspace Skills** under `c:\Users\nikhil\Desktop\projects\labos\.agents\skills\`.

#### 1. `nestjs-modular-monolith`
* **Capability:** NestJS architectural patterns and modular encapsulation.
* **Why Useful:** Enforces strict `@Module()` boundaries, prevents cross-module database imports, standardizes dependency injection, and ensures strict TypeScript compilation.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/nestjs-modular-monolith/`).

#### 2. `postgres-transactions`
* **Capability:** Safe PostgreSQL transaction orchestration and connection pool management.
* **Why Useful:** LabOS requires multi-entity atomic transactions (e.g., Customer + Primary Contact + Audit Log in SPEC-001). This skill guides agents to pass transactional clients correctly, prevent connection leaks, and avoid deadlocks.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/postgres-transactions/`).

#### 3. `database-migrations`
* **Capability:** Versioned SQL migration development, rollback testing, and schema integrity.
* **Why Useful:** Guides agents to author pure, idempotent, reversible SQL migration scripts with SHA-256 checksums under `src/core/database/migrations/`, respecting relational foreign keys.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/database-migrations/`).

#### 4. `backend-testing-vitest`
* **Capability:** Comprehensive unit and integration testing patterns with Vitest and real PostgreSQL.
* **Why Useful:** Standardizes test structure, ephemeral PostgreSQL cluster management (`test/helpers/global-setup.ts`), Supertest HTTP assertions, and test isolation. Prohibits SQLite mocks.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/backend-testing-vitest/`).

#### 5. `scientific-decimal-rigor`
* **Capability:** Exact decimal calculation patterns using `decimal.js`.
* **Why Useful:** Enforces *ADR-002* prohibiting native JavaScript floating-point math (`0.1 + 0.2`). Guides calibration curves, limits of detection (LOD), significant digits, and regulatory rounding.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/scientific-decimal-rigor/`).

#### 6. `rfc7807-api-design`
* **Capability:** RESTful API conventions with RFC 7807 Problem Details and UUIDv7.
* **Why Useful:** Standardizes request correlation IDs (`X-Correlation-ID`), machine-readable error codes, HTTP status mapping, and OpenAPI specification alignment.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/rfc7807-api-design/`).

#### 7. `audit-trail-integrity`
* **Capability:** Append-only ledger logging and cryptographic hash chaining (*ADR-005*).
* **Why Useful:** Enforces the 5 W's of laboratory auditing (Who, What, When, Where, Why), deterministic event serialization, and tamper-evident SHA-256 state tracking.
* **Risk Level:** Low.
* **Scope:** LabOS Workspace (`.agents/skills/audit-trail-integrity/`).

---

## 4. MCP Server Recommendations

Model Context Protocol (MCP) servers allow Antigravity to interact securely with external tools and services. Currently, `mcp_config.json` is empty.

### Recommended MCP Servers to Evaluate:

| MCP Server | Source / Package | Purpose | Risk Level | Scope | Recommended? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL Inspector** | `@modelcontextprotocol/server-postgres` | Provides real-time inspection of database schemas, table indexes, column constraints, and query execution plans (`EXPLAIN ANALYZE`). | Low (if read-only credentials are used) | LabOS Workspace | **Yes (Recommended for Phase 1)** |
| **GitHub Operations** | `@modelcontextprotocol/server-github` | Automates repository branch status, issue updates, pull request drafting, and commit synchronization. | Low (requires personal access token) | Global or Workspace | **Yes (Optional convenience)** |
| **Memory / Graph** | `@modelcontextprotocol/server-memory` | Stores persistent architectural decisions and relationship graphs across long-running sessions. | Low | Global | **No (LabOS already uses authoritative markdown docs in `docs/`)** |

---

## 5. Detailed Recommendation Matrix

| Capability | Existing Tool/Skill | Source / Repository | Why It Is Useful | Risk Level | Recommended Scope | Install / Configure? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Code Review** | `review`, `reviewer.md` | Global (`skills/review`, `agents/reviewer.md`) | Multi-lens adversarial verification of diffs before commit. | Low | Global | **Keep Active** |
| **Security Audit** | `security-review` | Global (`skills/security-review`) | Verifies parameterization, no secret leaks, auth guards. | Low | Global | **Keep Active** |
| **Verification Gate** | `verification`, `verifier.md` | Global (`skills/verification`, `agents/verifier.md`) | Ensures automated tests and gates pass before completion. | Low | Global | **Keep Active** |
| **Debugging** | `debug`, `debugging` | Global (`skills/debug`, `skills/debugging`) | Root cause analysis runbooks. | Low | Global | **Keep Active** |
| **NestJS / TypeScript** | None | LabOS Custom Skill | Enforces module boundaries and strict DI rules. | Low | LabOS Workspace | **Create Skill** |
| **PostgreSQL & ACID** | None (only BigQuery/GCP) | LabOS Custom Skill | Enforces atomic transactions and connection safety. | Low | LabOS Workspace | **Create Skill** |
| **Database Migrations** | None | LabOS Custom Skill | Reversible, versioned SQL migrations with checksums. | Low | LabOS Workspace | **Create Skill** |
| **Backend Testing** | None (only Dart/Flutter) | LabOS Custom Skill | Vitest, real PostgreSQL cluster, Supertest patterns. | Low | LabOS Workspace | **Create Skill** |
| **Scientific Math** | None | LabOS Custom Skill | Arbitrary-precision decimal calculations (`decimal.js`). | Low | LabOS Workspace | **Create Skill** |
| **API Error Handling** | None | LabOS Custom Skill | RFC 7807 Problem Details and correlation tracking. | Low | LabOS Workspace | **Create Skill** |
| **Audit Ledger** | None | LabOS Custom Skill | SHA-256 hash chaining and 5 W's compliance. | Low | LabOS Workspace | **Create Skill** |
| **PostgreSQL MCP** | None | `@modelcontextprotocol/server-postgres` | Live read-only schema and index inspection. | Low | LabOS Workspace | **Evaluate & Configure** |

---

## 6. Actionable Conclusion & Next Steps

1. **Immediate Execution Readiness:** The existing global quality and review skills (`review`, `security-review`, `verification`, `implement`) are completely sufficient to safely govern the implementation of **SPEC-001 (Customer Registration & Audit Trail)** right now.
2. **Recommended Workspace Skills Setup:** We should scaffold the 7 missing LabOS-specific skills under `.agents/skills/` in the workspace to give any AI agent clear, repeatable runbooks for NestJS, PostgreSQL transactions, migrations, and exact scientific decimals.
3. **No Unsafe Dependencies:** No external third-party packages or unsafe global plugins need to be installed at this stage.
