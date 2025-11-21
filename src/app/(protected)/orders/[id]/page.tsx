import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { OrderChatInterface } from '@/components/orders/OrderChatInterface';
import { getOrderConversation } from '../actions';

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default async function EditOrderPage({ params }: PageProps) {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
    }

    // Fetch order to get organization_id and check status
    const { data: order } = await supabase
        .from('orders')
        .select('*, organization:organizations(slug)')
        .eq('id', id)
        .single();

    if (!order) {
        notFound();
    }

    // If order is not in draft status, redirect to review or confirmation
    if (order.status === 'review') {
        redirect(`/orders/${id}/review`);
    } else if (order.status === 'sent' || order.status === 'archived') {
        redirect(`/orders/${id}/confirmation` as any);
    }

    // Fetch conversation history
    const messages = await getOrderConversation(id);

    return (
        <OrderChatInterface
            orderId={id}
            initialMessages={messages}
            organizationSlug={order.organization?.slug || ''}
            organizationId={order.organization_id}
        />
    );
}
