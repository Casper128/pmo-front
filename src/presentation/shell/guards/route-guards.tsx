import { Navigate, Outlet } from 'react-router';
import { Skeleton } from '@/shared/ui/skeleton';
import { DASHBOARD_PATH } from '../nav-items';
import { usePermissions } from '../use-permissions';

function PermissionsPending() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8" aria-busy="true">
      <span className="sr-only">Verificando permisos…</span>
      <Skeleton className="h-8 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

/**
 * Deja pasar si `allowed`; mientras `pending` (parámetros cargando) muestra un skeleton en lugar de
 * expulsar; si no, redirige al dashboard sin dejar la ruta en el historial.
 */
function Guard({ allowed, pending }: { allowed: boolean; pending: boolean }) {
  if (allowed) return <Outlet />;
  if (pending) return <PermissionsPending />;
  return <Navigate to={DASHBOARD_PATH} replace />;
}

/** Auditoría de eliminaciones (decisión P2). */
export function RequireAudit() {
  const { canReview, loading } = usePermissions();
  return <Guard allowed={canReview} pending={loading} />;
}

/** Configuración global (decisión P2): `canManage`. */
export function RequireAdmin() {
  const { canManage, loading } = usePermissions();
  return <Guard allowed={canManage} pending={loading} />;
}
