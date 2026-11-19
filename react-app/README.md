# pmo-front — react-app

Versión React + TypeScript de pmo-front, en migración desde la app Angular de `../src/`.
Plan y fases: `../docs/migration-plan.md`. Reglas de stack: `../.claude/skills/react-dashboard-architect/SKILL.md`.

Stack: Vite, React 19, TypeScript (strict), Tailwind 4, Shadcn UI (`@/shared/ui`), Vitest + React Testing Library.

## Requisitos

- Node 24 (`export PATH=$HOME/.nvm/versions/node/v24.16.0/bin:$PATH`).
- `npm install` dentro de `react-app/` (proyecto npm independiente del Angular).
- El build necesita las devDependencies (Vite, Tailwind, TypeScript y `shadcn`, que aporta
  `@import "shadcn/tailwind.css"`). Netlify las instala por defecto; no defina `NODE_ENV=production`
  ni `NPM_FLAGS=--production` en el sitio.

## Variables de entorno

En Netlify se configuran en las variables del sitio. En el repositorio solo se versiona `.env.example`;
los archivos `.env*.local` están ignorados por git.

Para desarrollo local:

1. `cp .env.example .env.local`
2. Complete cada variable con el valor equivalente de `../src/environments/environment.ts`:

   | Variable | Campo en `environment.ts` |
   |---|---|
   | `VITE_API_BASE_URL` | `apiBaseUrl` |
   | `VITE_SUPABASE_URL` | `supabaseUrl` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `supabasePublishableKey` |
   | `VITE_CONFIGURATION_ADMIN_EMAILS` | `configurationAdminEmails` (separados por comas) |
   | `VITE_LOCATION_ADMIN_EMAILS` | `locationAdminEmails` (separados por comas, copiar tal cual) |
   | `VITE_DEFAULT_AUDITOR_EMAIL` | Opcional. Auditor de eliminaciones por defecto: el correo que hoy usa `DEFAULT_DELETION_SETTINGS.auditorEmail` en `../src/` (Angular). Un correo o vacío; si falta, queda vacío |

   En Netlify y en `.env.local` configure `VITE_DEFAULT_AUDITOR_EMAIL` con el valor que tiene hoy la app Angular en
   `src/`; el correo no se escribe en ningún archivo de `react-app/`.

`src/config/environment.ts` valida estas variables con zod y lanza un error claro si falta alguna obligatoria.

## Despliegue en Netlify

`netlify.toml` (esta carpeta) define build `npm run build`, publish `dist` y el redirect SPA `/* → /index.html` (200).
Crea un sitio aparte con "Base directory" = `react-app` y las variables `VITE_*`; el `netlify.toml` de la raíz sigue
sirviendo Angular. Sin desplegar hasta que se autorice.

## Bundle

Cada página se carga con `lazy` por ruta y `vite.config.ts` separa los vendors (react, router, UI, datos) en chunks
propios; recharts solo se descarga con las gráficas (Dashboard y Datos). El build no debe mostrar el aviso de chunks > 500 kB.

## Scripts

| Script | Uso |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `tsc -b` + build de producción en `dist/` |
| `npm run preview` | Sirve el build |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |
| `npm run test` | Vitest (una ejecución); `npm run test:watch` en modo observación |
| `npm run test:tz` | Tests con `TZ=UTC`, `TZ=America/Bogota` y `TZ=Asia/Tokyo` |
| `npm run check:architecture` | Ubicación de archivos, reglas de capas, imports (alias, relativos y `require`), paquetes declarados y primitivos UI prohibidos |
| `npm run check:domain-sync` | Compara `src/domain` con `../src/domain`; solo admite las excepciones declaradas en el script |
| `npm run verify` | typecheck, lint, test, check:architecture, check:domain-sync y build |

## Capas

`src/domain` → `src/application` → `src/infrastructure` / `src/presentation`; componentes Shadcn generados en
`src/shared/ui` y `src/shared/hooks` (`npx shadcn@latest add <componente>`, no se editan salvo theming y las
excepciones de "Ediciones de código generado").

Solo se admite código en `src/{domain,application,infrastructure,presentation,shared/ui,shared/hooks,shared/lib,config,test}`
y en `src/main.tsx`; `check:architecture` falla ante cualquier otra carpeta o archivo suelto en `src/`. `main.tsx` se
analiza como presentation y, como `presentation/providers/container.ts`, puede importar infrastructure.

`src/domain` es copia de `../src/domain` (Angular). Cualquier cambio de reglas de negocio se aplica en ambos
lados; `check:domain-sync` falla si divergen. La única excepción es `time-record.repository.ts` (Observable → Promise).

`cn()`: shadcn 4.23 genera `import { cn } from "cn"` (paquete oficial de shadcn-ui) aunque `components.json`
declare `aliases.utils`; no hay opción para redirigirlo. `src/shared/lib/utils.ts` se conserva solo porque
`aliases.utils` de `components.json` apunta a él; el código propio importa `cn` desde `"cn"`. Alias: `@/*`, `@domain/*`, `@application/*`,
`@infrastructure/*`, `@presentation/*`, `@env/*` (→ `src/config/*`).

### Límites conocidos de `check:architecture`

El script recorre el AST de cada archivo con la API del compilador de TypeScript (`ts.createSourceFile`,
`ScriptKind.TSX` en `.tsx`), así que comentarios, strings, texto JSX y genéricos (`<T,>`, `<const T,>`,
`<T = string>`, `type Fn = <T>(x: T) => T`) no generan falsos positivos ni ocultan código. Detecta imports
estáticos, `import type`, `export … from`, `import x = require()`, `import()`, `require()` y tipos `import('x')`;
el `fetch` global (`fetch()`, `globalThis|window|self.fetch()`, también con `?.` o `['fetch']`); `any` explícito
(`AnyKeyword`); en domain, referencias a `window`, `document`, `localStorage` y `sessionStorage`; los elementos
JSX `select`/`table`/`dialog`, `role` = `dialog`/`alertdialog` y `type` = `date`/`datetime-local`/`month`/`week`
cuando su valor es estático (`"x"`, `{'x'}` o `` {`x`} ``). `type="time"` está permitido (decisión P5:
`Input type="time"` nativo). Importar `src/test` fuera de un test produce un único mensaje.

No resuelve ámbitos ni tipos: no detecta alias (`const f = fetch; f(url)`), valores calculados
(``role={`dia${'log'}`}``) ni `React.createElement('select')`, y un parámetro o variable local llamado
`document`/`window` dentro de domain se reporta como el global. La revisión de código cubre esos casos.

### Reglas de ESLint fuera de `src/domain`

`src/domain` se copia sin cambios desde Angular, por eso tsconfig no activa `verbatimModuleSyntax`,
`erasableSyntaxOnly` ni `noUnusedLocals`. Fuera del dominio ESLint lo compensa: `consistent-type-imports`,
sin parameter properties ni `enum`, y `@typescript-eslint/no-unused-private-class-members` (cubre miembros
`private` de TypeScript y `#private`). Las variables y parámetros sin usar los controla `no-unused-vars` en todo
el proyecto.

`no-restricted-globals` prohíbe el `fetch` global en `src/domain`, `src/application`, `src/presentation` y
`src/main.tsx` (aviso en el editor); solo `src/infrastructure` habla con la red. `check:architecture` cubre además
`window.fetch`/`globalThis.fetch`.

## Infraestructura (F3)

- `src/infrastructure/http`: `HttpClient` sobre `fetch` (JSON, cabeceras, `params` con la codificación de
  `HttpParams`, `timeoutMs`, `signal`) y `HttpError`, con la misma forma que `HttpErrorResponse` de Angular
  (`status` 0 en fallo de red, `error` con el cuerpo parseado, mismo `message`). No extiende `Error`, igual que
  `HttpErrorResponse`.
- Sin interceptores: cada adaptador añade su `Authorization: Bearer` (paridad con Angular).
- Los adaptadores reciben `HttpClient`, `AuthGateway` y `Environment` por constructor; las URL y claves salen
  siempre de `src/config/environment.ts`. `AuthService` y `AppParametersService` exponen `subscribe` para
  `useSyncExternalStore`.

## Shell (F4)

- `src/presentation/providers/container.ts`: `createContainer(environment)` es el único sitio que instancia
  infraestructura y casos de uso. `main.tsx` lo crea una vez (junto con el `QueryClient` y el router), fuera del
  árbol React, para que StrictMode no duplique servicios con estado. La presentación accede con `useContainer()`,
  `useAuth()` y `useAppParameters(selector)` (`useSyncExternalStore`).
- `query-client.ts`: `defaultError` es `unknown` (vía `Register`) porque `HttpError` no extiende `Error`; un
  reintento salvo sesión expirada, sin refetch al enfocar y cierre de sesión global ante 401/403.
- `src/presentation/shell`: `AuthGate` (restauración, login, renovación cada 4 min, auditoría de login), layout
  con Sidebar de Shadcn, cabecera, barra inferior móvil, tema (`pmo_theme` en sessionStorage, clase `.dark`) y
  guards `RequireAdmin` y `RequireAudit`, que esperan a que carguen los parámetros. Ubicaciones y el historial de
  envíos (`/registros/logs`) no se migran (P11, P12); `locationAdminEmails` se conserva en la configuración sin uso.
- Shadcn `form` está vacío en el estilo `radix-nova`; los formularios usan `Field` + react-hook-form + zod.
- Barra lateral (Shadcn `Sidebar`): el colapso se guarda en `localStorage` `pmo_sidebar_collapsed` (fuente de verdad,
  paridad con Angular). El componente generado escribe además la cookie `sidebar_state` (7 días, `path=/`) en cada
  cambio; la app no la lee. Atajo de teclado de Shadcn: Ctrl+B (Cmd+B en macOS) contrae o expande la barra
  (llama a `preventDefault`, así que en el navegador sustituye al atajo de marcadores). El borde arrastrable
  (`SidebarRail`) recibe `title`/`aria-label` "Contraer o expandir navegación" desde `app-sidebar.tsx`; el botón
  móvil, `aria-label` "Abrir navegación" (su `<span sr-only>` interno sigue en inglés, pero no forma el nombre
  accesible).
- Tests de presentación: `src/test/fakes` (`createTestContainer`, `FakeAuthGateway`, `FakeAppParameters`,
  `renderApp`), sin red ni datos reales.

### Ediciones de código generado (`src/shared/ui`)

Si se regenera uno de estos archivos con `shadcn add --overwrite`, hay que repetir la edición:

| Archivo | Edición | Motivo |
|---|---|---|
| `sidebar.tsx` | Título y descripción del Sheet móvil: "Navegación" / "Muestra la navegación principal." (antes "Sidebar" / "Displays the mobile sidebar.") | Textos en español para lectores de pantalla |
| `progress.tsx` | Se reenvía `value` al `Root` de Radix (el generado solo lo usa en el indicador) | Sin él no hay `aria-valuenow` en el `progressbar` |
| `calendar.tsx` | `modifiers["focused"]` (y `selected`, `range_*`) con corchetes, y `focused` extraído a una constante para el `useEffect` | `noPropertyAccessFromIndexSignature` del tsconfig (TS4111) y `react-hooks/exhaustive-deps` |

## Kit UI (F5)

Componentes Shadcn añadidos: textarea, dialog, alert-dialog, select, command, popover, calendar, table, badge,
progress, toggle-group (+ toggle), chart, empty, pagination, tabs e input-group (para `SearchInput` y `Command`).
Ya existían button, input, label, card, tooltip, skeleton, sonner, dropdown-menu, avatar, sidebar, sheet, alert,
field y separator. `form` no se añade (vacío en `radix-nova`, ver Shell). Dependencias que trajo `shadcn add`:
`cmdk`, `react-day-picker`, `date-fns` y `recharts`.

Composiciones en `src/presentation/shared/components/` (solo componen piezas de Shadcn; label, ayuda y error
se componen fuera con `Field`/`FieldLabel htmlFor={id}`):

| Componente | Equivale a | Notas |
|---|---|---|
| `AppSelect` | `ui-select` | `Select` si hay `searchThreshold` (8) opciones o menos; combobox `Popover` + `Command` si hay más (Angular: `options.length > searchThreshold`). `searchable` lo fuerza. Búsqueda "contiene" sin tildes ni mayúsculas, `loading` ("Cargando..."), `disabled`, `emptyMessage` |
| `DatePicker` | `ui-date-input` | `Calendar` + `Popover`, locale es (semana desde el lunes), `min`/`max` (2000-01-01 … 2100-12-31), "Hoy" y "Limpiar". Valor `YYYY-MM-DD` |
| `TimeInput` | `ui-time-input` | `Input type="time"` con `step=60` (P5); normaliza `H:mm` → `HH:mm` |
| `PageHeader` | `ui-page-header` | `eyebrow` (texto pequeño atenuado sobre el título), `h1`, descripción, `meta` (debajo de la descripción) y `aside` (acciones a la derecha) |
| `MetricCard` | `ui-metric-card` | `Card` con etiqueta, valor, descripción, `tone` y `delta` opcional (`Badge`) |
| `StateMessage` | `ui-state-message` | `Empty` + `Button` de acción (reintentar) |
| `OverflowText` | `overflow-tooltip.directive` | `truncate`/`line-clamp-2|3` + `Tooltip` solo si el texto desborda |
| `SearchInput` | `ui-search-input` | `InputGroup` con icono, "Limpiar búsqueda" y Escape |

`src/presentation/shared/format.ts`: `formatFechaEsp` (pipe `fechaEsp`, mismo código), `formatDateYmd` (pipe
`date: 'yyyy-MM-dd'`), `parseDateValue`/`toDateValue`/`formatDateDisplay` (fechas `YYYY-MM-DD` con `date-fns`
`parse`/`format` en hora local; nunca `new Date('YYYY-MM-DD')`), `normalizeTime` y `normalizeSearch`.

Pruebas de zona horaria: `src/test/timezones.ts` (`useTimezone`) cambia `TZ` dentro del test, así que `npm run test`
ya cubre UTC, America/Bogota y Asia/Tokyo en los tests de fechas; `npm run test:tz` repite toda la suite en cada zona.

## Reportar: borradores (F7)

- `DraftsProvider` (`presentation/time-records/drafts/`) se monta en `AuthGate`, por encima de las rutas: posee la lista
  de borradores (`pmo_pending_time_records`, restaurada al montar) y la fase de envío (`sendLocked`, base de F8).
  Todos los mutadores son no-op con el envío bloqueado. `initialSendPhase` solo lo usan las pruebas.
- `/registros/importar` (lazy): `ImportTextInput` (borrador propio en `pmo_text_time_draft`), `RecordsPreviewTable`
  (TanStack Table desde 1280 px, tarjetas por debajo), `EditRecordDialog` y `ManagementTemplateDialog` (RHF + zod, reglas
  del dominio). Las opciones de selects salen de TanStack Query (`hooks/select-options-queries.ts`).
- `shadcn add collapsible` y `@tanstack/react-table` (v9, API `useTable`) añadidos en F7. `--ui-hours-*` (colores de
  `HorasAlert` del dominio) definidos en `index.css`.
