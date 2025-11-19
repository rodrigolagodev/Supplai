-- Migration: Create archive system for order items
-- Description: Archive table, archival function, and unified view for historical data

-- =============================================================================
-- ORDER_ITEMS_ARCHIVE TABLE
-- =============================================================================

-- Mirror structure of order_items for archived data
CREATE TABLE order_items_archive (
    id UUID PRIMARY KEY,
    order_id UUID NOT NULL,
    supplier_id UUID,
    product TEXT NOT NULL CHECK (char_length(product) <= 200),
    quantity DECIMAL(10, 2) NOT NULL CHECK (quantity > 0 AND quantity <= 10000),
    unit item_unit NOT NULL,
    original_text TEXT CHECK (char_length(original_text) <= 500),
    confidence_score DECIMAL(3, 2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMPTZ NOT NULL,

    -- Archive metadata
    archived_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR ARCHIVE
-- =============================================================================

-- Primary query: items by order
CREATE INDEX idx_order_items_archive_order_id ON order_items_archive(order_id);

-- Query by supplier for historical analysis
CREATE INDEX idx_order_items_archive_supplier_id ON order_items_archive(supplier_id)
    WHERE supplier_id IS NOT NULL;

-- Query by archive date for cleanup operations
CREATE INDEX idx_order_items_archive_archived_at ON order_items_archive(archived_at DESC);

-- Query by creation date for historical reports
CREATE INDEX idx_order_items_archive_created_at ON order_items_archive(created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY FOR ARCHIVE
-- =============================================================================

ALTER TABLE order_items_archive ENABLE ROW LEVEL SECURITY;

-- Members can view archived items from orders in their organization
-- Note: We need to check via orders table since archive doesn't have direct org reference
CREATE POLICY "members_can_view_archived_items"
    ON order_items_archive FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM orders o
            WHERE o.id = order_id
            AND is_member_of(o.organization_id)
        )
    );

-- Only system (via function) can insert into archive
-- No direct user INSERT/UPDATE/DELETE policies

-- =============================================================================
-- ARCHIVE FUNCTION
-- =============================================================================

-- Function to archive old order items
-- Should be run as a weekly cron job
CREATE OR REPLACE FUNCTION archive_old_order_items()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- Move items from orders that are:
    -- 1. Status = 'archived'
    -- 2. sent_at older than 6 months
    WITH items_to_archive AS (
        SELECT oi.*
        FROM order_items oi
        INNER JOIN orders o ON oi.order_id = o.id
        WHERE o.status = 'archived'
        AND o.sent_at < NOW() - INTERVAL '6 months'
    ),
    inserted AS (
        INSERT INTO order_items_archive (
            id, order_id, supplier_id, product, quantity, unit,
            original_text, confidence_score, created_at
        )
        SELECT
            id, order_id, supplier_id, product, quantity, unit,
            original_text, confidence_score, created_at
        FROM items_to_archive
        RETURNING id
    ),
    deleted AS (
        DELETE FROM order_items
        WHERE id IN (SELECT id FROM items_to_archive)
        RETURNING id
    )
    SELECT COUNT(*) INTO archived_count FROM deleted;

    RETURN archived_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- UNIFIED VIEW
-- =============================================================================

-- View that combines active and archived items
-- Useful for historical reports and analytics
CREATE VIEW order_items_all AS
SELECT
    id,
    order_id,
    supplier_id,
    product,
    quantity,
    unit,
    original_text,
    confidence_score,
    created_at,
    FALSE AS is_archived,
    NULL::TIMESTAMPTZ AS archived_at
FROM order_items

UNION ALL

SELECT
    id,
    order_id,
    supplier_id,
    product,
    quantity,
    unit,
    original_text,
    confidence_score,
    created_at,
    TRUE AS is_archived,
    archived_at
FROM order_items_archive;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE order_items_archive IS 'Archived order items from orders older than 6 months';
COMMENT ON COLUMN order_items_archive.archived_at IS 'Timestamp when item was moved to archive';
COMMENT ON FUNCTION archive_old_order_items IS 'Move items from archived orders (6+ months old) to archive table. Run as weekly cron.';
COMMENT ON VIEW order_items_all IS 'Unified view of active and archived order items for historical reports';
