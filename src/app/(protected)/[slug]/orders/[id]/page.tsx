/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { OrderChatInterface } from '@/features/orders/components/OrderChatInterface';
import { getOrderConversation } from '@/features/orders/queries/get-order';

interface PageProps {
  params: Promise<{
    slug: string;
    id: string;
  }>;
}

export default async function EditOrderPage({ params }: PageProps) {
  const { slug, id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch order to get organization_id and check status
  const { data: order } = await supabase
    .from('orders')
    .select('*, organization:organizations(slug)')
    .eq('id', id)
    .single();

  // If not found as order, check if it's a supplier_order
  if (!order) {
    const { data: supplierOrder } = await supabase
      .from('supplier_orders')
      .select('id')
      .eq('id', id)
      .single();

    if (supplierOrder) {
      // Supplier orders can't be edited, redirect to details
      redirect(`/${slug}/orders/${id}/details` as any);
    }

    // If neither found, it MIGHT be a local-only draft.
    // We check if the user has access to the organization from the URL
    const { data: membership } = await supabase
      .from('memberships')
      .select('organization_id, organization:organizations(slug)')
      .eq('user_id', user.id)
      .eq('organization.slug', slug)
      .limit(1)
      .single();

    if (!membership) {
      notFound();
    }

    // Render chat interface for potential local order
    // The hook will handle loading from IndexedDB
    return (
      <OrderChatInterface
        orderId={id}
        initialMessages={[]}
        organizationSlug={slug}
        organizationId={membership.organization_id}
      />
    );
  }

  // If order is not in draft status, redirect to review or confirmation
  if (order.status === 'review') {
    redirect(`/${slug}/orders/${id}/review`);
  } else if (order.status === 'sent' || order.status === 'archived') {
    redirect(`/${slug}/orders/${id}/confirmation` as any);
  }

  // Fetch conversation history
  const messages = await getOrderConversation(id);

  return (
    <OrderChatInterface
      orderId={id}
      initialMessages={messages}
      organizationSlug={slug}
      organizationId={order.organization_id}
    />
  );
}
