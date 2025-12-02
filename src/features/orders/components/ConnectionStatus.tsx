'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSync } from '@/context/SyncContext';
import { RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function ConnectionStatus() {
  const isOnline = useNetworkStatus();
  const { isSyncing } = useSync();
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowOffline(true);
      toast.info('Estás offline. Puedes seguir escribiendo.', { id: 'offline-toast' });
    } else {
      if (showOffline) {
        toast.success('Conexión recuperada.', { id: 'online-toast' });
        setShowOffline(false);
      }
    }
  }, [isOnline, showOffline]);

  if (isOnline && !isSyncing) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors',
        !isOnline && 'bg-destructive/10 text-destructive',
        isSyncing && 'bg-yellow-500/10 text-yellow-600'
      )}
    >
      {!isOnline && (
        <>
          <WifiOff className="w-3 h-3" />
          <span>Offline</span>
        </>
      )}
      {isOnline && isSyncing && (
        <>
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Sincronizando...</span>
        </>
      )}
    </div>
  );
}
