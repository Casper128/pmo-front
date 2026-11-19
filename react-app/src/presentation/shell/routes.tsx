import { Navigate, type RouteObject } from 'react-router';
import { AuthGate } from './auth-gate';
import { RequireAdmin, RequireAudit, RequireLocationAdmin } from './guards/route-guards';
import { DASHBOARD_PATH } from './nav-items';
import { NotFoundPage, PlaceholderPage } from './placeholder-page';

/**
 * Rutas del plan §3.2. Las páginas aún no migradas usan `PlaceholderPage`; al migrarlas se cambian por
 * `lazy: () => import(...)`. `AuthGate` es el layout raíz: login, restauración de sesión y shell.
 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <AuthGate />,
    children: [
      { index: true, element: <Navigate to={DASHBOARD_PATH} replace /> },
      {
        path: 'registros/dashboard',
        element: (
          <PlaceholderPage
            title="Dashboard de tiempos"
            description="Resumen de tus horas reportadas: carga diaria, clientes, facturación y solicitudes recientes."
          />
        ),
      },
      {
        path: 'registros/importar',
        element: (
          <PlaceholderPage
            title="Reportar y revisar tiempos"
            description="Pega tus actividades, completa lo pendiente y registra con confianza."
          />
        ),
      },
      {
        path: 'registros/reportes',
        element: <PlaceholderPage title="Reportes" description="Consulta, edita y gestiona tus reportes enviados." />,
      },
      {
        path: 'registros/consolidado',
        element: <PlaceholderPage title="Consolidado" description="Descarga y revisa el consolidado de tus tiempos." />,
      },
      {
        path: 'registros/estadisticas',
        element: (
          <PlaceholderPage
            title="Estadísticas del consultor"
            description="Revisa tus horas, concentración de trabajo y registros del periodo."
          />
        ),
      },
      {
        path: 'registros/logs',
        element: (
          <PlaceholderPage
            title="Historial de envíos"
            description="Consulta envíos correctos y fallidos sin almacenar respuestas completas, contraseñas ni tokens."
          />
        ),
      },
      {
        path: 'registros/plantillas',
        element: (
          <PlaceholderPage
            title="Mis plantillas por gestión"
            description="Configura los campos avanzados que se aplican automáticamente al registrar o editar tiempos."
          />
        ),
      },
      {
        element: <RequireAudit />,
        children: [
          {
            path: 'auditoria/eliminaciones',
            element: (
              <PlaceholderPage
                title="Solicitudes de eliminación"
                description="Revisa los reportes enviados a auditoría y ejecuta el borrado solo cuando corresponda."
              />
            ),
          },
        ],
      },
      {
        element: <RequireAdmin />,
        children: [
          {
            path: 'configuracion',
            element: (
              <PlaceholderPage
                title="Configuración global de tiempos"
                description="Administra listas, valores predeterminados y reglas operativas usadas por todos los consultores."
              />
            ),
          },
        ],
      },
      {
        element: <RequireLocationAdmin />,
        children: [
          {
            path: 'administracion/ubicaciones',
            element: (
              <PlaceholderPage
                title="Ubicación de consultores"
                description="Muestra la última ubicación conocida. Se actualiza al iniciar sesión y al completar un envío, sin guardar una ubicación por cada registro."
              />
            ),
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
