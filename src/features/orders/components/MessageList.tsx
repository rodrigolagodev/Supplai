'use client';

import React, { useEffect, useRef } from 'react';
import { useOrderChat } from '@/context/OrderChatContext';
import { cn } from '@/lib/utils';
import { Bot, User, CheckCheck, Clock } from 'lucide-react';
import { AudioMessage } from './AudioMessage';
import { LocalMessage } from '@/lib/db/schema';
import { TypingIndicator } from './TypingIndicator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion } from 'framer-motion';

export function MessageList() {
  const { messages, isLoading, currentStatus, isAssistantTyping } = useOrderChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
          <Bot className="h-12 w-12 opacity-50" />
          <p className="text-center max-w-md">
            Hola. Soy tu asistente de pedidos.
            <br />
            Dime qué necesitas pedir (ej: "3 kilos de tomate y 2 cajas de leche") o graba un audio.
          </p>
        </div>
      ) : (
        <div className="mt-auto space-y-4 w-full">
          {messages.map(msg => (
            <MessageItem key={msg.id} message={msg} />
          ))}

          {(isLoading || isAssistantTyping) && (
            <div className="flex w-full gap-3 max-w-3xl mx-auto justify-start">
              <Avatar className="h-8 w-8 border">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              {isAssistantTyping ? (
                <TypingIndicator />
              ) : (
                <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce"></span>
                  </span>
                  <span className="text-xs text-muted-foreground ml-2 capitalize">
                    {currentStatus === 'transcribing' && 'Transcribiendo audio...'}
                    {currentStatus === 'parsing' && 'Escribiendo...'}
                    {currentStatus === 'classifying' && 'Buscando proveedores...'}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function MessageItem({ message }: { message: LocalMessage }) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isAudio = message.type === 'audio';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex w-full gap-3 max-w-3xl mx-auto',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {isAssistant && (
        <Avatar className="h-8 w-8 border">
          <AvatarImage src="/bot-avatar.png" alt="AI" />
          <AvatarFallback className="bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className="flex flex-col gap-1 max-w-[80%]">
        <div
          className={cn(
            'rounded-2xl overflow-hidden shadow-sm',
            isUser
              ? 'bg-primary text-primary-foreground rounded-br-none'
              : 'bg-card border text-card-foreground rounded-bl-none'
          )}
        >
          {/* Render audio message */}
          {isAudio && isUser ? (
            <div className="p-2">
              <AudioMessage
                audioUrl={message.audio_url}
                audioBlob={message.audio_blob}
                syncStatus={message.sync_status}
                className="bg-primary/20"
              />
            </div>
          ) : (
            <div className="px-4 py-3">
              {/* Format assistant messages with structured lists */}
              {isAssistant ? (
                <FormattedAssistantMessage content={message.content} />
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              )}
            </div>
          )}
        </div>

        {/* Sync status indicator for user messages */}
        {isUser && (
          <div className="flex items-center gap-1 justify-end px-2">
            {message.sync_status === 'pending' && (
              <>
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Guardando...</span>
              </>
            )}
            {message.sync_status === 'synced' && (
              <>
                <CheckCheck className="h-3 w-3 text-green-500" />
                <span className="text-xs text-muted-foreground">Enviado</span>
              </>
            )}
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 border">
          <AvatarImage src="/user-avatar.png" alt="User" />
          <AvatarFallback className="bg-primary text-primary-foreground">
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </motion.div>
  );
}

function FormattedAssistantMessage({ content }: { content: string }) {
  // Check if content has structured list (starts with "Entendido:")
  if (content.includes('Entendido:') || content.includes('•')) {
    const lines = content.split('\n');
    return (
      <div className="text-sm space-y-2">
        {lines.map((line, index) => {
          // Header line
          if (line.includes('Entendido:')) {
            return (
              <p key={index} className="font-medium">
                {line}
              </p>
            );
          }
          // List item
          if (line.trim().startsWith('•')) {
            return (
              <p key={index} className="pl-2">
                {line}
              </p>
            );
          }
          // Regular line
          if (line.trim()) {
            return (
              <p key={index} className="leading-relaxed">
                {line}
              </p>
            );
          }
          return null;
        })}
      </div>
    );
  }

  // Default rendering
  return <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>;
}
