-- Migration: Create order_items table
-- Description: Individual items within orders with AI classification metadata

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Units for order items
CREATE TYPE item_unit AS ENUM (
    'kg',
    'g',
    'units',
    'dozen',
    'liters',
    'ml',
    'packages',
    'boxes'
);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Check if current user can access an order (via organization membership)
CREATE OR REPLACE FUNCTION can_access_order(order_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
        AND is_member_of(o.organization_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin of the order's organization
CREATE OR REPLACE FUNCTION is_admin_of_order(order_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_id
        AND is_admin_of(o.organization_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ORDER_ITEMS TABLE
-- =============================================================================

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,

    -- Supplier (null = unclassified, needs manual assignment)
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,

    -- Item details
    product TEXT NOT NULL CHECK (char_length(product) <= 200),
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
    unit item_unit NOT NULL,

    -- AI processing metadata
    original_text TEXT CHECK (char_length(original_text) <= 500),
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),

    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary query: items by order
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Group items by supplier (for generating supplier messages)
CREATE INDEX idx_order_items_supplier_id ON order_items(supplier_id) WHERE supplier_id IS NOT NULL;

-- Sort by creation date
CREATE INDEX idx_order_items_created_at ON order_items(created_at DESC);

-- Find unclassified items (need manual assignment)
CREATE INDEX idx_order_items_unclassified ON order_items(order_id) WHERE supplier_id IS NULL;

-- Find low confidence items (may need review)
CREATE INDEX idx_order_items_low_confidence ON order_items(order_id, confidence_score)
    WHERE confidence_score IS NOT NULL AND confidence_score < 0.7;

-- Composite for order detail view: order + supplier grouping
CREATE INDEX idx_order_items_order_supplier ON order_items(order_id, supplier_id);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Members can view items in orders they can access
CREATE POLICY "members_can_view_order_items"
    ON order_items FOR SELECT
    USING (can_access_order(order_id));

-- Members can create items in orders they can access
CREATE POLICY "members_can_create_order_items"
    ON order_items FOR INSERT
    WITH CHECK (can_access_order(order_id));

-- Members can update items in orders they can access
-- (reassign supplier, edit quantity, etc.)
CREATE POLICY "members_can_update_order_items"
    ON order_items FOR UPDATE
    USING (can_access_order(order_id));

-- Members can delete items from orders they can access
CREATE POLICY "members_can_delete_order_items"
    ON order_items FOR DELETE
    USING (can_access_order(order_id));

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE order_items IS 'Individual items within orders with AI classification metadata';
COMMENT ON COLUMN order_items.order_id IS 'Parent order';
COMMENT ON COLUMN order_items.supplier_id IS 'Assigned supplier (null = unclassified, needs manual assignment)';
COMMENT ON COLUMN order_items.product IS 'Product name (normalized by AI)';
COMMENT ON COLUMN order_items.quantity IS 'Quantity (max 10000 to prevent input errors)';
COMMENT ON COLUMN order_items.unit IS 'Unit of measurement';
COMMENT ON COLUMN order_items.original_text IS 'Original text as spoken/typed by user before AI processing';
COMMENT ON COLUMN order_items.confidence_score IS 'AI confidence in classification (0-1, null if manual entry)';
COMMENT ON FUNCTION can_access_order IS 'Check if current user can access order via organization membership';
COMMENT ON FUNCTION is_admin_of_order IS 'Check if current user is admin of order organization';
