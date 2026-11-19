import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router';
import { Skeleton } from '@/shared/ui/skeleton';
import { useContainer } from '@presentation/providers/container-context';
import { errorMessage } from '@presentation/shared/error-message';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { DraftsProvider } from '@presentation/time-records/drafts/drafts-provider';
import { AppLayout } from './app-layout';
import { LoginPage, type LoginValues } from './login-page';
import { SESSION_REFRESH_INTERVAL_MS } from './session-config';

function SessionRestoring() {
  return (
    <main className="grid min-h-svh place-items-center px-4" aria-busy="true">
      <div className="flex w-full max-w-xs flex-col items-center gap-3">
        <Skeleton className="size-9 rounded-md" />
        <Skeleton className="h-4 w-40" />
        <p className="text-sm font-medium text-muted-foreground">Validando sesion...</p>
      </div>
    </main>
  );
}

/**
 * Raíz del shell (equivale al login integrado de `AppComponent`; no hay ruta `/login`): restaura la sesión
 * al cargar, muestra el login si no hay sesión y el layout con `<Outlet>` si la hay. Renueva la sesión
 * cada 4 min y cierra sesión si la renovación devuelve sesión expirada.
 */
export function AuthGate() {
  const { login: loginUseCase, parameters } = useContainer();
  const { auth, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  // StrictMode ejecuta los efectos dos veces en desarrollo: la restauración se lanza una sola vez.
  const restoreStarted = useRef(false);
  const loginInFlight = useRef(false);

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    auth
      .restoreSession()
      .then(
        (user) => {
          // `load()` marca `loading` de forma síncrona: los guards esperan en lugar de expulsar.
          if (user) void parameters.load();
        },
        () => auth.clearTokens(),
      )
      .finally(() => setRestoring(false));
  }, [auth, parameters]);

  const sessionActive = isLoggedIn && !restoring && !loggingIn;

  useEffect(() => {
    if (!sessionActive) return;
    const id = window.setInterval(() => {
      auth.refreshSession().catch((error: unknown) => {
        if (auth.isSessionExpiredError(error)) auth.clearTokens();
      });
    }, SESSION_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [auth, sessionActive]);

  // Al cerrar sesión no deben quedar datos del usuario anterior en caché.
  useEffect(() => {
    if (!isLoggedIn) queryClient.clear();
  }, [isLoggedIn, queryClient]);

  const login = useCallback(
    async ({ email, password }: LoginValues) => {
      if (loginInFlight.current) return;
      loginInFlight.current = true;
      setLoginError('');
      setLoggingIn(true);
      try {
        await loginUseCase.execute(email.trim(), password);
        void parameters.load();
      } catch (error) {
        setLoginError(errorMessage(error) || 'No se pudo iniciar sesión');
      } finally {
        loginInFlight.current = false;
        setLoggingIn(false);
      }
    },
    [loginUseCase, parameters],
  );

  if (restoring) return <SessionRestoring />;
  if (!isLoggedIn || loggingIn) {
    return <LoginPage submitting={loggingIn} error={loginError} onSubmit={(values) => void login(values)} />;
  }
  return (
    // Los borradores viven en el shell (por encima de las rutas): sobreviven a la navegación.
    <DraftsProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </DraftsProvider>
  );
}
