import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { useContainer } from '@presentation/providers/container-context';
import { canReviewDeleteRequests, isLocationAdmin } from './permissions';

export interface Permissions {
  /** Administra la configuración global (`AppParametersFacade.canManage`). */
  readonly canManage: boolean;
  /** Revisa solicitudes de eliminación (auditoría). */
  readonly canReview: boolean;
  /** Ve las ubicaciones de consultores (`environment.locationAdminEmails`). */
  readonly locationAdmin: boolean;
  /** Los parámetros (y por tanto `canManage`) se están cargando. */
  readonly loading: boolean;
}

export function usePermissions(): Permissions {
  const { auth, environment } = useContainer();
  const { user } = useAuth();
  const canManage = useAppParameters((parameters) => parameters.canManage());
  const canReview = useAppParameters((parameters) => canReviewDeleteRequests(auth.user(), parameters));
  const loading = useAppParameters((parameters) => parameters.loading());
  return {
    canManage,
    canReview,
    locationAdmin: isLocationAdmin(user, environment.locationAdminEmails),
    loading,
  };
}
