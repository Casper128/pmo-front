import { useCallback, useSyncExternalStore } from 'react';
import type { AuthGateway } from '@application/auth/auth.gateway';
import type { AuthUser } from '@domain/auth/auth-user.model';
import { useContainer } from '@presentation/providers/container-context';

export interface AuthState {
  /** Puerto de autenticación para las acciones (`login`, `clearTokens`, …). */
  readonly auth: AuthGateway;
  readonly user: AuthUser | null;
  readonly isLoggedIn: boolean;
}

/** Usuario y estado de sesión reactivos (`useSyncExternalStore` sobre `AuthGateway.subscribe`). */
export function useAuth(): AuthState {
  const { auth } = useContainer();
  const subscribe = useCallback((listener: () => void) => auth.subscribe(listener), [auth]);
  const user = useSyncExternalStore(subscribe, auth.user);
  const isLoggedIn = useSyncExternalStore(subscribe, auth.isLoggedIn);
  return { auth, user, isLoggedIn };
}
