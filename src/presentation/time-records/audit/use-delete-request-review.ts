import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useContainer } from '@presentation/providers/container-context';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { queryKeys } from '@presentation/shared/query-keys';
import { NOTIFICATIONS_POLL_MS } from '@presentation/notifications/use-notifications';
import { isAlreadyResolved } from './request-view';

/** Solicitudes pendientes, de la más reciente a la más antigua. Se refrescan cada minuto, al volver el foco y al llegar una notificación. */
export function usePendingDeleteRequests() {
  const { deleteRequests } = useContainer();
  const query = useQuery({
    queryKey: queryKeys.deleteRequests.pending,
    queryFn: () => deleteRequests.list(),
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
  const pending = useMemo(
    () => (query.data ?? []).filter((request) => request.status === 'pending').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [query.data],
  );
  return { pending, isPending: query.isPending, isError: query.isError, error: query.error, isFetching: query.isFetching, refetch: query.refetch };
}

/**
 * Aprobar (borra el reporte y aprueba en un solo paso del servidor) o rechazar con nota opcional. Resuelve con
 * `true` si se aplicó; si falla avisa con un toast (409 = ya resuelta por otro auditor) y refresca la lista.
 */
export function useReviewDeleteRequest() {
  const { deleteRequests } = useContainer();
  const queryClient = useQueryClient();
  const settled = () => queryClient.invalidateQueries({ queryKey: queryKeys.deleteRequests.all });

  const approve = useMutation({
    mutationFn: (id: string) => deleteRequests.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }),
    onSettled: settled,
  });
  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => deleteRequests.reject(id, note),
    onSettled: settled,
  });

  const run = async (action: () => Promise<unknown>, success: string, failure: string): Promise<boolean> => {
    try {
      await action();
      toast.success(success);
      return true;
    } catch (error) {
      toast.error(isAlreadyResolved(error) ? 'Ya fue resuelta por otro auditor' : apiErrorMessage(error, failure));
      return false;
    }
  };

  return {
    pending: approve.isPending || reject.isPending,
    approve: (id: string) => run(() => approve.mutateAsync(id), 'Reporte eliminado y solicitud aprobada.', 'No fue posible eliminar el reporte desde auditoría.'),
    reject: (id: string, note: string) => run(() => reject.mutateAsync({ id, note }), 'Solicitud rechazada.', 'No fue posible rechazar la solicitud.'),
  };
}
