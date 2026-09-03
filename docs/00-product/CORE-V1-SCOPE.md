# LabOS — Core V1 Scope & Boundaries

## 1. Product Direction & Core V1 Purpose

**LabOS** is a simple but powerful Laboratory Operating System for private laboratories, targeting **ISO/IEC 17025 analytical and testing laboratories** (specifically environmental, chemical, food safety, and materials testing).

### The Golden Rule of Core V1
> **Core V1 must represent one complete, coherent, usable laboratory workflow from customer request to released Certificate of Analysis, without cutting corners on scientific data integrity, auditability, or type safety.**

It is **not** a stripped-down toy: all core data models, foreign keys, decimal math rules, and append-only audit hooks are fully built into the foundation so the platform can scale into advanced laboratory automation without architectural rewrites.

---

## 2. Core V1 Scope Classification

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          LABOS SCOPE MATRIX                            │
│                                                                        │
│   [ 1. IN SCOPE - CORE V1 ]                                            │
│   • Single Laboratory Profile & Site                                   │
│   • Customer & Contact Management                                      │
│   • Test Request (Work Order) Intake                                   │
│   • Physical Sample Receipt, Inspection, & Accessioning                │
│   • Scientific Catalog (Sample Types, Methods, Parameters, Units)      │
│   • Instrument Reference Inventory                                     │
│   • Test Assignment & Scheduling                                       │
│   • Exact Decimal Result Entry & Flagging                              │
│   • Two-Tier Verification (Technical Review + Authorization)           │
│   • Immutable Certificate of Analysis (CoA) Generation & Issuance      │
│   • Tamper-Evident Append-Only Audit Trail (ADR-005)                   │
│   • OIDC Identity Integration & Internal RBAC (ADR-006)                │
│                                                                        │
│   [ 2. V1 EXTENSIONS ]                                                 │
│   • Multi-Container / Aliquot Splitting & Container Barcodes           │
│   • Automated Analytical Batch QC Acceptance Engine (Blanks/Spikes)    │
│   • Automated Shewhart Quality Control Charts                          │
│   • Automated Measurement Uncertainty Budget Calculators (GUM)         │
│   • File Attachments (Chromatogram images, raw exports)                │
│   • Automated Hold-Time Expiration Hard-Blocks                         │
│                                                                        │
│   [ 3. ARCHITECTED FOR BUT NOT IMPLEMENTED ]                           │
│   • Direct Instrument RS-232 / TCP Telemetry Ingestion (Satellite Wkr) │
│   • Multi-Laboratory / Multi-Site Partitioning                         │
│   • Customer Self-Service Client Portal                                │
│   • Electronic Signature Dual-Credential Re-auth (21 CFR Part 11)     │
│                                                                        │
│   [ 4. FUTURE ]                                                        │
│   • Multi-Tenant Enterprise Holding Corporation (Organization)         │
│   • Clinical Diagnostics Workflow (ISO 15189 / HIPAA / Patient MRNs)   │
│   • Pharmaceutical Batch Release (GxP / 21 CFR Part 11 Validation)    │
│   • Metrological Multi-Point Calibration Curve Fitting Engine          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. In Scope for Core V1

Core V1 includes everything necessary to execute a compliant, legally defensible, end-to-end analytical test run:

1. **Laboratory Profile:** Single accredited laboratory profile with address, accreditation number (e.g., ISO 17025 certificate details), and technical director.
2. **Customer & Contact Management:** Corporate client accounts with associated primary contacts, billing terms, and reporting emails.
3. **Test Request (Work Order):** Contract review, client purchase order tracking, requested turn-around-time, and special instructions.
4. **Physical Sample Accessioning:** Logging delivery carrier, tracking number, package temperature, visual condition check (intact vs. damaged), and auto-generation of unique accession numbers.
5. **Qualified Sample Acceptance:** Handling non-conforming items (e.g., warm samples) per ISO 17025 Clause 7.4.3 with mandatory report disclaimer flags.
6. **Scientific Method Catalog:** Pre-configured Standard Operating Procedures (SOPs), target analytes, CAS numbers, default units, and optional regulatory limits.
7. **Instrument Reference:** Inventory of analytical instruments (manufacturer, model, serial number, calibration status) for test assignment.
8. **Test Assignment:** Binding physical samples to specific test methods and assigned analysts.
9. **Scientific Result Engine:** Exact decimal entry (`decimal.js`), dilution factor application, detection limit flagging (`< LOQ`), and immutable `Result Version` tracking.
10. **Two-Stage Review (Four-Eyes Principle):**
    - Stage 1: Technical Review (Analyst / Peer verifies calibration & raw data).
    - Stage 2: Managerial Authorization (Technical Director signs off).
11. **Certificate of Analysis (CoA) Reporting:** Generating immutable, versioned PDF reports with mandatory ISO 17025 metadata, disclaimers, and amendment notices.
12. **Append-Only Audit Trail:** Transparent logging of Who, What, When, Where, and Why across all state changes.

---

## 4. Out of Scope for Core V1

The following capabilities are deliberately excluded from Core V1 to keep the initial release maintainable and focused:

* **Automated Instrument File Parsing:** No automated ingestion of CSV/vendor output files. Core V1 uses structured manual or copy-paste result entry.
* **Complex Sub-Container Aliquots:** Samples are treated as a single physical entity with container count metadata, rather than independent barcode-tracked sub-containers.
* **Automated Batch QC Algorithms:** Batches in V1 are recorded as metadata groupings on Tests; automated algorithmic evaluation of batch QC acceptance (blanks, spikes, duplicates) is deferred to V1 Extension.
* **Customer Self-Service Portal:** Customers do not log into the system directly; lab staff enter requests from paper Chain of Custody forms or emails.
* **Automated Billing & Invoicing:** No credit card processing, QuickBooks/ERP synchronization, or pricing calculation engines.
* **Instrument Metrological Calibration Modeling:** Instrument calibration curves ($R^2$ linear regressions) are recorded outside LabOS; LabOS records the instrument's operational validity status.

---

## 5. The Core V1 End-to-End Workflow

The single-sample analytical workflow designed for Core V1 (aligned with ISO/IEC 17025 principles):

```text
[1. Customer Creation]
         │
         ▼
[2. Test Request Intake] ───────► (Contract review, turn-around-time, requested tests)
         │
         ▼
[3. Physical Parcel Receipt] ───► (Carrier tracking, parcel intactness, delivery time)
         │
         ▼
[4. Condition Inspection] ─────► (Temperature check, container integrity, preservation)
         │
         ├───────────────────────► [If Damaged/Compromised: Reject OR Qualify with Disclaimer]
         ▼
[5. Accessioning & Barcoding] ──► (Assign immutable Accession # SAM-2026-XXXXX)
         │
         ▼
[6. Test Assignment] ───────────► (Bind Sample to Test Method e.g., EPA 200.8 & Instrument)
         │
         ▼
[7. Analytical Execution] ──────► (Analyst tests sample in lab; status -> IN_PROGRESS)
         │
         ▼
[8. Exact Result Entry] ────────► (Enter decimal concentrations, dilution, < LOQ flags)
         │
         ▼
[9. Technical Peer Review] ─────► (Peer checks raw data, dilution math, instrument logs)
         │
         ▼
[10. Managerial Authorization] ─► (Authorized signatory electronic approval)
         │
         ▼
[11. Certificate Release (CoA)] ► (Render immutable PDF report, publish, issue to client)
         │
         ▼
[12. Sample Disposal] ──────────► (Mandatory retention expires; hazardous waste manifest)
```
