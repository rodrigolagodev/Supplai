import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AudioService, GroqTranscriptionAPI } from '@/application/services/audio';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const orderId = formData.get('orderId') as string;

    if (!audioFile || !orderId) {
      return NextResponse.json({ error: 'Missing audio file or orderId' }, { status: 400 });
    }

    // 1. Validate user access
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this order via organization membership
    const { data: order } = await supabase
      .from('orders')
      .select('organization_id')
      .eq('id', orderId)
      .single();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('memberships')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', order.organization_id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Convert File to Blob and process with AudioService
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });

    const transcriptionAPI = new GroqTranscriptionAPI();
    const audioService = new AudioService(supabase, transcriptionAPI);

    try {
      const result = await audioService.uploadAndTranscribe(audioBlob, orderId);

      return NextResponse.json({
        transcription: result.transcription,
        audioFileId: result.audioFileId,
        fromCache: result.fromCache,
      });
    } catch (serviceError) {
      console.error('Audio service error:', serviceError);
      return NextResponse.json({ error: (serviceError as Error).message }, { status: 500 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
