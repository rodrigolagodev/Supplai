import { google } from '@ai-sdk/google';
import { streamText } from 'ai';
import { createClient } from '@/lib/supabase/server';
import { saveConversationMessage } from '@/app/(protected)/orders/actions';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();
  console.log('[API] /api/chat body:', JSON.stringify(body, null, 2));
  const { messages, orderId } = body;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Verify access to order
  const { data: order } = await supabase
    .from('orders')
    .select('organization_id')
    .eq('id', orderId)
    .single();

  if (!order) {
    return new Response('Order not found', { status: 404 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('organization_id', order.organization_id)
    .single();

  if (!membership) {
    return new Response('Forbidden', { status: 403 });
  }

  // Get the last user message to save it if needed (optimistic update handling)
  // In a real app, you might want to check if it's already saved, but for now
  // we assume the client sends the full history and we only persist the new interaction.
  // However, `useChat` sends everything.
  // Strategy: We will save the USER message and the ASSISTANT message in `onFinish`.
  // But wait, `onFinish` only gives the generated text.
  // We need to identify the NEW user message.
  // Usually, the last message in `messages` array is the new user message.
  if (!messages || !Array.isArray(messages)) {
    console.error('[API] Invalid messages format:', messages);
    return new Response('Invalid messages format', { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastMessage = messages[messages.length - 1] as any;

  // Get the current max sequence number for proper ordering
  const { data: maxSeqData } = await supabase
    .from('order_conversations')
    .select('sequence_number')
    .eq('order_id', orderId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = (maxSeqData?.sequence_number ?? -1) + 1;

  // 1. Save User Message IMMEDIATELY (to prevent loss on abort)
  if (lastMessage && lastMessage.role === 'user') {
    try {
      console.log('[API] Saving user message with seq:', nextSeq);
      await saveConversationMessage(orderId, 'user', lastMessage.content, undefined, nextSeq);
    } catch (error) {
      console.error('Failed to save user message:', error);
      // We continue even if saving fails, but ideally we should alert
    }
  }

  const result = await streamText({
    model: google('gemini-1.5-flash'),
    messages: messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
    system: `Eres un asistente de pedidos para restaurantes. 
    Tu objetivo es ayudar al usuario a crear una lista de productos para pedir a sus proveedores.
    Sé conciso y directo. Si el usuario pide algo, confirma que lo has anotado.
    Si el usuario envía un audio, asume que es una lista de productos.
    NO proceses el pedido todavía, solo acumula la información conversacionalmente.`,
    onFinish: async ({ text }) => {
      // Save the interaction to the database asynchronously
      try {
        // 2. Save Assistant Message
        console.log('[API] Saving assistant message with seq:', nextSeq + 1);
        await saveConversationMessage(orderId, 'assistant', text, undefined, nextSeq + 1);
      } catch (error) {
        console.error('Failed to save assistant message:', error);
      }
    },
  });

  return result.toTextStreamResponse();
}
