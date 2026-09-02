# LabOS — Implementation Readiness Gate Checklist

This checklist defines the **mandatory quality, security, and architectural gates** that must be fully satisfied and verified before any production business feature can be considered ready for deployment.

---

## 1. Compiler & Code Quality Gates

- [ ] **Strict TypeScript Configuration (`tsconfig.json`):**
  - [ ] `"strict": true` enabled.
  - [ ] `"noImplicitAny": true` enabled.
  - [ ] `"strictNullChecks": true` enabled.
  - [ ] `"noFallthroughCasesInSwitch": true` enabled.
  - [ ] `"forceConsistentCasingInFileNames": true` enabled.
- [ ] **Linting & Code Formatting:**
  - [ ] ESLint configured with strict TypeScript rules.
  - [ ] Rules prohibiting `any` escapes (`@typescript-eslint/no-explicit-any: error`).
  - [ ] Prettier configured with consistent style rules across all files.
  - [ ] Pre-commit lint check script passing with zero warnings or errors.

---

## 2. Test Framework & Automation Gates

- [ ] **Automated Test Harness:**
  - [ ] Unit test framework configured (Jest or Vitest) with in-memory execution.
  - [ ] Integration test harness configured against real PostgreSQL (via Testcontainers or local test DB).
  - [ ] Global test setup handles automatic database migration and truncation between runs.
  - [ ] Coverage threshold configured (minimum 80% coverage on domain and calculation services).
- [ ] **Scientific Calculation Testing:**
  - [ ] Unit test suite proving exact decimal precision using `decimal.js` (no binary float drift).
  - [ ] Deterministic rounding tests (half-up / half-even) verified against ISO metrology guidelines.

---

## 3. Persistence & Migration Gates

- [ ] **Database & Migrations (ADR-003):**
  - [ ] PostgreSQL connection pool configured with health check ping on startup.
  - [ ] Type-safe ORM / query builder configured (Prisma or Drizzle).
  - [ ] Migration harness executes within transactional DDL (`BEGIN` ... `COMMIT`).
  - [ ] Migration rollback script tested and documented.
  - [ ] Database constraints active: primary keys (UUIDv7), non-null, unique, and foreign keys.
  - [ ] Primary database verified as the single system of record.

---

## 4. Environment & Secrets Management Gates

- [ ] **Environment Configuration:**
  - [ ] `.env.example` committed with comprehensive documentation for all variables.
  - [ ] Runtime environment validation on application bootstrap (e.g., via Zod schema).
  - [ ] Missing required variables immediately aborts startup with clear error messages.
- [ ] **Secret Handling (ADR-006 / Rulebook):**
  - [ ] Zero secrets, API keys, or private tokens committed to Git history.
  - [ ] Database passwords and OIDC client secrets injected solely via environment variables.
  - [ ] `.gitignore` configured to block `.env`, `.env.local`, and credential files.

---

## 5. Security & Identity Gates

- [ ] **Authentication Integration (ADR-006):**
  - [ ] OpenID Connect (OIDC) JWT validation middleware active.
  - [ ] Cryptographic signature verification of incoming Bearer tokens using IdP JWKS endpoint.
  - [ ] Token expiration (`exp`) and audience (`aud`) strictly verified.
- [ ] **Domain Authorization & RBAC:**
  - [ ] Role-Based Access Control (RBAC) Guard active on all non-public routes.
  - [ ] Method-level permission decorator (`@RequirePermission(...)`) operational.
  - [ ] Four-Eyes Principle guard operational with configurable dev-only bypass.
- [ ] **HTTP Security Headers:**
  - [ ] Helmet middleware configured (CORS, CSP, HSTS, X-Content-Type-Options).

---

## 6. Audit Infrastructure Gates (ADR-005)

- [ ] **Append-Only Event Ledger:**
  - [ ] `audit_events` table configured with database-level rule/trigger blocking `UPDATE` and `DELETE`.
  - [ ] Deterministic canonical JSON serialization implemented for event diff payloads.
  - [ ] SHA-256 cryptographic hash chaining algorithm implemented and verified.
  - [ ] Independent hash-chain verification utility test passing.
  - [ ] Atomic rollback verified: if audit write fails, entire business transaction rolls back.

---

## 7. Error Handling & Observability Gates

- [ ] **Error Handling Boundary:**
  - [ ] Global exception filter catching all unhandled exceptions.
  - [ ] All error responses conform to RFC 7807 Problem Details JSON format.
  - [ ] Stack traces suppressed in non-development environments.
- [ ] **Structured Logging & Tracing:**
  - [ ] Structured JSON logging active (Pino or Winston).
  - [ ] Correlation ID middleware injecting `X-Correlation-ID` on all inbound requests.
  - [ ] Zero sensitive personal or authentication data logged in plaintext.

---

## 8. Continuous Integration & Dependency Security Gates

- [ ] **CI Pipeline Configuration:**
  - [ ] Automated CI workflow running on all branches and pull requests.
  - [ ] Pipeline step 1: `npm run lint` (ESLint + Prettier).
  - [ ] Pipeline step 2: `npm run typecheck` (tsc `--noEmit`).
  - [ ] Pipeline step 3: `npm run test` (Unit tests).
  - [ ] Pipeline step 4: `npm run test:integration` (Integration tests with PostgreSQL).
- [ ] **Dependency Security Scanning:**
  - [ ] `npm audit` or Snyk scanning integrated into CI (zero high or critical vulnerabilities).
  - [ ] Lockfile (`package-lock.json`) strictly committed and enforced via `npm ci`.
  - [ ] No unapproved or superfluous third-party dependencies installed.
