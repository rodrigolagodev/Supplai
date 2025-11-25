'use client';

import React, { useRef, useEffect, memo } from 'react';
import { useOrderChat } from '@/context/OrderChatContext';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { Button } from '@/components/ui/button';
import { SendHorizontal } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

/**
 * ChatInput component with React.memo to prevent unnecessary re-renders
 * when orderId changes in the context (which doesn't affect this component's UI)
 */
export const ChatInput = memo(function ChatInput() {
  const { input, handleInputChange, handleSubmit, processTranscription, isLoading, orderId } =
    useOrderChat();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'inherit';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 150)}px`;
    }
  }, [input]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  return (
    <div className="p-4 bg-background border-t">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu pedido o usa el micrófono..."
            className="min-h-[48px] max-h-[150px] resize-none pr-12 py-3 rounded-2xl border-muted-foreground/20 focus-visible:ring-primary"
            rows={1}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 bottom-1 h-10 w-10 text-primary hover:bg-primary/10 disabled:opacity-50"
            onClick={e => handleSubmit(e as unknown as React.FormEvent)}
            disabled={!input.trim() || isLoading}
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <VoiceRecorderButton
          orderId={orderId}
          onTranscriptionSuccess={processTranscription}
          disabled={input.length > 0} // Disable voice if typing
        />
      </div>

      <div className="text-center mt-2">
        <p className="text-xs text-muted-foreground">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
});
