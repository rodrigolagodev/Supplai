'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { syncPendingItems } from '@/lib/db/sync';
import { toast } from 'sonner';

interface SyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Conexión restaurada. Sincronizando...');
      syncNow();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('Modo sin conexión. Los cambios se guardarán localmente.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Periodic sync (every 30s)
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      syncNow();
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline]);

  const syncNow = async () => {
    if (isSyncing || !navigator.onLine) return;

    setIsSyncing(true);
    try {
      await syncPendingItems();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <SyncContext.Provider value={{ isOnline, isSyncing, syncNow }}>{children}</SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (context === undefined) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}
