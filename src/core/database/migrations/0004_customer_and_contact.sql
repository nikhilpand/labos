-- ==============================================================================
-- LabOS Database Migration: 0004_customer_and_contact.sql
-- Description: Core V1 Customer & Contact Entities (SPEC-001)
-- Normalized relational schema with strict multi-tenant constraints & partial index
-- ==============================================================================

-- 1. Customers Table
CREATE TABLE IF NOT EXISTS customers (
    customer_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    client_code VARCHAR(64) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    billing_street VARCHAR(255),
    billing_city VARCHAR(100),
    billing_state VARCHAR(100),
    billing_postal_code VARCHAR(20),
    billing_country VARCHAR(100),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'HOLD', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customers_lab_client_code UNIQUE (laboratory_id, client_code),
    CONSTRAINT chk_customer_client_code_nonempty CHECK (length(trim(client_code)) > 0),
    CONSTRAINT chk_customer_company_name_nonempty CHECK (length(trim(company_name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_customers_laboratory_id ON customers(laboratory_id);
CREATE INDEX IF NOT EXISTS idx_customers_client_code ON customers(laboratory_id, client_code);

-- 2. Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
    contact_id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role_title VARCHAR(100),
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_contacts_first_name_nonempty CHECK (length(trim(first_name)) > 0),
    CONSTRAINT chk_contacts_last_name_nonempty CHECK (length(trim(last_name)) > 0),
    CONSTRAINT chk_contacts_email_nonempty CHECK (length(trim(email)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_contacts_customer_id ON contacts(customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Enforce at most one primary contact per customer at database engine level
CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_customer_primary 
ON contacts (customer_id) 
WHERE is_primary_contact = TRUE;
