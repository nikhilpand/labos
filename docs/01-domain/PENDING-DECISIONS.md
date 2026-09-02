# LabOS — Pending Domain Decisions Requiring Approval

This document registers the top genuine domain and architectural decisions that require stakeholder approval before Phase 1 implementation begins.

---

## Decision 1: Accession Number Sequencing Format

### Question
What should be the canonical structure and scope of the human-readable accession number assigned to physical samples during intake?

### Recommended Option
**Global Annual Sequential Format (`SAM-YYYY-00001`).**
* Every sample receives a global, zero-padded annual sequence (e.g., `SAM-2026-00001`, `SAM-2026-00002`).

### Alternatives
* **Option B (Customer-Prefixed):** Format includes client code (e.g., `ACME-2026-00001`).
* **Option C (Date-Based Julian Format):** Format encodes Julian day (e.g., `26246-001`).

### Consequences
* **Recommended:** Clean, standardized barcode generation, fixed length, eliminates customer code collisions.
* **Option B:** Reveals client identity in raw barcodes, complicating blind sample testing.
* **Option C:** Shorter, but less human-intuitive.

### Default if No Decision Made
**`SAM-YYYY-00001`** will be adopted as the default system sequence.

---

## Decision 2: Electronic Signature Re-Authentication Requirement in Core V1

### Question
Under ISO/IEC 17025 (and future 21 CFR Part 11), does final managerial authorization of a report require the user to re-enter their credentials/password at the moment of signing, or is an active authenticated OIDC session token sufficient for Core V1?

### Recommended Option
**Active Session Token Verification with Explicit Audit Capture for Core V1.**
* The user must possess the `report:authorize` role. Authorization generates an audit record stamping their `user_id`, timestamp, and IP. Password re-entry is deferred to the 21 CFR Part 11 extension module.

### Alternatives
* **Option B (Strict Re-Authentication):** Force the user to re-authenticate against Keycloak / OIDC identity provider before every report release.

### Consequences
* **Recommended:** Streamlines analyst workflow and eliminates complex OIDC prompt re-auth in initial frontend/backend scaffolding. Fully compliant with ISO/IEC 17025:2017.
* **Option B:** Necessary for FDA pharmaceutical batch release (21 CFR Part 11), but creates high friction for environmental/commercial labs release cadence.

### Default if No Decision Made
**Active Session Token Verification** will be adopted for Core V1.

---

## Decision 3: Non-Detected Result (< LOQ) Storage & Representation

### Question
When an analyte is below the Limit of Quantitation (e.g., Lead is not detected above the method LOQ of `0.005 mg/L`), how should the numerical value and qualifier be stored in `Result Version`?

### Recommended Option
**Null Numeric Value with Explicit Boolean and Qualifier Flags.**
* `numeric_value = null`
* `is_below_detection_limit = true`
* `qualifier = 'U'` (Undetected)
* `reported_display_value = "< 0.005 mg/L"` (rendered using the parameter's active LOQ).

### Alternatives
* **Option B (Store the LOQ as the number):** `numeric_value = 0.005`, `qualifier = '<'`.
* **Option C (Store Zero):** `numeric_value = 0.0000`.

### Consequences
* **Recommended:** Prevents false mathematical averaging (storing `0.005` can corrupt automated mean calculations in statistical packages). Cleanly separates exact measurements from detection flags.
* **Option B:** High risk of downstream statistical skew.
* **Option C:** Scientifically invalid (measuring `< 0.005` does not prove the concentration is `0.0000`).

### Default if No Decision Made
**Null Numeric Value with `is_below_detection_limit = true` and `qualifier = 'U'`** will be adopted.

---

## Decision 4: Multi-Sample Test Request Partial Completion Rules

### Question
If a customer submits a Test Request containing 5 samples, and 1 sample is broken/rejected during accessioning while 4 are tested successfully, how does the parent `Test Request` transition?

### Recommended Option
**Partial Progress with Independent Sample Reporting.**
* The Test Request remains `IN_PROGRESS` as long as at least one active sample is being tested. The rejected sample is marked `REJECTED` with an audit reason. The Test Request reaches `COMPLETED` when all non-rejected samples have published reports.

### Alternatives
* **Option B (Atomic All-or-Nothing):** Any rejection voids the entire work order, requiring customer re-submission.
* **Option C (Order Splitting):** Automatically split the rejected sample into a new separate work order.

### Consequences
* **Recommended:** Matches physical commercial reality without generating ghost paperwork.
* **Option B:** Causes severe customer service friction for innocent shipping accidents.
* **Option C:** Complicates billing and purchase order cross-referencing.

### Default if No Decision Made
**Partial Progress with Independent Sample Reporting** will be adopted.

---

## Decision 5: Four-Eyes Principle Enforcement in Local Development Mode

### Question
ISO/IEC 17025 mandates the Four-Eyes Principle (the person who enters results cannot be the sole person who authorizes the report). Should this rule be strictly enforced even during single-user local development?

### Recommended Option
**Enforced by Default with an Explicit Environment Bypass Flag for Dev/Test.**
* In production, the system strictly blocks self-authorization (`entered_by_user_id !== authorized_by_user_id`).
* In local development, an environment variable `BYPASS_FOUR_EYES_FOR_DEV=true` allows solo developers to test the full pipeline using a single test account.

### Alternatives
* **Option B (Strict Always):** Require the developer to log in with two separate accounts to test any sample workflow locally.
* **Option C (No Enforcement in V1):** Defer Four-Eyes rule enforcement to V2.

### Consequences
* **Recommended:** Maximizes developer velocity and automated test execution speed while guaranteeing production compliance.
* **Option B:** Slows down local testing and requires managing multiple test user sessions.
* **Option C:** Violates core ISO 17025 review integrity in initial architecture.

### Default if No Decision Made
**Enforced by Default with Dev Bypass Flag** will be adopted.
