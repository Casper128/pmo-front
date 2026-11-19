import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useContainer } from '@presentation/providers/container-context';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { queryKeys } from '@presentation/shared/query-keys';

export const NOTIFICATIONS_POLL_MS = 60_000;

/**
 * Notificaciones sin leer del usuario con sesión: consulta cada minuto (no en segundo plano) y al volver el foco.
 * Cuando llegan nuevas tras la primera carga avisa con un toast e invalida las solicitudes de eliminación (propias y
 * de auditoría) para que se actualicen sin esperar su propio ciclo. Debe montarse una sola vez (la campana del header).
 */
export function useNotifications() {
  const { notifications: gateway } = useContainer();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.notifications.unread,
    queryFn: () => gateway.listUnread(),
    enabled: isLoggedIn,
    refetchInterval: NOTIFICATIONS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  // Ids ya vistos; `null` hasta la primera carga, que no avisa (son las pendientes de antes de abrir la app).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    const list = query.data?.notifications;
    if (!list) return;
    if (!seen.current) {
      seen.current = new Set(list.map((item) => item.id));
      return;
    }
    const fresh = list.filter((item) => !seen.current?.has(item.id));
    fresh.forEach((item) => seen.current?.add(item.id));
    if (!fresh.length) return;
    if (fresh.length === 1) toast.info(fresh[0].title, { description: fresh[0].body });
    else toast.info(`Tienes ${fresh.length} notificaciones nuevas`);
    void queryClient.invalidateQueries({ queryKey: queryKeys.deleteRequests.all });
  }, [query.data, queryClient]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
  const markRead = useMutation({ mutationFn: (ids: readonly string[]) => gateway.markRead(ids), onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: () => gateway.markAllRead(), onSuccess: refresh });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    markRead,
    markAllRead,
  };
}
