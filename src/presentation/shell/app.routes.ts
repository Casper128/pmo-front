import { Routes } from '@angular/router';
import { locationAdminGuard } from './guards/location-admin.guard';

export const routes: Routes = [
  {
    path: 'registros/importar',
    data: { view: 'import' },
    loadComponent: () =>
      import('@presentation/time-records/pages/multiple-import-page.component').then(
        (m) => m.MultipleImportPageComponent,
      ),
  },
  {
    path: 'registros/consolidado',
    data: { view: 'download' },
    loadComponent: () =>
      import('@presentation/time-records/pages/multiple-import-page.component').then(
        (m) => m.MultipleImportPageComponent,
      ),
  },
  {
    path: 'registros/reportes',
    data: { view: 'management' },
    loadComponent: () =>
      import('@presentation/time-records/pages/multiple-import-page.component').then(
        (m) => m.MultipleImportPageComponent,
      ),
  },
  {
    path: 'registros/estadisticas',
    loadComponent: () =>
      import('@presentation/time-records/pages/consultant-statistics-page.component').then(
        (m) => m.ConsultantStatisticsPageComponent,
      ),
  },
  {
    path: 'registros/logs',
    loadComponent: () =>
      import('@presentation/time-records/pages/send-logs-page.component').then(
        (m) => m.SendLogsPageComponent,
      ),
  },
  {
    path: 'administracion/ubicaciones',
    canActivate: [locationAdminGuard],
    loadComponent: () =>
      import('@presentation/time-records/pages/consultant-locations-page.component').then(
        (m) => m.ConsultantLocationsPageComponent,
      ),
  },
  {
    path: 'configuracion',
    loadComponent: () =>
      import('@presentation/time-records/pages/configuration-page.component').then(
        (m) => m.ConfigurationPageComponent,
      ),
  },
  // Redirige raíz a la página de importación (ajusta según tu app)
  { path: '', redirectTo: 'registros/importar', pathMatch: 'full' },
];
