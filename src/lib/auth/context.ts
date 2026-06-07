import { createClient } from '@/lib/supabase/server';

export type AuthedContext = {
  user: { id: string; email?: string };
  membership: { id: string; role: string; organization_id: string };
  supabase: Awaited<ReturnType<typeof createClient>>;
};

/**
 * Get authenticated context for server actions.
 * Verifies user is logged in and (optionally) is a member of the specified organization.
 *
 * @param organizationId Optional organization ID to verify membership against.
 * @returns Authenticated context with user, membership, and supabase client.
 * @throws Error if unauthorized or forbidden.
 */
export async function getAuthedContext(organizationId?: string): Promise<AuthedContext> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // This helper validates membership against a specific organization. Callers that
  // only have an order id should use getOrderContext, which resolves the org first.
  if (!organizationId) {
    throw new Error('Organization ID is required to verify membership');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  return {
    user: { id: user.id, email: user.email },
    membership,
    supabase,
  };
}

/**
 * Helper to get order and verify access in one go.
 * This is a common pattern: Get Order -> Check Auth -> Check Membership.
 */
export async function getOrderContext(orderId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  const { data: order } = await supabase
    .from('orders')
    .select('*, organization:organizations(slug)')
    .eq('id', orderId)
    .single();

  if (!order) {
    throw new Error('Order not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  return {
    user,
    order,
    membership,
    supabase,
  };
}

/**
 * Map an error thrown by the auth-context helpers to an HTTP status code, so API
 * routes can return the right status without re-implementing the auth checks.
 */
export function authErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message === 'Unauthorized') return 401;
  if (message === 'Forbidden') return 403;
  if (message.includes('not found')) return 404;
  return 500;
}

/**
 * Helper to get organization context and verify access.
 * Useful for pages/actions that operate on an organization level.
 */
export async function getOrganizationContext(organizationIdOrSlug: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  // Determine if input is UUID or Slug
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    organizationIdOrSlug
  );

  let organization;

  if (isUuid) {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationIdOrSlug)
      .single();
    if (error) throw error;
    organization = data;
  } else {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', organizationIdOrSlug)
      .single();
    if (error) throw error;
    organization = data;
  }

  if (!organization) {
    throw new Error('Organization not found');
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, role, organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organization.id)
    .single();

  if (!membership) {
    throw new Error('Forbidden');
  }

  return {
    user,
    organization,
    membership,
    supabase,
  };
}
