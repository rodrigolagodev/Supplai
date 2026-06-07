import { NextRequest, NextResponse } from 'next/server';
import { getOrderContext, authErrorStatus } from '@/lib/auth/context';
import { AudioService } from '@/features/orders/server/services/audio-service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const orderId = formData.get('orderId') as string;

    if (!audioFile || !orderId) {
      return NextResponse.json({ error: 'Missing audio file or orderId' }, { status: 400 });
    }

    // 1. Validate auth + order access + membership
    let supabase;
    try {
      ({ supabase } = await getOrderContext(orderId));
    } catch (authError) {
      return NextResponse.json(
        { error: (authError as Error).message },
        { status: authErrorStatus(authError) }
      );
    }

    // 2. Convert File to Blob and process with AudioService
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type });

    const audioService = new AudioService(supabase);

    try {
      const result = await audioService.uploadAndTranscribe(audioBlob, orderId);

      return NextResponse.json({
        transcription: result.transcription,
        audioFileId: result.audioFileId,
        fromCache: result.fromCache,
      });
    } catch (serviceError) {
      console.error('Audio service error:', serviceError);
      const errorMessage = serviceError instanceof Error ? serviceError.message : 'Unknown error';
      console.error('Error details:', { errorMessage, stack: (serviceError as Error).stack });
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
