# Specification 001: Customer Registration with Primary Contact & Audit Trail

- **Specification ID:** `SPEC-001`
- **Status:** Completed
- **Target Release:** Core V1 Milestone 1
- **Domain Focus:** Commercial Foundation & Architecture Validation
- **Completed Date:** 2026-09-03
- **Verification Evidence:** 34 unit tests & 32 real PostgreSQL integration tests passing

---

## 1. User Story

> **As an authorized** Laboratory Registrar / Accessioner,  
> **I want to** register a new commercial Customer account along with their designated primary Contact in our Laboratory,  
> **So that** the laboratory can establish an auditable commercial relationship and accept incoming sample test requests under an active customer account.

---

## 2. Why This is the First Vertical Slice

This feature represents the **smallest possible end-to-end architectural slice** that exercises 100% of the foundational primitives mandated in ADR-001 through ADR-006:
1. **Authenticated Identity (ADR-006):** Validates external OIDC Bearer JWTs.
2. **Domain Authorization (ADR-006):** Verifies internal `customer:create` permission via RBAC guards.
3. **Laboratory Facility Context (ADR-001):** Links the new customer directly to the active `laboratory_id`.
4. **API Boundary & Runtime Validation (ADR-002):** Schema validation at the HTTP edge with RFC 7807 error envelopes.
5. **PostgreSQL Relational Persistence (ADR-003):** Inserts rows into `customers` and `contacts` with UUIDv7 primary keys and foreign keys.
6. **ACID Transaction Boundary (ADR-003):** Atomically writes Customer, Contact, and Audit Event in a single database transaction.
7. **Domain Business Invariant:** Enforces unique client code per laboratory and mandatory primary contact.
8. **Append-Only Audit Ledger (ADR-005):** Computes and stores a SHA-256 hash-chained audit event.
9. **Automated Test Coverage:** Exercises unit, integration (real PostgreSQL), and security tests.

---

## 3. Scope Definition

### In Scope
* `POST /api/v1/customers` endpoint.
* Authenticated user extraction from OIDC JWT.
* Validation of `laboratory_id` context.
* Atomic creation of:
  * 1 `Customer` entity (`status = 'ACTIVE'`).
  * 1 `Contact` entity (`is_primary_contact = true`).
  * 1 `Audit Event` entity (`action = 'CUSTOMER_REGISTERED'`).
* Domain error handling (duplicate client code, invalid email).
* Automated unit and integration test suite.

### Out of Scope
* Updating or soft-deleting customers (subsequent slice).
* Adding secondary contacts (subsequent slice).
* Customer search or pagination list endpoint (subsequent slice).
* Invoicing, credit limits, or payment terms logic.
* Frontend user interface (backend API slice only).

---

## 4. Entities Affected

```text
┌───────────────────────────┐         ┌───────────────────────────┐
│         Customer          │ 1     1 │          Contact          │
│  - customer_id (UUIDv7)   ├─────────┤  - contact_id (UUIDv7)    │
│  - laboratory_id (UUIDv7) │         │  - customer_id (UUIDv7)   │
│  - client_code (string)   │         │  - first_name (string)    │
│  - company_name (string)  │         │  - last_name (string)     │
│  - status = 'ACTIVE'      │         │  - email (string)         │
└─────────────┬─────────────┘         │  - is_primary_contact=true│
              │                       └───────────────────────────┘
              │ 1
              │ triggers
              ▼ 1
┌───────────────────────────┐
│        Audit Event        │
│  - audit_event_id (UUIDv7)│
│  - actor_user_id (UUIDv7) │
│  - action = CUSTOMER_REG  │
│  - entity_id = customer_id│
│  - current_event_hash     │
└───────────────────────────┘
```

---

## 5. Security & Permissions

* **Authentication:** Valid OIDC Bearer Token in `Authorization: Bearer <JWT>` header.
* **Required Permission:** `customer:create`.
* **Authorized Roles:** `ADMIN`, `ACCESSIONER`, `DIRECTOR`.
* **Forbidden Roles:** `ANALYST` (without registrar permissions), unauthenticated anonymous requests.

---

## 6. API Contract

### Request Endpoint
`POST /api/v1/customers`

### Request Headers
```http
Authorization: Bearer <valid_jwt>
Content-Type: application/json
Idempotency-Key: 7b56d34e-85bb-4f01-9a73-9366df0471c9 (Optional)
```

### Request Payload Schema (Zod / DTO)
```json
{
  "clientCode": "CUST-1042",
  "companyName": "Acme Environmental Services Ltd",
  "billingAddress": {
    "street": "100 Industrial Parkway",
    "city": "Springfield",
    "state": "IL",
    "postalCode": "62701",
    "country": "USA"
  },
  "primaryContact": {
    "firstName": "Sarah",
    "lastName": "Jenkins",
    "email": "s.jenkins@acme-env.com",
    "phone": "+1-217-555-0199",
    "roleTitle": "Compliance Director"
  }
}
```

### Success Response (`201 Created`)
```json
{
  "data": {
    "customerId": "019182ab-c012-789a-bcde-f0123456789a",
    "laboratoryId": "01918000-0000-7000-8000-000000000001",
    "clientCode": "CUST-1042",
    "companyName": "Acme Environmental Services Ltd",
    "status": "ACTIVE",
    "createdAt": "2026-09-03T02:15:00.000Z",
    "primaryContact": {
      "contactId": "019182ab-c013-789a-bcde-f0123456789b",
      "firstName": "Sarah",
      "lastName": "Jenkins",
      "email": "s.jenkins@acme-env.com",
      "phone": "+1-217-555-0199",
      "isPrimaryContact": true
    },
    "auditEventId": "019182ab-c014-789a-bcde-f0123456789c"
  }
}
```

### Error Responses (RFC 7807)
* **`400 Bad Request`:** Invalid payload (e.g., missing company name or invalid email format).
* **`401 Unauthorized`:** Missing or expired JWT.
* **`403 Forbidden`:** Authenticated user lacks `customer:create` permission.
* **`409 Conflict`:** Client code `CUST-1042` already exists within this laboratory.

---

## 7. Persistence & Transaction Boundary

The service layer must execute inside an explicit **single ACID database transaction**:

```typescript
// Architectural Transaction Invariant:
await database.transaction(async (tx) => {
  // 1. Verify unique clientCode in active laboratory
  // 2. Insert Customer row
  // 3. Insert Contact row (with customer_id foreign key)
  // 4. Retrieve latest previous_event_hash from audit_events
  // 5. Compute SHA256(previous_hash + canonical_event_json)
  // 6. Insert Audit Event row
  // If ANY step throws an error, tx rolls back 100% of writes.
});
```

---

## 8. Audit Event Specification

* **Action:** `CUSTOMER_REGISTERED`
* **Actor:** Extracted from verified JWT (`sub` claim mapped to internal `user_id`).
* **Entity Type:** `Customer`
* **Entity ID:** Created `customer_id`
* **Diff Payload (Canonical JSON):**
  ```json
  {
    "clientCode": "CUST-1042",
    "companyName": "Acme Environmental Services Ltd",
    "status": "ACTIVE",
    "primaryContactEmail": "s.jenkins@acme-env.com"
  }
  ```
* **Hash Computation:** $\text{current\_hash} = \text{SHA-256}(\text{previous\_hash} + \text{canonical\_diff\_payload})$

---

## 9. Acceptance Criteria & Automated Tests

### Unit Tests
1. **DTO Validation Test:** Rejects invalid emails, empty client codes, and special characters.
2. **Audit Hash Test:** Verifies canonical serialization produces deterministic SHA-256 digests.

### Integration Tests (Against real PostgreSQL via Testcontainers)
3. **Happy Path:** Submitting valid payload inserts 1 customer, 1 contact, and 1 audit event; returns `201 Created`.
4. **Duplicate Client Code Conflict:** Inserting the same `clientCode` twice returns `409 Conflict` on the second attempt.
5. **Atomic Rollback on Audit Failure:** Simulating an audit engine failure during customer registration confirms zero customer or contact rows remain in the database.
6. **Authorization Guard:** Sending request without `customer:create` permission returns `403 Forbidden`.
7. **Unauthenticated Access:** Sending request without `Authorization` header returns `401 Unauthorized`.
