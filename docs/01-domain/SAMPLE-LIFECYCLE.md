# LabOS — Sample Lifecycle State Machine (ISO/IEC 17025)

This document specifies the authoritative state machine for a **Sample** in LabOS, covering standard progression, exception handling, rejection criteria, re-testing, and post-testing disposal in compliance with **ISO/IEC 17025:2017 Clause 7.4** (Handling of test items).

---

## 1. State Machine Evaluation & Refinement

The initial lifecycle model proposed:
$$\text{REQUESTED} \rightarrow \text{RECEIVED} \rightarrow \text{REGISTERED} \rightarrow \text{IN TESTING} \rightarrow \text{RESULTS ENTERED} \rightarrow \text{TECHNICALLY REVIEWED} \rightarrow \text{AUTHORIZED} \rightarrow \text{REPORTED}$$

### Critique Against ISO/IEC 17025:2017
While logically sound, a practical analytical testing laboratory requires four critical refinements:
1. **Handling of Compromised / Nonconforming Items (Clause 7.4.3):** Samples frequently arrive broken, past regulatory hold time, or warm (e.g., $12^\circ\text{C}$ instead of $<6^\circ\text{C}$). The lab cannot simply proceed normally; it must support formal **Rejection** or **Qualified Acceptance with Customer Disclaimer**.
2. **Sample Preparation Phase:** In analytical chemistry and environmental testing, samples are rarely tested raw; they must undergo extraction, digestion, or filtration prior to instrument analysis. An explicit `IN_PREPARATION` state tracks this step.
3. **Four-Eyes Principle (Clause 7.8.2):** Strict separation between technical verification (peer analyst checking QC math) and managerial authorization (sign-off by an authorized signatory).
4. **Sample Retention & Disposal (Clause 7.4.4):** After reporting, samples are retained in cold storage for a mandatory period (e.g., 30–90 days) before hazardous waste disposal.

---

## 2. Refined Authoritative State Diagram

```text
               ┌───────────────┐
               │   REQUESTED   │
               └───────┬───────┘
                       │ (Package Arrives at Dock)
                       ▼
               ┌───────────────┐
               │   RECEIVED    │
               └───────┬───────┘
                       │ (Inspection & Condition Check)
        ┌──────────────┴──────────────┬────────────────────────┐
        │ Condition Valid             │ Deviation Accepted     │ Unusable / Cancelled
        ▼                             ▼                        ▼
┌───────────────┐             ┌───────────────┐        ┌───────────────┐
│  REGISTERED   │             │   QUALIFIED   │        │   REJECTED    │
│   (Intact)    │             │  (Disclaimer) │        │ (Nonconforming│
└───────┬───────┘             └───────┬───────┘        └───────────────┘
        └──────────────┬──────────────┘
                       │ (Assigned to Batch / Aliquotted)
                       ▼
               ┌───────────────┐
               │IN_PREPARATION │
               └───────┬───────┘
                       │ (Loaded on Instrument / Bench)
                       ▼
               ┌───────────────┐
               │  IN_TESTING   │◄──────────────────────────────┐
               └───────┬───────┘                               │
                       │ (Instrument Output Recorded)          │ Re-Test /
                       ▼                                       │ Re-Analysis
               ┌───────────────┐                               │ (QC Failed)
               │RESULTS_ENTERED│                               │
               └───────┬───────┘                               │
                       │ (Peer Review of Calibration & QC)     │
                       ▼                                       │
               ┌───────────────┐                               │
               │  TECHNICALLY  │───────────────────────────────┘
               │   REVIEWED    │ (Rejected by Peer Review)
               └───────┬───────┘
                       │ (Sign-off by Authorized Signatory)
                       ▼
               ┌───────────────┐
               │  AUTHORIZED   │
               └───────┬───────┘
                       │ (CoA Released to Customer)
                       ▼
               ┌───────────────┐
               │   REPORTED    │
               └───────┬───────┘
                       │ (Mandatory Retention Period Elapsed)
                       ▼
               ┌───────────────┐
               │   DISPOSED    │
               └───────────────┘
```

---

## 3. Detailed State Definitions

| State | ISO 17025 Context | Description |
| :--- | :--- | :--- |
| `REQUESTED` | Pre-accession | Test request submitted electronically by client prior to physical receipt. |
| `RECEIVED` | Clause 7.4.1 | Physical parcel logged at receiving dock; package temperature and courier tracking noted. |
| `REGISTERED` | Clause 7.4.2 | Unpacked, accessioned, barcoded, intact condition verified, test methods assigned. |
| `QUALIFIED` | Clause 7.4.3 | Sample accepted with documented condition anomalies (e.g., elevated temperature) upon customer agreement; mandatory disclaimer attached to future report. |
| `REJECTED` | Clause 7.4.3 | Sample compromised, container shattered, or customer instructed cancellation. No testing performed. |
| `IN_PREPARATION` | Clause 7.4 | Aliquots created, chemical digestion, solvent extraction, or filtration underway. |
| `IN_TESTING` | Clause 7.5 | Physical testing or instrument run in progress on analytical equipment. |
| `RESULTS_ENTERED` | Clause 7.5 | Analytical observations and exact decimal calculations entered and flagged. |
| `TECHNICALLY_REVIEWED`| Clause 7.7 | Peer analyst has validated batch QC, blank values, and calculation equations. |
| `AUTHORIZED` | Clause 7.8.2 | Legally designated Laboratory Director or Technical Manager has signed off. |
| `REPORTED` | Clause 7.8 | Immutable Certificate of Analysis (CoA) published and issued to the client. |
| `DISPOSED` | Clause 7.4.4 | Physical sample safely neutralized, incinerated, or discarded after retention. |

---

## 4. State Transition Matrix & Permissions

| From State | To State | Authorized Role | Reason Mandatory? | Action Required |
| :--- | :--- | :--- | :---: | :--- |
| `REQUESTED` | `RECEIVED` | Sample Accessioner | No | Scan courier package barcode; log dock arrival time. |
| `RECEIVED` | `REGISTERED` | Sample Accessioner | No | Verify container integrity, volume, temperature, preservation. |
| `RECEIVED` | `QUALIFIED` | Sample Accessioner / QA | **YES** | Record condition deviation and client agreement to proceed. |
| `RECEIVED` | `REJECTED` | Sample Accessioner / QA | **YES** | Document non-conformance; issue rejection notice to client. |
| `REGISTERED` | `IN_PREPARATION` | Laboratory Analyst | No | Log reagent lot numbers and prep protocol. |
| `IN_PREPARATION` | `IN_TESTING` | Laboratory Analyst | No | Assign to Analytical Batch and Instrument. |
| `IN_TESTING` | `RESULTS_ENTERED` | Laboratory Analyst | No | Enter or import decimal results and dilution factors. |
| `RESULTS_ENTERED` | `TECHNICALLY_REVIEWED` | Senior Analyst / Lead | No | Confirm calibration curve and batch QC passed. |
| `RESULTS_ENTERED` | `IN_TESTING` | Senior Analyst / Lead | **YES** | Reject results due to QC failure; order re-analysis. |
| `TECHNICALLY_REVIEWED` | `AUTHORIZED` | Technical Director | No | Review full chain of custody and issue electronic sign-off. |
| `AUTHORIZED` | `REPORTED` | System / Reporting Officer| No | Render immutable PDF Certificate of Analysis. |
| `REPORTED` | `DISPOSED` | Sample Custodian | No | Record hazardous disposal manifest ID. |
| *Any Pre-Testing* | `CANCELLED` | Customer Service / QA | **YES** | Document client request to cancel order. |

---

## 5. Critical Lifecycle Rules & Exceptions

### Rule 1: The Four-Eyes Principle (ISO/IEC 17025 Clause 7.8.2)
* The user who performed the test and entered the results (`RESULTS_ENTERED`) **cannot** be the sole user who signs off (`AUTHORIZED`).
* A peer analyst or technical manager must perform the technical review.

### Rule 2: Re-Testing vs. Re-Analysis
When a test fails quality control or yields an anomalous outlier, the lab distinguishes between two paths:
1. **Re-Analysis (Instrument Re-injection):** The existing prepared vial or extract is re-injected onto the instrument (e.g., to rule out an autosampler bubble). The Sample state remains `IN_TESTING`.
2. **Re-Testing (Full Re-Preparation):** The original sample aliquot is spent or contaminated, requiring a fresh sub-sample from the parent container to be digested and re-tested. A new child `Test` entity is created, and the prior result is archived with status `INVALIDATED`.

### Rule 3: Handling Compromised Samples (ISO/IEC 17025 Clause 7.4.3)
If a sample arrives out-of-temperature (e.g., milk or water received at $14^\circ\text{C}$):
1. The accessioner logs the anomaly with temperature photographic evidence.
2. The customer is alerted electronically.
3. If the customer instructs the lab to proceed, the state transitions to `QUALIFIED`.
4. **System Enforcement:** The system automatically locks an immutable flag onto the sample. When the final Certificate of Analysis is generated, ISO 17025 clause 7.4.3 requires an inescapable disclaimer printed in bold on the report:
   > *"Warning: Sample received outside recommended preservation temperature ($14^\circ\text{C}$). Results may be compromised."*

### Rule 4: Report Corrections & Amendments (ISO/IEC 17025 Clause 7.8.8)
Once a sample reaches `REPORTED`, its results cannot be edited. If an error is discovered post-release:
1. The Sample status does not revert to `IN_TESTING`.
2. A formal **Amendment Workflow** is initiated.
3. A new `Result Version` is created with a mandatory written justification.
4. A new `Report Version` (e.g., `COA-2026-0089-Rev1`) is published with an explicit statement of what was changed and why, referencing the superseded report.
