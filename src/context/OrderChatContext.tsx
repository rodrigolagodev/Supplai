'use client';

import React, { createContext, useContext } from 'react';
import type { LocalMessage } from '@/lib/db/schema';
import { useOrderChatLogic } from '@/features/orders/hooks/useOrderChatLogic';

interface OrderChatContextType {
  orderId: string;
  messages: LocalMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  isProcessing: boolean;
  currentStatus: string;
  processAudio: (audioBlob: Blob) => Promise<void>;
  processOrder: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  isAssistantTyping: boolean;
  pendingCount: number;
  updateTypingActivity: () => void;
  cancelDebounce: () => void;
  isRecording: boolean;
  setIsRecording: (value: boolean) => void;
}

const OrderChatContext = createContext<OrderChatContextType | undefined>(undefined);

export function OrderChatProvider({
  children,
  orderId,
  organizationId,
  onOrderProcessed,
}: {
  children: React.ReactNode;
  orderId: string;
  organizationId: string;
  initialMessages?: Array<{ id: string; role: string; content: string; [key: string]: unknown }>;
  onOrderProcessed?: (redirectUrl: string) => void;
}) {
  const logic = useOrderChatLogic({
    orderId,
    organizationId,
    onOrderProcessed,
  });

  return <OrderChatContext.Provider value={logic}>{children}</OrderChatContext.Provider>;
}

export function useOrderChat() {
  const context = useContext(OrderChatContext);
  if (context === undefined) {
    throw new Error('useOrderChat must be used within an OrderChatProvider');
  }
  return context;
}
