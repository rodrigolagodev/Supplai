'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Database } from '@/types/database';
import { ClassifiedItem } from '@/lib/ai/classifier';
import { saveConversationMessage, saveParsedItems } from '@/app/(protected)/orders/actions';
import { toast } from 'sonner';

type Order = Database['public']['Tables']['orders']['Row'];
type Message = Database['public']['Tables']['order_conversations']['Row'] & {
    audio_file?: Database['public']['Tables']['order_audio_files']['Row'] | null;
};

interface OrderChatContextType {
    orderId: string;
    messages: Message[];
    isProcessing: boolean;
    currentStatus: string; // 'listening' | 'transcribing' | 'parsing' | 'classifying' | 'idle'
    addMessage: (role: 'user' | 'assistant', content: string, audioFileId?: string) => Promise<void>;
    processAudio: (audioBlob: Blob) => Promise<void>;
    processText: (text: string) => Promise<void>;
    processOrder: () => Promise<void>;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
    children,
    orderId,
    initialMessages = []
}: {
    children: React.ReactNode;
    orderId: string;
    initialMessages?: Message[];
}) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [isProcessing, setIsProcessing] = useState(false);
    const [currentStatus, setCurrentStatus] = useState('idle');

    // Optimistic update for messages
    const addMessage = useCallback(async (role: 'user' | 'assistant', content: string, audioFileId?: string) => {
        const tempId = crypto.randomUUID();
        const newMessage: Message = {
            id: tempId,
            order_id: orderId,
            role,
            content,
            created_at: new Date().toISOString(),
            metadata: {},
        };

        setMessages(prev => [...prev, newMessage]);

        try {
            await saveConversationMessage(orderId, role, content, audioFileId);
        } catch (error) {
            console.error('Failed to save message:', error);
            toast.error('Error al guardar el mensaje');
        }
    }, [orderId]);

    const processText = useCallback(async (text: string) => {
        if (!text.trim()) return;
        // Just add the message, no processing
        await addMessage('user', text);
    }, [addMessage]);

    const processAudio = useCallback(async (audioBlob: Blob) => {
        setIsProcessing(true);
        setCurrentStatus('transcribing');

        try {
            // 1. Upload and transcribe
            const formData = new FormData();
            formData.append('audio', audioBlob, 'recording.webm');
            formData.append('orderId', orderId);

            const response = await fetch('/api/process-audio', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Error en la transcripción');

            const { transcription, audioFileId } = await response.json();

            // 2. Add user message with audio
            await addMessage('user', transcription, audioFileId);

        } catch (error) {
            console.error('Audio processing error:', error);
            toast.error('Error al procesar el audio');
        } finally {
            setIsProcessing(false);
            setCurrentStatus('idle');
        }
    }, [orderId, addMessage]);

    const processOrder = useCallback(async () => {
        setIsProcessing(true);
        setCurrentStatus('parsing'); // or 'processing'

        try {
            // Call the batch processing action
            // We need to import processOrderBatch dynamically or pass it via props if it's a server action?
            // Since we are in a client component context, we can import the server action directly if it's marked 'use server'
            // But here we are in a context file.
            // Let's assume we import it at the top.

            // Wait, I need to import processOrderBatch at the top of this file first.
            // But I can't add imports with this tool easily if I don't replace the top.
            // I will add the import in a separate step or assume it's available.
            // Actually, I'll use a dynamic import or just fetch if it was an API route.
            // But it is a server action.

            // Let's just call the API route wrapper if I made one? No, I made a server action.
            // I should import it.

            // For now, I will leave this placeholder and fix imports in next step.
            const { processOrderBatch } = await import('@/app/(protected)/orders/actions');

            const result = await processOrderBatch(orderId);

            if (result.message) {
                // Add the assistant message to local state
                await addMessage('assistant', result.message);
            }

            toast.success('Pedido procesado correctamente');

        } catch (error) {
            console.error('Batch processing error:', error);
            toast.error('Error al procesar el pedido');
            await addMessage('assistant', 'Hubo un error al procesar el pedido. Por favor intenta de nuevo.');
        } finally {
            setIsProcessing(false);
            setCurrentStatus('idle');
        }
    }, [orderId, addMessage]);

    return (
        <OrderChatContext.Provider value={{
            orderId,
            messages,
            isProcessing,
            currentStatus,
            addMessage,
            processAudio,
            processText,
            processOrder
        }}>
            {children}
        </OrderChatContext.Provider>
    );
}

export function useOrderChat() {
    const context = useContext(OrderChatContext);
    if (context === undefined) {
        throw new Error('useOrderChat must be used within an OrderChatProvider');
    }
    return context;
}
