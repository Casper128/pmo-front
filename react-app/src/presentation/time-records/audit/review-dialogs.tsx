import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/field';
import { Textarea } from '@/shared/ui/textarea';
import { requestTitle } from './request-view';

export type ReviewAction = 'approve' | 'reject';
export interface ReviewTarget {
  readonly request: ManagementDeleteRequest;
  readonly action: ReviewAction;
}

export interface ReviewDialogsProps {
  readonly target: ReviewTarget | null;
  readonly busy: boolean;
  readonly onApprove: (request: ManagementDeleteRequest) => Promise<unknown>;
  readonly onReject: (request: ManagementDeleteRequest, note: string) => Promise<unknown>;
  readonly onClose: () => void;
}

function RejectForm({ request, busy, onReject, onClose }: { readonly request: ManagementDeleteRequest; readonly busy: boolean; readonly onReject: ReviewDialogsProps['onReject']; readonly onClose: () => void }) {
  const [note, setNote] = useState('');
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onReject(request, note).then(onClose);
      }}
    >
      <DialogHeader>
        <DialogTitle>Rechazar solicitud</DialogTitle>
        <DialogDescription>
          El reporte {request.identifier} ({requestTitle(request)}) se conserva. El solicitante recibirá el motivo en sus notificaciones.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="reject-note">Motivo (opcional)</FieldLabel>
        <Textarea id="reject-note" rows={3} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
        <FieldDescription>Explica qué falta o por qué no procede la eliminación.</FieldDescription>
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
          Rechazar solicitud
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Confirmación de "Eliminar y aprobar" (destructiva) y formulario de rechazo con nota opcional. No se cierran mientras envían. */
export function ReviewDialogs({ target, busy, onApprove, onReject, onClose }: ReviewDialogsProps) {
  const request = target?.request;
  const close = (open: boolean) => !open && !busy && onClose();
  return (
    <>
      <AlertDialog open={target?.action === 'approve'} onOpenChange={close}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar reporte y aprobar</AlertDialogTitle>
            <AlertDialogDescription>
              {request ? `Se eliminará de forma definitiva el reporte ${request.identifier} (${requestTitle(request)}) y la solicitud quedará aprobada. Esta acción no se puede deshacer.` : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => request && void onApprove(request).then(onClose)}>
              {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              Eliminar y aprobar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={target?.action === 'reject'} onOpenChange={close}>
        <DialogContent>{request && target?.action === 'reject' ? <RejectForm key={request.id} request={request} busy={busy} onReject={onReject} onClose={onClose} /> : null}</DialogContent>
      </Dialog>
    </>
  );
}
