-- ==============================================================================
-- LabOS Database Migration: 0005_catalog_and_methods.sql
-- Description: Core V1 Scientific Catalog & Versioned Test Methods (SPEC-002)
-- Enforces ISO/IEC 17025 Clause 7.2 method immutability, exact decimal limits,
-- multi-tenant isolation, and separation of duties (four-eyes approval)
-- ==============================================================================

-- 1. Units of Measurement (Hybrid: Global standard units + tenant custom units)
CREATE TABLE IF NOT EXISTS units_of_measurement (
    unit_id UUID PRIMARY KEY,
    laboratory_id UUID REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    symbol VARCHAR(32) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_units_symbol_nonempty CHECK (length(trim(symbol)) > 0),
    CONSTRAINT chk_units_name_nonempty CHECK (length(trim(name)) > 0),
    CONSTRAINT chk_units_category_nonempty CHECK (length(trim(category)) > 0)
);

-- Unique index for global units (laboratory_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_global_symbol
ON units_of_measurement (symbol)
WHERE laboratory_id IS NULL;

-- Unique index for tenant custom units (laboratory_id IS NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS uq_units_tenant_symbol
ON units_of_measurement (laboratory_id, symbol)
WHERE laboratory_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_units_laboratory_id ON units_of_measurement(laboratory_id);

-- 2. Sample Types (Material Matrices)
CREATE TABLE IF NOT EXISTS sample_types (
    sample_type_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sample_types_lab_code UNIQUE (laboratory_id, code),
    CONSTRAINT chk_sample_types_code_nonempty CHECK (length(trim(code)) > 0),
    CONSTRAINT chk_sample_types_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_sample_types_lab_code ON sample_types(laboratory_id, code);

-- 3. Test Parameters (Standalone Analytes / Observables)
CREATE TABLE IF NOT EXISTS test_parameters (
    parameter_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    chemical_formula VARCHAR(64),
    cas_number VARCHAR(32),
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_test_parameters_lab_code UNIQUE (laboratory_id, code),
    CONSTRAINT chk_test_parameters_code_nonempty CHECK (length(trim(code)) > 0),
    CONSTRAINT chk_test_parameters_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_test_parameters_lab_code ON test_parameters(laboratory_id, code);

-- 4. Test Methods (Stable Parent Header)
CREATE TABLE IF NOT EXISTS test_methods (
    test_method_id UUID PRIMARY KEY,
    laboratory_id UUID NOT NULL REFERENCES laboratories(laboratory_id) ON DELETE RESTRICT,
    code VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    regulatory_agency VARCHAR(64),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_test_methods_lab_code UNIQUE (laboratory_id, code),
    CONSTRAINT chk_test_methods_code_nonempty CHECK (length(trim(code)) > 0),
    CONSTRAINT chk_test_methods_name_nonempty CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_test_methods_lab_code ON test_methods(laboratory_id, code);

-- 5. Test Method Versions (Point-in-Time Immutable Scientific Releases)
CREATE TABLE IF NOT EXISTS test_method_versions (
    method_version_id UUID PRIMARY KEY,
    test_method_id UUID NOT NULL REFERENCES test_methods(test_method_id) ON DELETE RESTRICT,
    version_number INTEGER NOT NULL CHECK (version_number > 0),
    revision_label VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'RETIRED')),
    accreditation_status VARCHAR(32) NOT NULL DEFAULT 'ACCREDITED' CHECK (accreditation_status IN ('ACCREDITED', 'NON_ACCREDITED')),
    sop_reference VARCHAR(255),
    effective_from TIMESTAMPTZ,
    effective_to TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
    approved_by_user_id UUID REFERENCES users(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_method_version_number UNIQUE (test_method_id, version_number),
    CONSTRAINT chk_revision_label_nonempty CHECK (length(trim(revision_label)) > 0)
);

-- Concurrency backstop: Ensure at most ONE ACTIVE version per method
CREATE UNIQUE INDEX IF NOT EXISTS uq_method_active_version
ON test_method_versions (test_method_id)
WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_method_versions_test_method_id ON test_method_versions(test_method_id);
CREATE INDEX IF NOT EXISTS idx_method_versions_status ON test_method_versions(status);

-- 6. Method Version Parameters (Analyte Limits and Units Configuration)
CREATE TABLE IF NOT EXISTS method_version_parameters (
    method_version_parameter_id UUID PRIMARY KEY,
    method_version_id UUID NOT NULL REFERENCES test_method_versions(method_version_id) ON DELETE RESTRICT,
    parameter_id UUID NOT NULL REFERENCES test_parameters(parameter_id) ON DELETE RESTRICT,
    unit_id UUID NOT NULL REFERENCES units_of_measurement(unit_id) ON DELETE RESTRICT,
    detection_limit NUMERIC(18, 8) NOT NULL,
    reporting_limit NUMERIC(18, 8) NOT NULL,
    decimal_precision INTEGER NOT NULL DEFAULT 2 CHECK (decimal_precision >= 0 AND decimal_precision <= 8),
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_method_version_param UNIQUE (method_version_id, parameter_id),
    CONSTRAINT chk_limits_order CHECK (reporting_limit >= detection_limit),
    CONSTRAINT chk_limits_positive CHECK (detection_limit > 0 AND reporting_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_mv_params_version ON method_version_parameters(method_version_id);
CREATE INDEX IF NOT EXISTS idx_mv_params_param ON method_version_parameters(parameter_id);

-- 7. Method Version Sample Types (Compatible Material Matrices)
CREATE TABLE IF NOT EXISTS method_version_sample_types (
    method_version_id UUID NOT NULL REFERENCES test_method_versions(method_version_id) ON DELETE RESTRICT,
    sample_type_id UUID NOT NULL REFERENCES sample_types(sample_type_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (method_version_id, sample_type_id)
);

CREATE INDEX IF NOT EXISTS idx_mv_sample_types_sample_type ON method_version_sample_types(sample_type_id);

-- ==============================================================================
-- DATABASE-LEVEL IMMUTABILITY & INTEGRITY TRIGGERS
-- ==============================================================================

-- A. Protect Global Standard Units
CREATE OR REPLACE FUNCTION fn_protect_global_units()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.laboratory_id IS NULL THEN
            RAISE EXCEPTION 'Cannot delete platform-standard global unit of measurement'
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.laboratory_id IS NULL THEN
            RAISE EXCEPTION 'Cannot modify platform-standard global unit of measurement'
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_global_units ON units_of_measurement;
CREATE TRIGGER trg_protect_global_units
BEFORE UPDATE OR DELETE ON units_of_measurement
FOR EACH ROW
EXECUTE FUNCTION fn_protect_global_units();

-- B. Enforce Method Version Immutability & Four-Eyes Approval
CREATE OR REPLACE FUNCTION fn_enforce_method_version_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status != 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete test method version once finalized (status: %)', OLD.status
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- If already in a frozen historical state (SUPERSEDED or RETIRED), NO updates are permitted
        IF OLD.status IN ('SUPERSEDED', 'RETIRED') THEN
            RAISE EXCEPTION 'Cannot modify historical test method version in % status', OLD.status
                USING ERRCODE = '23514';
        END IF;

        -- If OLD was ACTIVE, only permitted transitions are to SUPERSEDED or RETIRED
        IF OLD.status = 'ACTIVE' THEN
            IF NEW.status NOT IN ('SUPERSEDED', 'RETIRED') THEN
                RAISE EXCEPTION 'Invalid status transition from ACTIVE to %', NEW.status
                    USING ERRCODE = '23514';
            END IF;
            -- Scientific and authoring fields cannot be mutated during supersession/retirement
            IF NEW.test_method_id != OLD.test_method_id
               OR NEW.version_number != OLD.version_number
               OR NEW.revision_label != OLD.revision_label
               OR NEW.accreditation_status != OLD.accreditation_status
               OR NEW.created_by_user_id != OLD.created_by_user_id
               OR COALESCE(NEW.sop_reference, '') != COALESCE(OLD.sop_reference, '')
               OR NEW.effective_from != OLD.effective_from
               OR NEW.approved_by_user_id != OLD.approved_by_user_id THEN
                RAISE EXCEPTION 'Cannot modify scientific or audit fields of an ACTIVE test method version'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        -- If OLD was DRAFT, transitioning to ACTIVE must have approved_by_user_id != created_by_user_id
        IF OLD.status = 'DRAFT' AND NEW.status = 'ACTIVE' THEN
            IF NEW.approved_by_user_id IS NULL THEN
                RAISE EXCEPTION 'Cannot activate method version without approved_by_user_id'
                    USING ERRCODE = '23514';
            END IF;
            IF NEW.approved_by_user_id = OLD.created_by_user_id THEN
                RAISE EXCEPTION 'Four-eyes policy violation: author cannot approve own method version'
                    USING ERRCODE = '23514';
            END IF;
        END IF;

        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_method_version_immutability ON test_method_versions;
CREATE TRIGGER trg_method_version_immutability
BEFORE UPDATE OR DELETE ON test_method_versions
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_method_version_immutability();

-- C. Enforce Method Version Parameters Immutability (Non-DRAFT versions cannot be edited)
CREATE OR REPLACE FUNCTION fn_enforce_method_parameters_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status VARCHAR(32);
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO v_parent_status FROM test_method_versions WHERE method_version_id = OLD.method_version_id;
        IF v_parent_status IS NOT NULL AND v_parent_status != 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete parameters of a finalized test method version (status: %)', v_parent_status
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    ELSE
        SELECT status INTO v_parent_status FROM test_method_versions WHERE method_version_id = NEW.method_version_id;
        IF v_parent_status IS NOT NULL AND v_parent_status != 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot modify or add parameters to a finalized test method version (status: %)', v_parent_status
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_method_parameters_immutability ON method_version_parameters;
CREATE TRIGGER trg_method_parameters_immutability
BEFORE INSERT OR UPDATE OR DELETE ON method_version_parameters
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_method_parameters_immutability();

-- D. Enforce Method Version Sample Types Immutability
CREATE OR REPLACE FUNCTION fn_enforce_method_sample_types_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_status VARCHAR(32);
BEGIN
    IF TG_OP = 'DELETE' THEN
        SELECT status INTO v_parent_status FROM test_method_versions WHERE method_version_id = OLD.method_version_id;
        IF v_parent_status IS NOT NULL AND v_parent_status != 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot delete sample types from a finalized test method version (status: %)', v_parent_status
                USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    ELSE
        SELECT status INTO v_parent_status FROM test_method_versions WHERE method_version_id = NEW.method_version_id;
        IF v_parent_status IS NOT NULL AND v_parent_status != 'DRAFT' THEN
            RAISE EXCEPTION 'Cannot modify or add sample types to a finalized test method version (status: %)', v_parent_status
                USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_method_sample_types_immutability ON method_version_sample_types;
CREATE TRIGGER trg_method_sample_types_immutability
BEFORE INSERT OR UPDATE OR DELETE ON method_version_sample_types
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_method_sample_types_immutability();

-- E. Enforce Parameter & Unit Tenant Consistency
CREATE OR REPLACE FUNCTION fn_enforce_parameter_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_method_lab_id UUID;
    v_param_lab_id UUID;
    v_unit_lab_id UUID;
BEGIN
    SELECT tm.laboratory_id INTO v_method_lab_id
    FROM test_method_versions tmv
    JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
    WHERE tmv.method_version_id = NEW.method_version_id;

    SELECT laboratory_id INTO v_param_lab_id
    FROM test_parameters
    WHERE parameter_id = NEW.parameter_id;

    IF v_param_lab_id IS DISTINCT FROM v_method_lab_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: parameter does not belong to the method laboratory'
            USING ERRCODE = '23514';
    END IF;

    SELECT laboratory_id INTO v_unit_lab_id
    FROM units_of_measurement
    WHERE unit_id = NEW.unit_id;

    IF v_unit_lab_id IS NOT NULL AND v_unit_lab_id IS DISTINCT FROM v_method_lab_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: custom unit belongs to another laboratory'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parameter_tenant_consistency ON method_version_parameters;
CREATE TRIGGER trg_parameter_tenant_consistency
BEFORE INSERT OR UPDATE ON method_version_parameters
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_parameter_tenant_consistency();

-- F. Enforce Sample Type Tenant Consistency
CREATE OR REPLACE FUNCTION fn_enforce_sample_type_tenant_consistency()
RETURNS TRIGGER AS $$
DECLARE
    v_method_lab_id UUID;
    v_sample_type_lab_id UUID;
BEGIN
    SELECT tm.laboratory_id INTO v_method_lab_id
    FROM test_method_versions tmv
    JOIN test_methods tm ON tm.test_method_id = tmv.test_method_id
    WHERE tmv.method_version_id = NEW.method_version_id;

    SELECT laboratory_id INTO v_sample_type_lab_id
    FROM sample_types
    WHERE sample_type_id = NEW.sample_type_id;

    IF v_sample_type_lab_id IS DISTINCT FROM v_method_lab_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: sample type does not belong to the method laboratory'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sample_type_tenant_consistency ON method_version_sample_types;
CREATE TRIGGER trg_sample_type_tenant_consistency
BEFORE INSERT OR UPDATE ON method_version_sample_types
FOR EACH ROW
EXECUTE FUNCTION fn_enforce_sample_type_tenant_consistency();

-- ==============================================================================
-- SEED DATA: PLATFORM-STANDARD UNITS OF MEASUREMENT
-- ==============================================================================
INSERT INTO units_of_measurement (unit_id, laboratory_id, symbol, name, category, is_active)
VALUES
    ('018f0000-0000-7000-8000-000000000001', NULL, 'mg/L', 'Milligrams per Liter', 'CONCENTRATION_MASS', TRUE),
    ('018f0000-0000-7000-8000-000000000002', NULL, 'µg/L', 'Micrograms per Liter', 'CONCENTRATION_MASS', TRUE),
    ('018f0000-0000-7000-8000-000000000003', NULL, 'mg/kg', 'Milligrams per Kilogram', 'CONCENTRATION_MASS', TRUE),
    ('018f0000-0000-7000-8000-000000000004', NULL, 'µg/kg', 'Micrograms per Kilogram', 'CONCENTRATION_MASS', TRUE),
    ('018f0000-0000-7000-8000-000000000005', NULL, 'ppm', 'Parts per Million', 'CONCENTRATION_RATIO', TRUE),
    ('018f0000-0000-7000-8000-000000000006', NULL, 'ppb', 'Parts per Billion', 'CONCENTRATION_RATIO', TRUE),
    ('018f0000-0000-7000-8000-000000000007', NULL, '%', 'Percent', 'PERCENTAGE', TRUE),
    ('018f0000-0000-7000-8000-000000000008', NULL, 'pH units', 'pH Units', 'PHYSICAL_PROPERTY', TRUE),
    ('018f0000-0000-7000-8000-000000000009', NULL, 'CFU/100mL', 'Colony Forming Units per 100 mL', 'CONCENTRATION_COUNT', TRUE),
    ('018f0000-0000-7000-8000-00000000000a', NULL, 'MPN/100mL', 'Most Probable Number per 100 mL', 'CONCENTRATION_COUNT', TRUE),
    ('018f0000-0000-7000-8000-00000000000b', NULL, 'NTU', 'Nephelometric Turbidity Units', 'PHYSICAL_PROPERTY', TRUE),
    ('018f0000-0000-7000-8000-00000000000c', NULL, 'µS/cm', 'MicroSiemens per Centimeter', 'PHYSICAL_PROPERTY', TRUE),
    ('018f0000-0000-7000-8000-00000000000d', NULL, 'mg/m3', 'Milligrams per Cubic Meter', 'CONCENTRATION_MASS', TRUE)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- SEED DATA: CATALOG PERMISSIONS & ROLE ASSIGNMENTS
-- ==============================================================================
INSERT INTO permissions (permission_code, description)
VALUES 
    ('catalog:read', 'Permission to view laboratory catalog items, methods, parameters, and units'),
    ('catalog:manage', 'Permission to create and manage catalog units, sample types, parameters, and draft methods'),
    ('method:approve', 'Permission to activate and authorize draft test method versions'),
    ('method:retire', 'Permission to retire active test method versions')
ON CONFLICT (permission_code) DO NOTHING;

-- Map Catalog Permissions to Roles
-- ADMIN: all permissions
INSERT INTO role_permissions (role_id, permission_code)
VALUES 
    ('01918000-0000-7000-8000-000000000010', 'catalog:read'),
    ('01918000-0000-7000-8000-000000000010', 'catalog:manage'),
    ('01918000-0000-7000-8000-000000000010', 'method:approve'),
    ('01918000-0000-7000-8000-000000000010', 'method:retire')
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- DIRECTOR: all permissions
INSERT INTO role_permissions (role_id, permission_code)
VALUES 
    ('01918000-0000-7000-8000-000000000012', 'catalog:read'),
    ('01918000-0000-7000-8000-000000000012', 'catalog:manage'),
    ('01918000-0000-7000-8000-000000000012', 'method:approve'),
    ('01918000-0000-7000-8000-000000000012', 'method:retire')
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- ANALYST: catalog:read
INSERT INTO role_permissions (role_id, permission_code)
VALUES 
    ('01918000-0000-7000-8000-000000000013', 'catalog:read')
ON CONFLICT (role_id, permission_code) DO NOTHING;

-- ACCESSIONER: catalog:read
INSERT INTO role_permissions (role_id, permission_code)
VALUES 
    ('01918000-0000-7000-8000-000000000011', 'catalog:read')
ON CONFLICT (role_id, permission_code) DO NOTHING;

