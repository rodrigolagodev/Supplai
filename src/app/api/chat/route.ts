import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/supabase/server';
import { saveConversationMessage } from '@/features/orders/actions/process-message';
import { CONVERSATIONAL_SYSTEM_PROMPT } from '@/lib/ai/prompts';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: Request) {
  const body = await req.json();
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

  if (!messages || !Array.isArray(messages)) {
    return new Response('Invalid messages format', { status: 400 });
  }

  const lastMessage = messages[messages.length - 1];

  // Get the current max sequence number for proper ordering
  const { data: maxSeqData } = await supabase
    .from('order_conversations')
    .select('sequence_number')
    .eq('order_id', orderId)
    .order('sequence_number', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextSeq = ((maxSeqData as { sequence_number?: number })?.sequence_number ?? -1) + 1;

  // Note: User messages are saved by the sync process from IndexedDB
  // We only save the assistant response here

  // Fetch product suggestions and last order for context
  const {
    getFrequentProducts,
    getLastOrder,
    formatFrequentProductsForPrompt,
    formatLastOrderForPrompt,
  } = await import('@/features/orders/server/services/product-suggestions');

  const [frequentProducts, lastOrderItems] = await Promise.all([
    getFrequentProducts(supabase, user.id, order.organization_id, 10),
    getLastOrder(supabase, user.id, order.organization_id),
  ]);

  const frequentProductsContext = formatFrequentProductsForPrompt(frequentProducts);
  const lastOrderContext = formatLastOrderForPrompt(lastOrderItems);

  // Build enhanced system prompt with context
  const enhancedSystemPrompt = `${CONVERSATIONAL_SYSTEM_PROMPT}

PRODUCTOS FRECUENTES DEL USUARIO:
${frequentProductsContext}

ÚLTIMO PEDIDO DEL USUARIO:
${lastOrderContext}

INSTRUCCIONES ADICIONALES:
- Si el usuario pregunta "¿qué suelo pedir?" o "mis productos habituales", menciona los productos frecuentes.
- Si el usuario dice "lo mismo que la vez pasada" o "repetir último pedido", menciona los items del último pedido.
- Cuando confirmes un producto, usa el formato: ✅ [cantidad] [unidad] de [producto]
- Si el usuario menciona un producto sin cantidad o unidad, pregunta amablemente para aclarar.`;

  // Convert messages to Google AI format
  const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const model = genAI.getGenerativeModel({
    model: 'models/gemini-2.0-flash',
    generationConfig: {
      temperature: 0.7,
    },
    systemInstruction: enhancedSystemPrompt,
  });

  try {
    const chat = model.startChat({ history });

    // Stream the response
    const result = await chat.sendMessageStream(String(lastMessage.content));

    const encoder = new TextEncoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            controller.enqueue(encoder.encode(text));
          }

          // Save assistant message after streaming completes
          try {
            await saveConversationMessage(
              orderId,
              'assistant',
              fullResponse,
              undefined,
              nextSeq + 1
            );
          } catch (error) {
            console.error('Failed to save assistant message:', error);
          }

          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Gemini API Error:', error);

    // Check for quota exceeded (429) or overloaded (503)
    if (
      error?.status === 429 ||
      error?.status === 503 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota')
    ) {
      return new Response(
        JSON.stringify({
          error: 'quota_exceeded',
          message: 'El sistema de IA está ocupado. Por favor intenta de nuevo en unos momentos.',
          retryAfter: 60, // Default to 60s if not provided
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: 'Error procesando tu mensaje',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
