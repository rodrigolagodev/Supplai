'use server';

import { getOrderContext } from '@/lib/auth/context';

/**
 * Save a message to the conversation history
 */
/**
 * Save a message to the conversation history
 */
export async function saveConversationMessage(
  orderId: string,
  role: 'user' | 'assistant',
  content: string,
  audioFileId?: string,
  sequenceNumber?: number,
  id?: string
) {
  // We use getOrderContext to verify access to the order
  const { supabase } = await getOrderContext(orderId);

  const messageId = id || crypto.randomUUID();
  const seqNum = sequenceNumber || 0;

  // Handle sequence number overflow (legacy support)
  const safeSequenceNumber = seqNum > 2000000000 ? Math.floor(seqNum / 1000) : seqNum;

  const { error } = await supabase.from('order_conversations').upsert(
    {
      id: messageId,
      order_id: orderId,
      role,
      content,
      audio_file_id: audioFileId || null,
      sequence_number: safeSequenceNumber,
    },
    {
      onConflict: 'id',
      ignoreDuplicates: false,
    }
  );

  if (error) {
    throw new Error(`Failed to add message: ${error.message}`);
  }
}

/**
 * Process a batch of recent messages and return AI summary
 * Used for debounced conversational responses
 * Gets all user messages since the last assistant message
 */
export async function processBatchMessages(orderId: string) {
  const { supabase, order } = await getOrderContext(orderId);

  // 2. Get the last assistant message sequence number
  const { data: lastAssistantMsg } = await supabase
    .from('order_conversations')
    .select('sequence_number')
    .eq('order_id', orderId)
    .eq('role', 'assistant')
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Temporary type fix until database types are regenerated
  type OrderConversationWithSequence = { sequence_number: number };
  const lastAssistantSeq =
    (lastAssistantMsg as unknown as OrderConversationWithSequence)?.sequence_number ?? -1;

  // 3. Get all user messages after the last assistant message
  const { data: messages } = await supabase
    .from('order_conversations')
    .select('*')
    .eq('order_id', orderId)
    .eq('role', 'user')
    .gt('sequence_number', lastAssistantSeq)
    .order('sequence_number', { ascending: true });

  if (!messages || messages.length === 0) {
    return { summary: 'No hay mensajes nuevos para procesar', items: [], processedCount: 0 };
  }

  // 3. Concatenate message content
  const conversationText = messages.map(m => m.content).join('\n');

  // 4. Get suppliers for context
  const { data: suppliers } = await supabase
    .from('suppliers')
    .select('id, name, category, custom_keywords')
    .eq('organization_id', order.organization_id);

  // 5. Call AI to parse items (using existing AI infrastructure)
  const { parseOrderText } = await import('@/lib/ai/gemini');

  try {
    const items = await parseOrderText(conversationText, suppliers || []);

    // 6. Format response
    let summary = 'Entendido:\n';
    if (items.length > 0) {
      summary += items
        .map(
          (item: { quantity: number; unit: string; product: string }) =>
            `• ${item.quantity} ${item.unit} de ${item.product}`
        )
        .join('\n');
      summary += '\n\n¿Algo más que agregar?';
    } else {
      summary =
        'He recibido tus mensajes, pero no pude identificar productos específicos. ¿Podrías darme más detalles?';
    }

    return {
      summary,
      items,
      processedCount: messages.length,
    };
  } catch (error) {
    console.error('Error parsing batch messages:', error);
    return {
      summary: 'He recibido tus mensajes. ¿Puedes confirmar los productos?',
      items: [],
      processedCount: messages.length,
    };
  }
}

/**
 * Process all messages in an order to extract items
 *
 * This is now a thin controller that delegates to ProcessOrderMessageUseCase
 */
export async function processOrderBatch(orderId: string) {
  const { supabase, order } = await getOrderContext(orderId);

  // Delegate to use case
  const { processOrderMessageUseCase } = await import(
    '@/application/use-cases/ProcessOrderMessage'
  );

  return await processOrderMessageUseCase({
    orderId,
    organizationId: order.organization_id,
    supabase,
  });
}
