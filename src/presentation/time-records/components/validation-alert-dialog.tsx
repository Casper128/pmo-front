import { TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';

/** Mensaje de validación que detiene una operación (`alertDialog` de Angular, contexto `validation`). */
export interface ValidationAlert {
  readonly title: string;
  readonly text: string;
}

export const DEFAULT_ALERT_TITLE = 'No se puede continuar';

export interface ValidationAlertDialogProps {
  readonly alert: ValidationAlert | null;
  readonly onClose: () => void;
}

/** `AlertDialog` de validación; el usuario debe cerrarlo con "Entendido, revisar registros". */
export function ValidationAlertDialog({ alert, onClose }: ValidationAlertDialogProps) {
  return (
    <AlertDialog open={!!alert} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{alert?.title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{alert?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium text-foreground">
          La operación fue detenida para proteger la información. Corrige los datos indicados y vuelve a
          intentarlo.
        </p>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Entendido, revisar registros</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
