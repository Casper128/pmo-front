import { Loader2 } from 'lucide-react';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { Button } from '@/shared/ui/button';

export interface TemplateDeleteDialogProps {
  /** Plantilla a eliminar; `null` mantiene el diálogo cerrado. */
  readonly template: ManagementAdvancedTemplate | null;
  readonly deleting: boolean;
  readonly onConfirm: (template: ManagementAdvancedTemplate) => void;
  readonly onClose: () => void;
}

/** Confirmación destructiva de eliminar una plantilla; no se cierra mientras elimina. */
export function TemplateDeleteDialog({ template, deleting, onConfirm, onClose }: TemplateDeleteDialogProps) {
  return (
    <AlertDialog open={!!template} onOpenChange={(open) => !open && !deleting && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
          <AlertDialogDescription>
            {template
              ? `La plantilla de ${template.gestionName} (ID ${template.gestionId}, cliente ${template.client || 'sin cliente asociado'}) dejará de usarse para completar campos avanzados. Al registrar o editar de nuevo esa gestión podrás crear una nueva, con el cliente solo como dato informativo y de filtro.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={deleting} onClick={() => template && onConfirm(template)}>
            {deleting ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Eliminar plantilla
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
