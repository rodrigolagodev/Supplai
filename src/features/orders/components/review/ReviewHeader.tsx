import { TapButton } from '@/components/ui/motion-button';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { AutoSaveIndicator } from './AutoSaveIndicator';

interface ReviewHeaderProps {
  isFinalizing: boolean;
  isCancelling: boolean;
  unclassifiedItemsCount: number;
  organizationSlug: string;
  onCancel: () => void;
  onFinalize: () => void;
}

export function ReviewHeader({
  isFinalizing,
  isCancelling,
  unclassifiedItemsCount,
  organizationSlug,
  onCancel,
  onFinalize,
}: ReviewHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <AutoSaveIndicator organizationSlug={organizationSlug} />

      <div className="hidden md:flex items-center gap-2">
        <TapButton
          variant="outline"
          className="text-destructive hover:bg-destructive/10 border-destructive/50"
          onClick={onCancel}
          disabled={isFinalizing || isCancelling}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Eliminar Pedido
        </TapButton>
        <TapButton
          onClick={onFinalize}
          disabled={isFinalizing || isCancelling || unclassifiedItemsCount > 0}
        >
          {isFinalizing ? 'Enviando...' : 'Confirmar Pedido'}
          <CheckCircle2 className="ml-2 h-4 w-4" />
        </TapButton>
      </div>
    </div>
  );
}
