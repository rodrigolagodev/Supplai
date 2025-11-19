-- Migration: Create suppliers table
-- Description: Suppliers with contact info and classification keywords

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable trigram extension for fuzzy text search (must be before index creation)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Supplier categories for classification
CREATE TYPE supplier_category AS ENUM (
    'fruits_vegetables',
    'meats',
    'fish_seafood',
    'dry_goods',
    'dairy',
    'beverages'
);

-- Preferred contact method (email only for MVP)
CREATE TYPE contact_method AS ENUM ('email');

-- =============================================================================
-- SUPPLIERS TABLE
-- =============================================================================

CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic info
    name TEXT NOT NULL CHECK (char_length(name) <= 200),

    -- Contact information
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    phone TEXT CHECK (char_length(phone) <= 50),
    address TEXT CHECK (char_length(address) <= 500),
    notes TEXT CHECK (char_length(notes) <= 1000),
    preferred_contact_method contact_method NOT NULL DEFAULT 'email',

    -- Classification
    category supplier_category NOT NULL,
    custom_keywords TEXT[] NOT NULL DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary query: suppliers by organization
CREATE INDEX idx_suppliers_organization_id ON suppliers(organization_id);

-- Filter by category within organization
CREATE INDEX idx_suppliers_org_category ON suppliers(organization_id, category);

-- Full-text search on name (for autocomplete)
CREATE INDEX idx_suppliers_name_trgm ON suppliers USING gin (name gin_trgm_ops);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger for updated_at
CREATE TRIGGER set_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

-- Members can view suppliers in their organization
CREATE POLICY "members_can_view_suppliers"
    ON suppliers FOR SELECT
    USING (is_member_of(organization_id));

-- Admins can create suppliers
CREATE POLICY "admins_can_create_suppliers"
    ON suppliers FOR INSERT
    WITH CHECK (is_admin_of(organization_id));

-- Admins can update suppliers
CREATE POLICY "admins_can_update_suppliers"
    ON suppliers FOR UPDATE
    USING (is_admin_of(organization_id));

-- Admins can delete suppliers
CREATE POLICY "admins_can_delete_suppliers"
    ON suppliers FOR DELETE
    USING (is_admin_of(organization_id));

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE suppliers IS 'Suppliers with contact info and AI classification keywords';
COMMENT ON COLUMN suppliers.custom_keywords IS 'Custom keywords for AI classification (e.g., regional product names)';
COMMENT ON COLUMN suppliers.preferred_contact_method IS 'How to send orders - email only for MVP';
