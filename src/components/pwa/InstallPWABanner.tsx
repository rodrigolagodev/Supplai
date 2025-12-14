'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if running on mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check if user dismissed the banner before
    const wasDismissed = localStorage.getItem('pwa-install-dismissed') === 'true';

    if (!isMobile || isStandalone || wasDismissed) {
      return;
    }

    // Listen for the beforeinstallprompt event
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the custom banner
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Hide the banner regardless of choice
    setShowBanner(false);

    // Clear the deferredPrompt
    setDeferredPrompt(null);

    // Track the result
    console.log(`User response to install prompt: ${outcome}`);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', 'true');
    setTimeout(
      () => {
        localStorage.removeItem('pwa-install-dismissed');
      },
      7 * 24 * 60 * 60 * 1000
    ); // 7 days
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg animate-in slide-in-from-bottom duration-300">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Instalar Supplai</h3>
          <p className="text-xs opacity-90">
            Accede más rápido y úsala sin conexión desde tu pantalla de inicio
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 bg-white text-purple-600 rounded-lg font-medium text-sm hover:bg-gray-100 transition-colors active:scale-95"
          >
            Instalar
          </button>

          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors active:scale-95"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
