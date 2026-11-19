import { TriangleAlert } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import type { ValidationAlert } from './validation-alert-dialog';

export interface SendConfirmDialogProps {
  readonly confirm: ValidationAlert | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** Aviso que no bloquea: el envío continúa solo si el usuario lo confirma (exceso de jornada con lo ya enviado). */
export function SendConfirmDialog({ confirm, onConfirm, onCancel }: SendConfirmDialogProps) {
  return (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-warning/15 text-warning">
            <TriangleAlert aria-hidden="true" />
          </AlertDialogMedia>
          <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
          <AlertDialogDescription className="break-words">{confirm?.text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Revisar registros</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Enviar de todos modos</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
