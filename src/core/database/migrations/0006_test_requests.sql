-- ==============================================================================
-- Migration: 0006_test_requests.sql
-- Purpose: Schema for Test Requests, Annual Counters, Immutable Method Version Binding,
--          Integrity Triggers, and Granular RBAC Permissions
-- Specification Reference: SPEC-003
-- ADR Reference: ADR-001 (ISO 17025 Laboratory), ADR-004 (Modular Monolith), ADR-005 (Audit Integrity)
-- ==============================================================================

-- 1. Test Request Annual Counters (Per-tenant gap-free request numbering)
CREATE TABLE IF NOT EXISTS test_request_counters (
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    year INTEGER NOT NULL,
    last_value INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (laboratory_id, year)
);

-- 2. Test Requests (Commercial work order header)
CREATE TABLE IF NOT EXISTS test_requests (
    test_request_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE RESTRICT,
    request_number VARCHAR(64) NOT NULL,
    customer_reference VARCHAR(100),
    special_instructions TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'SUBMITTED',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_test_requests_lab_number UNIQUE (laboratory_id, request_number),
    CONSTRAINT chk_test_requests_number_nonempty CHECK (length(trim(request_number)) > 0),
    CONSTRAINT chk_test_requests_status CHECK (status IN ('SUBMITTED', 'ACCEPTED', 'CANCELLED')),
    CONSTRAINT chk_test_requests_cancellation_consistency CHECK (
        (status = 'SUBMITTED' AND cancellation_reason IS NULL AND cancelled_at IS NULL)
        OR
        (status = 'CANCELLED' AND cancellation_reason IS NOT NULL AND length(trim(cancellation_reason)) > 0 AND cancelled_at IS NOT NULL)
        OR
        (status = 'ACCEPTED' AND cancellation_reason IS NULL AND cancelled_at IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_test_requests_lab_status ON test_requests(laboratory_id, status);
CREATE INDEX IF NOT EXISTS idx_test_requests_customer_id ON test_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_test_requests_requested_at ON test_requests(laboratory_id, requested_at DESC);

-- 3. Test Request Items (Immutable scientific test method version binding)
CREATE TABLE IF NOT EXISTS test_request_items (
    test_request_item_id UUID PRIMARY KEY,
    test_request_id UUID NOT NULL REFERENCES test_requests(test_request_id) ON DELETE RESTRICT,
    method_version_id UUID NOT NULL REFERENCES test_method_versions(method_version_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_test_request_item_method UNIQUE (test_request_id, method_version_id)
);

CREATE INDEX IF NOT EXISTS idx_test_request_items_request_id ON test_request_items(test_request_id);
CREATE INDEX IF NOT EXISTS idx_test_request_items_method_version ON test_request_items(method_version_id);

-- ==============================================================================
-- DATABASE INTEGRITY TRIGGERS
-- ==============================================================================

-- A. Enforce Customer Tenant Consistency on Test Request Header
CREATE OR REPLACE FUNCTION fn_enforce_test_request_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_cust_lab_id UUID;
BEGIN
    SELECT laboratory_id INTO v_cust_lab_id
    FROM customers
    WHERE customer_id = NEW.customer_id;

    IF v_cust_lab_id IS NULL THEN
        RAISE EXCEPTION 'Referenced customer does not exist' USING ERRCODE = '23503';
    END IF;

    IF v_cust_lab_id <> NEW.laboratory_id THEN
        RAISE EXCEPTION 'Tenant integrity violation: customer does not belong to the test request laboratory'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_request_tenant_consistency ON test_requests;
CREATE TRIGGER trg_test_request_tenant_consistency
BEFORE INSERT OR UPDATE ON test_requests
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_test_request_tenant_consistency();

-- B. Enforce Test Request Header Immutability & Lifecycle Transitions
CREATE OR REPLACE FUNCTION fn_enforce_test_requests_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete test request once recorded' USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' THEN
        -- Core identification fields cannot be modified
        IF NEW.test_request_id <> OLD.test_request_id
           OR NEW.laboratory_id <> OLD.laboratory_id
           OR NEW.customer_id <> OLD.customer_id
           OR NEW.request_number <> OLD.request_number
           OR NEW.created_by_user_id <> OLD.created_by_user_id
           OR NEW.requested_at <> OLD.requested_at
           OR NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Cannot modify core identification fields of a test request'
                USING ERRCODE = '23514';
        END IF;

        -- Terminal state CANCELLED cannot be modified
        IF OLD.status = 'CANCELLED' THEN
            RAISE EXCEPTION 'Cannot modify test request in CANCELLED status'
                USING ERRCODE = '23514';
        END IF;

        -- Status transitions from SUBMITTED
        IF OLD.status = 'SUBMITTED' THEN
            IF NEW.status NOT IN ('SUBMITTED', 'CANCELLED', 'ACCEPTED') THEN
                RAISE EXCEPTION 'Invalid status transition from SUBMITTED to %', NEW.status
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        NEW.updated_at = NOW();
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_requests_immutability ON test_requests;
CREATE TRIGGER trg_test_requests_immutability
BEFORE UPDATE OR DELETE ON test_requests
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_test_requests_immutability();

-- C. Enforce Method Version Eligibility & Tenant Consistency on Item Insert
CREATE OR REPLACE FUNCTION fn_enforce_test_request_item_insert_eligibility()
RETURNS TRIGGER AS $$
DECLARE
    v_req_lab_id UUID;
    v_method_lab_id UUID;
    v_version_status VARCHAR(32);
BEGIN
    -- Get parent test request laboratory
    SELECT laboratory_id INTO v_req_lab_id
    FROM test_requests
    WHERE test_request_id = NEW.test_request_id;

    IF v_req_lab_id IS NULL THEN
        RAISE EXCEPTION 'Parent test request does not exist' USING ERRCODE = '23503';
    END IF;

    -- Get method version details and its method laboratory
    SELECT tmv.status, tm.laboratory_id
    INTO v_version_status, v_method_lab_id
    FROM test_method_versions tmv
    JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
    WHERE tmv.method_version_id = NEW.method_version_id;

    IF v_version_status IS NULL THEN
        RAISE EXCEPTION 'Referenced test method version does not exist' USING ERRCODE = '23503';
    END IF;

    -- Tenant isolation check
    IF v_method_lab_id <> v_req_lab_id THEN
        RAISE EXCEPTION 'Tenant integrity violation: method version does not belong to the test request laboratory'
            USING ERRCODE = '23514';
    END IF;

    -- Eligibility check: must be ACTIVE at time of binding
    IF v_version_status <> 'ACTIVE' THEN
        RAISE EXCEPTION 'Method version eligibility violation: method_version_id % is in % status, but only ACTIVE versions can be bound to new test requests',
            NEW.method_version_id, v_version_status
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_request_item_insert_eligibility ON test_request_items;
CREATE TRIGGER trg_test_request_item_insert_eligibility
BEFORE INSERT ON test_request_items
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_test_request_item_insert_eligibility();

-- D. Enforce Test Request Item Permanent Immutability (Append-only)
CREATE OR REPLACE FUNCTION fn_enforce_test_request_item_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Cannot delete test request items once recorded' USING ERRCODE = '23514';
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.test_request_item_id <> OLD.test_request_item_id
           OR NEW.test_request_id <> OLD.test_request_id
           OR NEW.method_version_id <> OLD.method_version_id
           OR NEW.created_at <> OLD.created_at THEN
            RAISE EXCEPTION 'Cannot modify immutable test request item' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_test_request_item_immutability ON test_request_items;
CREATE TRIGGER trg_test_request_item_immutability
BEFORE UPDATE OR DELETE ON test_request_items
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_test_request_item_immutability();

-- ==============================================================================
-- RBAC SEEDING: SPEC-003 Permissions and Role Assignments
-- ==============================================================================

INSERT INTO permissions (permission_code, description) VALUES
    ('test_request:create', 'Submit commercial laboratory test requests and bind method versions'),
    ('test_request:read', 'View laboratory test requests and immutable method version bindings'),
    ('test_request:cancel', 'Cancel submitted laboratory test requests with documented justification')
ON CONFLICT (permission_code) DO NOTHING;

-- Map permissions to roles:
-- ADMIN, ACCESSIONER, DIRECTOR: create, read, cancel
-- ANALYST: read
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.role_id, p.permission_code
FROM roles r
CROSS JOIN permissions p
WHERE p.permission_code IN ('test_request:create', 'test_request:read', 'test_request:cancel')
  AND r.code IN ('ADMIN', 'ACCESSIONER', 'DIRECTOR')
ON CONFLICT (role_id, permission_code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.role_id, p.permission_code
FROM roles r
CROSS JOIN permissions p
WHERE p.permission_code = 'test_request:read'
  AND r.code = 'ANALYST'
ON CONFLICT (role_id, permission_code) DO NOTHING;
