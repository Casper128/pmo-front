import { QueryCache, QueryClient } from '@tanstack/react-query';
import type { AuthGateway } from '@application/auth/auth.gateway';

declare module '@tanstack/react-query' {
  interface Register {
    /**
     * Los adaptadores lanzan `HttpError` (misma forma que `HttpErrorResponse`, no extiende `Error`) o
     * `Error`; por eso el error por defecto es `unknown` y se inspecciona con guardas.
     */
    defaultError: unknown;
  }
}

/** Reintentos de consultas: uno, nunca ante sesión expirada (401/403). */
export const MAX_QUERY_RETRIES = 1;

/**
 * Cliente de TanStack Query (plan §1.5): sin refetch al enfocar (Angular no lo hacía), `staleTime` 30 s,
 * un reintento salvo sesión expirada y cierre de sesión global si una consulta devuelve 401/403.
 * Se crea una vez en `main.tsx`.
 */
export function createQueryClient(auth: AuthGateway): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (auth.isSessionExpiredError(error)) auth.clearTokens();
      },
    }),
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < MAX_QUERY_RETRIES && !auth.isSessionExpiredError(error),
      },
      mutations: { retry: false },
    },
  });
}
