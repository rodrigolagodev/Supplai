import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';

interface ReviewDialogsProps {
  showCancelConfirm: boolean;
  setShowCancelConfirm: (show: boolean) => void;
  isCancelling: boolean;
  onCancelOrder: () => void;
}

export function ReviewDialogs({
  showCancelConfirm,
  setShowCancelConfirm,
  isCancelling,
  onCancelOrder,
}: ReviewDialogsProps) {
  return (
    <ResponsiveDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>¿Eliminar pedido permanentemente?</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Esta acción es irreversible. El pedido y todos sus datos serán eliminados de forma
            permanente.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => setShowCancelConfirm(false)}>
            Volver
          </Button>
          <Button variant="destructive" onClick={onCancelOrder} disabled={isCancelling}>
            {isCancelling ? 'Eliminando...' : 'Sí, eliminar pedido'}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
