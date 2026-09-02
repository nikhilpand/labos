# ADR-002: Technology Stack & Scientific Calculation Rigor — TypeScript with NestJS

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

LabOS requires a backend technology stack that satisfies several critical demands:
1. **Enforced Modularity:** The architecture is committed to a Modular Monolith. The framework must physically encourage clean module boundaries, dependency injection, and separation of concerns.
2. **Beginner Maintainability & AI-Assisted Development:** The codebase will be developed and maintained with significant assistance from AI coding tools. The language and framework must be one where AI models exhibit the highest accuracy, lowest hallucination rate, and cleanest refactoring support.
3. **Type Safety & Data Integrity:** Scientific calculations, chain of custody, and regulatory audits cannot tolerate unhandled `null`/`undefined` states or ambiguous data shapes.
4. **Scientific Numeric Rigor:** Binary floating-point arithmetic (IEEE 754) is notoriously imprecise in standard runtimes (e.g., `0.1 + 0.2 = 0.30000000000000004`). Laboratory calculations (dilutions, standard curve regressions, parts-per-billion contaminant thresholds) demand exact decimal accuracy.

---

## Options Considered

1. **TypeScript + NestJS (Node.js):** Highly structured, enterprise module system, outstanding AI model familiarity, unified language across backend and future web frontend.
2. **Kotlin + Spring Boot (JVM):** Enterprise standard in banking/healthcare, built-in `BigDecimal`. However, steep learning curve for beginners and heavy runtime reflection/annotation magic that makes AI-assisted debugging difficult.
3. **Python + FastAPI:** Native scientific ecosystem, but type safety is opt-in and dynamic runtime errors are common; lacks enforced modular boundaries.
4. **C# + ASP.NET Core:** Strongly typed and fast, but smaller ecosystem for modern open-source web tooling and AI coding benchmarks compared to TypeScript.

---

## Decision

**LabOS will use TypeScript with NestJS running in strict TypeScript mode.**

### Mandatory Requirements:
1. **Strict Type Checking:** `"strict": true`, `"strictNullChecks": true`, and `"noImplicitAny": true` must be enabled across all configuration files.
2. **No Implicit Any:** All variables, function parameters, and return types must be explicitly typed.
3. **Runtime Input Validation:** Compile-time types disappear at runtime. Strict schema validation (e.g., via `class-validator` / `Zod`) is mandatory at all system boundaries (HTTP request payloads, instrument file parsing, queue messages). Data that fails validation must be rejected before entering domain services.
4. **No Native JavaScript Floating-Point for Critical Results:** Standard JavaScript `number` arithmetic must **never** be used for critical scientific calculations, assay results, limits of detection, calibration curves, or regulatory thresholds.
5. **Exact Decimal Handling:** Dedicated arbitrary-precision decimal libraries (such as `decimal.js` or `bignumber.js`) must be used for all scientific calculations.
6. **Deterministic Calculation Rules:** All mathematical and scientific calculation logic must be isolated in pure, deterministic domain functions with comprehensive automated unit tests covering edge cases, rounding modes, and boundary thresholds.

---

## Rationale

- **Enforced Architectural Boundaries:** NestJS organizes code strictly into `@Module()`, `@Injectable()` services, and controllers. This mirrors enterprise patterns (like Spring or Angular) while keeping the application in a single, cohesive codebase.
- **AI-Assisted Precision:** Modern AI coding tools have immense training depth in TypeScript and NestJS, generating idiomatic, highly maintainable, and strongly typed code.
- **Elimination of Floating-Point Traps:** By explicitly mandating decimal math libraries at the architectural level, LabOS avoids the subtle rounding errors that plague software relying on native floating-point math.
- **Shared Contracts:** When frontend interfaces are developed in the future, data transfer objects (DTOs) and validation schemas can be shared directly without duplicate definitions.

---

## Consequences

### Positive
- Strict compile-time and runtime safety guarantees.
- Seamless developer experience with high-accuracy AI pair programming.
- Exact, verifiable scientific calculations without floating-point distortion.
- Clean modular boundaries enforced by the framework.

### Negative
- Requires developer discipline to always wrap numbers in decimal objects rather than using primitive operators (`+`, `*`, `/`).
- Heavy CPU bursts (e.g., intensive mathematical modeling) run on Node's single-threaded event loop and must be delegated to worker threads if long-running.

---

## Explicit Non-Goals

- Writing unvalidated HTTP endpoints or using `any` type escapes.
- Using native JavaScript `number` arithmetic for analytical sample results.
- Splitting the NestJS application into microservices or distributed RPC networks.

---

## Reconsideration Criteria

This decision may be reconsidered if:
1. Long-term computational profiling demonstrates that Node.js worker threads cannot sustain analytical execution throughput, necessitating an isolated compute worker.
2. A critical dependency or native instrument driver is strictly unavailable in the Node.js/TypeScript ecosystem.
