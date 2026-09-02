# LabOS — Domain Module Boundaries

This document defines the domain module architecture for the **LabOS Modular Monolith**. It establishes strict boundaries, entity ownership, and interface contracts to prevent tight coupling and spaghetti dependencies.

---

## 1. Module Boundary Overview

The system is decomposed into **9 cohesive domain modules** inside the NestJS application:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          LabOS Modular Monolith                         │
│                                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   identity   │  │ organization │  │   customer   │  │   catalog    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                 │                 │                 │         │
│  ───────┴─────────────────┴─────────────────┴─────────────────┴──────── │
│                      Core Workflow Modules                              │
│  ────────────────────────────────────────────────────────────────────── │
│         │                                                     │         │
│  ┌──────┴───────┐  ┌──────────────┐  ┌──────────────┐  ┌──────┴───────┐ │
│  │    sample    │─►│   testing    │─►│    result    │─►│    report    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                                         │
│  ────────────────────────────────────────────────────────────────────── │
│                      Cross-Cutting Ledger Subsystem                     │
│  ────────────────────────────────────────────────────────────────────── │
│                                                                         │
│                            ┌──────────────┐                             │
│                            │    audit     │                             │
│                            │ (Append-Only)│                             │
│                            └──────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Module Responsibilities & Entity Ownership

### 1. `identity` Module
* **Core Responsibility:** Validates external OpenID Connect (OIDC) tokens, maps external Subject IDs to internal `User` records, and evaluates laboratory Role-Based Access Control (RBAC) permissions.
* **Owned Entities:** `User`, `Role`, `Permission`.
* **Inbound Dependencies:** None (foundational).
* **Key Invariant:** Never stores user passwords or manages external login sessions.

### 2. `organization` Module
* **Core Responsibility:** Governs laboratory legal identity, accreditation scope, and physical testing sites.
* **Owned Entities:** `Laboratory`, `Laboratory Site` (and `Organization` in Future phases).
* **Inbound Dependencies:** `identity`.
* **Key Invariant:** Every testing activity must be mapped to an accredited `Laboratory Site`.

### 3. `customer` Module
* **Core Responsibility:** Manages commercial clients, customer contacts, billing profiles, and contract agreements.
* **Owned Entities:** `Customer`, `Contact`.
* **Inbound Dependencies:** `identity`.
* **Key Invariant:** Customer accounts cannot be hard-deleted if associated with active or historical test requests.

### 4. `catalog` Module
* **Core Responsibility:** The scientific reference library. Manages standardized standard operating procedures (SOPs), test methods, analytes, units of measurement, and specification limits.
* **Owned Entities:** `Test Method`, `Test Parameter`, `Sample Type`, `Unit of Measurement`, `Specification Limit`.
* **Inbound Dependencies:** `identity`.
* **Key Invariant:** Catalog methods cannot be modified or deleted if referenced by historical tests; changes must spawn new method versions.

### 5. `sample` Module
* **Core Responsibility:** Governs physical intake, accessioning, barcode scanning, container condition checks, aliquot splitting, and sample lifecycle state machine.
* **Owned Entities:** `Test Request`, `Sample`, `Sample Item` (Aliquot).
* **Inbound Dependencies:** `identity`, `customer`, `catalog`.
* **Key Invariant:** An accession number is immutable once registered. If temperature or preservation is nonconforming, a qualified condition flag is mandatory.

### 6. `testing` Module
* **Core Responsibility:** Analytical scheduling, batch creation, bench assignment, and instrument linkage.
* **Owned Entities:** `Test`, `Analytical Batch`, `Instrument`, `Quality Control`.
* **Inbound Dependencies:** `identity`, `sample`, `catalog`.
* **Key Invariant:** A batch cannot exceed regulatory capacity (e.g., maximum 20 customer samples per ISO 17025 batch).

### 7. `result` Module
* **Core Responsibility:** Scientific computation, exact decimal calculations, dilution factor application, detection limit flagging (`< LOQ`), and technical peer review.
* **Owned Entities:** `Result`, `Result Version`.
* **Inbound Dependencies:** `identity`, `testing`, `catalog`.
* **Key Invariant:** **No native JavaScript floating-point calculations.** Raw measurements are converted using exact decimal libraries. Result updates always generate a new `Result Version`.

### 8. `report` Module
* **Core Responsibility:** Certificate of Analysis (CoA) compilation, four-eyes authorization sign-off, immutable PDF rendering, and post-release amendment workflows.
* **Owned Entities:** `Report`, `Report Version`.
* **Inbound Dependencies:** `identity`, `sample`, `result`, `organization`.
* **Key Invariant:** Published reports are sealed and immutable. Corrections require issuing a new `Report Version` with an explicit amendment notice.

### 9. `audit` Module
* **Core Responsibility:** Append-only event ledger capturing all state-altering events across all modules with deterministic canonical JSON serialization and SHA-256 hash chaining.
* **Owned Entities:** `Audit Event`.
* **Inbound Dependencies:** Cross-cutting (invoked by domain services inside existing database transactions).
* **Key Invariant:** Zero update and delete operations. If an audit write fails, the entire business transaction rolls back.

---

## 3. Inter-Module Communication Rules

1. **No Cross-Module Database Joins:** A service in the `sample` module must not directly execute SQL queries against tables owned by the `result` module. 
2. **Public Service Interfaces:** Modules interact strictly via exported, strongly typed NestJS service interfaces (e.g., `ResultService.getApprovedResultsBySampleId(sampleId)`).
3. **In-Process Domain Events:** Long-running or non-blocking side effects (such as sending a customer email alert or logging an audit event) are triggered using in-process domain events (e.g., `SampleRegisteredEvent`).
4. **Shared Database Transactions:** When a workflow spans two modules (e.g., accessioning a sample and logging its initial audit event), both operations execute within the same PostgreSQL ACID transaction context.
