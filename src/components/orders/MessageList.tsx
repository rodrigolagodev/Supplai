'use client';

import React, { useEffect, useRef } from 'react';
import { useOrderChat } from '@/context/OrderChatContext';
import { cn } from '@/lib/utils';
import { Bot, User, FileAudio } from 'lucide-react';

export function MessageList() {
    const { messages, isProcessing, currentStatus } = useOrderChat();
    const bottomRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isProcessing]);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                    <Bot className="h-12 w-12 opacity-50" />
                    <p className="text-center max-w-md">
                        Hola. Soy tu asistente de pedidos.
                        <br />
                        Dime qué necesitas pedir (ej: "3 kilos de tomate y 2 cajas de leche") o graba un audio.
                    </p>
                </div>
            )}

            {messages.map((msg) => (
                <div
                    key={msg.id}
                    className={cn(
                        "flex w-full gap-3 max-w-3xl mx-auto",
                        msg.role === 'user' ? "justify-end" : "justify-start"
                    )}
                >
                    {msg.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Bot className="h-5 w-5 text-primary" />
                        </div>
                    )}

                    <div
                        className={cn(
                            "rounded-2xl px-4 py-3 max-w-[80%]",
                            msg.role === 'user'
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-muted text-foreground rounded-bl-none"
                        )}
                    >
                        {msg.audio_file && (
                            <div className="flex items-center gap-2 mb-2 text-xs opacity-80 border-b border-white/20 pb-2">
                                <FileAudio className="h-3 w-3" />
                                <span>Audio grabado</span>
                            </div>
                        )}
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                            {msg.content}
                        </p>
                    </div>

                    {msg.role === 'user' && (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <User className="h-5 w-5 text-primary-foreground" />
                        </div>
                    )}
                </div>
            ))}

            {isProcessing && (
                <div className="flex w-full gap-3 max-w-3xl mx-auto justify-start">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                        <span className="flex gap-1">
                            <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                            <span className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce"></span>
                        </span>
                        <span className="text-xs text-muted-foreground ml-2 capitalize">
                            {currentStatus === 'transcribing' && 'Transcribiendo audio...'}
                            {currentStatus === 'parsing' && 'Analizando pedido...'}
                            {currentStatus === 'classifying' && 'Buscando proveedores...'}
                        </span>
                    </div>
                </div>
            )}

            <div ref={bottomRef} />
        </div>
    );
}
