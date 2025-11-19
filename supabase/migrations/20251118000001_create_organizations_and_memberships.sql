-- Migration: Create organizations, memberships, and invitations
-- Description: Base multi-tenant structure with roles

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Role enum for memberships and invitations
CREATE TYPE membership_role AS ENUM ('admin', 'member');

-- =============================================================================
-- ORGANIZATIONS TABLE
-- =============================================================================

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (char_length(name) <= 200),
    slug TEXT NOT NULL UNIQUE CHECK (char_length(slug) <= 100),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for slug lookups
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);

-- Trigger for updated_at
CREATE TRIGGER set_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- MEMBERSHIPS TABLE
-- =============================================================================

CREATE TABLE memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role membership_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user can only be member of an organization once
    UNIQUE(user_id, organization_id)
);

-- Indexes for common queries
CREATE INDEX idx_memberships_user_id ON memberships(user_id);
CREATE INDEX idx_memberships_organization_id ON memberships(organization_id);
CREATE INDEX idx_memberships_user_org ON memberships(user_id, organization_id);

-- =============================================================================
-- INVITATIONS TABLE
-- =============================================================================

CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    role membership_role NOT NULL DEFAULT 'member',
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Only one pending invitation per email per organization
    UNIQUE(organization_id, email)
);

-- Indexes for invitation lookups
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at) WHERE accepted_at IS NULL;

-- =============================================================================
-- SECURITY HELPER FUNCTIONS
-- =============================================================================

-- Check if current user is member of organization
CREATE OR REPLACE FUNCTION is_member_of(org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = auth.uid()
        AND organization_id = org_id
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is admin of organization
CREATE OR REPLACE FUNCTION is_admin_of(org_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM memberships
        WHERE user_id = auth.uid()
        AND organization_id = org_id
        AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- ROW LEVEL SECURITY - ORGANIZATIONS
-- =============================================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Members can view their organizations
CREATE POLICY "members_can_view_organizations"
    ON organizations FOR SELECT
    USING (is_member_of(id));

-- Any authenticated user can create an organization
CREATE POLICY "authenticated_can_create_organizations"
    ON organizations FOR INSERT
    WITH CHECK (auth.uid() = created_by);

-- Admins can update their organizations
CREATE POLICY "admins_can_update_organizations"
    ON organizations FOR UPDATE
    USING (is_admin_of(id));

-- Admins can delete their organizations
CREATE POLICY "admins_can_delete_organizations"
    ON organizations FOR DELETE
    USING (is_admin_of(id));

-- =============================================================================
-- ROW LEVEL SECURITY - MEMBERSHIPS
-- =============================================================================

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- Members can view memberships in their organization
CREATE POLICY "members_can_view_memberships"
    ON memberships FOR SELECT
    USING (is_member_of(organization_id));

-- Admins can create memberships (invite users)
CREATE POLICY "admins_can_create_memberships"
    ON memberships FOR INSERT
    WITH CHECK (is_admin_of(organization_id));

-- Admins can update memberships (change roles)
CREATE POLICY "admins_can_update_memberships"
    ON memberships FOR UPDATE
    USING (is_admin_of(organization_id));

-- Admins can delete memberships (remove users)
-- But cannot delete their own membership if they're the last admin
CREATE POLICY "admins_can_delete_memberships"
    ON memberships FOR DELETE
    USING (is_admin_of(organization_id));

-- =============================================================================
-- ROW LEVEL SECURITY - INVITATIONS
-- =============================================================================

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Admins can view invitations for their organization
CREATE POLICY "admins_can_view_invitations"
    ON invitations FOR SELECT
    USING (is_admin_of(organization_id));

-- Invited users can view their own invitations
CREATE POLICY "invitees_can_view_own_invitations"
    ON invitations FOR SELECT
    USING (email = auth.email());

-- Admins can create invitations
CREATE POLICY "admins_can_create_invitations"
    ON invitations FOR INSERT
    WITH CHECK (is_admin_of(organization_id) AND invited_by = auth.uid());

-- Invited users can update their invitation (accept it)
CREATE POLICY "invitees_can_accept_invitations"
    ON invitations FOR UPDATE
    USING (email = auth.email() AND accepted_at IS NULL);

-- Admins can delete invitations (cancel them)
CREATE POLICY "admins_can_delete_invitations"
    ON invitations FOR DELETE
    USING (is_admin_of(organization_id));

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE organizations IS 'Multi-tenant organizations (restaurants/businesses)';
COMMENT ON TABLE memberships IS 'User membership in organizations with roles';
COMMENT ON TABLE invitations IS 'Pending invitations to join organizations';
COMMENT ON FUNCTION is_member_of IS 'Check if current user is member of organization';
COMMENT ON FUNCTION is_admin_of IS 'Check if current user is admin of organization';
