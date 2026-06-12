# PMO – Importación Múltiple de Registros
## Arquitectura DDD para Angular + Tailwind

```
src/app/
├── core/
│   └── auth/
│       └── auth.service.ts              ← token JWT centralizado
│
└── features/
    └── time-records/
        ├── domain/                      ← CAPA DE DOMINIO (sin dependencias externas)
        │   ├── models/
        │   │   └── time-record.model.ts ← Entidad, defaults, tipos de alertas
        │   ├── repositories/
        │   │   └── time-record.repository.ts  ← Puerto (interfaz)
        │   └── services/
        │       └── time-record-domain.service.ts ← Parse, validación, cálculo de horas
        │
        ├── application/                 ← CAPA DE APLICACIÓN (casos de uso)
        │   └── use-cases/
        │       ├── send-all-records.use-case.ts
        │       └── load-select-options.use-case.ts
        │
        ├── infrastructure/              ← CAPA DE INFRAESTRUCTURA (HTTP, adapters)
        │   └── adapters/
        │       └── time-record-http.adapter.ts ← Implementa el puerto HTTP
        │
        ├── presentation/                ← CAPA DE PRESENTACIÓN (Angular + Tailwind)
        │   ├── components/
        │   │   ├── import-text-input/   ← Textarea + botón procesar
        │   │   ├── records-preview/     ← Tabla agrupada por fecha con alertas
        │   │   └── edit-record-modal/   ← Modal completo de edición por registro
        │   ├── pages/
        │   │   └── multiple-import-page.component.ts  ← Orquestador
        │   └── pipes/
        │       └── fecha-esp.pipe.ts
        │
        └── time-records.providers.ts   ← Wiring DDD (token → adapter)
```

---

## Integración en tu app existente

### 1. Agrega los providers al `app.config.ts`

```ts
import { TIME_RECORDS_PROVIDERS } from './features/time-records/time-records.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    ...TIME_RECORDS_PROVIDERS,
    // tus providers existentes...
  ],
};
```

### 2. Agrega la ruta

```ts
// app.routes.ts
{
  path: 'registros/importar',
  loadComponent: () =>
    import('./features/time-records/presentation/pages/multiple-import-page.component')
      .then(m => m.MultipleImportPageComponent),
},
```

### 3. Alimenta el `AuthService` con el token de tu login

```ts
// Donde manejes el login:
authService.setTokens(token, refreshToken);
```

### 4. Agrega las clases CSS base a `styles.css`

```css
/* Copia el contenido de styles-components.css en tu styles.css global */
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

@layer components {
  .field-wrap { @apply flex flex-col gap-1; }
  .field-label { @apply text-xs font-bold text-slate-600; }
  .field-input {
    @apply px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800
           bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all;
  }
}
```

---

## Formato de texto aceptado

```
26/05/2026
7:30AM-9:00AM Descripción de la actividad
9:30AM-11:00AM Otra actividad | Cliente | RICEF | Proyecto | Solicitud

27/05/2026
8:00AM-12:00PM Actividad del nuevo día
```

Los campos separados por `|` después de la descripción son opcionales:
`descripción | cliente | ricef | proyecto | solicitud`

---

## Flujo del usuario

1. **Pega texto** con el formato → clic **Procesar Registros**
2. Ve la **tabla agrupada por fecha** con alertas de horas (🟡 faltan / ✓ exacto / ⚠️ excede)
3. Clic **Editar** en cualquier fila → modal completo con todos los campos
4. Clic **Enviar Todos los Registros** → envía en paralelo (concurrencia 3) a la misma API del HTML original
