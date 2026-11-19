import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { AppProviders } from '@presentation/providers/app-providers';
import type { Container } from '@presentation/providers/container-context';
import { createQueryClient } from '@presentation/providers/query-client';
import { appRoutes } from '@presentation/shell/routes';

/**
 * Monta la app completa (providers + rutas reales) en memoria, en la ruta indicada y con StrictMode como
 * `main.tsx`, para que los tests detecten efectos duplicados.
 */
export function renderApp(container: Container, initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] });
  const queryClient = createQueryClient(container.auth);
  const view = render(
    <StrictMode>
      <AppProviders container={container} queryClient={queryClient}>
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
  return { ...view, router, queryClient };
}
