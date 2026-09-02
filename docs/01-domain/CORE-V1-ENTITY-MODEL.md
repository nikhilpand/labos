# LabOS — Core V1 Entity Model Specifications

This document defines the formal entity specifications for **LabOS Core V1**. It establishes attributes, relationships, mutability, versioning, and audit rules without premature database DDL.

---

## 1. Laboratory
* **Canonical Name:** `Laboratory`
* **Purpose:** Defines the legal testing facility holding the ISO/IEC 17025 accreditation certificate.
* **Identifier:** `laboratory_id` (UUIDv7)
* **Owner:** System Root / Administrator.
* **Key Fields:** `name`, `accreditation_number`, `accreditation_body` (e.g., A2LA, UKAS), `street_address`, `city`, `state_province`, `postal_code`, `country`, `phone`, `email`.
* **Required Fields:** `name`, `accreditation_number`, `street_address`, `city`, `country`.
* **Relationships:** Has many `Users`, `Customers`, `Test Requests`, `Instruments`, `Test Methods`.
* **Lifecycle:** `Active` -> `Suspended`.
* **Mutability:** Mutable configuration with audit logging.
* **Versioning:** Unversioned profile; address updates do not alter past printed reports.
* **Deletion Policy:** Hard delete strictly prohibited. Soft-deactivate only.
* **Audit Requirements:** All changes logged as `LABORATORY_PROFILE_UPDATED`.

---

## 2. User
* **Canonical Name:** `User`
* **Purpose:** Represents human analysts, technicians, and managers operating within LabOS.
* **Identifier:** `user_id` (UUIDv7)
* **Owner:** `Laboratory`.
* **Key Fields:** `laboratory_id`, `oidc_subject_id` (OIDC link), `full_name`, `email`, `job_title`, `status` (`ACTIVE`, `INACTIVE`).
* **Required Fields:** `laboratory_id`, `oidc_subject_id`, `full_name`, `email`, `status`.
* **Relationships:** Belongs to `Laboratory`. Associated with many `Roles`. Authors `Audit Events`.
* **Lifecycle:** `Active` -> `Inactive`.
* **Mutability:** Profile details mutable; identity link immutable.
* **Versioning:** None. Historical audit logs link to permanent `user_id`.
* **Deletion Policy:** Never hard deleted. Soft-deactivate (`status = INACTIVE`).
* **Audit Requirements:** Profile and role assignments logged as `USER_UPDATED`.

---

## 3. Role & Permission (Internal RBAC)
* **Canonical Name:** `Role`, `Permission`
* **Purpose:** Implements internal laboratory authorization per ADR-006.
* **Identifier:** `role_id` (UUIDv7), `permission_code` (String enum, e.g., `test:review`, `report:authorize`).
* **Owner:** `Laboratory`.
* **Key Fields:** `name`, `description`, `is_system_role`.
* **Required Fields:** `name`, `permission_code`.
* **Relationships:** Many-to-many between `User` and `Role`; many-to-many between `Role` and `Permission`.
* **Lifecycle:** Static system roles (`ACCESSIONER`, `ANALYST`, `REVIEWER`, `DIRECTOR`, `ADMIN`).
* **Mutability:** System permissions immutable; role mappings configurable.
* **Versioning:** None.
* **Deletion Policy:** System roles cannot be deleted.
* **Audit Requirements:** Role mapping changes logged as `ROLE_PERMISSIONS_UPDATED`.

---

## 4. Customer
* **Canonical Name:** `Customer`
* **Purpose:** The commercial company, municipality, or client ordering testing services.
* **Identifier:** `customer_id` (UUIDv7)
* **Owner:** `Laboratory`.
* **Key Fields:** `laboratory_id`, `client_code` (unique human code e.g. `CUST-1042`), `company_name`, `billing_address`, `payment_terms`, `status` (`ACTIVE`, `HOLD`, `INACTIVE`).
* **Required Fields:** `laboratory_id`, `client_code`, `company_name`, `status`.
* **Relationships:** Belongs to `Laboratory`. Has many `Contacts`, `Test Requests`, and `Samples`.
* **Lifecycle:** `Active` -> `Hold` -> `Inactive`.
* **Mutability:** Profile mutable with audit logging.
* **Versioning:** None.
* **Deletion Policy:** Soft-deactivate only. Cannot be deleted if Test Requests exist.
* **Audit Requirements:** Creation and updates logged as `CUSTOMER_UPDATED`.

---

## 5. Contact
* **Canonical Name:** `Contact`
* **Purpose:** A specific human at the Customer organization (e.g., Compliance Officer).
* **Identifier:** `contact_id` (UUIDv7)
* **Owner:** `Customer`.
* **Key Fields:** `customer_id`, `first_name`, `last_name`, `email`, `phone`, `role_title`, `is_primary_contact`.
* **Required Fields:** `customer_id`, `first_name`, `last_name`, `email`.
* **Relationships:** Belongs to `Customer`. Associated with `Test Requests`.
* **Lifecycle:** `Active` -> `Inactive`.
* **Mutability:** Mutable with audit tracking.
* **Versioning:** None.
* **Deletion Policy:** Soft-deactivate only.
* **Audit Requirements:** Logged as `CONTACT_UPDATED`.

---

## 6. Test Request (Work Order / Chain of Custody)
* **Canonical Name:** `Test Request`
* **Purpose:** The commercial order grouping submitted samples and requested analytical tests.
* **Identifier:** `test_request_id` (UUIDv7)
* **Owner:** `Customer`.
* **Key Fields:** `request_number` (human-readable e.g., `TR-2026-00412`), `customer_id`, `contact_id`, `customer_po_number`, `order_date`, `turnaround_time_days`, `status`, `special_instructions`.
* **Required Fields:** `request_number`, `customer_id`, `order_date`, `status`.
* **Relationships:** Belongs to `Customer`. Has many `Samples`. Originates `Reports`.
* **Lifecycle:** `DRAFT` -> `SUBMITTED` -> `ACCEPTED` -> `IN_PROGRESS` -> `COMPLETED` -> `CANCELLED`.
* **Mutability:** Commercial terms locked once accepted; status transitions auditable.
* **Versioning:** None.
* **Deletion Policy:** Soft-cancellation only (`CANCELLED` with mandatory reason).
* **Audit Requirements:** Logged as `TEST_REQUEST_CREATED`, `TEST_REQUEST_ACCEPTED`, `TEST_REQUEST_CANCELLED`.

---

## 7. Sample
* **Canonical Name:** `Sample`
* **Purpose:** The physical portion of material (water, soil, food) submitted for analysis.
* **Identifier:** `sample_id` (UUIDv7)
* **Owner:** `Test Request`.
* **Key Fields:** `accession_number` (e.g., `SAM-2026-00891`), `test_request_id`, `sample_type_id`, `client_sample_id` (client's field label), `collection_timestamp`, `received_timestamp`, `received_temperature_celsius`, `condition_on_receipt` (`INTACT`, `DAMAGED`, `PRESERVATION_ANOMALY`), `is_qualified` (boolean), `disclaimer_text`, `status`.
* **Required Fields:** `accession_number`, `test_request_id`, `sample_type_id`, `received_timestamp`, `condition_on_receipt`, `status`.
* **Relationships:** Belongs to `Test Request`. Has one `Sample Type`. Has many `Tests`.
* **Lifecycle:** Follows **Physical Sample Lifecycle** (`EXPECTED` -> `RECEIVED` -> `ACCESSIONED` / `QUALIFIED` -> `IN_STORAGE` -> `DISPOSED`).
* **Mutability:** Intake metadata locked after accessioning. Post-accession changes require explicit reason.
* **Versioning:** State-machine driven; changes produce audit entries.
* **Deletion Policy:** Never hard deleted. Cancel or Reject with reason.
* **Audit Requirements:** Logged as `SAMPLE_ACCESSIONED`, `SAMPLE_CONDITION_QUALIFIED`, `SAMPLE_DISPOSED`.

---

## 8. Sample Type (Matrix)
* **Canonical Name:** `Sample Type`
* **Purpose:** Material classification (e.g., `Drinking Water`, `Groundwater`, `Agricultural Soil`).
* **Identifier:** `sample_type_id` (UUIDv7)
* **Owner:** `Laboratory Catalog`.
* **Key Fields:** `code` (e.g., `WATER_POTABLE`), `name`, `default_preservation_temperature`, `description`.
* **Required Fields:** `code`, `name`.
* **Relationships:** Referenced by `Samples`, `Test Methods`, and `Specification Limits`.
* **Lifecycle:** `Active` -> `Deprecated`.
* **Mutability:** Immutable once referenced by historical samples.
* **Versioning:** Deprecate and create new type if rules change.
* **Deletion Policy:** Soft-deactivate only.
* **Audit Requirements:** Logged as `SAMPLE_TYPE_UPDATED`.

---

## 9. Test Method (SOP)
* **Canonical Name:** `Test Method`
* **Purpose:** The validated scientific standard operating procedure (e.g., `EPA 200.8`).
* **Identifier:** `test_method_id` (UUIDv7)
* **Owner:** `Laboratory Catalog`.
* **Key Fields:** `code` (e.g., `EPA_200_8`), `name`, `version`, `accreditation_status` (`ACCREDITED`, `NON_ACCREDITED`), `regulatory_agency` (e.g., EPA, ISO, ASTM), `status`.
* **Required Fields:** `code`, `name`, `version`, `accreditation_status`, `status`.
* **Relationships:** Contains many `Test Parameters`. Applied to `Tests`.
* **Lifecycle:** `Draft` -> `Active` -> `Superseded` -> `Retired`.
* **Mutability:** Published methods are immutable. Revisions increment `version`.
* **Versioning:** Versioned catalog entity.
* **Deletion Policy:** Cannot be deleted if historical tests reference it.
* **Audit Requirements:** Logged as `TEST_METHOD_REVISED`.

---

## 10. Test Parameter (Analyte)
* **Canonical Name:** `Test Parameter`
* **Purpose:** A specific measured substance (e.g., `Lead`, `Nitrate`, `pH`).
* **Identifier:** `test_parameter_id` (UUIDv7)
* **Owner:** `Test Method`.
* **Key Fields:** `test_method_id`, `name`, `chemical_formula`, `cas_number`, `default_unit_id`, `default_loq` (Decimal).
* **Required Fields:** `test_method_id`, `name`, `default_unit_id`, `default_loq`.
* **Relationships:** Belongs to `Test Method`. Target of `Results`.
* **Lifecycle:** `Active` -> `Deprecated`.
* **Mutability:** Immutable once active.
* **Versioning:** Catalog entity.
* **Deletion Policy:** Soft-deactivate only.
* **Audit Requirements:** Logged as `TEST_PARAMETER_UPDATED`.

---

## 11. Unit of Measurement (UoM)
* **Canonical Name:** `Unit of Measurement`
* **Purpose:** Standardized scientific units (e.g., `mg/L`, `µg/kg`, `pH units`).
* **Identifier:** `unit_id` (UUIDv7)
* **Owner:** `Laboratory Catalog`.
* **Key Fields:** `symbol`, `name`, `system` (`SI`, `METRIC`, `CUSTOMARY`).
* **Required Fields:** `symbol`, `name`.
* **Relationships:** Referenced by `Test Parameters`, `Results`, `Specification Limits`.
* **Lifecycle:** `Active` -> `Inactive`.
* **Mutability:** Immutable standard dictionary.
* **Versioning:** None.
* **Deletion Policy:** Hard deletion forbidden.
* **Audit Requirements:** Logged as `UNIT_CREATED`.

---

## 12. Specification Limit (Optional Catalog Threshold)
* **Canonical Name:** `Specification Limit`
* **Purpose:** Regulatory threshold (e.g., Lead MCL = `0.015 mg/L`) for out-of-spec flagging.
* **Identifier:** `specification_limit_id` (UUIDv7)
* **Owner:** `Laboratory Catalog`.
* **Key Fields:** `test_parameter_id`, `sample_type_id`, `lower_limit` (Decimal), `upper_limit` (Decimal), `limit_type` (`REGULATORY`, `ACTION_LEVEL`), `authority` (e.g., `EPA`).
* **Required Fields:** `test_parameter_id`, `limit_type`.
* **Relationships:** Connects `Test Parameter` and `Sample Type`. Evaluated against `Results`.
* **Lifecycle:** `Active` -> `Expired`.
* **Mutability:** Versioned on threshold modification.
* **Versioning:** Replaced by new effective date record.
* **Deletion Policy:** Soft-expire only.
* **Audit Requirements:** Logged as `SPECIFICATION_LIMIT_UPDATED`.

---

## 13. Instrument (Reference Inventory)
* **Canonical Name:** `Instrument`
* **Purpose:** Inventory reference linking tests to specific analytical equipment for traceability.
* **Identifier:** `instrument_id` (UUIDv7)
* **Owner:** `Laboratory`.
* **Key Fields:** `name`, `serial_number`, `model`, `manufacturer`, `asset_tag`, `status` (`OPERATIONAL`, `MAINTENANCE`, `OUT_OF_SERVICE`).
* **Required Fields:** `name`, `serial_number`, `status`.
* **Relationships:** Associated with `Tests`.
* **Lifecycle:** `Operational` -> `Maintenance` -> `Decommissioned`.
* **Mutability:** Maintenance and status history are append-only.
* **Versioning:** None.
* **Deletion Policy:** Soft-decommission only.
* **Audit Requirements:** Logged as `INSTRUMENT_STATUS_UPDATED`.

---

## 14. Test
* **Canonical Name:** `Test`
* **Purpose:** The schedulable work item binding a `Sample` to a `Test Method`.
* **Identifier:** `test_id` (UUIDv7)
* **Owner:** `Sample`.
* **Key Fields:** `sample_id`, `test_method_id`, `instrument_id`, `assigned_analyst_id`, `batch_reference_tag`, `status`, `started_at`, `completed_at`.
* **Required Fields:** `sample_id`, `test_method_id`, `status`.
* **Relationships:** Connects `Sample` to `Test Method`. Yields `Results`.
* **Lifecycle:** Follows **Test/Analysis Lifecycle** (`SCHEDULED` -> `IN_PROGRESS` -> `COMPLETED` / `CANCELLED`).
* **Mutability:** State transitions are auditable.
* **Versioning:** Repeated tests spawn a new child `Test`.
* **Deletion Policy:** Soft-cancellation only with reason.
* **Audit Requirements:** Logged as `TEST_SCHEDULED`, `TEST_COMPLETED`, `TEST_CANCELLED`.

---

## 15. Result
* **Canonical Name:** `Result`
* **Purpose:** Logical container for a scientific measurement on a specific parameter.
* **Identifier:** `result_id` (UUIDv7)
* **Owner:** `Test`.
* **Key Fields:** `test_id`, `test_parameter_id`, `current_version_id`, `current_version_number`, `is_below_detection_limit`, `status`.
* **Required Fields:** `test_id`, `test_parameter_id`, `status`.
* **Relationships:** Belongs to `Test`. References `Test Parameter`. Owns `Result Versions`.
* **Lifecycle:** Follows **Result Lifecycle** (`DRAFT` -> `ENTERED` -> `TECHNICALLY_REVIEWED` -> `AUTHORIZED` -> `AMENDED` / `INVALIDATED`).
* **Mutability:** Container row updates `current_version_id` and `status`; numerical values are never updated in-place.
* **Versioning:** Governed entirely by immutable `Result Version` records.
* **Deletion Policy:** Deletion strictly prohibited. Retract via `INVALIDATED` status.
* **Audit Requirements:** Logged as `RESULT_ENTERED`, `RESULT_REVIEWED`, `RESULT_AUTHORIZED`.

---

## 16. Result Version
* **Canonical Name:** `Result Version`
* **Purpose:** Permanent, immutable record of an exact decimal scientific value and calculation basis.
* **Identifier:** `result_version_id` (UUIDv7)
* **Owner:** `Result`.
* **Key Fields:** `result_id`, `version_number` (1, 2, 3...), `numeric_value` (Exact arbitrary-precision Decimal string), `qualifier` (`U` for undetected, `J` for estimated), `unit_id`, `dilution_factor` (Decimal, default `1.0`), `entered_by_user_id`, `entered_at`, `amendment_reason` (Mandatory if `version_number > 1`).
* **Required Fields:** `result_id`, `version_number`, `unit_id`, `entered_by_user_id`, `entered_at`.
* **Relationships:** Belongs to `Result`. Referenced by `Report Versions`.
* **Lifecycle:** Append-only snapshot.
* **Mutability:** **100% Immutable.**
* **Versioning:** Monotonically increasing version number per Result.
* **Deletion Policy:** **DELETION FORBIDDEN.**
* **Audit Requirements:** Logged as `RESULT_VERSION_CREATED`.

---

## 17. Report (Certificate of Analysis - CoA)
* **Canonical Name:** `Report`
* **Purpose:** Legal and scientific document entity issued to the customer.
* **Identifier:** `report_id` (UUIDv7)
* **Owner:** `Test Request`.
* **Key Fields:** `report_number` (e.g., `COA-2026-00891`), `test_request_id`, `customer_id`, `current_version_id`, `current_version_number`, `status`.
* **Required Fields:** `report_number`, `test_request_id`, `customer_id`, `status`.
* **Relationships:** Belongs to `Test Request`. Owns `Report Versions`.
* **Lifecycle:** Follows **Report Lifecycle** (`DRAFT` -> `PENDING_AUTHORIZATION` -> `RELEASED` -> `AMENDED` / `VOIDED`).
* **Mutability:** Status changes auditable. Released reports are locked.
* **Versioning:** Managed via `Report Version` editions.
* **Deletion Policy:** Deletion strictly prohibited. Retract via `VOIDED` status.
* **Audit Requirements:** Logged as `REPORT_COMPILED`, `REPORT_RELEASED`, `REPORT_VOIDED`.

---

## 18. Report Version
* **Canonical Name:** `Report Version`
* **Purpose:** An immutable, published edition of a Certificate of Analysis (PDF snapshot).
* **Identifier:** `report_version_id` (UUIDv7)
* **Owner:** `Report`.
* **Key Fields:** `report_id`, `version_number` (1, 2, 3...), `published_at`, `authorized_by_user_id`, `amendment_reason` (Mandatory if `version_number > 1`), `sha256_checksum`, `file_storage_path`.
* **Required Fields:** `report_id`, `version_number`, `published_at`, `authorized_by_user_id`, `sha256_checksum`.
* **Relationships:** Belongs to `Report`. References included `Result Version` IDs.
* **Lifecycle:** Append-only snapshot.
* **Mutability:** **100% Immutable.**
* **Versioning:** Revision edition.
* **Deletion Policy:** **DELETION FORBIDDEN.**
* **Audit Requirements:** Logged as `REPORT_VERSION_PUBLISHED`.

---

## 19. Audit Event
* **Canonical Name:** `Audit Event`
* **Purpose:** Tamper-evident, append-only historical ledger event per ADR-005.
* **Identifier:** `audit_event_id` (UUIDv7)
* **Owner:** Platform Audit Subsystem.
* **Key Fields:** `previous_event_hash`, `current_event_hash` (SHA-256), `actor_user_id`, `action`, `entity_type`, `entity_id`, `correlation_id`, `timestamp_utc`, `reason`, `diff_payload_json`.
* **Required Fields:** `previous_event_hash`, `current_event_hash`, `actor_user_id`, `action`, `entity_type`, `entity_id`, `timestamp_utc`.
* **Relationships:** Cross-cutting reference to any entity.
* **Lifecycle:** Append-only ledger.
* **Mutability:** **100% Immutable.**
* **Versioning:** Monotonic hash chain.
* **Deletion Policy:** **DELETION STRICTLY FORBIDDEN.** Protected against `UPDATE` and `DELETE` queries.
* **Audit Requirements:** Self-auditing ledger.
