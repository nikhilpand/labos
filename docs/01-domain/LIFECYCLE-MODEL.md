# LabOS — De-coupled Lifecycle State Machines

To prevent data corruption, tight coupling, and workflow deadlocks, **LabOS separates laboratory lifecycles into four distinct, independent state machines**:

1. **Physical Sample Lifecycle:** Tracks physical matter, containers, integrity, and disposal.
2. **Test / Analysis Lifecycle:** Tracks laboratory bench assignments, instrument runs, and work queues.
3. **Result Lifecycle:** Tracks scientific measurement maturity, calculation validation, and amendments.
4. **Report Lifecycle:** Tracks legal Certificate of Analysis (CoA) compilation, authorization, and release.

```text
┌────────────────────────────────────────────────────────────────────────┐
│               FOUR DE-COUPLED LABORATORY LIFECYCLES                    │
│                                                                        │
│   [ Physical Sample ]                                                  │
│   EXPECTED ──► RECEIVED ──► ACCESSIONED / QUALIFIED ──► DISPOSED       │
│                                 │                                      │
│                                 │ schedules                            │
│   [ Test / Analysis ]           ▼                                      │
│   SCHEDULED ──────────────► IN_PROGRESS ─────────────► COMPLETED       │
│                                                         │              │
│                                                         │ produces     │
│   [ Result ]                                            ▼              │
│   DRAFT ──────► ENTERED ──► TECHNICALLY_REVIEWED ────► AUTHORIZED      │
│                                                         │              │
│                                                         │ compiles     │
│   [ Report ]                                            ▼              │
│   DRAFT ──────────────► PENDING_AUTHORIZATION ───────► RELEASED        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Physical Sample Lifecycle

Governs the custody, physical condition, and storage of physical specimens per **ISO/IEC 17025:2017 Clause 7.4**.

### States
* `EXPECTED`: Test Request logged in advance; physical container has not yet arrived.
* `RECEIVED`: Package delivered to intake dock; receipt timestamp and parcel condition logged.
* `ACCESSIONED`: Inspected, verified intact, temperature compliant, accession barcode applied.
* `QUALIFIED`: Sample accepted with documented condition anomalies (e.g., received at $12^\circ\text{C}$); customer agreed to proceed; mandatory report disclaimer locked.
* `REJECTED`: Non-conforming sample (broken container, severe leakage, client refusal); no testing permitted.
* `IN_STORAGE`: Placed in cold-room or shelf location awaiting/between tests.
* `DISPOSED`: Retention period expired; sample physically neutralized, discarded, or returned.

### Transitions & Triggers

| From State | To State | Trigger | Role | Reason Mandatory? | Audit Event |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `EXPECTED` | `RECEIVED` | Parcel scanned at dock | Sample Accessioner | No | `SAMPLE_PARCEL_RECEIVED` |
| `RECEIVED` | `ACCESSIONED` | Inspection passes | Sample Accessioner | No | `SAMPLE_ACCESSIONED` |
| `RECEIVED` | `QUALIFIED` | Anomaly accepted by client | Sample Accessioner / QA | **YES** | `SAMPLE_CONDITION_QUALIFIED` |
| `RECEIVED` | `REJECTED` | Unusable / client rejects | Sample Accessioner / QA | **YES** | `SAMPLE_REJECTED` |
| `ACCESSIONED` / `QUALIFIED` | `IN_STORAGE` | Placed in storage bin | Sample Custodian | No | `SAMPLE_LOCATION_UPDATED` |
| `IN_STORAGE` | `DISPOSED` | Retention time elapsed | Sample Custodian | No | `SAMPLE_DISPOSED` |

### Invariant Rules
* **Invalid Transitions:** A `REJECTED` or `DISPOSED` sample can never transition to `IN_PROGRESS` testing.
* **Terminal States:** `REJECTED`, `DISPOSED`.
* **Disposal Guard:** A sample cannot be marked `DISPOSED` if any associated Test is still `IN_PROGRESS` or Result is `DRAFT`.

---

## 2. Test / Analysis Lifecycle

Governs the execution of an assigned analytical standard operating procedure (SOP) on a sample.

### States
* `SCHEDULED`: Test assigned to a specific method, instrument, and analyst queue.
* `IN_PROGRESS`: Chemical preparation, digestion, or instrument run actively underway.
* `COMPLETED`: All parameter measurements entered and ready for review.
* `REPEAT_REQUIRED`: Technical review identified an analytical failure; re-test mandated.
* `CANCELLED`: Test aborted prior to analytical completion.

### Transitions & Triggers

| From State | To State | Trigger | Role | Reason Mandatory? | Audit Event |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `SCHEDULED` | `IN_PROGRESS` | Analyst starts prep/run | Assigned Analyst | No | `TEST_STARTED` |
| `IN_PROGRESS` | `COMPLETED` | All results entered | Assigned Analyst | No | `TEST_COMPLETED` |
| `COMPLETED` | `REPEAT_REQUIRED` | QC / peer review failure | Technical Reviewer | **YES** | `TEST_REPEAT_ORDERED` |
| `REPEAT_REQUIRED`| `SCHEDULED` | Re-analysis queued | Lab Supervisor | **YES** | `TEST_RESCHEDULED` |
| `SCHEDULED` / `IN_PROGRESS` | `CANCELLED` | Client or lab cancels | Lab Supervisor / QA | **YES** | `TEST_CANCELLED` |

### Invariant Rules
* **Invalid Transitions:** A `CANCELLED` test cannot transition to `COMPLETED`.
* **Terminal States:** `COMPLETED`, `CANCELLED`.
* **Repeat Protocol:** If a test requires repetition due to preparation failure, a new child `Test` is spawned to preserve historical traceability; the original test is marked `REPEAT_REQUIRED`.

---

## 3. Result Lifecycle

Governs individual scientific analyte measurements and numerical integrity per **ADR-002, ADR-003, and ADR-005**.

### States
* `DRAFT`: Initial decimal entry; editable by the assigned analyst.
* `ENTERED`: Analyst submitted result for independent technical verification.
* `TECHNICALLY_REVIEWED`: Peer analyst verified calibration, raw data, dilution factors, and batch QC.
* `AUTHORIZED`: Authorized signatory approved result for official inclusion on a Certificate of Analysis.
* `AMENDED`: Result corrected post-authorization; spawns an immutable `Result Version` (Rev > 1).
* `INVALIDATED`: Result formally retracted due to proven instrument or contamination failure.

### Transitions & Triggers

| From State | To State | Trigger | Role | Reason Mandatory? | Audit Event |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `DRAFT` | `ENTERED` | Analyst finalizes entry | Assigned Analyst | No | `RESULT_ENTERED` |
| `ENTERED` | `TECHNICALLY_REVIEWED` | Peer validates data | Peer Analyst / Chemist | No | `RESULT_TECH_REVIEWED` |
| `ENTERED` | `DRAFT` | Peer rejects entry | Peer Analyst / Chemist | **YES** | `RESULT_REJECTED_TO_DRAFT` |
| `TECHNICALLY_REVIEWED` | `AUTHORIZED` | Sign-off issued | Technical Director | No | `RESULT_AUTHORIZED` |
| `AUTHORIZED` | `AMENDED` | Post-approval correction | Technical Director / QA | **YES** | `RESULT_AMENDED` |
| `ENTERED` / `AUTHORIZED` | `INVALIDATED` | Confirmed false data | Quality Assurance | **YES** | `RESULT_INVALIDATED` |

### Invariant Rules
* **Four-Eyes Rule:** The user who moved a result to `ENTERED` **cannot** perform the transition to `TECHNICALLY_REVIEWED`.
* **Immutability of Values:** Numerical values are **never updated in-place**. Any change after `ENTERED` spawns a new `Result Version` record.
* **Terminal States:** `AUTHORIZED` (active), `AMENDED` (superseded historic version), `INVALIDATED`.

---

## 4. Report Lifecycle

Governs official legal document compilation and release per **ISO/IEC 17025:2017 Clause 7.8**.

### States
* `DRAFT`: Report document created; pulls latest authorized result versions.
* `PENDING_AUTHORIZATION`: Report compiled; awaiting formal electronic signature by reporting officer.
* `RELEASED`: Final PDF rendered, cryptographically hashed, and issued to customer. **Immutable.**
* `AMENDED`: Revised report edition issued (e.g., `Rev 1`) following post-release result corrections.
* `VOIDED`: Report officially cancelled/retracted in its entirety.

### Transitions & Triggers

| From State | To State | Trigger | Role | Reason Mandatory? | Audit Event |
| :--- | :--- | :--- | :--- | :---: | :--- |
| `DRAFT` | `PENDING_AUTHORIZATION` | Compiler seals draft | Reporting Officer | No | `REPORT_COMPILED` |
| `PENDING_AUTHORIZATION`| `RELEASED` | Authorized signature | Technical Director | No | `REPORT_RELEASED` |
| `PENDING_AUTHORIZATION`| `DRAFT` | Signatory rejects draft | Technical Director | **YES** | `REPORT_REJECTED_TO_DRAFT` |
| `RELEASED` | `AMENDED` | New version published | Technical Director | **YES** | `REPORT_AMENDED` |
| `RELEASED` | `VOIDED` | Complete retraction | Lab Director / QA | **YES** | `REPORT_VOIDED` |

### Invariant Rules
* **Report Prerequisite:** A Report cannot be moved to `RELEASED` unless **100% of included Results are in `AUTHORIZED` status**.
* **Immutability of Released Reports:** Once a report reaches `RELEASED`, its physical PDF and database rows are completely frozen.
* **Amendment Mechanics (Clause 7.8.8):** A released report is **never overwritten**. Amendments produce a new `Report Version` with an incremented revision number, an explicit statement of what was changed and why, and a reference to the superseded report ID.
