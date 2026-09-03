# Specification 002: Laboratory Catalog and Versioned Test Method Foundation

- **Specification ID:** `SPEC-002`
- **Status:** Completed & Verified
- **Target Release:** Core V1 Milestone 2
- **Domain Focus:** Scientific Catalog, Versioned Test Methods & Analytical Limits (ISO/IEC 17025 Clause 7.2)
- **Prerequisites:** Platform Kernel (Phase 1 & 2A), Customer Registration (SPEC-001)

---

## 1. User Story

> **As an authorized** Quality Manager or Technical Director,  
> **I want to** define and maintain standardized Units of Measurement, Sample Matrices, Analytes, and version-controlled analytical Test Methods with exact detection/reporting limits,  
> **So that** testing requests and analytical runs are executed against strictly validated, immutable scientific methods whose historical configurations can never be silently overwritten or corrupted.

---

## 2. Why Catalog Precedes Test Requests and Accessioning

Before a customer can submit samples or request laboratory analysis, LabOS must formally know what the laboratory can test. Conflating scientific methods with sample records or hard-coding analytes into application code violates ISO/IEC 17025 and destroys data integrity.

SPEC-002 establishes:
1. **Canonical Units of Measurement:** Standard scientific symbols (`mg/L`, `µg/L`, `CFU/100mL`, `pH units`, `%`, `ppm`).
2. **Sample Types (Matrices):** Standard material categories (`Drinking Water`, `Groundwater`, `Soil`).
3. **Test Parameters (Analytes):** Standalone measured substances (`Lead`, `Arsenic`, `Nitrate`, `pH`).
4. **Test Methods (Parent Headers):** Stable identities for SOPs (`EPA 200.8`, `Standard Methods 4500-NO3 F`).
5. **Test Method Versions:** Immutable, point-in-time releases (`DRAFT` $\to$ `ACTIVE` $\to$ `SUPERSEDED` / `RETIRED`).
6. **Method-to-Parameter Configuration:** Binding analytes, units, detection limits (LOD), and reporting limits (LOQ) using exact decimal precision.
7. **Database-Level Immutability:** PostgreSQL triggers preventing mutation of non-draft scientific configurations.
8. **Four-Eyes Authorization:** Separation of duties (`created_by_user_id != approved_by_user_id`) during method activation.

---

## 3. Scope Definition

### In Scope
- Migration `0005_catalog_and_methods.sql`:
  - `units_of_measurement` (hybrid: global platform units with `laboratory_id IS NULL` + tenant custom units)
  - `sample_types` (tenant-scoped material categories)
  - `test_parameters` (tenant-scoped standalone analytes)
  - `test_methods` (stable parent headers)
  - `test_method_versions` (revisions with lifecycle state machine)
  - `method_version_parameters` (analyte limits and units configuration)
  - `method_version_sample_types` (compatible sample matrix junction)
  - PostgreSQL immutability triggers on active/superseded/retired records
  - Seed migration for platform-standard scientific units
- REST API under `/api/v1/catalog`:
  - Units: `GET /units`, `POST /units`
  - Sample Types: `GET /sample-types`, `POST /sample-types`
  - Parameters: `GET /parameters`, `POST /parameters`
  - Methods: `GET /methods`, `POST /methods`, `GET /methods/:id`, `GET /methods/:id/versions/:versionId`, `POST /methods/:id/versions`
  - Method Configuration: `PUT /methods/:id/versions/:versionId/parameters`
  - Version Lifecycle: `POST /methods/:id/versions/:versionId/activate`, `POST /methods/:id/versions/:versionId/retire`
- RBAC security (`catalog:read`, `catalog:manage`, `method:approve`, `method:retire`).
- Transactional four-eyes approval and atomic supersession.
- Append-only cryptographic audit logging.

### Out of Scope
- Test Request order logging (SPEC-003).
- Physical Sample intake and accessioning (SPEC-004).
- Instrument assignment or analytical runs (SPEC-005).
- Result calculation execution (SPEC-006).
- Frontend UI components.

---

## 4. Entity Architecture & Invariants

```text
[Laboratory]
   │ 1:N
   ├──► [units_of_measurement] (or global IS NULL)
   ├──► [sample_types]
   ├──► [test_parameters] (Standalone Analytes)
   └──► [test_methods] (Stable Header)
           │ 1:N
           └──► [test_method_versions] (Point-in-Time Immutable Release)
                   │ 1:N
                   ├──► [method_version_parameters] ──► [test_parameters]
                   │                                ──► [units_of_measurement]
                   └──► [method_version_sample_types] ──► [sample_types]
```

### Invariant Rules:
1. **Immutability Invariant:** Once a version transitions to `ACTIVE`, `SUPERSEDED`, or `RETIRED`, its parameters, limits, units, sample types, and scientific fields can never be updated or deleted. Enforced by PostgreSQL triggers.
2. **Single Active Version Invariant:** A method header can have at most one `ACTIVE` version at any time (`CREATE UNIQUE INDEX uq_method_active_version ON test_method_versions (test_method_id) WHERE status = 'ACTIVE'`).
3. **Four-Eyes Approval:** The author of a draft method version cannot be the approver who activates it (`created_by_user_id != approved_by_user_id`).
4. **Limit Invariant:** `reporting_limit >= detection_limit` and both limits must be strictly positive exact decimals (`NUMERIC(18, 8)`).
5. **Tenant Isolation:** A method cannot configure analytes, sample types, or custom units owned by a different laboratory.

---

## 5. Verification Results

All verification gates have passed:
1. `npm run typecheck`: 0 TypeScript errors.
2. `npm run lint`: 0 ESLint errors/warnings.
3. `npm run format:check`: 100% Prettier conformity.
4. `npm run test`: All 9 test suites (52 unit tests) passed.
5. `npm run test:integration`: All 8 test suites (49 integration tests) passed on real PostgreSQL, including all 17 mandated SPEC-002 verification scenarios.
6. `npm run test:all`: All 17 test suites (101 tests) passing.
7. `npm run build`: Production build cleanly emitted to `dist/`.
