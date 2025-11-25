import { createClient } from '@/lib/supabase/server';
import { redirect as nextRedirect } from 'next/navigation';

export default async function NewOrderPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    nextRedirect('/login');
  }

  // Get user's organization
  // For MVP we assume single organization or pick first one
  // In real app, we might need an org switcher or context
  const { data: membership } = await supabase
    .from('memberships')
    .select('organization_id, organization:organizations(slug)')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  if (!membership) {
    // Handle case where user has no organization
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-500">No Organization Found</h2>
        <p>Please contact support or create an organization.</p>
      </div>
    );
  }

  // EAGER ORDER CREATION: Create draft order immediately
  // We always create a new order here. If the user wants to continue a draft,
  // they should access it via the History/Dashboard.
  const { data: newOrder, error } = await supabase
    .from('orders')
    .insert({
      organization_id: membership.organization_id,
      created_by: user.id,
      status: 'draft',
    })
    .select('id')
    .single();

  if (error || !newOrder) {
    console.error('Failed to create draft order:', error);
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-red-500">Error Creating Order</h2>
        <p>Unable to create a new order. Please try again.</p>
      </div>
    );
  }

  // Immediately redirect to the order page
  // This prevents conflicts with draft recovery and ensures stable URL
  nextRedirect(`/orders/${newOrder.id}`);
}
