import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useOrderChat } from '@/context/OrderChatContext';
import { Sparkles, Loader2, RefreshCw, Check } from 'lucide-react';
import { useSync } from '@/context/SyncContext';

export function ProcessButton({ onClick }: { onClick?: () => void }) {
  const { messages, processOrder, isProcessing } = useOrderChat();
  const { syncNow } = useSync();
  const [stage, setStage] = useState<'idle' | 'syncing' | 'parsing' | 'done'>('idle');

  // Only show if there are user messages
  const hasUserMessages = messages.some(m => m.role === 'user');

  if (!hasUserMessages) return null;

  const handleProcess = async () => {
    try {
      setStage('syncing');
      // We manually trigger sync first to show the state
      await syncNow();

      setStage('parsing');
      // Then we call the context processOrder which handles the rest
      // Note: context processOrder also calls syncNow, but it's fine to call it twice or we can modify context.
      // Actually, context processOrder does everything.
      // If we want to show stages, we might need to decompose it or just rely on timing.
      // But since we can't easily hook into the middle of context function,
      // we will just wrap it.
      await processOrder();

      setStage('done');
      // Navigation happens in context callback, but we set done here just in case
      if (onClick) onClick();
    } catch {
      setStage('idle');
    }
  };

  return (
    <Button
      onClick={handleProcess}
      disabled={isProcessing || stage !== 'idle'}
      className="gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0 transition-all duration-300"
    >
      {stage === 'idle' && (
        <>
          <Sparkles className="h-4 w-4" />
          Procesar Pedido
        </>
      )}
      {stage === 'syncing' && (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          Sincronizando...
        </>
      )}
      {stage === 'parsing' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Analizando...
        </>
      )}
      {stage === 'done' && (
        <>
          <Check className="h-4 w-4" />
          Listo!
        </>
      )}
    </Button>
  );
}
