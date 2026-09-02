# LabOS — Entity Relationships & Invariants (ISO/IEC 17025)

This document maps how domain entities relate to each other, establishes relational cardinality, and enforces critical boundary rules to prevent corrupt or nonconforming laboratory states.

---

## 1. High-Level Entity Relationship Diagram

```text
┌───────────────────────────┐
│         Customer          │
└─────────────┬─────────────┘
              │ 1
              │
              │ has many (1:N)
              ▼
┌───────────────────────────┐
│       Test Request        │◄────────┐
└─────────────┬─────────────┘         │
              │ 1                     │ generates (1:N)
              │                       │
              │ contains (1:N)        │
              ▼                       ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│          Sample           │   │          Report           │
└─────────────┬─────────────┘   └─────────────┬─────────────┘
              │ 1                             │ 1
              │                               │ has many (1:N)
              │ has (1:N)                     ▼
              ▼                         ┌───────────────────────────┐
┌───────────────────────────┐           │      Report Version       │
│           Test            │           │  (Immutable PDF Snapshot) │
└──────┬──────────────┬─────┘           └───────────────────────────┘
       │ 1            │ N
       │              │
       │ applies (N:1)│ yields (1:N)
       ▼              ▼
┌──────────────┐ ┌───────────────────────────┐
│ Test Method  │ │          Result           │
│    (SOP)     │ └─────────────┬─────────────┘
└──────────────┘               │ 1
                               │ has many (1:N)
                               ▼
                         ┌───────────────────────────┐
                         │      Result Version       │
                         │   (Exact Decimal Math)    │
                         └───────────────────────────┘
```

---

## 2. Cardinality & Ownership Rules

| Parent Entity | Child Entity | Cardinality | Ownership Rule | Cascade Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Customer** | Contact | 1 : N | Customer owns Contact. | Soft delete / Inactive. |
| **Customer** | Test Request | 1 : N | Customer owns Test Request. | Cannot delete Customer if Test Requests exist. |
| **Test Request** | Sample | 1 : N | Test Request groups Samples. | Samples cannot be orphaned; must belong to a Test Request. |
| **Sample** | Sample Item (Aliquot) | 1 : N | Sample physically owns Sample Items. | Destroyed or archived with Sample. |
| **Sample** | Test | 1 : N | Sample is the subject of Tests. | Tests cannot exist without an active Sample. |
| **Test Method** | Test Parameter | 1 : N | Method catalog defines Parameters. | Parameter cannot exist without a Method. |
| **Test Method** | Test | 1 : N | Method is referenced by Tests. | Deleting an active Method is forbidden if historical Tests reference it. |
| **Test** | Result | 1 : N | Test generates Results for each Parameter. | Results belong strictly to one Test. |
| **Result** | Result Version | 1 : N | Result owns its historical versions. | Append-only. Versions are permanent. |
| **Test Request** | Report | 1 : N | Request generates Reports. | Reports cannot exist without a Test Request. |
| **Report** | Report Version | 1 : N | Report owns its editions. | Append-only. Versions are permanent. |
| **Analytical Batch** | Test | 1 : N | Batch groups Tests for execution. | Removing a Test from an open batch returns it to the queue. |
| **Analytical Batch** | Quality Control | 1 : N | Batch owns its QC samples. | QC samples belong strictly to that batch. |

---

## 3. The Critical Distinction: Sample vs. Request vs. Test vs. Method vs. Result

Conflating these concepts is the most common failure in laboratory software architecture. LabOS maintains rigid conceptual separation:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. TEST REQUEST (The Contractual Order)                                                │
│    "Client City-Water-Dept submitted Order #TR-101 for 3 samples on 2026-09-03."       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ contains physical items
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. SAMPLE (The Physical Material)                                                      │
│    "Bottle #SAM-001 is 1 Liter of drinking water collected from Tap 4 at 10:00 AM."   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ has testing assigned
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. TEST METHOD (The Catalog Scientific Standard)                                       │
│    "EPA 200.8: Determination of Trace Elements by ICP-MS."                             │
│    (Defines parameters: Lead, Cadmium, Arsenic. Not tied to any sample).               │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ binds Method to Sample
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. TEST (The Scheduled Work Unit)                                                      │
│    "Run EPA 200.8 on Bottle #SAM-001 on Instrument ICPMS-01."                          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ produces measurements
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. RESULT (The Scientific Measurement)                                                 │
│    "For Sample #SAM-001, Parameter = Lead (Pb), Value = 0.0042 mg/L."                  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Why this distinction matters:
1. **A Sample is NOT a Test:** A single sample of river water may have 5 different Tests performed on it (Metals by ICP-MS, Anions by Ion Chromatography, pH by probe, Volatiles by GC-MS, and Total Suspended Solids by gravimetry).
2. **A Test is NOT a Result:** One Test (e.g., EPA 200.8 ICP-MS) produces multiple Results (one for Lead, one for Copper, one for Arsenic, etc.).
3. **A Test Method is NOT a Test:** The Method is the general laboratory cookbook (SOP). The Test is the actual cooking of a specific sample on a specific Tuesday.

---

## 4. Invariant Rules Preventing Invalid Relationships

To maintain data integrity and regulatory compliance under ISO/IEC 17025, the following database and application constraints are strictly enforced:

### Rule 1: No Orphaned Results
* A `Result` must **always** link to a valid `Test`, which must link to a valid `Sample`, which must link to a valid `Test Request`.
* Raw results can never be floating in the database without complete parentage.

### Rule 2: Method Compatibility Guard
* A `Test` can only be scheduled for a `Sample` if the `Test Method` explicitly supports the sample's `Sample Type`.
* *Example:* The system will reject assigning a "Drinking Water Clean Matrix Method" to a "Hazardous Industrial Sludge" sample type.

### Rule 3: Parameter Completeness
* When a `Test` is marked `Completed`, every mandatory `Test Parameter` defined by that `Test Method` must have an associated `Result` recorded (or an explicit non-analyzable flag with documented justification).

### Rule 4: QC Batch Invariant
* A `Test` cannot transition to `Technically_Reviewed` or `Authorized` if its parent `Analytical Batch` has a `qc_status` of `Failed`.
* Samples processed alongside failed blanks or out-of-spec control spikes must be re-run or flagged with formal non-conformance reports.

### Rule 5: Report Result Snapshot
* A `Report Version` does not reference mutable `Result` rows directly. It stores foreign keys to specific, immutable `Result Version` IDs.
* If a result is amended after a report is published, the published report continues to display the exact historical values it was authorized with until a new `Report Version` is formally issued.
