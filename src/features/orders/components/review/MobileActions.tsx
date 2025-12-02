import { TapButton } from '@/components/ui/motion-button';
import { CheckCircle2 } from 'lucide-react';

interface MobileActionsProps {
  isFinalizing: boolean;
  isCancelling: boolean;
  unclassifiedItemsCount: number;
  onSave: () => void;
  onFinalize: () => void;
}

export function MobileActions({
  isFinalizing,
  isCancelling,
  unclassifiedItemsCount,
  onSave: _onSave,
  onFinalize,
}: MobileActionsProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t flex gap-3 md:hidden z-40 safe-area-bottom">
      <TapButton
        onClick={onFinalize}
        disabled={isFinalizing || isCancelling || unclassifiedItemsCount > 0}
        className="flex-1"
      >
        {isFinalizing ? 'Enviando...' : 'Confirmar Pedido'}
        <CheckCircle2 className="ml-2 h-4 w-4" />
      </TapButton>
    </div>
  );
}
