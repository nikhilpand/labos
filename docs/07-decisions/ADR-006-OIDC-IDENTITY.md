# ADR-006: Identity, Authentication & Domain Authorization Architecture

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

Laboratory systems manage critical scientific, proprietary, and regulated data. Security, identity, and access control are fundamental requirements. 

However, building custom authentication mechanisms (storing password hashes, building password resets, token rotation, multi-factor authentication) in application code is a well-known security anti-pattern that creates maintenance liability and security vulnerabilities.

Furthermore, laboratory environments operate in diverse IT landscapes:
- Commercial analytical labs frequently run corporate Single Sign-On (SSO) using Microsoft Azure AD / Entra ID or Okta.
- Hospital and academic research laboratories use LDAP, Active Directory, or institutional OpenID Connect (OIDC) identity providers.
- Local developer and on-premise environments require a zero-cost, self-hostable identity solution.

---

## Options Considered

1. **Custom Password Authentication (Roll-Our-Own):** Storing user credentials in local PostgreSQL tables and writing custom authentication endpoints. High security risk, high maintenance, and incompatible with enterprise SSO.
2. **Proprietary Cloud-Only SaaS (e.g., Auth0, Clerk):** Excellent developer experience, but creates vendor lock-in and prevents offline, air-gapped, or strictly on-premise laboratory deployments.
3. **Standards-Based OIDC / OAuth2 Architecture (Chosen):** Decoupling authentication to standard OpenID Connect / OAuth2 identity providers, using self-hostable solutions (Keycloak) for local development and standard OIDC federation for enterprise SSO.

---

## Decision

**LabOS will use OpenID Connect (OIDC) and OAuth2 protocols for all user identity and authentication integration.**

Custom password management and raw credential storage in LabOS application tables are strictly prohibited.

### Strict Separation: Authentication vs. Authorization

LabOS establishes a rigid architectural separation between verifying identity and granting laboratory authority:

```text
┌────────────────────────────────────────────────────────┐
│             Authentication ("Who are you?")           │
│   - Delegated to OIDC / OAuth2 Identity Provider       │
│   - Handles passwords, MFA, SSO, session security      │
│   - Emits standardized Identity Tokens (JWTs)          │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│             Authorization ("What can you do?")         │
│   - Managed entirely inside LabOS                      │
│   - Domain-level roles (Accessioner, Analyst, QA)      │
│   - Granular permissions (Approve Run, Amend Result)   │
│   - Laboratory section & department access boundaries  │
│   - Electronic signature verification workflows        │
└────────────────────────────────────────────────────────┘
```

1. **Authentication (Who is the user?):**
   - Delegated entirely to a standards-compliant OpenID Connect / OAuth2 Identity Provider (IdP).
   - The IdP is responsible for credential verification, password policies, multi-factor authentication (MFA), and session token issuance.
   - For **local development**, LabOS will support a self-hostable, standards-based identity provider (such as **Keycloak** running via Docker).
   - In **production**, LabOS will support standard OIDC integration with enterprise identity providers (e.g., Microsoft Azure AD / Entra ID, Okta, Ping Identity, Google Workspace).

2. **Authorization (What is the user allowed to do?):**
   - **LabOS manages its own internal domain authorization.** External IdPs should not dictate laboratory-specific business rules.
   - LabOS maintains its own internal role definitions (e.g., `Sample Accessioner`, `Analytical Chemist`, `Quality Assurance Manager`, `Lab Director`).
   - LabOS enforces fine-grained permission checks on every domain action (e.g., only an authorized `Lab Director` can release a certified CoA).
   - LabOS will govern its own future **electronic signature workflows** (including 21 CFR Part 11 requirements for re-authenticating user credentials immediately prior to signing off on critical scientific results).

---

## Rationale

- **Security by Standard:** Eliminates the risk of implementing flawed custom authentication protocols, credential leaks, or insecure password storage.
- **Enterprise Ready:** Connecting to a client lab's existing corporate Active Directory or Okta system requires zero architectural restructuring.
- **Self-Hostable & Offline Capable:** By using open standards and supporting Keycloak, LabOS can run entirely on-premise in secure, air-gapped scientific testing environments without requiring external internet connectivity.
- **Clear Domain Boundaries:** Keeping authorization logic inside LabOS ensures laboratory business rules (such as four-eyes review, where the person who ran the assay cannot sign off on the report) remain strictly governed by the domain layer.

---

## Consequences

### Positive
- Zero credential storage liabilities in LabOS databases.
- Seamless compatibility with enterprise SSO.
- Ability to run locally and on-premise without cloud vendor lock-in.
- Clear, auditable domain-level role and permission governance.

### Negative
- Local development requires running an identity provider container (e.g., Keycloak) alongside the database.
- Backend API must validate incoming JWT tokens and map external Subject IDs (`sub`) to internal LabOS user profiles.

---

## Explicit Non-Goals

- Building custom login/password storage or custom password-reset flows.
- Relying on external IdP groups to hard-code scientific laboratory permissions.
- Writing authentication or Keycloak setup scripts during Phase 0.

---

## Reconsideration Criteria

This decision will only be reconsidered if an embedded, lightweight development identity mock is temporarily required to streamline isolated automated unit testing suites.
