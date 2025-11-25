import { SupabaseClient } from '@supabase/supabase-js';
import { eventBus } from '@/lib/events/EventBus';
import { OrderEventNames } from '@/features/orders/server/events/OrderEvents';
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
  }): Promise<string> {
    const messageId = crypto.randomUUID();

    const { error } = await this.supabase.from('order_conversations').insert({
      id: messageId,
      order_id: params.orderId,
      role: params.role,
      content: params.content,
      audio_file_id: params.audioFileId || null,
      sequence_number: params.sequenceNumber,
    });

    if (error) {
      throw new Error(`Failed to add message: ${error.message}`);
    }

    // Emit event for tracking/analytics
    eventBus.emit(OrderEventNames.MESSAGE_ADDED, {
      orderId: params.orderId,
      messageId,
      role: params.role,
      sequenceNumber: params.sequenceNumber,
      timestamp: new Date().toISOString(),
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
      const unclassifiedCount = classifiedItems.filter(item => !item.supplier_id).length;

      // Emit event for tracking/analytics
      eventBus.emit(OrderEventNames.ORDER_PROCESSED, {
        orderId,
        itemCount: classifiedItems.length,
        unclassifiedCount,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        redirectUrl: `/orders/${orderId}/review`,
      };
    } catch (error) {
      // Emit failure event
      eventBus.emit(OrderEventNames.PROCESSING_FAILED, {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stage: 'parsing',
        timestamp: new Date().toISOString(),
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
    eventBus.emit(OrderEventNames.ORDER_SENT, {
      orderId,
      supplierOrderIds: supplierOrders.map(so => so.id),
      supplierCount: supplierOrders.length,
      timestamp: new Date().toISOString(),
    });
  }
}
