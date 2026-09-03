-- ==============================================================================
-- Migration: 0003_audit_ledger.sql
-- Purpose: Create append-only, tamper-evident audit ledger with PostgreSQL triggers
-- ADR Reference: ADR-005 (Audit Trail & Historical Data Immutability Architecture)
-- ==============================================================================

-- 1. Audit Chain Heads (Maintains the latest cryptographic state per laboratory for serialized locking)
CREATE TABLE IF NOT EXISTS audit_chain_heads (
    laboratory_id UUID PRIMARY KEY REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    latest_event_hash VARCHAR(64) NOT NULL,
    total_events BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Audit Events (Append-only immutable historical event ledger)
CREATE TABLE IF NOT EXISTS audit_events (
    audit_event_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    sequence_number BIGINT NOT NULL,
    actor_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    correlation_id VARCHAR(64) NOT NULL,
    reason TEXT,
    diff_payload JSONB NOT NULL,
    previous_event_hash VARCHAR(64) NOT NULL,
    current_event_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_audit_lab_sequence UNIQUE (laboratory_id, sequence_number)
);

-- Index for entity-level audit traceability (backward lookup from entity to all events)
CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events (entity_type, entity_id);

-- Index for correlation tracing
CREATE INDEX IF NOT EXISTS idx_audit_events_correlation ON audit_events (correlation_id);

-- ==============================================================================
-- Immutability Enforcement Trigger
-- Structural prevention of UPDATE and DELETE on audit_events
-- ==============================================================================

CREATE OR REPLACE FUNCTION protect_audit_ledger()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '[Audit Invariant Violation] Audit ledger records are permanent and immutable. UPDATE and DELETE operations are strictly prohibited by ISO/IEC 17025 and ADR-005.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_audit_events ON audit_events;
CREATE TRIGGER trg_protect_audit_events
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION protect_audit_ledger();

-- Seed genesis chain head for default testing laboratory
INSERT INTO audit_chain_heads (laboratory_id, latest_event_hash, total_events)
VALUES (
    '01918000-0000-7000-8000-000000000001',
    '0000000000000000000000000000000000000000000000000000000000000000',
    0
) ON CONFLICT (laboratory_id) DO NOTHING;
