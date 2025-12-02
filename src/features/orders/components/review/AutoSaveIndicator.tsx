'use client';

import { useRouter } from 'next/navigation';
import { Check, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AutoSaveIndicatorProps {
  organizationSlug: string;
}

export function AutoSaveIndicator({ organizationSlug }: AutoSaveIndicatorProps) {
  const router = useRouter();

  const handleHome = () => {
    router.refresh(); // Force revalidation of dashboard data
    router.push(`/${organizationSlug}`);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Home button - always visible */}
      <Button variant="ghost" size="sm" onClick={handleHome} className="gap-2">
        <Home className="h-4 w-4" />
        Inicio
      </Button>

      {/* Auto-save indicator */}
      <div className="flex items-center gap-2 px-3 py-1.5">
        <div className="relative">
          <Check className="h-4 w-4 text-green-600" />
          {/* Pulse animation */}
          <span className="absolute inset-0 h-4 w-4 rounded-full bg-green-200 animate-ping opacity-20" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">Auto-guardado</span>
      </div>
    </div>
  );
}
