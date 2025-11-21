import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transcribeAudio } from '@/lib/ai/groq';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;
        const orderId = formData.get('orderId') as string;

        if (!audioFile || !orderId) {
            return NextResponse.json(
                { error: 'Missing audio file or orderId' },
                { status: 400 }
            );
        }

        // 1. Validate user access
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

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

        // 2. Upload to Supabase Storage
        const fileExt = audioFile.name.split('.').pop() || 'webm';
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const storagePath = `order-audio/${orderId}/${fileName}`;

        // Use Admin Client to ensure bucket exists (only if key is available)
        if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
            const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
            const adminClient = createSupabaseClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY
            );

            const { data: buckets } = await adminClient.storage.listBuckets();
            if (!buckets?.find(b => b.name === 'orders')) {
                await adminClient.storage.createBucket('orders', {
                    public: false,
                    fileSizeLimit: 26214400, // 25MB
                });
            }
        }

        // Upload using authenticated user client (respects RLS)
        const { error: uploadError } = await supabase.storage
            .from('orders')
            .upload(storagePath, audioFile, {
                contentType: 'audio/webm',
                upsert: false
            });

        if (uploadError) {
            console.error('Storage upload error:', uploadError);
            return NextResponse.json(
                { error: 'Failed to upload audio' },
                { status: 500 }
            );
        }

        console.log('Audio file details:', {
            name: audioFile.name,
            type: audioFile.type,
            size: audioFile.size
        });

        // 3. Create database record for audio file
        const { data: audioRecord, error: dbError } = await supabase
            .from('order_audio_files')
            .insert({
                order_id: orderId,
                original_filename: audioFile.name,
                storage_path: storagePath,
                file_size_bytes: audioFile.size,
                processing_status: 'processing',
            })
            .select()
            .single();

        if (dbError) {
            console.error('Database error:', dbError);
            return NextResponse.json(
                { error: 'Failed to create audio record' },
                { status: 500 }
            );
        }

        // 4. Transcribe with Groq
        // Note: In a production app, this might be better as a background job
        // But for MVP/interactive chat, we do it inline for speed
        try {
            const result = await transcribeAudio(audioFile);

            // Update record with result
            await supabase
                .from('order_audio_files')
                .update({
                    transcription: result.text,
                    confidence_score: result.confidence,
                    duration_seconds: result.duration,
                    processing_status: 'completed',
                    transcribed_at: new Date().toISOString(),
                })
                .eq('id', audioRecord.id);

            return NextResponse.json({
                transcription: result.text,
                confidence: result.confidence,
                audioFileId: audioRecord.id,
            });

        } catch (transcriptionError) {
            console.error('Transcription error:', transcriptionError);

            // Update record with error
            await supabase
                .from('order_audio_files')
                .update({
                    processing_status: 'failed',
                    error_message: (transcriptionError as Error).message,
                })
                .eq('id', audioRecord.id);

            return NextResponse.json(
                { error: 'Transcription failed' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
