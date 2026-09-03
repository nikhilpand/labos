-- ==============================================================================
-- Migration: 0002_laboratory_and_auth_context.sql
-- Purpose: Establish Organization, Laboratory, User, and RBAC schema prerequisites
-- ADR Reference: ADR-001 (ISO 17025 Laboratory), ADR-006 (OIDC Identity & Authorization)
-- ==============================================================================

-- 1. Organizations (Top-level legal governing entity)
CREATE TABLE IF NOT EXISTS organizations (
    organization_id UUID PRIMARY KEY,
    legal_name VARCHAR(255) NOT NULL,
    tax_identifier VARCHAR(64),
    country_of_incorporation VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_org_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'))
);

-- 2. Laboratories (Accredited scientific testing facility)
CREATE TABLE IF NOT EXISTS laboratories (
    laboratory_id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(organization_id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    accreditation_number VARCHAR(64) NOT NULL,
    accreditation_body VARCHAR(64) NOT NULL DEFAULT 'ISO/IEC 17025',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_lab_status CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE'))
);

-- 3. Users (Laboratory staff and system actors)
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    oidc_subject_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    job_title VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED'))
);

-- 4. Roles (Internal Laboratory RBAC)
CREATE TABLE IF NOT EXISTS roles (
    role_id UUID PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Permissions (Granular domain action codes)
CREATE TABLE IF NOT EXISTS permissions (
    permission_code VARCHAR(64) PRIMARY KEY,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Role-Permission mappings
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_code VARCHAR(64) NOT NULL REFERENCES permissions(permission_code) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_code)
);

-- 7. User-Role assignments
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- ==============================================================================
-- Baseline System Seed Data (Deterministic UUIDv7 markers)
-- ==============================================================================

-- Baseline Organization
INSERT INTO organizations (organization_id, legal_name, tax_identifier, country_of_incorporation, status)
VALUES (
    '01918000-0000-7000-8000-000000000000',
    'Apex Scientific Holdings Inc',
    'US-EIN-987654321',
    'USA',
    'ACTIVE'
) ON CONFLICT (organization_id) DO NOTHING;

-- Baseline ISO/IEC 17025 Testing Laboratory
INSERT INTO laboratories (laboratory_id, organization_id, name, accreditation_number, accreditation_body, status)
VALUES (
    '01918000-0000-7000-8000-000000000001',
    '01918000-0000-7000-8000-000000000000',
    'Apex Environmental & Chemical Testing Labs',
    'AT-2941-ISO17025',
    'A2LA',
    'ACTIVE'
) ON CONFLICT (laboratory_id) DO NOTHING;

-- Baseline Permissions
INSERT INTO permissions (permission_code, description)
VALUES 
    ('customer:create', 'Permission to register a new commercial customer account and primary contact')
ON CONFLICT (permission_code) DO NOTHING;

-- Baseline System Roles
INSERT INTO roles (role_id, code, name, description)
VALUES 
    ('01918000-0000-7000-8000-000000000010', 'ADMIN', 'System Administrator', 'Full administrative authority across laboratory settings'),
    ('01918000-0000-7000-8000-000000000011', 'ACCESSIONER', 'Sample Registrar / Accessioner', 'Responsible for customer registration, sample intake, and work orders'),
    ('01918000-0000-7000-8000-000000000012', 'DIRECTOR', 'Laboratory Director', 'Overall scientific and accreditation authority for laboratory operations'),
    ('01918000-0000-7000-8000-000000000013', 'ANALYST', 'Analytical Chemist / Testing Technician', 'Conducts analytical runs and records scientific measurements')
ON CONFLICT (role_id) DO NOTHING;

-- Map customer:create to ADMIN, ACCESSIONER, DIRECTOR
INSERT INTO role_permissions (role_id, permission_code)
VALUES 
    ('01918000-0000-7000-8000-000000000010', 'customer:create'),
    ('01918000-0000-7000-8000-000000000011', 'customer:create'),
    ('01918000-0000-7000-8000-000000000012', 'customer:create')
ON CONFLICT (role_id, permission_code) DO NOTHING;
