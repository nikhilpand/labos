# ADR-005: Audit Trail & Historical Data Immutability Architecture

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

In regulated scientific environments (ISO/IEC 17025, ISO 15189, GxP, and 21 CFR Part 11), an audit trail is not merely a debugging log—it is a legal and scientific instrument of proof. 

Standard application logs and simple database update timestamps are insufficient for scientific integrity because:
1. Normal database operations (`UPDATE` and `DELETE`) silently obliterate past states.
2. Standard logging tables can be casually truncated, updated, or manipulated by privileged users or administrative scripts without detection.
3. Auditors must be able to verify whether any record in history has been altered or omitted.

---

## Options Considered

1. **Standard Application-Level Log Tables:** Recording logs via application logic. Readily vulnerable to accidental deletion, modification, or bypass by direct SQL queries.
2. **Database Triggers Writing to Standard Tables:** Triggers prevent application-level bypass, but logs remain vulnerable to direct administrative modification.
3. **External Log Ingestion (e.g., CloudWatch, Elasticsearch):** Separates logs from the primary database, but introduces network failure risks (partial writes where the entity changes but the log fails to deliver).
4. **Append-Only Relational Ledger with Cryptographic Integrity Verification (Chosen):** Dedicated append-only tables protected against updates/deletions, with cryptographic hash chaining to make historical alteration immediately detectable.

---

## Decision

**LabOS will use an append-only, tamper-evident audit architecture.**

The audit trail will be modeled as a permanent, immutable event ledger within the primary PostgreSQL system of record.

### Mandatory Requirements:
1. **Append-Only Invariance:** Audit events are strictly append-only. Normal application operations (`UPDATE` and `DELETE`) are structurally prevented at the database and application levels.
2. **Core Audit Event Schema:** Every audit event must capture:
   - **Actor:** Authenticated identity (user ID, system agent ID, or automated process) responsible for the action.
   - **Timestamp:** High-precision, immutable UTC timestamp.
   - **Action:** Explicit domain verb (e.g., `SAMPLE_ACCESSIONED`, `RESULT_AMENDED`, `RUN_INVALIDATED`).
   - **Affected Entity:** Target domain entity type (e.g., `Sample`, `Batch`, `AssayResult`).
   - **Entity Identifier:** Stable UUID of the affected entity.
   - **Correlation Identifier:** Identifier linking related multi-step operations (e.g., a batch operation touching 96 well results).
   - **Reason for Change:** Mandatory structured justification for any modification, recalculation, re-run, or invalidation of scientific data.
   - **Previous & New State Representation:** Structured serialization (JSON representation) capturing the before-and-after state diff where appropriate.
3. **Deterministic Event Representation:** Audit payloads must be serialized in a deterministic, canonical representation (e.g., canonical JSON with sorted keys) so that digital signatures or hashes are perfectly reproducible.
4. **Cryptographic Integrity Verification:** Each audit record will incorporate cryptographic verification mechanisms (such as SHA-256 hash chaining, where each record incorporates the cryptographic hash of the immediately preceding record: `hash = SHA256(previous_hash + canonical_event_data)`).

### Realistic Security Posture: Tamper-Evident, Not "Untamperable"
We do **not** claim that this system is "absolutely impossible to tamper with." A hostile actor with physical storage access or root database administrative credentials could theoretically alter raw storage sectors. 

Rather, **the explicit design goal is tamper-evidence and independent verifiability**:
- Any alteration, insertion, or deletion of a historical record breaks the cryptographic chain at that exact point.
- Auditors can independently verify the unbroken continuity of the entire audit trail with a lightweight mathematical verification script.

### Phasing Note
**The audit system is not being implemented at this time.** This ADR establishes the architectural foundation and future design direction. Implementation will occur in a dedicated, planned phase.

---

## Rationale

- **Uncompromising Traceability:** Satisfies the "5 W's" of regulatory auditing (Who, What, When, Where, Why) directly in the database.
- **Scientific Trust:** Scientific results can be defended in legal, clinical, and regulatory inquiries because any historical tampering is mathematically detectable.
- **Transactional Integrity:** Placing the append-only audit events inside the primary PostgreSQL database guarantees that the business entity change and its audit record succeed or fail together inside the same atomic ACID transaction.

---

## Consequences

### Positive
- Fully auditable lifecycle for all samples, batches, and scientific measurements.
- Mathematical proof of history continuity.
- Architecture designed to facilitate regulatory readiness for ISO/IEC 17025 and 21 CFR Part 11.

### Negative
- Higher database storage footprint over time (mitigated by table partitioning and cold storage archival strategies).
- Requires developers to write explicit amendment workflows rather than relying on in-place edits.

---

## Explicit Non-Goals

- Implementing a public or private blockchain or distributed ledger technology.
- Claiming mathematical impossibility of physical data manipulation.
- Writing audit implementation code during Phase 0.

---

## Reconsideration Criteria

This decision will be reconsidered only if formal regulatory standards mandate a specific hardware-security-module (HSM) or third-party write-once-read-many (WORM) storage appliance integration.
