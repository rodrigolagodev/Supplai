'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ParsedItem } from '@/lib/ai/gemini';
import { ClassifiedItem } from '@/lib/ai/classifier';

import { parseOrderText } from '@/lib/ai/gemini';
import { classifyItemsBySupplier } from '@/lib/ai/classifier';

/**
 * Create a new draft order
 */
export async function createDraftOrder(organizationId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // Verify membership
    const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', organizationId)
        .single();

    if (!membership) {
        throw new Error('Forbidden');
    }

    const { data: order, error } = await supabase
        .from('orders')
        .insert({
            organization_id: organizationId,
            created_by: user.id,
            status: 'draft',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating order:', error);
        throw new Error('Failed to create order');
    }

    return order;
}

/**
 * Save a message to the conversation history
 */
export async function saveConversationMessage(
    orderId: string,
    role: 'user' | 'assistant',
    content: string,
    audioFileId?: string
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // Check access via order membership
    const { data: order } = await supabase
        .from('orders')
        .select('organization_id')
        .eq('id', orderId)
        .single();

    if (!order) {
        throw new Error('Order not found');
    }

    const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', order.organization_id)
        .single();

    if (!membership) {
        throw new Error('Forbidden');
    }

    const { error } = await supabase
        .from('order_conversations')
        .insert({
            order_id: orderId,
            role,
            content,
            audio_file_id: audioFileId || null,
        });

    if (error) {
        console.error('Error saving message:', error);
        throw new Error('Failed to save message');
    }
}

/**
 * Save parsed and classified items to the order
 */
export async function saveParsedItems(
    orderId: string,
    items: ClassifiedItem[]
) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // Check access via order membership
    const { data: order } = await supabase
        .from('orders')
        .select('organization_id')
        .eq('id', orderId)
        .single();

    if (!order) {
        throw new Error('Order not found');
    }

    const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', order.organization_id)
        .single();

    if (!membership) {
        throw new Error('Forbidden');
    }

    // Prepare items for insertion
    const dbItems = items.map(item => ({
        order_id: orderId,
        product: item.product,
        quantity: item.quantity,
        unit: item.unit,
        original_text: item.original_text,
        confidence_score: item.confidence,
        supplier_id: item.supplier_id, // Can be null
    }));

    const { error } = await supabase
        .from('order_items')
        .insert(dbItems);

    if (error) {
        console.error('Error saving items:', error);
        throw new Error('Failed to save items');
    }

    revalidatePath(`/orders/${orderId}`);
}

/**
 * Process all messages in an order to extract items
 * - Fetches all user messages
 * - Aggregates text
 * - Parses with Gemini
 * - Classifies with Suppliers
 * - Replaces existing items
 */
export async function processOrderBatch(orderId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // 1. Get order and verify access
    const { data: order } = await supabase
        .from('orders')
        .select('organization_id')
        .eq('id', orderId)
        .single();

    if (!order) {
        throw new Error('Order not found');
    }

    const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', order.organization_id)
        .single();

    if (!membership) {
        throw new Error('Forbidden');
    }

    // 2. Fetch all user messages
    const { data: messages } = await supabase
        .from('order_conversations')
        .select('content')
        .eq('order_id', orderId)
        .eq('role', 'user')
        .order('created_at', { ascending: true });

    if (!messages || messages.length === 0) {
        return { items: [], message: 'No hay mensajes para procesar.' };
    }

    // 3. Aggregate text
    const fullText = messages.map(m => m.content).join('\n\n');

    // 4. Fetch suppliers (needed for intelligent parsing)
    const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, category, custom_keywords')
        .eq('organization_id', order.organization_id);

    // 5. Parse with Gemini (includes supplier classification)
    const parsedItems = await parseOrderText(fullText, suppliers || []);

    if (parsedItems.length === 0) {
        return { items: [], message: 'No pude identificar productos en la conversación.' };
    }

    // 6. Map ParsedItem to ClassifiedItem format
    // Gemini now returns supplier_id directly, so we just need to ensure the format
    const classifiedItems = parsedItems.map(item => ({
        ...item,
        supplier_id: item.supplier_id || null,
        classification_confidence: item.confidence, // Use Gemini's confidence as classification confidence
    }));

    // 7. Replace existing items (Transaction-like)
    // First delete old items
    await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId);

    // Then save new items
    await saveParsedItems(orderId, classifiedItems);

    // 8. Add assistant summary message
    const itemCount = classifiedItems.length;
    let summary = `He procesado todo el pedido. Encontré ${itemCount} producto${itemCount !== 1 ? 's' : ''}:\n\n`;

    classifiedItems.forEach(item => {
        const supplier = suppliers?.find(s => s.id === item.supplier_id);
        const supplierName = supplier?.name || 'Sin proveedor';
        summary += `- ${item.quantity} ${item.unit} de ${item.product} (${supplierName})\n`;
    });

    await saveConversationMessage(orderId, 'assistant', summary);

    // Return redirect URL instead of redirecting directly to avoid client-side try-catch issues
    return { success: true, redirectUrl: `/orders/${orderId}/review` };
}

/**
 * Get conversation history for an order
 */
export async function getOrderConversation(orderId: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        throw new Error('Unauthorized');
    }

    // Check access via order membership
    const { data: order } = await supabase
        .from('orders')
        .select('organization_id')
        .eq('id', orderId)
        .single();

    if (!order) {
        throw new Error('Order not found');
    }

    const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('user_id', user.id)
        .eq('organization_id', order.organization_id)
        .single();

    if (!membership) {
        throw new Error('Forbidden');
    }

    const { data, error } = await supabase
        .from('order_conversations')
        .select(`
      *,
      audio_file:order_audio_files(*)
    `)
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching conversation:', error);
        throw new Error('Failed to fetch conversation');
    }

    return data;
}
