import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { useContainer } from '@presentation/providers/container-context';
import { queryKeys } from '@presentation/shared/query-keys';

/**
 * Solicitud que importa por reporte: la pendiente o, si no hay, la rechazada más reciente (una aprobada ya
 * eliminó el reporte y una cancelada no cuenta).
 */
export function relevantRequests(requests: readonly ManagementDeleteRequest[]): Map<string, ManagementDeleteRequest> {
  const byIdentifier = new Map<string, ManagementDeleteRequest>();
  const rank = (request: ManagementDeleteRequest) => (request.status === 'pending' ? 2 : request.status === 'rejected' ? 1 : 0);
  for (const request of requests) {
    if (!rank(request)) continue;
    const current = byIdentifier.get(request.identifier);
    if (!current || rank(request) > rank(current) || (rank(request) === rank(current) && request.requestedAt > current.requestedAt)) {
      byIdentifier.set(request.identifier, request);
    }
  }
  return byIdentifier;
}

/** Solicitudes de eliminación del usuario por identificador de reporte. Si la consulta falla, el mapa queda vacío (sin badges). */
export function useMyDeleteRequests() {
  const { deleteRequests } = useContainer();
  const query = useQuery({ queryKey: queryKeys.deleteRequests.mine, queryFn: () => deleteRequests.listMine() });
  const byIdentifier = useMemo(() => relevantRequests(query.data ?? []), [query.data]);
  return { byIdentifier, isError: query.isError, refetch: query.refetch };
}
