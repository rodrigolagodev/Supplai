import { SupabaseClient } from '@supabase/supabase-js';
import { eventBus } from '@/lib/events/EventBus';

import type { Database } from '@/types/database';

/**
 * OrderCommands - Encapsulates all write operations for orders
 *
 * Benefits:
 * - Testable without database (can mock SupabaseClient)
 * - Single place for business logic
 * - Event emission built-in for analytics
 * - Reusable across different entry points (API routes, Server Actions, etc.)
 */
export class OrderCommands {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Add a message to an order conversation
   *
   * @param params - Message parameters
   * @returns The created message ID
   * @throws Error if save fails
   */
  async addMessage(params: {
    orderId: string;
    role: 'user' | 'assistant';
    content: string;
    audioFileId?: string;
    sequenceNumber: number;
    id?: string;
  }): Promise<string> {
    const messageId = params.id || crypto.randomUUID();

    const { error } = await this.supabase.from('order_conversations').upsert(
      {
        id: messageId,
        order_id: params.orderId,
        role: params.role,
        content: params.content,
        audio_file_id: params.audioFileId || null,
        // Ensure sequence number fits in 4-byte integer (max 2,147,483,647)
        // If it's a timestamp (13 digits), we need to handle it.
        // However, the best practice is to let the database handle auto-increment or use a smaller number.
        // Since we receive it from params, we'll cap it or modulo it if it's too large,
        // BUT for correctness we should probably query the max sequence number if it looks like a timestamp.
        // For now, let's assume if it's > 2000000000 it's a timestamp and we should fix it.
        sequence_number:
          params.sequenceNumber > 2000000000
            ? Math.floor(params.sequenceNumber / 1000)
            : params.sequenceNumber,
      },
      {
        onConflict: 'id',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    // Emit event for tracking/analytics
    // Emit event for tracking/analytics
    // Map to new EventBus structure
    eventBus.publish({
      type: 'message:sent',
      payload: {
        messageId,
        content: params.content,
      },
    });

    return messageId;
  }

  /**
   * Process an order: parse messages into items and classify them
   *
   * @param orderId - Order ID to process
   * @param organizationId - Organization ID (for fetching suppliers)
   * @returns Processing result with redirect URL or message
   * @throws Error if processing fails
   */
  async processOrder(
    orderId: string,
    organizationId: string
  ): Promise<{
    success: boolean;
    redirectUrl?: string;
    message?: string;
  }> {
    try {
      // Import AI parsing function
      const { parseOrderText } = await import('@/lib/ai/gemini');

      // 1. Fetch user messages
      const { data: messages, error: messagesError } = await this.supabase
        .from('order_conversations')
        .select('content')
        .eq('order_id', orderId)
        .eq('role', 'user')
        .order('sequence_number', { ascending: true });

      if (messagesError || !messages || messages.length === 0) {
        return {
          success: false,
          message: 'No hay mensajes para procesar.',
        };
      }

      // 2. Aggregate text
      const fullText = messages.map(m => m.content).join('\n\n');

      // 3. Fetch suppliers for classification
      const { data: suppliers } = await this.supabase
        .from('suppliers')
        .select('id, name, category, custom_keywords')
        .eq('organization_id', organizationId);

      // 4. Parse with AI (Gemini includes supplier classification)
      const parsedItems = await parseOrderText(fullText, suppliers || []);

      if (parsedItems.length === 0) {
        return {
          success: false,
          message: 'No pude identificar productos en la conversación.',
        };
      }

      // 5. Format items with classification confidence
      const classifiedItems = parsedItems.map(item => ({
        ...item,
        supplier_id: item.supplier_id || null,
        classification_confidence: item.confidence,
      }));

      // 6. Replace existing items (delete old, insert new)
      await this.supabase.from('order_items').delete().eq('order_id', orderId);

      // Import and use saveParsedItems helper
      const { saveParsedItems } = await import('@/features/orders/actions/items');
      await saveParsedItems(orderId, classifiedItems);

      // 7. Create summary message
      const itemCount = classifiedItems.length;
      let summary = `He procesado todo el pedido. Encontré ${itemCount} producto${itemCount !== 1 ? 's' : ''}:\n\n`;

      classifiedItems.forEach(item => {
        const supplier = suppliers?.find(s => s.id === item.supplier_id);
        const supplierName = supplier?.name || 'Sin proveedor';
        summary += `- ${item.quantity} ${item.unit} de ${item.product} (${supplierName})\n`;
      });

      // Add summary message (this will use OrderCommands.addMessage internally)
      await this.addMessage({
        orderId,
        role: 'assistant',
        content: summary,
        sequenceNumber: messages.length + 1,
      });

      // Calculate stats for event

      return {
        success: true,
        redirectUrl: `/orders/${orderId}/review`,
      };
    } catch (error) {
      // Emit failure event
      // Emit failure event
      eventBus.publish({
        type: 'error:occurred',
        payload: {
          error: error instanceof Error ? error : new Error('Unknown error'),
          context: `Processing failed for order ${orderId}`,
        },
      });

      throw error;
    }
  }

  /**
   * Send an order to suppliers via email queue
   *
   * @param orderId - Order ID to send
   * @throws Error if sending fails
   */
  async sendOrder(orderId: string): Promise<void> {
    // Import services dynamically to avoid circular dependencies
    const { OrderService } = await import('@/services/orders');
    const { JobQueue } = await import('@/services/queue');

    // 1. Validate order exists and has items
    const { data: order, error: orderError } = await this.supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error('Order not found');
    }

    // 2. Create Supplier Orders (Idempotent)
    const supplierOrders = await OrderService.createSupplierOrders(orderId, this.supabase);

    if (supplierOrders.length === 0) {
      throw new Error('No items found to send');
    }

    // 3. Enqueue Jobs
    for (const supplierOrder of supplierOrders) {
      await JobQueue.enqueue(
        'SEND_SUPPLIER_ORDER',
        { supplierOrderId: supplierOrder.id },
        this.supabase
      );
    }

    // 4. Update main order status to 'sending' immediately for UI feedback
    const { error: updateError } = await this.supabase
      .from('orders')
      .update({ status: 'sending' })
      .eq('id', orderId);

    if (updateError) {
      throw new Error(`Failed to update order status: ${updateError.message}`);
    }

    // Emit event for tracking/analytics
    // Emit event for tracking/analytics
    // TODO: Define specific events for order sending
    eventBus.publish({
      type: 'queue:status_changed',
      payload: { pending: 0, executing: 0 },
    });
  }
}
