import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { useContainer } from '@presentation/providers/container-context';
import { canReviewDeleteRequests } from './permissions';

export interface Permissions {
  /** Administra la configuración global (`AppParametersFacade.canManage`). */
  readonly canManage: boolean;
  /** Revisa solicitudes de eliminación (auditoría). */
  readonly canReview: boolean;
  /** Los parámetros (y por tanto `canManage`) se están cargando. */
  readonly loading: boolean;
}

export function usePermissions(): Permissions {
  const { auth } = useContainer();
  const canManage = useAppParameters((parameters) => parameters.canManage());
  const canReview = useAppParameters((parameters) => canReviewDeleteRequests(auth.user(), parameters));
  const loading = useAppParameters((parameters) => parameters.loading());
  return {
    canManage,
    canReview,
    loading,
  };
}
