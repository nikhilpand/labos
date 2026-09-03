# ADR-001: Primary First Laboratory Domain — ISO/IEC 17025 Analytical & Testing Laboratories

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

LabOS has the long-term ambition to orchestrate operations across multiple laboratory sectors: clinical diagnostics, pharmaceutical development, forensic analysis, environmental testing, and calibration. 

However, attempting to model all laboratory domains simultaneously at project inception introduces high risk:
1. **Premature Abstraction:** Trying to satisfy the unique data structures of every lab type before understanding any single one thoroughly creates bloated, ambiguous code.
2. **Regulatory Entanglement:** Medical laboratories require patient privacy (HIPAA / GDPR), health insurance billing, and clinical diagnostic integrations (HL7/FHIR) on Day 1. Pharmaceutical labs require complex Computer System Validation (CSV) packages and 21 CFR Part 11 predicate rules.

LabOS needs a focused, rigorous starting domain that models the universal scientific core without getting stalled by clinical privacy laws or pharmaceutical validation hurdles.

---

## Options Considered

1. **Medical / Clinical Diagnostic Laboratory (ISO 15189 / CLIA / CAP):** High commercial value, but introduces patient Protected Health Information (PHI) and complex clinician/patient billing workflows immediately.
2. **ISO/IEC 17025 Analytical & Testing Laboratory:** Testing food safety, water quality, environmental soil, materials, and chemical purity.
3. **Pharmaceutical & Biotech Laboratory (GxP / 21 CFR Part 11):** High enterprise budget, but extremely heavy upfront regulatory validation overhead.
4. **Calibration Laboratory:** Specialized metrology workflows focused on instrument calibration rather than consumable sample testing.

---

## Decision

**LabOS will initially target ISO/IEC 17025 analytical and testing laboratories** (specifically analytical chemistry, environmental, and food safety testing).

The architecture and core data model must remain extensible enough to support other laboratory domains later (such as ISO 15189 clinical labs or GxP pharma labs), but we will **not** implement domain-specific requirements for those sectors in the initial phases.

---

## Rationale

- **Full Lifecycle Coverage:** ISO/IEC 17025 encompasses the complete, authentic "Sample-to-Report" lifecycle:
  - Sample intake, inspection, and barcoding
  - Batching into plates, tubes, and preparation racks
  - Analytical run execution on instruments
  - Quality Control (QC) evaluations (blanks, calibration standards, matrix spikes, duplicates)
  - Mathematical result calculations and unit conversions
  - Scientific verification and authorized sign-off
  - Generation of an authorized Certificate of Analysis (CoA)
- **Zero Human PHI Risk on Day 1:** Testing water, soil, or food allows the system to be developed and tested with realistic synthetic data without the legal and compliance risks associated with human patient medical records.
- **Direct Foundation for Other Standards:** ISO 15189 (the international medical laboratory standard) was derived directly from ISO/IEC 17025. Building a rock-solid ISO 17025 engine creates the exact scientific spine required for clinical and pharmaceutical applications later.

---

## Consequences

### Positive
- A clean, well-defined domain model centered on scientific rigor.
- Immediate utility for thousands of environmental, food safety, and industrial testing labs.
- Simple, unencumbered synthetic data generation for testing.

### Negative
- Medical-specific concepts (such as Patient MRNs, clinical ordering physicians, and HL7/FHIR interfaces) are deferred to future phases.

### Neutral
- The system must use neutral naming (e.g., `Client` or `SubmittingOrganization` rather than `Patient`) to ensure future compatibility.

---

## Explicit Non-Goals

- Implementing patient diagnostic medical records, HIPAA privacy safeguards, or health insurance billing workflows.
- Implementing pharmaceutical batch release manufacturing workflows.
- Implementing instrument calibration metrology certificates.

---

## Reconsideration Criteria

This decision may be reconsidered if:
1. A strategic institutional partnership or funding source requires immediate deployment in a clinical diagnostic or pharmaceutical environment.
2. The core ISO 17025-aligned pipeline is fully implemented and verified against compliance specifications, triggering a formal Phase transition to ISO 15189 (Clinical Diagnostics).
