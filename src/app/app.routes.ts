import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'registros/importar',
    loadComponent: () =>
      import('./features/time-records/presentation/pages/multiple-import-page.component').then(
        m => m.MultipleImportPageComponent
      ),
  },
  {
    path: 'registros/estadisticas',
    loadComponent: () =>
      import('./features/time-records/presentation/pages/consultant-statistics-page.component').then(
        m => m.ConsultantStatisticsPageComponent
      ),
  },
  // Redirige raíz a la página de importación (ajusta según tu app)
  { path: '', redirectTo: 'registros/importar', pathMatch: 'full' },
];
