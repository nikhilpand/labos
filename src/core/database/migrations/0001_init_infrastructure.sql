-- ==============================================================================
-- Migration: 0001_init_infrastructure.sql
-- Purpose: Initialize platform system metadata to verify connectivity & migrations
-- ADR Reference: ADR-003 (PostgreSQL Persistence & Transactional Migrations)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS system_metadata (
    key VARCHAR(64) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed baseline platform marker
INSERT INTO system_metadata (key, value)
VALUES ('platform_version', '0.1.0-foundation')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
