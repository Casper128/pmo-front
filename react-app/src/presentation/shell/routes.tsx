import { Navigate, type RouteObject } from 'react-router';
import { AuthGate } from './auth-gate';
import { RequireAdmin, RequireAudit } from './guards/route-guards';
import { DASHBOARD_PATH } from './nav-items';
import { NotFoundPage } from './not-found-page';

/**
 * Rutas del plan §3.2. Cada página se carga con `lazy` (code splitting por ruta). `AuthGate` es el layout raíz: login, restauración de sesión y shell.
 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AuthGate />,
    children: [
      { index: true, element: <Navigate to={DASHBOARD_PATH} replace /> },
      {
        path: 'registros/dashboard',
        lazy: async () => ({
          Component: (await import('@presentation/time-records/pages/time-dashboard-page')).TimeDashboardPage,
        }),
      },
      {
        path: 'registros/importar',
        lazy: async () => ({ Component: (await import('@presentation/time-records/pages/import-page')).ImportPage }),
      },
      {
        path: 'registros/reportes',
        lazy: async () => ({
          Component: (await import('@presentation/time-records/pages/reports-page')).ReportsPage,
        }),
      },
      {
        path: 'registros/consolidado',
        lazy: async () => ({
          Component: (await import('@presentation/time-records/pages/consolidated-page')).ConsolidatedPage,
        }),
      },
      {
        path: 'registros/estadisticas',
        lazy: async () => ({
          Component: (await import('@presentation/time-records/pages/statistics-page')).StatisticsPage,
        }),
      },
      {
        path: 'registros/plantillas',
        lazy: async () => ({
          Component: (await import('@presentation/time-records/pages/templates-page')).TemplatesPage,
        }),
      },
      {
        element: <RequireAudit />,
        children: [
          {
            path: 'auditoria/eliminaciones',
            lazy: async () => ({
              Component: (await import('@presentation/time-records/pages/audit-delete-requests-page')).AuditDeleteRequestsPage,
            }),
          },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: 'configuracion',
            lazy: async () => ({
              Component: (await import('@presentation/time-records/pages/configuration-page')).ConfigurationPage,
            }),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
