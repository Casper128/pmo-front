import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
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
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Input } from '@/shared/ui/input';
import { useContainer } from '@presentation/providers/container-context';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import type { ReportRow } from './report-list';
import { useReportMutations } from './use-report-mutations';

function DeleteForm({ row, today, onClose }: { readonly row: ReportRow; readonly today: string; readonly onClose: () => void }) {
  const { parameters } = useContainer();
  const { user } = useAuth();
  const { remove, technicalRemove, requestRemoval } = useReportMutations();
  const [technicalKey, setTechnicalKey] = useState('');
  const direct = row.view.dayKey === today;
  const requesterEmail = user?.email || '';
  const canTechnical = parameters.canUseTechnicalDelete(requesterEmail);
  const useTechnical = canTechnical && !!technicalKey.trim();
  const pending = remove.isPending || technicalRemove.isPending || requestRemoval.isPending;

  const submit = async () => {
    const identifier = row.view.id;
    try {
      if (useTechnical) {
        await technicalRemove.mutateAsync({ identifier, technicalKey: technicalKey.trim(), requesterEmail });
        toast.success('Reporte eliminado correctamente');
      } else if (direct) {
        await remove.mutateAsync(identifier);
        toast.success('Reporte eliminado correctamente');
      } else {
        const { duplicated } = await requestRemoval.mutateAsync(row.report);
        if (duplicated) toast.info('Ya existe una solicitud pendiente para este reporte.');
        else toast.success('Solicitud de eliminación enviada a auditoría');
      }
      onClose();
    } catch (error) {
      toast.error(
        apiErrorMessage(error, direct || useTechnical ? 'No se pudo eliminar el reporte. Intenta nuevamente.' : 'No se pudo enviar la solicitud a auditoría. Intenta nuevamente.'),
      );
    }
  };

  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{direct ? 'Eliminar reporte' : 'Solicitar eliminación a auditoría'}</AlertDialogTitle>
        <AlertDialogDescription>
          {direct
            ? `Se eliminará ahora el reporte ${row.view.id} (${row.managementName}). Esta acción no se puede deshacer.`
            : `El reporte ${row.view.id} no es de hoy: auditoría debe aprobar la eliminación. Seguirá visible hasta que la apruebe.`}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {canTechnical ? (
        <Field>
          <FieldLabel htmlFor="delete-technical-key">Clave técnica (opcional)</FieldLabel>
          <Input
            id="delete-technical-key"
            type="password"
            autoComplete="off"
            value={technicalKey}
            onChange={(event) => setTechnicalKey(event.target.value)}
          />
          <FieldDescription>Con la clave se elimina de inmediato, sin solicitud.</FieldDescription>
        </Field>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
        <Button type="button" variant={direct || useTechnical ? 'destructive' : 'default'} disabled={pending} onClick={() => void submit()}>
          {pending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          {direct || useTechnical ? 'Eliminar reporte' : 'Enviar solicitud'}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}

export interface DeleteReportDialogProps {
  readonly row: ReportRow | null;
  /** Hoy en Colombia: solo los reportes de hoy se borran directo; el resto va a auditoría. */
  readonly today: string;
  readonly onClose: () => void;
}

/** Confirma eliminar el reporte (hoy) o solicitar su eliminación a auditoría (otros días). */
export function DeleteReportDialog({ row, today, onClose }: DeleteReportDialogProps) {
  return (
    <AlertDialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      {row ? <DeleteForm key={row.view.id} row={row} today={today} onClose={onClose} /> : null}
    </AlertDialog>
  );
}
