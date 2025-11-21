import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import { OrderChatInterface } from '@/components/orders/OrderChatInterface';

export default async function NewOrderPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/login');
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

    // We don't create the order immediately anymore (Lazy Creation)
    // We pass the organizationId so the context can create it when needed

    return (
        <OrderChatInterface
            orderId={null}
            initialMessages={[]}
            organizationSlug={membership.organization?.slug || ''}
            organizationId={membership.organization_id}
        />
    );
}
