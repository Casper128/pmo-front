# Diseño: F9 Reportes ampliada, notificaciones y seguridad Supabase

Autor: kiro-architect (modo plan) · 2026-11-18 · Estado: pendiente de decisiones del usuario (ver §5).
Insumos: prueba de escritorio de Reportes (22 hallazgos), exploración de Supabase, inventario funcional.

## 0. Supuestos a vetar
- A1. `HoraInicio`/`HoraFin` son hora de pared con una `Z` engañosa: se muestra `HH:mm` sin convertir zona (verificar con registro real).
- A2. Un borrado repetido en PMO devuelve 4xx: el servidor solo borra en el PATCH con `deleteReport:true`.
- A3. Sin cancelación de solicitud por el solicitante en el MVP (`cancelled` sin uso).
- A4. Se puede volver a solicitar si la anterior fue rechazada.
- A5. Notificaciones leídas se purgan a los 30 días (perezoso en el GET).

## 1. F9 Reportes (React)
### 1.1 Cimientos puros (F9.0, antes de F8)
- `reportDayKey(report)`: única forma de obtener `YYYY-MM-DD` (vía `colombiaDateLabel` con try/catch; `'sin-fecha'` si falla).
- `toReportView(report)`: id, dayKey, startMin/endMin, computableHours (0 si Fábrica), clientName único, searchText precomputado (incluye nombreGestion).
- `buildDayLedger(sentViews, drafts)` + `useDayLedger()`: horas por día de enviados + borradores, Fábrica fuera de computables. Lo usan Reportes, edición, duplicado y F8 (`validateBeforeSend` cuenta lo ya enviado; si el fetch falla, avisa sin bloquear).
- `formatHours`/`parseHoursInput`: hasta 2 decimales, coma es-CO; "1,5" válido, error en vez de 0 silencioso.
- `isManagementReportOwnedBy` estricto (igualdad de id; si no hay id, igualdad exacta de correo; sin subcadenas), aplicado una vez en `useMyReports`. Fix en ambos `domain/` + spec (bug-fix permitido por P6). Se elimina `isCurrentUserReport`.

### 1.2 Página `/registros/reportes`
- Filtros en URL: `?preset=month|today|week|3m|custom&from=&to=&q=&cliente=&report=<id>&mode=view|edit`. Rango inicial fijo: mes actual. Presets con ToggleGroup; Personalizado muestra dos DatePicker. `useReportRange` compartido con Consolidado.
- Layout denso: barra de filtros sticky; en xl dos columnas (lista por día + resumen sticky 320 px: totales, horas por tipo de hora con Fábrica "no computa", top 5 clientes); en <xl franja de 3 KPIs con Collapsible.
- Lista por día: Collapsible con cabecera sticky (fecha, total vs jornada con Badge OK/falta/excede, conteo, "Duplicar día"); 10 días y "Mostrar más"; grupo "Sin fecha" al final, visible, fuera de totales. md+: Table densa (Horario HH:mm–HH:mm, Cliente, Gestión, Tipo de hora Badge, Horas tabular-nums, Estado de eliminación Badge, DropdownMenu Ver/Editar/Duplicar/Eliminar). <md: tarjetas de 2 líneas.
- Estado de eliminación por fila: pending → "Eliminación solicitada" y acción deshabilitada; rejected → badge con nota en Tooltip y permite solicitar de nuevo; approved → desaparece tras invalidar.
- Estados: Skeleton, StateMessage con reintento, vacío distinguiendo "sin reportes" de "sin resultados" con "Limpiar filtros".

### 1.3 Hooks y queries
- `useMyReports()` (staleTime 2 min, keepPreviousData; rango/búsqueda no refetchean), `useReportsView(params)`, `useDebouncedValue(q, 250)`, `useMyDeleteRequests()` (indexado por identifier), `useUpdateReport` (invalida; sin edición local), `useRequestDelete` (devuelve `{request, duplicated}`; duplicated = "Ya existe una solicitud pendiente"), `useTechnicalDelete`, `useDuplicateToDrafts`.
- Puertos: `TimeManagementGateway.requestDelete` devuelve la respuesta; `ManagementDeleteRequestGateway.listMine()`; `mark` acepta `{note, deleteReport}`.
- 401 global en `QueryCache.onError` y `MutationCache.onError` (cierra sesión); 403 no.

### 1.4 Hallazgo → solución
| # | Sev. | Solución |
|---|---|---|
| 1 | Alto | Fila y cabecera usan dayKey; sin edición local (invalidar y refetch). |
| 2 | Alto | Servidor (§3); React nunca llama a `/delete` desde Reportes. |
| 3 | Alto | Servidor (§3); vía técnica solo si `canTechnicalDelete`. |
| 4 | Alto | Servidor: helper único `isAuditUser`. |
| 5 | Alto | `listMine` + badge + bloqueo si pendiente + `duplicated:true` + campana. |
| 6 | Alto | Flujo §1.5 (aviso, anti doble clic, huella, ledger, `duplicatedFromGestionId`). |
| 7 | Medio | Grupo "Sin fecha" visible. |
| 8 | Medio | Pertenencia estricta única. |
| 9 | Medio | Debounce 250 ms, searchText con nombreGestion, clientName único. |
| 10 | Medio | Estados separados; 401 global. |
| 11 | Medio | `apiErrorMessage(error, fallback)`; plantillas con useQuery y reintento; Guardar según isPending/isError. |
| 12 | Medio | §1.6. |
| 13 | Medio | Servidor: aprobación con `deleteReport:true`. |
| 14 | Medio | Auditor resuelto en servidor. |
| 15-22 | Bajo | HH:mm, formatHours, duplicar sin horario con Alert (no se inventa 12:00), botón deshabilitado con sendLocked, toast "Ir a Reportar" sin cambiar vista, rango fijo, clave técnica oculta si no autorizado. |

### 1.5 Duplicar registro y día (`DuplicateDialog`)
- Registro: fecha destino (por defecto hoy en Colombia) y horas editables; `reportToDraft` + `markDuplicatedRecord`; avisos en vivo con el ledger (solape, día excedido) sin bloquear → "Crear de todos modos".
- Día: lista con checkbox, DatePicker destino, Fábrica "no computa", total del día destino vs jornada, Badge "Solapa"; destino = origen deshabilitado; una sola llamada `addRecords(batch)`; si devuelve false (envío en curso) no cambia nada y avisa.
- Anti duplicados: bloqueo síncrono con useRef; huella `sourceId|fecha|horaIni|horaFin` bloquea "Ya está en borradores".
- Integración con DraftsProvider sin cambiar contrato (`addRecords`, `records`, `sendLocked`).

### 1.6 Edición en Sheet (`ReportSheet`)
- Detalle → "Editar" (`?mode=edit`, enlazable). RHF + zod reutilizando campos/opciones de F7.
- Reglas: horaIni < horaFin; horas = duración calculada (tecleables solo en Fábrica, "no computa"); bloqueo si supera `maxHoursPerRecord` con mensaje correcto; solape bloquea; exceso de jornada avisa con confirmación (ledger incluye enviados y borradores fuera del rango).
- Errores del servidor con mensaje original; guardar invalida y cierra.

## 2. Notificaciones (MVP sin Supabase Auth)
### 2.1 Migración `pmo_notifications`
Tabla con `id`, `recipient_key` (correo normalizado o userKey), `kind` (delete_request_created|approved|rejected), `request_id` FK cascade, `title`, `body`, `data jsonb`, `created_at`, `read_at`, unique (request_id, recipient_key, kind); índices de no leídas y por destinatario; RLS solo service_role.
### 2.2 `pmo-management-delete-request`
- POST: ignora `auditorEmail` del cliente; `auditor_email` = `PMO_AUDIT_EMAIL`; destinatarios `AUDITOR_EMAILS` (default `PMO_AUDIT_EMAIL`); error 23505 → `duplicated:true`; notificaciones best-effort.
- PATCH: `update ... eq('status','pending')`, 409 si no actualiza; notificación al solicitante con nota; `deleteReport:true` → borra en PMO con token técnico (404 = ya borrado) y luego marca approved; sin flag, comportamiento actual (Angular).
- GET `?scope=mine`: solicitudes del usuario, 90 días, todos los estados. Sin scope, igual que hoy.
### 2.3 Nueva función `pmo-notifications`
GET `?unread=1&limit=20` (+ unreadCount); POST `{ids?|all}` marca leídas solo las propias; purga perezosa 30 días; `--no-verify-jwt`, valida Bearer contra PMO.
### 2.4 Frontend
Puerto `NotificationGateway`, `useNotifications()` (refetchInterval 60 s, pausa en segundo plano, refetch al enfocar), toast + invalidaciones al llegar nuevas, `NotificationBell` en el header (Popover, Badge, scroll-area, "Marcar todas como leídas"); clic navega a Auditoría o a Reportes `?q=<identifier>`.
### 2.5 Correo (opcional)
Helper `sendMail` best-effort con Resend si existen `RESEND_API_KEY`/`MAIL_FROM`. Recomendación: no en el MVP.

## 3. Seguridad Supabase
Helper `supabase/functions/_shared/pmo-session.ts` (cors, json, identifyUser, secretClient, isAuditUser, auditorRecipients, auditToken). Validación local con `deno check` y `supabase functions serve` + matriz curl.
| Función | Cambio | ¿Rompe Angular? |
|---|---|---|
| `pmo-management-delete` (2, 4) | Solo `isAuditUser`; 403 al resto; auditor legítimo distinto de la cuenta técnica usa token técnico. | No (Angular solo la llama desde Auditoría). |
| `pmo-management-delete-technical` (3) | Exigir correo de sesión en `technicalDeleteEmails` (de parámetros, fallback env `TECHNICAL_DELETE_EMAILS`, falla cerrada) y pertenencia; ignorar `requesterEmail` del cuerpo. | No. |
| `pmo-management-delete-request` (13, 14, auditorEmail) | §2.2. | No (Angular no envía `deleteReport`). |
| `pmo-config-admin:107`, `pmo-send-logs:78` | Quitar correo por defecto (falla cerrada). | Sí si falta el secret `CONFIG_ADMIN_EMAILS`: verificar antes de desplegar. |
| `supabase/.temp` | `git rm -r --cached` + `.gitignore`; alinear project ref. | No. |
Nada se despliega sin autorización (db push + functions deploy de las funciones tocadas).

## 4. Pantallas
- Datos: fusionar en Dashboard como pestaña "Desgloses" (gráfico con selector de dimensión y `aggregate` genérico); redirección `/registros/estadisticas`; se retira "Crear borrador" (lo reemplaza Duplicar de Reportes); retira F11. **Pendiente del análisis de reportes con enfoque de Ingeniería Industrial.**
- Consolidado: mantener, renombrar "Consolidado del equipo", reutilizar `useReportRange` y lista por día.
- Menú móvil: Dashboard, Reportar, Reportes, Plantillas.

## 6. Cambios al plan propuestos
Orden: F7 → F9.0 → F8 → F6 (+Desgloses) → FS → FS-D (autorizado) → F9 → F13 (+campana) → F10 → F12 → F14 → F16; F4.1 (menú móvil) en cualquier momento. F11 retirada si se fusiona Datos.
Riesgos: R12 cierre de `/delete` rompe flujo no inventariado; R13 sin `CONFIG_ADMIN_EMAILS`; R14 borrado PMO no idempotente; R15 costo del polling; R16 dominios divergentes por fix de ownership; R17 crecimiento de notificaciones.
Decisiones propuestas P18-P26 (identidad de notificaciones, auditor en servidor, aprobación con deleteReport, solo auditoría borra directo, fusión de Datos, ledger único, duplicar atómico con huella, fixes de dominio en ambos lados, sin correos en código).

## 7. Decisiones del usuario (2026-11-18)
- **Principio rector: minimalismo.** Solo lo necesario, reutilizando los patrones que ya existen en `react-app/` (hooks con TanStack Query, providers, kit Shadcn, puertos/adaptadores). Nada de extras "por si acaso"; ante la duda, la opción más pequeña.
- **P21 (ajustada): borrado directo solo el mismo día por el dueño.** `pmo-management-delete` permite al dueño borrar directo solo registros cuya fecha sea hoy (en Colombia); cualquier otro día exige solicitud a auditoría. Auditoría puede borrar siempre.
- **Despliegue de Supabase lo hace el coordinador**, con una condición: **no se sobrescriben ni se pierden datos existentes**. Migraciones solo aditivas (`create table if not exists`, `add column if not exists`, sin `drop`, sin `truncate`, sin reescritura de datos); funciones desplegadas con compatibilidad hacia atrás para Angular. Antes de desplegar: revisar `supabase migration list` y que existan los secrets necesarios (solo nombres).
- **Avisos de nuevas solicitudes: solo la cuenta de auditoría** (`PMO_AUDIT_EMAIL`). Sin `AUDITOR_EMAILS`.
- **Consolidado: lo ven todos, como hoy** (el backend ya restringe los datos según el consultor). Sin guard nuevo; el renombre es opcional y solo si aclara.
- Correo: no (solo campana), por minimalismo.
