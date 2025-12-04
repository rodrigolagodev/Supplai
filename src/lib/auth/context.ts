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

  // If no organizationId is provided, we just return the user and supabase client
  // We mock a membership for now or we could fetch the default one if needed.
  // But for most actions we need a specific organization context.
  // If organizationId is NOT provided, we can't return a valid membership for a specific org.
  // However, the type definition implies we always return a membership.
  // Let's adjust the logic: if organizationId is provided, we enforce it.
  // If not, we might need to fetch the user's "current" or "default" organization,
  // or just return null for membership if the type allows.

  // For this project's specific pattern seen in actions.ts, most actions operate on an organizationId
  // (derived from order or passed directly).

  if (!organizationId) {
    // If we don't have an org ID, we can't validate membership.
    // But we can't return a full AuthedContext as defined above.
    // Let's fetch the first membership found for the user to satisfy the type,
    // or we should make membership optional in the return type.
    // Given the strictness of the current code, let's make membership optional in the return type
    // OR throw if organizationId is missing but required by the caller (implicit).

    // Actually, let's look at how it's used.
    // Most times we query membership by user_id and organization_id.

    // Let's fetch ANY membership to ensure the user is at least part of the system?
    // No, that's not secure enough for specific actions.

    // Let's change the signature to require organizationId if we want membership.
    // But wait, some actions might look up the order first to get the organizationId.
    // So the flow is:
    // 1. Get User
    // 2. Get Order -> Get Org ID
    // 3. Check Membership

    // So this helper might be best used *after* we have the Org ID.
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
