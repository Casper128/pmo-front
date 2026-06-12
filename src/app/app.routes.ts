import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'registros/importar',
    loadComponent: () =>
      import('./features/time-records/presentation/pages/multiple-import-page.component').then(
        m => m.MultipleImportPageComponent
      ),
  },
  // Redirige raíz a la página de importación (ajusta según tu app)
  { path: '', redirectTo: 'registros/importar', pathMatch: 'full' },
];
