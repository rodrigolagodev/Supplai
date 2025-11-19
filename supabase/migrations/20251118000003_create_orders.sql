-- Migration: Create orders table
-- Description: Orders with status workflow and organization context

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Order status for workflow management
CREATE TYPE order_status AS ENUM ('draft', 'review', 'sent', 'archived');

-- =============================================================================
-- ORDERS TABLE
-- =============================================================================

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'draft',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint: sent_at must be set when status is 'sent' or 'archived'
    CONSTRAINT orders_sent_at_required CHECK (
        (status IN ('sent', 'archived') AND sent_at IS NOT NULL) OR
        (status IN ('draft', 'review') AND sent_at IS NULL)
    )
);

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Primary query: orders by organization
CREATE INDEX idx_orders_organization_id ON orders(organization_id);

-- Filter by status within organization (most common query pattern)
CREATE INDEX idx_orders_org_status ON orders(organization_id, status);

-- Filter by creator
CREATE INDEX idx_orders_created_by ON orders(created_by);

-- Sort by creation date (recent orders)
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Query sent orders for archival (sent_at older than threshold)
CREATE INDEX idx_orders_sent_at ON orders(sent_at) WHERE sent_at IS NOT NULL;

-- Composite for dashboard: organization + status + recent
CREATE INDEX idx_orders_org_status_created ON orders(organization_id, status, created_at DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger for updated_at
CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Members can view orders in their organization
CREATE POLICY "members_can_view_orders"
    ON orders FOR SELECT
    USING (is_member_of(organization_id));

-- Members can create orders in their organization
CREATE POLICY "members_can_create_orders"
    ON orders FOR INSERT
    WITH CHECK (
        is_member_of(organization_id) AND
        created_by = auth.uid()
    );

-- Members can update orders in their organization
-- (change status, edit draft orders)
CREATE POLICY "members_can_update_orders"
    ON orders FOR UPDATE
    USING (is_member_of(organization_id));

-- Only admins can delete orders
-- (typically only draft orders should be deleted)
CREATE POLICY "admins_can_delete_orders"
    ON orders FOR DELETE
    USING (is_admin_of(organization_id));

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE orders IS 'Orders with status workflow (draft -> review -> sent -> archived)';
COMMENT ON COLUMN orders.organization_id IS 'Organization that owns this order';
COMMENT ON COLUMN orders.created_by IS 'User who created the order';
COMMENT ON COLUMN orders.status IS 'Workflow status: draft (editing), review (AI processed), sent (delivered), archived (historical)';
COMMENT ON COLUMN orders.sent_at IS 'Timestamp when order was sent to suppliers';
