# LabOS — Core Domain Entities (ISO/IEC 17025)

This document formally defines the 26 core domain entities for **LabOS**. Every entity is classified into one of three project releases:
* **`CORE V1`**: Absolute minimum vertical slice required to accession a sample, perform a test, enter exact results, review, and issue an auditable report.
* **`V1 EXTENSION`**: Operational extensions required for full analytical batching, instrument logging, and QC control charts.
* **`FUTURE`**: Advanced enterprise multi-tenancy and automated metrological calibration chains.

---

## 1. Organization
* **Classification:** `FUTURE`
* **Simple Explanation:** The parent corporate or governing legal entity that owns one or more laboratory business units.
* **Purpose:** Multi-tenant enterprise boundary for large commercial lab networks.
* **Unique Identifier:** `organization_id` (UUIDv7)
* **Important Attributes:** `legal_name`, `tax_identifier`, `country_of_incorporation`, `billing_currency`.
* **Relationships:** One Organization has many Laboratories.
* **Ownership:** Top-level root entity.
* **Lifecycle:** `Active` -> `Suspended` -> `Archived`.
* **Immutability:** Mutable with audit log. Historical legal entity changes require explicit administrative reasons.

---

## 2. Laboratory
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** A dedicated scientific division or testing organization (e.g., "Apex Environmental Testing Labs").
* **Purpose:** Defines the administrative and accreditation boundary holding the ISO/IEC 17025 certificate.
* **Unique Identifier:** `laboratory_id` (UUIDv7)
* **Important Attributes:** `name`, `accreditation_number` (e.g., A2LA, UKAS), `quality_manager_id`, `technical_director_id`.
* **Relationships:** Belongs to an Organization (or operates standalone in V1). Has many Laboratory Sites, Users, and Test Methods.
* **Ownership:** Organization (or self in single-tenant V1).
* **Lifecycle:** `Active` -> `Inactive`.
* **Immutability:** Mutable with audit logging.

---

## 3. Laboratory Site
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** The physical street address or facility where tests are conducted.
* **Purpose:** ISO/IEC 17025 clause 7.8.2.1 mandates that test reports explicitly state the location of all testing activities.
* **Unique Identifier:** `laboratory_site_id` (UUIDv7)
* **Important Attributes:** `site_name`, `street_address`, `city`, `state_province`, `postal_code`, `environmental_monitoring_status`.
* **Relationships:** Belongs to a Laboratory. Houses Instruments and processes Samples.
* **Ownership:** Laboratory.
* **Lifecycle:** `Operational` -> `Decommissioned`.
* **Immutability:** Mutable address; changes do not alter past printed reports.

---

## 4. User
* **Classification:** `CORE V1`
* **Simple Explanation:** A human staff member or system agent interacting with LabOS.
* **Purpose:** Establishes identity, accountability, domain roles, and qualification tracking for ISO/IEC 17025 clause 6.2 (Personnel).
* **Unique Identifier:** `user_id` (UUIDv7)
* **Important Attributes:** `identity_provider_subject_id` (OIDC link), `full_name`, `email`, `active_status`, `role_ids`.
* **Relationships:** Belongs to a Laboratory. Authors Audit Events, performs Tests, signs Reports.
* **Ownership:** Laboratory.
* **Lifecycle:** `Invited` -> `Active` -> `Suspended` -> `Deactivated`. (Never hard-deleted).
* **Immutability:** Profile mutable; historical actions tied to immutable `user_id`.

---

## 5. Customer (Client)
* **Classification:** `CORE V1`
* **Simple Explanation:** The commercial company, municipality, or individual submitting samples for testing.
* **Purpose:** Tracks contract agreements, invoicing destination, and report delivery per ISO/IEC 17025 clause 7.1.
* **Unique Identifier:** `customer_id` (UUIDv7)
* **Important Attributes:** `company_name`, `client_code` (e.g., `CL-1049`), `account_status`, `default_reporting_currency`.
* **Relationships:** Has many Contacts, Test Requests, and Samples.
* **Ownership:** Laboratory.
* **Lifecycle:** `Prospect` -> `Active` -> `Hold` -> `Archived`.
* **Immutability:** Profile details mutable with audit trail.

---

## 6. Contact
* **Classification:** `CORE V1`
* **Simple Explanation:** A specific person working for a Customer.
* **Purpose:** Identifies who authorized a test request, who receives email alerts, and who receives the Certificate of Analysis.
* **Unique Identifier:** `contact_id` (UUIDv7)
* **Important Attributes:** `customer_id`, `first_name`, `last_name`, `email`, `phone_number`, `is_primary_contact`.
* **Relationships:** Belongs to a Customer. Linked to Test Requests.
* **Ownership:** Customer.
* **Lifecycle:** `Active` -> `Inactive`.
* **Immutability:** Mutable with audit tracking.

---

## 7. Sample
* **Classification:** `CORE V1`
* **Simple Explanation:** The physical material (water, soil, air, food) submitted to the lab for testing.
* **Purpose:** Represents the core real-world scientific entity whose chain of custody and testing lifecycle must be defended.
* **Unique Identifier:** `sample_id` (UUIDv7)
* **Important Attributes:** `accession_number` (human-readable e.g., `SAM-2026-00042`), `customer_id`, `test_request_id`, `sample_type_id`, `collection_timestamp`, `received_timestamp`, `received_temperature_celsius`, `condition_on_receipt` (`Intact`, `Leaking`, `Preservation_Invalid`), `status`.
* **Relationships:** Belongs to a Customer and Test Request. Has a Sample Type. Contains one or more Sample Items. Subject of one or more Tests.
* **Ownership:** Test Request / Customer.
* **Lifecycle:** `Requested` -> `Received` -> `Registered` -> `In_Testing` -> `Results_Entered` -> `Technically_Reviewed` -> `Authorized` -> `Reported` -> `Disposed`.
* **Immutability:** Core intake metadata is locked after registration. Amendments require an explicit reason and audit event.

---

## 8. Sample Type (Matrix)
* **Classification:** `CORE V1`
* **Simple Explanation:** The category of material being tested (e.g., "Potable Water", "Surface Soil", "Raw Milk").
* **Purpose:** Enforces valid preparation protocols, required container preservatives, and maximum regulatory hold times.
* **Unique Identifier:** `sample_type_id` (UUIDv7)
* **Important Attributes:** `code` (e.g., `WATER_POTABLE`), `name`, `default_storage_temperature`, `description`.
* **Relationships:** Referenced by Samples and Test Methods.
* **Ownership:** Laboratory Catalog.
* **Lifecycle:** `Active` -> `Deprecated`.
* **Immutability:** Catalog definition; versioned if requirements change.

---

## 9. Sample Item (Aliquot / Container)
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** An individual physical container or sub-divided portion of a sample.
* **Purpose:** Manages physical sample splits preserved differently (e.g., Container A with $HNO_3$ for heavy metals, Container B unpreserved for pH).
* **Unique Identifier:** `sample_item_id` (UUIDv7)
* **Important Attributes:** `sample_id`, `container_barcode`, `preservative_type`, `volume_amount`, `volume_unit`, `storage_location_id`.
* **Relationships:** Belongs to a Sample. Assigned to Tests and Analytical Batches.
* **Ownership:** Sample.
* **Lifecycle:** `Intact` -> `In_Use` -> `Consumed` -> `Disposed`.
* **Immutability:** Append-only volume deduction log.

---

## 10. Test Request (Work Order / Chain of Custody)
* **Classification:** `CORE V1`
* **Simple Explanation:** The official order grouping a batch of samples submitted by a customer for testing.
* **Purpose:** Encapsulates the contract review required by ISO/IEC 17025 clause 7.1 (pricing, turn-around-time, required tests).
* **Unique Identifier:** `test_request_id` (UUIDv7)
* **Important Attributes:** `request_number` (e.g., `TR-2026-00108`), `customer_id`, `contact_id`, `order_date`, `turnaround_time_days`, `special_instructions`, `status`.
* **Relationships:** Belongs to a Customer. Contains one or more Samples. Originates one or more Reports.
* **Ownership:** Customer.
* **Lifecycle:** `Draft` -> `Submitted` -> `Accepted` -> `In_Progress` -> `Completed` -> `Cancelled`.
* **Immutability:** Contractual items locked once accepted.

---

## 11. Test
* **Classification:** `CORE V1`
* **Simple Explanation:** The execution of a specific Test Method on a specific Sample.
* **Purpose:** The schedulable unit of analytical work assigned to a laboratory bench or analyst.
* **Unique Identifier:** `test_id` (UUIDv7)
* **Important Attributes:** `sample_id`, `test_method_id`, `analytical_batch_id`, `assigned_analyst_id`, `status`, `started_at`, `completed_at`.
* **Relationships:** Connects a Sample to a Test Method. Belongs optionally to an Analytical Batch. Yields one or more Results.
* **Ownership:** Sample.
* **Lifecycle:** `Pending` -> `Scheduled` -> `In_Progress` -> `Completed` -> `Repeated` -> `Cancelled`.
* **Immutability:** State changes are auditable. If a test must be repeated, a new Test record is spawned.

---

## 12. Test Method (SOP)
* **Classification:** `CORE V1`
* **Simple Explanation:** The documented, validated standard operating procedure (e.g., "EPA 200.8 - Metals by ICP-MS").
* **Purpose:** Defines the scientific rules, applicable sample types, preparation steps, and required quality controls per ISO/IEC 17025 clause 7.2.
* **Unique Identifier:** `test_method_id` (UUIDv7)
* **Important Attributes:** `code` (e.g., `EPA_200_8`), `name`, `version`, `accreditation_status` (`Accredited`, `Non-Accredited`), `regulatory_agency` (e.g., EPA, ISO, ASTM).
* **Relationships:** Contains many Test Parameters. Associated with valid Sample Types. Instantiated by Tests.
* **Ownership:** Laboratory Catalog.
* **Lifecycle:** `Draft` -> `Active` -> `Superseded` -> `Retired`.
* **Immutability:** Method revisions create a new version; past tests reference the immutable historical version used.

---

## 13. Test Parameter (Analyte)
* **Classification:** `CORE V1`
* **Simple Explanation:** A single specific chemical, element, or physical attribute measured by a Test Method (e.g., "Lead", "Nitrate", "Turbidity").
* **Purpose:** Defines the atomic target of measurement, its default units, and reporting detection limits.
* **Unique Identifier:** `test_parameter_id` (UUIDv7)
* **Important Attributes:** `test_method_id`, `name`, `chemical_formula`, `cas_number` (Chemical Abstracts Service registry), `default_unit_id`, `default_limit_of_quantitation` (LOQ).
* **Relationships:** Belongs to a Test Method. Target of Results.
* **Ownership:** Test Method.
* **Lifecycle:** `Active` -> `Deprecated`.
* **Immutability:** Catalog definition.

---

## 14. Result
* **Classification:** `CORE V1`
* **Simple Explanation:** The scientific observation or quantified concentration determined for a Test Parameter on a Sample.
* **Purpose:** The primary scientific deliverable produced by laboratory testing.
* **Unique Identifier:** `result_id` (UUIDv7)
* **Important Attributes:** `test_id`, `test_parameter_id`, `current_version_number`, `is_below_detection_limit` (boolean flag for `< LOQ`), `status` (`Preliminary`, `Verified`, `Approved`, `Invalidated`).
* **Relationships:** Belongs to a Test. Relates to a Test Parameter. Has one or more Result Versions.
* **Ownership:** Test.
* **Lifecycle:** `Draft` -> `Entered` -> `Reviewed` -> `Approved` -> `Amended` -> `Invalidated`.
* **Immutability:** Governed entirely through immutable Result Versions. Never updated in-place.

---

## 15. Result Version
* **Classification:** `CORE V1`
* **Simple Explanation:** An immutable historical snapshot of a Result value and its calculation basis.
* **Purpose:** Enforces the absolute rule: *Never silently overwrite scientific results*.
* **Unique Identifier:** `result_version_id` (UUIDv7)
* **Important Attributes:** `result_id`, `version_number` (1, 2, 3...), `numeric_value` (Exact arbitrary-precision decimal), `qualifier` (e.g., `U` for undetected, `J` for estimated), `unit_id`, `dilution_factor`, `entered_by_user_id`, `entered_at`, `amendment_reason` (mandatory if version > 1).
* **Relationships:** Belongs to a Result.
* **Ownership:** Result.
* **Lifecycle:** Append-only. Once created, never updated or deleted.
* **Immutability:** **100% Immutable.**

---

## 16. Unit of Measurement (UoM)
* **Classification:** `CORE V1`
* **Simple Explanation:** The standardized scientific unit (e.g., `mg/L`, `µg/kg`, `pH units`, `°C`).
* **Purpose:** Ensures dimensional consistency and accurate mathematical unit conversions.
* **Unique Identifier:** `unit_id` (UUIDv7)
* **Important Attributes:** `symbol`, `name`, `system` (`SI`, `Metric`, `Customary`), `base_unit_dimension` (e.g., Mass/Volume).
* **Relationships:** Referenced by Test Parameters, Results, and Limits.
* **Ownership:** Global Laboratory Catalog.
* **Lifecycle:** `Active` -> `Inactive`.
* **Immutability:** Immutable definitions.

---

## 17. Reference Range or Specification Limit
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** Regulatory threshold or client benchmark (e.g., EPA Lead maximum limit = `0.015 mg/L`).
* **Purpose:** Allows automated compliance evaluation and visual flags for out-of-specification results on reports per ISO/IEC 17025 clause 7.8.6.
* **Unique Identifier:** `specification_limit_id` (UUIDv7)
* **Important Attributes:** `test_parameter_id`, `sample_type_id`, `lower_limit`, `upper_limit`, `limit_type` (`Regulatory`, `Action_Level`, `Client_Specification`), `regulatory_authority`.
* **Relationships:** Connects Test Parameters and Sample Types. Evaluated against Results.
* **Ownership:** Laboratory Quality Management.
* **Lifecycle:** `Active` -> `Expired`.
* **Immutability:** Versioned over time.

---

## 18. Instrument
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** A physical analytical instrument or measuring balance (e.g., "Agilent 7900 ICP-MS #1").
* **Purpose:** Metrological traceability per ISO/IEC 17025 clause 6.4: linking every result to the specific machine that measured it.
* **Unique Identifier:** `instrument_id` (UUIDv7)
* **Important Attributes:** `serial_number`, `model`, `manufacturer`, `asset_tag`, `commissioned_date`, `calibration_due_date`, `status` (`Operational`, `Maintenance_Required`, `Out_of_Service`).
* **Relationships:** Located at a Laboratory Site. Executes Analytical Batches and Tests.
* **Ownership:** Laboratory Site.
* **Lifecycle:** `In_Commissioning` -> `Operational` -> `Maintenance` -> `Decommissioned`.
* **Immutability:** Maintenance and status history are append-only.

---

## 19. Instrument Run
* **Classification:** `FUTURE`
* **Simple Explanation:** A single injection or raw execution sequence on an instrument (e.g., Autosampler Rack 1, Vial 12).
* **Purpose:** Tracks automated raw data capture from instrument vendor software and telemetry logs.
* **Unique Identifier:** `instrument_run_id` (UUIDv7)
* **Important Attributes:** `instrument_id`, `batch_id`, `run_started_at`, `run_completed_at`, `raw_data_file_path`.
* **Relationships:** Belongs to an Instrument and Analytical Batch.
* **Ownership:** Instrument.
* **Lifecycle:** `Running` -> `Completed` -> `Aborted`.
* **Immutability:** Raw instrument output logs are append-only.

---

## 20. Calibration
* **Classification:** `FUTURE`
* **Simple Explanation:** A multi-point standard curve measuring instrument response against certified concentrations.
* **Purpose:** Fulfills ISO/IEC 17025 clause 6.5 (Metrological Traceability). Determines the mathematical formula (slope, intercept, $R^2$) used to calculate concentrations.
* **Unique Identifier:** `calibration_id` (UUIDv7)
* **Important Attributes:** `instrument_id`, `test_method_id`, `calibration_date`, `r_squared_coefficient`, `calibration_curve_type` (`Linear`, `Quadratic`), `is_valid`.
* **Relationships:** Belongs to an Instrument and Test Method.
* **Ownership:** Instrument.
* **Lifecycle:** `Active` -> `Expired` -> `Invalidated`.
* **Immutability:** Immutable once evaluated.

---

## 21. Quality Control (QC)
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** A control sample (Method Blank, Laboratory Control Sample, Matrix Spike) run inside a batch.
* **Purpose:** Validates analytical accuracy and precision per ISO/IEC 17025 clause 7.7.
* **Unique Identifier:** `quality_control_id` (UUIDv7)
* **Important Attributes:** `qc_type` (`Method_Blank`, `LCS`, `Matrix_Spike`, `Duplicate`), `analytical_batch_id`, `true_value` (certified spike amount), `measured_value`, `percent_recovery`, `acceptance_criteria_passed` (boolean).
* **Relationships:** Belongs to an Analytical Batch.
* **Ownership:** Analytical Batch.
* **Lifecycle:** `Scheduled` -> `Analyzed` -> `Accepted` -> `Failed`.
* **Immutability:** Calculations are deterministic and immutable.

---

## 22. Analytical Batch (Run Batch)
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** A group of up to 20 customer samples prepared and analyzed together with the same QC samples.
* **Purpose:** Enforces quality control grouping. If the batch QC fails, all sample results in the batch are held.
* **Unique Identifier:** `analytical_batch_id` (UUIDv7)
* **Important Attributes:** `batch_number` (e.g., `BAT-2026-0045`), `test_method_id`, `instrument_id`, `created_at`, `qc_status` (`Pending`, `Passed`, `Failed`).
* **Relationships:** Contains many Tests and Quality Control samples.
* **Ownership:** Laboratory Bench / Section.
* **Lifecycle:** `Open` -> `In_Prep` -> `In_Analysis` -> `QC_Reviewed` -> `Closed`.
* **Immutability:** Closed batches cannot accept new samples.

---

## 23. Report (Certificate of Analysis - CoA)
* **Classification:** `CORE V1`
* **Simple Explanation:** The official scientific document issued to the client containing verified results.
* **Purpose:** Fulfills ISO/IEC 17025 clause 7.8 (Reporting of results). The legal output of the testing process.
* **Unique Identifier:** `report_id` (UUIDv7)
* **Important Attributes:** `report_number` (e.g., `COA-2026-0089`), `test_request_id`, `customer_id`, `current_version_number`, `status` (`Draft`, `Released`, `Amended`, `Voided`).
* **Relationships:** Belongs to a Test Request. Encompasses Results from one or more Samples. Contains one or more Report Versions.
* **Ownership:** Test Request.
* **Lifecycle:** `Draft` -> `Pending_Authorization` -> `Released` -> `Amended` -> `Voided`.
* **Immutability:** Managed via versioning. Released reports cannot be altered in place.

---

## 24. Report Version
* **Classification:** `CORE V1`
* **Simple Explanation:** An immutable, published edition of a Certificate of Analysis.
* **Purpose:** ISO/IEC 17025 clause 7.8.8 mandates that any amendment to an issued report must be uniquely identified, versioned, and state the reason for change.
* **Unique Identifier:** `report_version_id` (UUIDv7)
* **Important Attributes:** `report_id`, `version_number` (1, 2, 3...), `published_at`, `authorized_by_user_id`, `amendment_reason` (mandatory for version > 1), `file_attachment_id` (rendered PDF).
* **Relationships:** Belongs to a Report. Contains a snapshot of included Result Versions.
* **Ownership:** Report.
* **Lifecycle:** Append-only. Once published, never updated or deleted.
* **Immutability:** **100% Immutable.**

---

## 25. Attachment
* **Classification:** `V1 EXTENSION`
* **Simple Explanation:** An external digital file (e.g., signed PDF Chain of Custody, instrument chromatogram image, raw data export).
* **Purpose:** Preserves supporting documentation and raw evidence required for technical audits.
* **Unique Identifier:** `attachment_id` (UUIDv7)
* **Important Attributes:** `file_name`, `mime_type`, `file_size_bytes`, `sha256_checksum`, `storage_path`.
* **Relationships:** Attached to Test Requests, Samples, Instruments, or Reports.
* **Ownership:** The entity it is attached to.
* **Lifecycle:** Append-only.
* **Immutability:** Storage files are immutable and verified via SHA-256 checksums.

---

## 26. Audit Event
* **Classification:** `CORE V1`
* **Simple Explanation:** A permanent record of an action taken in the system.
* **Purpose:** Implements ADR-005 (tamper-evident audit integrity). Provides legal and regulatory traceability.
* **Unique Identifier:** `audit_event_id` (UUIDv7)
* **Important Attributes:** `previous_event_hash`, `current_event_hash` (SHA-256), `actor_user_id`, `action`, `entity_type`, `entity_id`, `correlation_id`, `timestamp_utc`, `reason`, `diff_payload_json`.
* **Relationships:** Refers to any domain entity.
* **Ownership:** Platform Audit Subsystem.
* **Lifecycle:** Append-only ledger.
* **Immutability:** **100% Immutable. Protected against UPDATE and DELETE operations.**
