# Plan maestro de migración: pmo-front Angular 22 → React + TypeScript

> Estado: propuesta de arquitectura (sin implementar). Autor: kiro-architect. Fecha: 2026-11-18.
> Reglas de stack: `.claude/skills/react-dashboard-architect/SKILL.md`.
> Ejecución: `kiro-developer` implementa una fase por vez; `kiro-qa` valida cada fase antes de la siguiente.

---

## 0. Objetivo, alcance y hechos de partida

**Objetivo.** Reescribir la capa de presentación en React manteniendo idéntico el comportamiento de negocio,
en una carpeta nueva `react-app/` con su propio `package.json`. El proyecto Angular en `src/` sigue intacto y
desplegable hasta el corte final.

**Fuera de alcance.** Cambios en la API PMO, en Supabase (`supabase/functions`, `supabase/migrations`),
rediseño funcional, nuevas funcionalidades y retirada de `src/` (se decide en el corte, sección 9).

### Hechos verificados en el código

| Hecho | Evidencia |
|---|---|
| Clean Architecture por capas con alias `@domain`, `@application`, `@infrastructure`, `@presentation`, `@env` | `ARCHITECTURE.md`, `tsconfig.json` |
| Composition root Angular | `src/presentation/shell/app.config.ts`, `src/presentation/shell/providers/time-records.providers.ts` |
| Domain: solo 1 archivo acoplado (rxjs) | `src/domain/time-records/repositories/time-record.repository.ts` |
| Los servicios de dominio reciben parámetros como funciones (`workSettings()`, `defaults()`, `defaultFor()`) | `TimeRecordParameters` en `time-record-domain.service.ts` (compatible con un store no-Angular) |
| Ports como `abstract class` con `Observable`; `LocationGateway.capture` ya es `Promise` | `src/application/**` |
| `SendAllRecordsUseCase` ya usa callback `onProgress`; envío secuencial con espera de 900 ms entre registros; errores por registro no abortan el lote | `send-all-records.use-case.ts` |
| `LoadSelectOptionsUseCase` cachea por cliente+proyecto con `shareReplay`, borra la entrada fallida y precarga con concurrencia 4 | `load-select-options.use-case.ts` |
| No hay interceptor HTTP; cada adaptador añade `Authorization: Bearer` | `src/infrastructure/**` |
| La presentación lee la forma de `HttpErrorResponse` (`error.status`, `error.error.error`, `error.error.message`, `status === 0`) | `multiple-import-page`, `time-dashboard-page`, `consultant-statistics-page`, `audit-delete-requests-page`, `management-template.adapter` |
| God component: `MultipleImportPageComponent` (2198 líneas TS + 1221 HTML, 132 aristas en el grafo) atiende 3 rutas vía `data.view` (`import`, `download`, `management`) | `app.routes.ts`, `GRAPH_REPORT.md` |
| Solo `/administracion/ubicaciones` tiene `canActivate`. Auditoría y Configuración se ocultan en la navegación y verifican el permiso dentro de la página (`canReview`, `canManage`) | `app.routes.ts`, `app.component.ts`, `audit-delete-requests-page.component.ts`, `configuration-page.component.ts` |
| Además del guard, el shell redirige de forma reactiva si cambia el usuario estando en ubicaciones | `app.component.ts` (`locationRouteProtection`) |
| Login integrado en el shell (no hay ruta `/login`); restauración de sesión al arrancar; refresh cada 4 min; logout si 401/403 | `app.component.ts`, `auth.service.ts` |
| Auditoría de login con geolocalización (`highAccuracy:false, maximumAgeMs:300000, timeoutMs:10000`) y de reporte (`highAccuracy:true, maximumAgeMs:0, timeoutMs:15000`), errores de auditoría silenciados | `app.component.ts`, `register-time-record.use-case.ts` |
| Claves de almacenamiento: `pmo_token`, `pmo_refresh_token`, `pmo_user`, `pmo_pending_time_records`, `pmo_sidebar_collapsed` (localStorage), `pmo_theme` (sessionStorage), más las de parámetros y plantillas | `auth.service.ts`, `app.component.ts`, `app-parameters.service.ts`, `management-template.adapter.ts` |
| Tests: Vitest 4 + jsdom ya en uso. 6 specs: 4 de dominio, 1 de application, 1 de presentación (6 casos de envío) | `find src -name "*.spec.ts"` |
| Gráficas Chart.js en 3 componentes; mapa Leaflet en ubicaciones; Excel con `read-excel-file/browser` | `grouped-bar-chart`, `statistics-chart`, `weekly-hours-chart`, `consultant-locations-page` |
| Netlify publica `dist/pmo-app/browser` con fallback SPA | `netlify.toml` |

### Supuestos (validar con el usuario si cambian la solución)

- S1. Ambas apps usan la misma API y el mismo Supabase; no habrá cambios de backend durante la migración.
- S2. Se mantiene el aspecto visual actual (paleta azul/slate, modo claro/oscuro) adaptado a variables de Shadcn,
  no un rediseño.
- S3. El trabajo funcional nuevo en Angular se congela o se replica en React mientras dure la migración.
- S4. `react-app/` es un proyecto npm independiente (sin workspaces) para no tocar el build de Angular.

---

## 1. Estrategia por capa

### 1.1 Domain — copiar tal cual

- Copiar `src/domain/**` a `react-app/src/domain/**` byte a byte, incluidas sus specs.
- **Única excepción:** `time-records/repositories/time-record.repository.ts` cambia `Observable<T>` por `Promise<T>`
  y elimina el import de `rxjs`. Se conserva su ubicación y su nombre para no mover dependencias.
- Se preservan sin tocar: `WorkdayHoursPolicy`, `TimeRecordValidationPolicy`, `TimeRecordApiBodyBuilder`
  (regla Fábrica: se guarda en la fecha del día ejecutado y no cuenta para topes), `colombiaDateLabel`
  (ancla 12:00 GMT-0500), `TimeDashboardCalculator`, `ManagementReportOwnershipPolicy`, `TimeRecordDomainService`.
- Control de deriva mientras convivan las dos apps: script `react-app/scripts/check-domain-sync.mjs` que compara
  `src/domain` con `react-app/src/domain` (ignorando el repositorio) y falla si difieren.

### 1.2 Application — de Observable a Promise

Regla general: cada método `Observable<T>` pasa a `Promise<T>`; se conserva la firma, el nombre y el
`abstract class` (sirve como contrato y como tipo; la infraestructura sigue haciendo `extends`). Sin React ni fetch.

| Archivo | Conversión |
|---|---|
| `ports/time-management.gateway.ts`, `management-template.gateway.ts`, `management-delete-request.gateway.ts`, `send-log.gateway.ts`, `audit/*.ts` | `Observable<T>` → `Promise<T>`. Métodos síncronos (`registerKnownManagement`, `knownManagement`) quedan igual. |
| `auth/auth.gateway.ts` | Métodos async → `Promise`. Los getters reactivos (`user()`, `isLoggedIn()`) se mantienen como funciones y se añade `subscribe(listener): () => void` para que React los lea con `useSyncExternalStore`. |
| `configuration/app-parameters.facade.ts` | Ya es casi agnóstico (`load`/`save` son `Promise`). Se añade `subscribe(listener)`. Los getters siguen siendo funciones: así `TimeRecordParameters` del dominio no cambia. |
| `use-cases/register-time-record.use-case.ts` | `async execute(record)`: `await templates.get` → validar plantilla → aplicar plantilla → `bodyBuilder.build` → `await location.capture({highAccuracy:true, maximumAgeMs:0, timeoutMs:15000})` → `try { await repository.register } ` → auditoría con resultado; los errores de auditoría se silencian (`.catch(() => undefined)`); el error de registro se relanza tras auditar `false`. Mismos mensajes de error. |
| `use-cases/send-all-records.use-case.ts` | `async execute(records, onProgress?, signal?: AbortSignal): Promise<SendResult>`. Bucle `for` secuencial, `await delay(900)` antes de cada registro salvo el primero, `try/catch` por registro (un fallo no detiene el lote), `onProgress(log)` tras cada intento, acumulación idéntica de `SendResult`. Se conservan `buildLog`, `extractIdentifier`, `isSuccessful`, `errorMessage`, `fallbackIdentifier`. `AbortSignal` sustituye a `unsubscribe` (se revisa antes de cada registro; no se usa para cancelar una petición ya enviada). |
| `use-cases/load-select-options.use-case.ts` | Caché `Map<string, Promise<ClientManagementOptions>>`; si la promesa rechaza se borra la entrada; alias por proyecto resuelto igual que hoy. `preloadManagementOptions(clientes, concurrency = 4): Promise<void>` con un pool mínimo (helper `runWithConcurrency` de ~15 líneas en `application/shared/`), ignorando fallos. |

**Progreso del envío: callback, no AsyncIterable.** Motivo: el contrato actual ya es un callback, la spec existente
lo usa y un callback encaja directamente con `setState`; un `AsyncIterable` obligaría a reescribir el consumo sin
beneficio (KISS).

### 1.3 Infrastructure — adaptadores con fetch

- Nuevo `infrastructure/http/http-client.ts`: envoltorio mínimo sobre `fetch` (`get/post/put/patch/delete`,
  `params`, `headers`, cuerpo JSON, `timeoutMs` con `AbortController`). En errores lanza `HttpError` con la **misma
  forma que `HttpErrorResponse`**: `status` (0 en fallo de red), `statusText`, `message`, `error` (cuerpo parseado).
  Así se preservan sin cambios `isSessionExpiredError`, los `error?.error?.error` y el caso `status === 0`.
- Cada adaptador recibe `http` y `auth` por constructor (antes `inject`). Se conserva el `Bearer` por adaptador
  (sin interceptor) para no alterar comportamiento; el `HttpClient` acepta un `getToken` opcional para quien lo use.
- `AuthService`: estado privado + `listeners`; mismas claves de `localStorage`; misma lógica de
  `login → loadUser (fallback al usuario de la respuesta)`, `refreshSession`, `restoreSession`, `isSessionExpiredError` (401/403).
- `AppParametersService`: reemplaza `signal/computed` por un store simple (estado inmutable + `subscribe` + `notify`);
  conserva `canManage` (lista de admins del entorno o acceso de servidor), carga Supabase con fallback local,
  `fetch` con timeout ya existente, `save`, `resetLocal`, claves de almacenamiento.
- `BrowserGeolocationAdapter`, adaptadores Supabase (`user-audit`, `consultant-location`, `send-log`),
  `management-template` (con caché local), `management-delete-request`, `time-management-http`, `time-record-http`
  y mappers: traducción mecánica `http.x().pipe(map(...))` → `const r = await http.x(); return map(r)`.
  `catchError` → `try/catch` con las mismas ramas (p. ej. 403 relanzado en plantillas).

### 1.4 Inyección de dependencias → composition root + contexto React

```
presentation/providers/container.ts        createContainer(env, overrides?) → objeto inmutable
presentation/providers/container-context.tsx  <ContainerProvider value={container}> + useContainer()
presentation/providers/app-providers.tsx    QueryClientProvider + ContainerProvider + Theme + Tooltip + Toaster
```

- `createContainer` reproduce exactamente el grafo de `app.config.ts` + `TIME_RECORDS_PROVIDERS`:
  `auth`, `parameters`, `timeRecordRepository`, `timeManagement`, `sendLogs`, `templates`, `deleteRequests`,
  `location`, `userAudit`, `consultantLocations`, `domainService`, `dashboardCalculator`, `apiBodyBuilder`,
  `registerTimeRecord`, `sendAllRecords`, `loadSelectOptions`.
- Es el **único** archivo de presentación autorizado a importar `@infrastructure/*` (lo verifica el script de capas).
- Se crea una vez en `main.tsx` (fuera del árbol React, para no duplicarse con StrictMode).
- Tests: `createContainer(testEnv, { timeManagement: fake, ... })` o un contenedor de dobles; nunca singletons importados.
- Estado reactivo de `auth` y `parameters`: hooks `useAuthUser()`, `useAppParameters()` con `useSyncExternalStore`
  sobre el `subscribe` del puerto. Sin librerías de estado adicionales.

### 1.5 Integración con TanStack Query

- Los componentes nunca llaman casos de uso o puertos directamente: usan hooks en `presentation/<feature>/hooks/`.
- `queryKeys` centralizado (`presentation/shared/query-keys.ts`): `['management-reports', consultantId]`,
  `['send-logs', query]`, `['templates']`, `['delete-requests']`, `['consultant-locations', filter]`,
  `['options','clientes']`, `['options','proyectos',cliente]`, `['options','gestiones',cliente,proyecto]`.
- `QueryClient` por defecto: `refetchOnWindowFocus:false` (paridad: Angular no refresca al enfocar),
  `staleTime: 30_000`, `retry`: 1 salvo 401/403 (sin reintento). Un `QueryCache.onError` global cierra sesión
  si `auth.isSessionExpiredError(error)`.
- Mutaciones (`updateReport`, `deleteReport`, `requestDelete`, `technicalDelete`, `saveTemplate`, `removeTemplate`,
  `markDeleteRequest`, `saveParameters`) con `useMutation` + `invalidateQueries` + toast Sonner.
- Opciones de selects: `queryFn` delega en `LoadSelectOptionsUseCase` (que mantiene su caché de sesión; TanStack
  cachea encima con `staleTime: Infinity`). La precarga se dispara una vez tras cargar clientes.
- **Envío masivo: no es `useMutation`.** Se implementa `useSendAllRecords` (ver 1.6) porque necesita bloqueo
  síncrono antes del siguiente render, `runId`, progreso incremental y fases propias. Al terminar invalida
  `management-reports` y `send-logs`.

### 1.6 Protecciones del envío (preservar exactamente)

Ubicación: `presentation/time-records/drafts/` con `DraftsProvider` montado en el shell (por encima de las rutas).
Motivo: en Angular el envío sigue vivo si el usuario navega; si el estado viviera en la página, al volver se perdería
el bloqueo y se podría reenviar. Con el provider el bloqueo sobrevive a la navegación.

| Protección actual | Implementación React |
|---|---|
| Un solo envío en curso (`sending`, `sendLocked`, `sendSubscription.closed`) | `inFlightRef = useRef(false)` comprobado y fijado **síncronamente** al inicio de `sendAll()` (antes de cualquier `await`/render); `sendLocked` derivado de la fase (`sending`, `saving-logs`, `log-error`). |
| `runId` | `runIdRef.current = ++n`; cada callback y la resolución comparan contra `runIdRef.current` y descartan ejecuciones antiguas. |
| Poda por referencia | `sentRef: Set<TimeRecord>` con las mismas referencias del lote (`batch = [...records]`); `removeSentRecords` filtra por `!sent.has(record)`. Las ediciones están bloqueadas durante el envío, por lo que las referencias se mantienen. |
| Contador limitado | `processed = Math.min(processed + 1, total)`; `percent = Math.min(100, Math.round(processed/total*100))`. |
| `localStorage pmo_pending_time_records` | Hook `usePendingRecordsStorage`: restaura una vez al montar (idempotente frente a StrictMode), persiste en cada cambio, borra la clave si queda vacío, y en cada progreso `ok` persiste `records.filter(r => !sent.has(r))` inmediatamente. |
| Fases `idle → sending → saving-logs → completed | log-error | failed` y `retrySendLogs` | `useReducer` con las mismas fases y transiciones; `resetSendTracking` nunca libera con fase `sending`/`saving-logs`. |
| Validaciones previas (plantilla bloqueada, campos faltantes/invalidos, horas por registro, horas por día) | Se mueven a una función pura `validateBeforeSend(records, domain, templates)` en presentación que reutiliza los métodos del dominio y devuelve el mismo mensaje y título. |

---

## 2. Inventario de componentes de `src/presentation/` → equivalente

Regla: nada de primitivos hechos a mano. Las "composiciones" permitidas se listan explícitamente.

| Angular | React (destino) | Nota |
|---|---|---|
| `ui-modal` (variants `dialog`, `sheet`, `confirmation`, `destructive`; sizes sm–xl) | Shadcn `Dialog` (dialog), `Sheet` (sheet), `AlertDialog` (confirmation/destructive) | Tamaños vía `className` (`sm:max-w-lg/3xl/...`). |
| `ui-select` (búsqueda desde `searchThreshold = 8`, `loading`, `error`, `hint`) | `AppSelect` = composición: Shadcn `Select` si opciones < umbral, combobox `Popover` + `Command` si ≥ umbral | Mantiene la API `options/placeholder/loading/error/searchThreshold`. |
| `ui-date-input` (`YYYY-MM-DD`, min/max, ControlValueAccessor) | `DatePicker` = Shadcn `Calendar` (react-day-picker) + `Popover`; integración con `FormField` | Valor string `YYYY-MM-DD`; parseo/formateo con `date-fns` `parse`/`format` en hora local, nunca `new Date('YYYY-MM-DD')`. Rango de reportes: `Calendar mode="range"`. |
| `ui-time-input` (popover con listas de horas/minutos) | Shadcn `Input type="time"` (step 60) | Shadcn no trae time picker. Alternativa: `Select` de franjas. Decisión abierta P5. |
| `ui-field` (text/number/textarea, error, hint) | Shadcn `Input`/`Textarea` + `Label` + `Form` (`FormField`, `FormMessage`, `FormDescription`) | Con react-hook-form + zod. |
| `ui-form-section` | Shadcn `Card` (+ `CardHeader`/`CardContent`) con grid Tailwind | Composición de layout. |
| `ui-toolbar` (usuario, iniciales, tema, logout) | Header con Shadcn `Avatar`, `DropdownMenu`, `Button` (toggle tema) | |
| Sidebar del shell + navegación móvil | Shadcn `Sidebar` (colapsable, `pmo_sidebar_collapsed`) + barra inferior con `Button`/`NavLink` | |
| `ui-search-input` | Shadcn `Input` (o `InputGroup`) + icono `Search` de lucide | |
| `ui-metric-card` (label, value, description, tone) | Tremor-style KPI con Shadcn `Card` + `Badge` | Composición. |
| `ui-page-header` | Componente de layout `PageHeader` (eyebrow, title, description) | Composición pura de texto. |
| `ui-segmented-control` | Shadcn `ToggleGroup` (type="single") | |
| `ui-state-message` (empty/error con acción) | Shadcn `Empty` (o `Alert`) + `Button` | Cubre estados vacío/error/reintento del checklist UX. |
| Alertas temporales `showAlert` (5 s) | Shadcn `Sonner` (`toast.success/error`) | |
| `alertDialog` (validación/auditoría) | Shadcn `AlertDialog` | |
| `overflow-tooltip.directive` | `OverflowText` = `truncate`/`line-clamp-n` + Shadcn `Tooltip` mostrado solo si hay desbordamiento (hook `useIsOverflowing` con `ResizeObserver`) | Composición. |
| `fecha-esp.pipe` | Función pura `formatFechaEsp(fechaISO)` en `presentation/shared/format.ts` | Mismo código (`T12:00:00`), con spec. |
| `analytics-chart-card` | Shadcn `Card` + `ChartContainer` | |
| `statistics-chart` (doughnut/pie/bar/line, horizontal, configurable) + `statistics-chart-config.factory` | Shadcn `Chart` (Recharts `PieChart`, `BarChart` con `layout="vertical"`, `LineChart`) + `ToggleGroup` para cambiar tipo | El factory se reescribe como mapeo a `ChartConfig`; `statistics-chart.model.ts` se copia. |
| `grouped-bar-chart` (series, stacked, horizontal) | Shadcn `Chart` + Recharts `BarChart` multi-`Bar` (`stackId` si stacked) | |
| `weekly-hours-chart` (MutationObserver para tema) | Shadcn `Chart` + `BarChart` | El tema lo resuelven las variables CSS; desaparece el observer. |
| `records-preview` (grupos por día, edición inline cliente/tipoHora, duplicar, eliminar, enviar, cancelar) | `RecordsPreviewTable` = TanStack Table + Shadcn `Table` dentro de `Card` por `DayGroup`; celdas editables con `AppSelect`; acciones con `DropdownMenu`; `Progress` para envío | Scroll horizontal dentro de la card. |
| `edit-record-modal` | `Dialog` + react-hook-form + zod; `superRefine` delega en `domain.getMissingFields/getInvalidFields` (DRY, sin duplicar reglas) | |
| `import-text-input` | Shadcn `Textarea` + `Button` + `Alert`; parseo con `domain.parseText/validateImportText` | |
| `management-report-detail-modal` + `management-report-detail.presenter.ts` | `Sheet` o `Dialog`; el presenter (TS puro) se copia tal cual | |
| `management-template-dialog` + `management-template-form` | `Dialog` + formulario RHF + zod con `AppSelect` | |
| Mapa Leaflet en ubicaciones | `react-leaflet` (`MapContainer`, `TileLayer`, `Circle`, `Marker`) | Carga perezosa. |
| Iconos `@ng-icons/lucide` | `lucide-react` | |
| Tablas manuales en logs, auditoría, reportes, ubicaciones, plantillas, consolidado | TanStack Table + Shadcn `Table` (+ `Pagination` en logs) | |
| Barra de progreso del envío | Shadcn `Progress` con `aria-valuenow` limitado | |
| Skeletons de carga | Shadcn `Skeleton` | |

**Gráficas: Shadcn Chart (Recharts) como única librería.** Tremor queda permitido por la skill, pero usar solo
Shadcn Chart evita dos sistemas de theming y problemas de compatibilidad de Tremor con Tailwind 4. Decisión abierta P7.

---

## 3. Rutas y páginas

### 3.1 Router: React Router v7 (modo librería, `createBrowserRouter`)

Justificación frente a TanStack Router: 10 rutas planas, sin estado en query string que requiera tipado fuerte,
guards simples y datos ya gestionados por TanStack Query (no se necesitan loaders). React Router es la opción más
sencilla y conocida; TanStack Router aportaría tipado de rutas/search params a costa de generación de código y más
superficie. Lazy loading con `lazy: () => import(...)` por ruta.

### 3.2 Tabla de rutas

| Ruta | Angular | React (página) | Guard |
|---|---|---|---|
| `/` | redirect | `<Navigate to="/registros/dashboard" replace>` | — |
| `/registros/dashboard` | `TimeDashboardPageComponent` | `TimeDashboardPage` | sesión |
| `/registros/importar` | `MultipleImportPageComponent` view `import` | `ImportPage` (Reportar) | sesión |
| `/registros/reportes` | `MultipleImportPageComponent` view `management` | `ManagementReportsPage` | sesión |
| `/registros/consolidado` | `MultipleImportPageComponent` view `download` | `ConsolidatedPage` | sesión |
| `/registros/estadisticas` | `ConsultantStatisticsPageComponent` | `ConsultantStatisticsPage` | sesión |
| `/registros/logs` | `SendLogsPageComponent` | `SendLogsPage` | sesión |
| `/registros/plantillas` | `ManagementTemplatesPageComponent` | `ManagementTemplatesPage` | sesión |
| `/auditoria/eliminaciones` | `AuditDeleteRequestsPageComponent` | `AuditDeleteRequestsPage` | sesión + `canReviewDeleteRequests` |
| `/configuracion` | `ConfigurationPageComponent` | `ConfigurationPage` | sesión + `canManage` |
| `/administracion/ubicaciones` | `ConsultantLocationsPageComponent` + `locationAdminGuard` | `ConsultantLocationsPage` | sesión + `locationAdminEmails` |
| `*` | (no existe) | redirect a dashboard | — |

El god component se divide en **3 páginas** que comparten hooks (`useManagementReports`, `useDrafts`,
`useSelectOptions`, `useTemplates`) y funciones puras extraídas (filtros, mapeos Excel, `managementReportToDraftRecord`,
helpers de fecha). Duplicar un reporte a borradores usa `DraftsProvider`, igual que hoy vía `localStorage`.

### 3.3 Guards

- `AuthGate` en el shell: muestra skeleton mientras `restoreSession`, el formulario de login si no hay sesión y el
  layout con `<Outlet>` si la hay (paridad: no existe ruta `/login`).
- `RequireLocationAdmin`: wrapper de ruta que lee `useAuthUser()`; si el email normalizado no está en
  `environment.locationAdminEmails` → `<Navigate to="/registros/dashboard" replace>`. Al ser reactivo cubre también la
  redirección del shell cuando cambia el usuario.
- Auditoría y Configuración: **paridad por defecto** = ocultar en navegación (`canShowNavItem`) + comprobación dentro
  de la página. `canReviewDeleteRequests` se extrae a una función pura compartida por shell y página (hoy está duplicada).
  Pasar a redirección es la decisión abierta P2 (cuidado: `canManage` depende de `parameters.load()` asíncrono; un
  guard con redirect debe esperar `loading=false` para no expulsar al admin).

### 3.4 Orden de migración (prioridad)

1. Shell + login + dashboard (pantalla inicial).
2. Reportar/importar: borradores, preview, edición, plantillas obligatorias.
3. Envío masivo con protecciones + **logs** (adelantado: es el destino de "Ver historial" tras enviar y es pequeño).
4. Reportes (gestión: listar, editar, eliminar/solicitar/técnica, detalle, duplicar).
5. Consolidado (descarga + Excel).
6. Estadísticas (933 líneas, gráficas).
7. Plantillas.
8. Auditoría de eliminaciones.
9. Configuración.
10. Ubicaciones (mapa).

Hasta que una página exista, su ruta muestra un placeholder "En migración" para que la navegación funcione.

---

## 4. Estructura de `react-app/`

```
react-app/
  package.json  vite.config.ts  vitest.config.ts  tsconfig.json  tsconfig.app.json  tsconfig.node.json
  eslint.config.js  components.json  index.html  .env.example  .env.development  .env.production
  scripts/
    check-architecture.mjs        port del script actual (ver 4.3)
    check-domain-sync.mjs         compara src/domain con ../src/domain
  public/
  src/
    main.tsx                      crea container + router + <AppProviders>
    index.css                     Tailwind 4 (@import "tailwindcss") + variables Shadcn claro/oscuro
    config/
      environment.ts              lee import.meta.env, valida con zod, exporta `environment` con la forma actual
    domain/                       copia de src/domain
    application/
      audit/ auth/ configuration/ shared/ (run-with-concurrency.ts) time-records/{ports,use-cases}
    infrastructure/
      http/ (http-client.ts, http-error.ts)
      audit/ auth/ configuration/ time-records/{adapters,mappers}
    presentation/
      providers/   container.ts, container-context.tsx, app-providers.tsx, query-client.ts
      shell/       router.tsx, app-layout.tsx, auth-gate.tsx, login-form.tsx, app-sidebar.tsx, app-header.tsx,
                   guards/require-location-admin.tsx, nav-items.ts, permissions.ts
      shared/      components/ (app-select, date-picker, page-header, metric-card, state-message, overflow-text,
                   search-input), hooks/ (use-auth-user, use-app-parameters, use-is-overflowing), format.ts, query-keys.ts
      time-records/
        drafts/    drafts-provider.tsx, use-send-all-records.ts, use-pending-records-storage.ts, validate-before-send.ts
        hooks/     use-management-reports.ts, use-select-options.ts, use-templates.ts, use-send-logs.ts, ...
        components/ records-preview-table, edit-record-dialog, import-text-input, charts/, template-dialog, ...
        presenters/ management-report-detail.presenter.ts (copia)
        pages/     una por ruta
    shared/
      ui/          componentes generados por Shadcn (no editar salvo theming)
      lib/utils.ts `cn()` de Shadcn
    test/
      setup.ts     jest-dom, mocks de matchMedia/ResizeObserver/geolocation
      fakes/       dobles de puertos + `createTestContainer()`
```

### 4.1 Alias

`tsconfig.app.json` + `vite.config.ts` (`vite-tsconfig-paths` o `resolve.alias`):

| Alias | Ruta |
|---|---|
| `@domain/*` | `src/domain/*` |
| `@application/*` | `src/application/*` |
| `@infrastructure/*` | `src/infrastructure/*` |
| `@presentation/*` | `src/presentation/*` |
| `@env/*` | `src/config/*` (mantiene `import { environment } from '@env/environment'`) |
| `@/*` | `src/*` (exigido por Shadcn: `components.json` → `ui: "@/shared/ui"`, `utils: "@/shared/lib/utils"`) |

Conservar los alias actuales permite copiar domain/application/infrastructure con cambios mínimos.

### 4.2 Variables de entorno

| Angular (`environment.ts`) | Vite |
|---|---|
| `production` | `import.meta.env.PROD` |
| `apiBaseUrl` | `VITE_API_BASE_URL` |
| `supabaseUrl` | `VITE_SUPABASE_URL` |
| `supabasePublishableKey` | `VITE_SUPABASE_PUBLISHABLE_KEY` (clave publicable, no secreta) |
| `configurationAdminEmails` | `VITE_CONFIGURATION_ADMIN_EMAILS` (CSV) |
| `locationAdminEmails` | `VITE_LOCATION_ADMIN_EMAILS` (CSV) |

`src/config/environment.ts` valida con zod al arrancar (falla rápido si falta una variable) y normaliza los CSV a
arrays en minúsculas. `.env.example` siempre versionado; si `.env.development/.env.production` se versionan o se
definen en Netlify es la decisión P4. Los valores se copian tal cual, incluido `locationAdminEmails`
(`1darwin.osorio@...`, ver P3).

### 4.3 Port de `scripts/check-architecture.mjs`

Mismo enfoque (Node sin dependencias), adaptado:

- Recorre `.ts` y `.tsx`; excluye `src/shared/ui/**` (código generado) de la regla `any`.
- Capas obligatorias: `domain`, `application`, `infrastructure`, `presentation`.
- `domain`: prohibido importar `react`, `react-dom`, `@tanstack/*`, `rxjs`, `@angular/*`, `@application`,
  `@infrastructure`, `@presentation`, `@/shared/ui`; prohibido `fetch(`, `localStorage`, `window.`.
- `application`: prohibido `react*`, `@tanstack/*`, `rxjs`, `@angular/*`, `@infrastructure`, `@presentation`, `fetch(`.
- `infrastructure`: prohibido `@presentation`, `react*`.
- `presentation`: prohibido `@infrastructure` salvo `presentation/providers/container.ts`; prohibido `fetch(`.
- **Nuevo:** resolver imports relativos (`../../infrastructure/...`) a su capa para que no se salten las reglas.
- **Nuevo (regla de la skill):** fuera de `src/shared/ui/` prohibido `chart.js`, `new Chart(`, `<select`,
  `<table`, `<dialog`, `role="dialog"`, `type="date"`; obliga a usar Shadcn/TanStack/Recharts.
- `any` explícito prohibido; URL de PMO (`execute-api`) solo permitida en `.env*`.
- `npm run verify` = `check:architecture && check:domain-sync && typecheck && lint && test && build`.

---

## 5. Estrategia de pruebas

Stack: Vitest + React Testing Library + `@testing-library/user-event` + jsdom. Sin red real: dobles de puertos vía
`createTestContainer()`; `fetch` mockeado solo en tests de infraestructura. Ejecución con `TZ=UTC` y un segundo
script `test:tz` con `TZ=America/Bogota` y `TZ=Asia/Tokyo` para las pruebas de fechas.

### 5.1 Specs portadas con paridad 100 % (mismos casos y aserciones)

| Spec Angular | Destino | Cambio permitido |
|---|---|---|
| `domain/.../colombia-date-label.spec.ts` | igual | ninguno |
| `domain/.../time-record-api-body.builder.spec.ts` (Fábrica 19:30–23:59 conserva día) | igual | ninguno |
| `domain/.../management-report-ownership.policy.spec.ts` (6) | igual | ninguno |
| `domain/.../time-dashboard.calculator.spec.ts` (16) | igual | ninguno |
| `application/.../load-select-options.use-case.spec.ts` (3) | igual | dobles `of()/throwError` → `Promise.resolve/reject`; mismas aserciones |
| `presentation/.../multiple-import-page.component.spec.ts` (6) | `presentation/time-records/drafts/use-send-all-records.test.ts` (`renderHook`) | `Subscriber` del stub → promesa controlada (`deferred`); mismos 6 casos: bloqueo de segundo envío y de cambios, contador/porcentaje limitados, progreso de ejecución anterior ignorado, retiro de localStorage por confirmación, `log-error` sin confirmados en borradores, poda por referencia |

### 5.2 Pruebas nuevas

Application / infrastructure:
- `send-all-records.use-case.test.ts`: orden secuencial, espera de 900 ms (fake timers), un error no detiene el lote,
  `onProgress` por registro, `SendResult` idéntico, `AbortSignal` detiene antes del siguiente registro.
- `register-time-record.use-case.test.ts`: plantilla ausente/pendiente/incompleta (mensajes exactos), auditoría en
  éxito y en error, fallo de auditoría silenciado, opciones de geolocalización exactas.
- `http-client.test.ts`: forma de `HttpError` (`status`, `error`, `status 0` en red, timeout).
- `auth.service.test.ts`: persistencia de claves, `restoreSession`, `refreshSession`, 401/403 → expirada.
- `app-parameters.service.test.ts`: fallback local, `canManage`, `subscribe/notify`.

Componentes (RTL):
- **Envío sin duplicación:** doble clic rápido en "Enviar" → `sendAllRecords.execute` llamado una sola vez; navegar a
  otra ruta y volver durante el envío mantiene el botón bloqueado; recarga simulada (re-montar con localStorage) no
  restaura registros ya confirmados.
- **Barra de progreso:** `Progress` refleja `processed/total`, nunca supera 100 % ni el total aunque lleguen
  progresos extra o de un `runId` anterior; textos de fase en español iguales a Angular.
- **Fábrica sin desfase:** crear/editar registro Fábrica 2026-09-09 19:30–23:59 con `TZ=Asia/Tokyo` y
  `TZ=America/Bogota` → el cuerpo enviado al repositorio conserva `fechaInicio` del 09 (`colombiaDateLabel`) y no
  computa contra el tope diario (`getDailyLaborHoursExceeded` vacío con 9 h laborales + Fábrica).
- `DatePicker`: seleccionar un día devuelve exactamente `YYYY-MM-DD` en cualquier TZ; min/max respetados.
- `AppSelect`: Select simple < 8 opciones, combobox con búsqueda ≥ 8.
- `RequireLocationAdmin`: redirige a dashboard si el email no está en la lista y reacciona al cambio de usuario.
- Navegación: ítems de Auditoría/Configuración visibles solo con permiso.
- `AuthGate`: restauración de sesión, login con error, auditoría de login invocada, intervalo de refresh 4 min y
  logout en 401/403 (fake timers).
- Por página migrada: estados loading (skeleton), vacío, error con reintento y una interacción principal.
- `formatFechaEsp`: casos de fin de mes/año.

---

## 6. Fases de implementación

Cada fase termina en un estado compilable y verificable. Criterio común de salida (DoD): `npm run typecheck`,
`npm run lint`, `npm run test`, `npm run build`, `npm run check:architecture` en `react-app/` en verde; la app Angular
no se toca (`git diff --stat src/` vacío); QA revisa solo lo cambiado en la fase.

| Fase | Contenido | Verificación específica |
|---|---|---|
| **F0 Andamiaje** | Vite + React 19 + TS (misma línea que Angular, `strict`), Tailwind 4 (`@tailwindcss/vite`), `shadcn init` con alias, ESLint, Vitest + RTL + setup, scripts npm, `check-architecture.mjs` portado (con capas vacías), `.env.example`, `config/environment.ts` | `npm run dev` muestra página en blanco con tema; script de capas detecta una violación de prueba |
| **F1 Domain** | Copia de `src/domain`; repositorio a `Promise`; `check-domain-sync.mjs` | Las 4 specs de dominio pasan sin cambios; `check:domain-sync` en verde |
| **F2 Application** | Ports a `Promise` + `subscribe` en Auth/Parameters; casos de uso async; `runWithConcurrency` | Spec de load-select-options portada + tests nuevos de send-all y register |
| **F3 Infrastructure** | `HttpClient`/`HttpError`, Auth, AppParameters store, todos los adaptadores y mappers | Tests de http-client, auth y app-parameters; compilación sin `@angular`/`rxjs` |
| **F4 Shell** | `createContainer`, providers, QueryClient, router con placeholders, `AuthGate` + login + restore + refresh 4 min + auditoría de login, sidebar/header/nav móvil, tema claro/oscuro, `RequireLocationAdmin` | Tests de AuthGate y guard; prueba manual de login contra API dev (requiere credenciales del usuario) |
| **F5 Kit UI** | `shadcn add` (button, input, textarea, label, form, dialog, sheet, alert-dialog, select, command, popover, calendar, table, card, badge, tooltip, progress, skeleton, sonner, toggle-group, dropdown-menu, avatar, sidebar, chart, empty, pagination, tabs, alert); composiciones `AppSelect`, `DatePicker`, `PageHeader`, `MetricCard`, `StateMessage`, `OverflowText`, `SearchInput`, `formatFechaEsp` | Tests de DatePicker, AppSelect, formatFechaEsp |
| **F6 Dashboard** | `TimeDashboardPage` con `TimeDashboardCalculator`, KPIs, gráfica semanal, filtros/presets | Test de estados + cálculo mostrado coincide con el calculator |
| **F7 Reportar (borradores)** | `DraftsProvider`, `usePendingRecordsStorage`, `ImportTextInput`, `RecordsPreviewTable`, `EditRecordDialog`, selects por fila, plantilla obligatoria (dialog), duplicar/eliminar/cancelar | Restaurar borradores tras recarga; validaciones con mensajes idénticos |
| **F8 Envío + Logs** | `useSendAllRecords`, `validateBeforeSend`, `Progress`, fases, `retrySendLogs`, `SendLogsPage` | 6 casos portados + pruebas de envío sin duplicación, progreso y Fábrica |
| **F9 Reportes** | `ManagementReportsPage`: lista, filtros y rango, edición, eliminación (normal/solicitud/técnica), detalle, duplicar a borradores | Tests de ownership en UI y mutaciones con invalidación |
| **F10 Consolidado** | `ConsolidatedPage`: filtros, descarga, lectura Excel (`read-excel-file/browser`), resumen diario | Parseo Excel con fichero de ejemplo |
| **F11 Estadísticas** | `ConsultantStatisticsPage` + gráficas Recharts configurables | Estados + cambio de tipo de gráfica |
| **F12 Plantillas** | `ManagementTemplatesPage` + formulario RHF/zod | Guardar/eliminar con toasts |
| **F13 Auditoría** | `AuditDeleteRequestsPage` (aprobar/rechazar) | Permiso `canReview` y mensajes de error del backend |
| **F14 Configuración** | `ConfigurationPage` (campos avanzados, workSettings, deletionSettings) | Solo `canManage` puede guardar; restablecer local |
| **F15 Ubicaciones** | `ConsultantLocationsPage` con react-leaflet (lazy) | Guard + mapa renderiza con datos falsos |
| **F16 Paridad y corte** | Checklist UX (360 px, dark mode, skeleton/empty/error), comparación lado a lado por ruta, tamaño de bundle, configuración Netlify para `react-app` (sin desplegar sin autorización), actualización de `ARCHITECTURE.md`/README | Informe QA formal (`qa-audit-report.md`) |

Recomendación: F7 y F8 son las de mayor riesgo; QA debe revisarlas con el checklist de los ~70 métodos de
`MultipleImportPageComponent` para confirmar que cada uno tiene destino (hook, función pura o componente).

---

## 7. Riesgos y mitigaciones

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | Regresiones al dividir el god component (2198 líneas, 3 vistas) | Extraer primero funciones puras con tests; checklist método→destino; 3 páginas con hooks compartidos |
| R2 | Cambiar la forma de los errores HTTP rompe mensajes y detección de sesión expirada | `HttpError` compatible con `HttpErrorResponse` + tests |
| R3 | Doble envío por StrictMode, doble clic o navegación | Bloqueo síncrono con `useRef`, estado en `DraftsProvider`, nunca disparar envíos desde `useEffect`, restauración idempotente |
| R4 | Desfase de fecha en DatePicker / `new Date('YYYY-MM-DD')` | `date-fns` en local, dominio intacto, tests con varias TZ |
| R5 | Deriva de reglas de negocio entre `src/domain` y `react-app/src/domain` | `check-domain-sync` en `verify`; congelar cambios de dominio o aplicarlos en ambos |
| R6 | `canManage` asíncrono provoca redirecciones falsas | Paridad con comprobación en página; si se añade guard, esperar a `loading=false` |
| R7 | Paridad visual/UX (Shadcn por defecto ≠ estilos actuales) | Mapear la paleta actual a variables CSS de Shadcn en F0; revisión lado a lado en F16 |
| R8 | Peso del bundle (Recharts, Leaflet, read-excel-file) | Lazy por ruta; import dinámico de `read-excel-file` |
| R9 | Las claves de `localStorage` compartidas si ambas apps comparten origen | Mantener las mismas claves (facilita el corte); no ejecutar ambas apps en el mismo origen simultáneamente con usuarios reales |
| R10 | Coste del time picker si se exige el popover actual | Decisión P5 antes de F5 |

---

## 8. Decisiones que kiro-developer debe respetar

1. `src/` (Angular) no se modifica. Todo vive en `react-app/`.
2. Domain copiado sin cambios (excepto `time-record.repository.ts` → `Promise`).
3. Ports siguen siendo `abstract class` con `Promise<T>`; progreso por callback `onProgress` + `AbortSignal` opcional.
4. Un único composition root (`presentation/providers/container.ts`) expuesto por contexto; único importador de `@infrastructure`.
5. Componentes → hooks → casos de uso/puertos; TanStack Query para datos de servidor; envío masivo con hook propio.
6. Protecciones de envío exactamente como en 1.6; estado de borradores y envío en `DraftsProvider` a nivel shell.
7. React Router v7; las 3 vistas del god component pasan a 3 páginas.
8. Shadcn Chart (Recharts) para todas las gráficas; ningún primitivo UI hecho a mano.
9. Mismos textos en español, mismas claves de almacenamiento, mismas opciones de geolocalización, refresh cada 4 min.
10. `HttpError` con forma de `HttpErrorResponse`.

## 9. Preguntas abiertas para el usuario

- **P1. Corte:** ¿reemplazo completo en Netlify cuando haya paridad (recomendado, con deploy preview previo) o
  convivencia por rutas? ¿Se elimina `src/` después?
- **P2. Guards de Auditoría y Configuración:** ¿mantener la paridad (ocultar en navegación + verificación en página)
  o redirigir al dashboard?
- **P3. `locationAdminEmails = ['1darwin.osorio@...']`:** ¿el `1` es intencional (ubicaciones deshabilitada) o un error?
  Se copiará tal cual salvo indicación.
- **P4. Variables de entorno:** ¿versionar `.env.development/.env.production` (los valores ya están en el repo) o
  configurarlas en Netlify?
- **P5. Selector de hora:** ¿`Input type="time"` nativo (recomendado) o `Select` de franjas fijas (p. ej. 15 min)?
- **P6. Congelación:** ¿se congelan cambios funcionales en Angular durante la migración?
- **P7. Gráficas:** ¿se acepta usar solo Shadcn Chart (Recharts) y no Tremor?
- **P8. Estilo visual:** ¿replicar la apariencia actual o aceptar el estilo Shadcn con la paleta actual?
