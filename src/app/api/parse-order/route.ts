import { NextRequest, NextResponse } from 'next/server';
import { getOrderContext, authErrorStatus } from '@/lib/auth/context';
import { parseOrderText } from '@/lib/ai/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, orderId } = body;

    if (!text || !orderId) {
      return NextResponse.json({ error: 'Missing text or orderId' }, { status: 400 });
    }

    // 1. Validate auth + order access + membership
    try {
      await getOrderContext(orderId);
    } catch (authError) {
      return NextResponse.json(
        { error: (authError as Error).message },
        { status: authErrorStatus(authError) }
      );
    }

    // 2. Parse with Gemini
    const items = await parseOrderText(text);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Parsing API error:', error);
    return NextResponse.json({ error: 'Failed to parse order' }, { status: 500 });
  }
}
