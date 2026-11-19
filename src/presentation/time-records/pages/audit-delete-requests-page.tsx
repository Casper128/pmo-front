import { ChevronDown, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/ui/collapsible';
import { Skeleton } from '@/shared/ui/skeleton';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { ReviewDialogs, type ReviewTarget } from '../audit/review-dialogs';
import {
  requestDate,
  requestDescription,
  requestDetailFields,
  requestHours,
  requestRequester,
  requestTitle,
} from '../audit/request-view';
import { usePendingDeleteRequests, useReviewDeleteRequest } from '../audit/use-delete-request-review';

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">
        <OverflowText>{value}</OverflowText>
      </dd>
    </div>
  );
}

function RequestCard({ request, busy, onReview }: { readonly request: ManagementDeleteRequest; readonly busy: boolean; readonly onReview: (target: ReviewTarget) => void }) {
  const details = requestDetailFields(request);
  return (
    <Card role="article" aria-label={`Solicitud de eliminación ${request.identifier}`}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="min-w-0 break-words">{requestTitle(request)}</CardTitle>
          <Badge variant="warning">
            <Clock aria-hidden="true" /> Pendiente
          </Badge>
        </div>
        <CardDescription className="break-all">{request.identifier}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Solicitante" value={requestRequester(request)} />
          <Summary label="Cliente" value={request.report.cliente || 'N/A'} />
          <Summary label="Fecha" value={requestDate(request)} />
          <Summary label="Horas" value={requestHours(request)} />
        </dl>
        <div>
          <p className="text-xs text-muted-foreground">Descripción</p>
          <p className="mt-0.5 text-sm break-words">{requestDescription(request)}</p>
        </div>
        {details.length ? (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="-ml-2.5 group/detail">
                Ver detalle del reporte
                <ChevronDown aria-hidden="true" className="transition-transform group-data-[state=open]/detail:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {details.map((field) => (
                  <Summary key={field.label} label={field.label} value={field.value} />
                ))}
              </dl>
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => onReview({ request, action: 'reject' })}>
          Rechazar
        </Button>
        <Button type="button" disabled={busy} onClick={() => onReview({ request, action: 'approve' })}>
          Eliminar y aprobar
        </Button>
      </CardFooter>
    </Card>
  );
}

/** Bandeja de auditoría (F13): solicitudes de eliminación pendientes; aprobar borra el reporte, rechazar admite una nota. */
export function AuditDeleteRequestsPage() {
  const requests = usePendingDeleteRequests();
  const review = useReviewDeleteRequest();
  const [target, setTarget] = useState<ReviewTarget | null>(null);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Solicitudes de eliminación"
        description="Revisa los reportes enviados a auditoría y ejecuta el borrado solo cuando corresponda. La solicitud no elimina el reporte: el borrado real ocurre cuando auditoría aprueba."
        aside={
          <>
            <Badge variant="secondary" className="h-8 px-3 text-sm tabular-nums" aria-live="polite">
              {requests.pending.length} {requests.pending.length === 1 ? 'pendiente' : 'pendientes'}
            </Badge>
            <Button type="button" variant="outline" disabled={requests.isFetching} onClick={() => void requests.refetch()}>
              {requests.isFetching ? <Loader2 aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
              Actualizar
            </Button>
          </>
        }
      />

      {requests.isPending ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Cargando solicitudes...">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-56" />
          ))}
        </div>
      ) : requests.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible cargar auditoría"
          description={apiErrorMessage(requests.error, 'No fue posible cargar auditoría.')}
          actionLabel="Reintentar"
          onAction={() => void requests.refetch()}
        />
      ) : !requests.pending.length ? (
        <StateMessage
          title="No hay solicitudes pendientes"
          description="Cuando un consultor pida eliminar un reporte enviado, aparecerá aquí para revisión."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {requests.pending.map((request) => (
            <RequestCard key={request.id} request={request} busy={review.pending} onReview={setTarget} />
          ))}
        </div>
      )}

      <ReviewDialogs
        target={target}
        busy={review.pending}
        onApprove={(request) => review.approve(request.id)}
        onReject={(request, note) => review.reject(request.id, note)}
        onClose={() => setTarget(null)}
      />
    </div>
  );
}
