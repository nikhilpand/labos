# ADR-003: Primary Database Engine & Persistence Strategy — PostgreSQL

- **Status:** Approved
- **Date:** 2026-09-03

---

## Context

A Laboratory Operating System handles complex, multi-entity scientific lifecycles: clients, orders, samples, aliquots, batches, instruments, quality controls, results, and audit trails. 

A failure in data persistence can lead to lost chain of custody, orphaned records, or partial writes. To maintain scientific and regulatory integrity, the persistence engine must offer rock-solid transactional guarantees, strict relational modeling, and predictable schema evolutions.

---

## Options Considered

1. **PostgreSQL (Relational SQL):** The industry benchmark for open-source relational databases. Full ACID compliance, transactional DDL migrations, rich constraints, native UUID support, and powerful JSONB capabilities.
2. **SQLite (File-Based SQL):** Zero-configuration setup, but lacks concurrent write throughput, advanced row-level security, and multi-user enterprise capabilities.
3. **MongoDB / Document NoSQL:** Flexible schema, but fundamentally lacks strict relational foreign keys and ACID transactions across disparate collections, making chain-of-custody enforcement fragile.
4. **MySQL / MariaDB:** Mature relational database, but lacks transactional schema migrations (a failed migration can corrupt the schema state) and has less sophisticated JSON querying than PostgreSQL.

---

## Decision

**LabOS will use PostgreSQL as the sole system of record for both local development and production.**

### Mandatory Requirements:
1. **Relational Integrity:** Core laboratory entities must be modeled using explicit relational tables with database-enforced foreign keys, not-null constraints, and unique constraints.
2. **ACID Transactions:** Multi-entity operations (e.g., sample intake accompanied by audit trail creation) must execute within strict database transactions. Partial writes are prohibited.
3. **Versioned Migrations:** All schema changes must be managed via version-controlled, reproducible, and reversible migration scripts. Manual table alterations are strictly prohibited.
4. **UUIDs for Stable Identifiers:** All primary domain entities must use UUIDs (e.g., UUIDv4 or UUIDv7) as primary keys to ensure stable, collision-free identification across distributed environments and audit trails.
5. **PostgreSQL JSONB Strictly for Genuinely Flexible Data:** The `JSONB` data type is permitted **only** for storing genuinely dynamic, heterogeneous data—such as arbitrary instrument run parameters, raw vendor-specific telemetry, or flexible metadata. Core domain entities, relationships, and auditable states must remain strictly relational.
6. **PostgreSQL as the Single System of Record:** External search indexes, caches, or analytical stores may only act as read-optimized replicas. PostgreSQL remains the authoritative, tamper-resistant system of record.

---

## Rationale

- **Transactional DDL:** PostgreSQL is one of the few relational engines that wraps schema migrations inside transactions. If a migration script fails halfway through, the entire change is rolled back automatically, preventing database corruption.
- **Data Integrity by Default:** Strict database-level foreign keys ensure orphaned records (e.g., an aliquot with no parent sample, or a test result with no associated batch) can never exist, regardless of application bugs.
- **Environment Parity:** Using PostgreSQL in both local development (via Docker) and production eliminates the "works on my machine" bugs that arise when developers use SQLite locally while running PostgreSQL in production.
- **Hybrid Relational + JSONB Power:** PostgreSQL allows LabOS to maintain uncompromising relational structure for chain-of-custody while easily accommodating hundreds of differing instrument output formats via indexed JSONB columns.

---

## Consequences

### Positive
- Unmatched data reliability and regulatory auditability.
- Safe, rollback-capable schema migrations.
- High developer confidence through environment parity between development and production.
- Fast, indexed querying across both tabular and semi-structured instrument data.

### Negative
- Local development requires running a PostgreSQL service or Docker container (cannot run as a zero-config single file).

---

## Explicit Non-Goals

- Using NoSQL document databases as the primary persistence layer.
- Storing core business relationships inside unvalidated JSON blobs.
- Permitting non-transactional or out-of-band schema modifications.

---

## Reconsideration Criteria

This decision will not be reconsidered unless a fundamental architectural paradigm shift occurs that renders relational database technology obsolete.
