# ADR-004: Core Architectural Strategy — Modular Monolith as Permanent Default

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

A frequent architectural anti-pattern in modern software engineering is premature decomposition into microservices. While microservices can offer independent deployment for large, multi-team organizations, they introduce severe liabilities:
1. **Network Latency & Failure Modes:** In-memory calls become network RPCs subject to timeouts, packet drops, and partial failures.
2. **Distributed Transaction Complexities:** In a laboratory system, a single operation often spans multiple domains (e.g., sample accessioning + barcode creation + audit logging). In microservices, this requires distributed transactions (Sagas, two-phase commits), which are notoriously prone to split-brain states and data desynchronization.
3. **Operational Burden:** Demands container orchestrators (Kubernetes), distributed tracing, service meshes, and complex API gateways, creating unnecessary friction for development teams and AI tools.

LabOS requires an architecture that provides strict domain encapsulation, high developer velocity, simple operations, and transactional data consistency.

---

## Options Considered

1. **Modular Monolith (Chosen):** A single deployable application structured into strictly decoupled, domain-driven modules with explicit public interfaces and shared database transactions.
2. **Microservices from the Start:** Decomposing every business capability (Sample Service, Assay Service, QC Service, Report Service) into separate repositories and deployable services.
3. **Microservices as a Guaranteed Future Destination:** Building a monolith with the explicit assumption of splitting it into microservices later.

---

## Decision

**LabOS will use a Modular Monolith as its default, permanent long-term architecture.**

Microservices are **not** a planned destination for LabOS. The core laboratory business logic, workflow state machines, and audit trail will remain inside the modular monolith unless a formal Architecture Decision Record explicitly changes this.

### Strict Exceptions for External Services / Satellite Workers
External workers or auxiliary services may **only** be introduced when there is an overwhelming, documented justification matching one of these three criteria:

1. **Extreme Isolated Compute Requirements:** Heavy, long-running calculations (such as whole-genome sequencing alignment, 3D molecular modeling, or AI image analysis) that would starve the main web application's CPU/memory resources and require dedicated compute nodes.
2. **Essential Technology Requiring a Different Runtime:** Mandatory integration with a scientific tool, proprietary instrument driver, or legacy laboratory hardware that only provides an SDK in a non-Node.js runtime (e.g., C++, Python, or C#).
3. **Strong Security Sandboxing Requirements:** The need to execute untrusted user-submitted custom calculation scripts or plugins within an isolated, hardened sandbox container to protect the core application.

Even when an external worker is introduced under these conditions, it acts as a non-authoritative **satellite worker**. The core business rules, entity state transitions, and audit records remain strictly governed inside the Modular Monolith.

---

## Rationale

- **Transactional Consistency:** Laboratory workflows require atomic operations. In a modular monolith, complex multi-entity operations run within a single, bulletproof PostgreSQL database transaction.
- **Maintainability & AI Ergonomics:** AI coding assistants and human developers can easily navigate, understand, and refactor a single codebase without dealing with network mocks, cross-service contracts, or distributed tracing.
- **Operational Simplicity:** A modular monolith can be deployed as a single container, scaled horizontally behind a standard load balancer, and backed up with standard PostgreSQL tooling.
- **High Performance:** Communication between modules occurs via in-memory function calls rather than serialized JSON over HTTP or message queues, eliminating network overhead.

---

## Consequences

### Positive
- Zero network latency between domain modules.
- Bulletproof ACID transactions across multi-module workflows.
- Radically simplified local development, testing, and deployment.
- Clean separation of concerns through enforced NestJS module boundaries.

### Negative
- All modules share the same runtime process; an uncaught fatal crash in one module could restart the process (mitigated by process supervisors, robust error boundaries, and horizontal scaling).
- Requires architectural discipline to ensure modules do not directly access each other's database tables or bypass public service interfaces.

---

## Explicit Non-Goals

- Building distributed microservice networks, service meshes, or distributed event buses.
- Decomposing core laboratory features (accessioning, QC, reporting) into independent deployable microservices.
- Using distributed saga transactions for core domain workflows.

---

## Reconsideration Criteria

This decision will only be reconsidered if:
1. The engineering organization scales to dozens of independent teams requiring distinct deployment cadences that cannot be coordinated in a single release pipeline.
2. A specific functional capability satisfies one of the three documented satellite worker exceptions, triggering a dedicated ADR for that specific worker.
