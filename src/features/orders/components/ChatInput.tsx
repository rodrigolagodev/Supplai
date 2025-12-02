'use client';

import React, { useRef, useEffect, memo } from 'react';
import { useOrderChat } from '@/context/OrderChatContext';
import { VoiceRecorderButton } from './VoiceRecorderButton';
import { Button } from '@/components/ui/button';
import { SendHorizontal, Check, WifiOff, Wifi } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useSync } from '@/context/SyncContext';
import { QuickReplies } from './QuickReplies';

/**
 * ChatInput component with React.memo to prevent unnecessary re-renders
 * when orderId changes in the context (which doesn't affect this component's UI)
 */
export const ChatInput = memo(function ChatInput() {
  const {
    input,
    handleInputChange,
    handleSubmit,
    processAudio,
    isLoading,
    orderId,
    pendingCount,
    sendMessage,
    processOrder,
    updateTypingActivity,
    setIsRecording,
  } = useOrderChat();
  const { isOnline } = useSync();
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

  const handleQuickReply = (reply: { action: string; message?: string }) => {
    if (reply.action === 'message' && reply.message) {
      sendMessage(reply.message);
    } else if (reply.action === 'finish') {
      processOrder();
    }
  };

  return (
    <div className="p-4 bg-background border-t">
      <div className="max-w-3xl mx-auto mb-2">
        <QuickReplies onSelect={handleQuickReply} disabled={isLoading} />
      </div>
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => {
              handleInputChange(e);
              updateTypingActivity();
            }}
            onKeyDown={onKeyDown}
            placeholder="Escribe tu pedido o usa el micrófono..."
            className="min-h-[48px] max-h-[150px] resize-none pr-12 py-3 rounded-2xl border-muted-foreground/20 focus-visible:ring-primary"
            rows={1}
          />
          <Button
            size="icon"
            variant="ghost"
            className="absolute right-1 bottom-1 h-10 w-10 text-primary hover:bg-primary/10 disabled:opacity-50"
            onClick={e => {
              e.preventDefault();
              const formEvent = new Event('submit', { bubbles: true, cancelable: true });
              handleSubmit(formEvent as unknown as React.FormEvent<HTMLFormElement>);
            }}
            disabled={!input.trim() || isLoading}
          >
            <SendHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <VoiceRecorderButton
          orderId={orderId}
          onRecordingComplete={processAudio}
          onRecordingStateChange={setIsRecording}
          disabled={input.length > 0} // Disable voice if typing
        />
      </div>

      {/* Status indicators */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {/* Online/Offline indicator */}
          {isOnline ? (
            <div className="flex items-center gap-1 text-green-600">
              <Wifi className="h-3 w-3" />
              <span className="text-xs">IA Activa</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-600">
              <WifiOff className="h-3 w-3" />
              <span className="text-xs">Modo Captura</span>
            </div>
          )}

          {/* Pending messages indicator */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Check className="h-3 w-3" />
              <span className="text-xs">
                {pendingCount} mensaje{pendingCount > 1 ? 's' : ''} guardado
                {pendingCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
});
