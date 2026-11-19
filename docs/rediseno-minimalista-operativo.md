# Rediseño "Minimalista operativo" — especificación (kiro-ux-ui)

Estilo: limpio, denso pero legible (tipo Linear/Vercel); neutros zinc, un solo acento azul, color solo para estado/acción; claro y oscuro de igual calidad. Primitivos en `src/shared/ui`.

## 1. Sistema

### Tokens (`src/index.css`, `:root` / `.dark`; se conserva la estructura, cambian valores)

| Token | Claro | Oscuro |
|---|---|---|
| background | #fafafa | #0c0c0e |
| foreground | #18181b | #ededef |
| card / popover | #ffffff | #141417 |
| card-fg / popover-fg | #18181b | #ededef |
| secondary / muted | #f4f4f5 | #1c1c21 |
| muted-foreground | #5b5b66 | #a1a1aa |
| border | #e4e4e7 | #27272d |
| input (borde de campos) | #8c8c97 | #6b6b76 |
| ring / primary | #2457c5 | #7aa2f7 |
| primary-foreground | #ffffff | #0c0c0e |
| accent | #eef3fd | #1c2438 |
| accent-foreground | #1b469e | #c3d4fb |
| destructive | #c42b1c | #f87171 |
| destructive-foreground | #ffffff | #0c0c0e |
| success | #12794f | #4ade80 |
| success-foreground | #ffffff | #0c0c0e |
| warning | #8a5a00 | #fbbf24 |
| warning-foreground | #ffffff | #0c0c0e |
| chart-1..5 | #2457c5 #12794f #b7791f #71717a #c42b1c | #7aa2f7 #4ade80 #fbbf24 #a1a1aa #f87171 |
| sidebar | #fafafa | #0c0c0e |
| sidebar-accent / -foreground | #f4f4f5 / #18181b | #1c1c21 / #ededef |
| sidebar-border | #e4e4e7 | #27272d |
| selection | #dbe6fb | #1e2a4a |

- `--ui-hours-*` se conservan; fondos `color-mix(in oklab, var(--success|--destructive|--warning) 10%, var(--card))`, bordes al 30 %.
- Contraste WCAG calculado (claro): fg/bg 16.97, muted-fg/bg 6.42, primary-fg/primary 6.47, destructive/card 5.66, success 5.42, warning 5.93, input/bg 3.19. Oscuro: fg/bg 16.71, muted-fg/card 7.17, primary-fg/primary 7.76, destructive-fg/destructive 7.07, input 3.71.
- chart-3/chart-4 solo para áreas/barras, no texto. `border` es decorativo; los campos usan `border-input`.

### Radios, tipografía, densidad
- `--radius: 0.5rem`; controles/badges `rounded-md`, cards `rounded-lg` (Card pasa de `rounded-xl`).
- Fuente Inter Variable (`--font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif`), `tabular-nums` en números de tabla/KPI.
- Escala: título página `text-xl font-semibold tracking-tight`; sección/card `text-sm font-semibold`; cuerpo `text-sm`; meta `text-xs` muted; KPI `text-2xl font-semibold`. Sin `uppercase tracking-widest`.
- Página: `mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8`, `gap-6` entre bloques.
- Card sin sombra, `ring-1 ring-border`; padding 16 px (12 px en `size=sm`).
- Tabla: fila `h-10` (`px-3 py-2`), cabecera `h-9 text-xs font-medium text-muted-foreground bg-muted/40` sticky, hover `bg-muted/50`, sin cebra.
- Sombras solo en Popover/Dropdown/Sheet (`shadow-md`) y Dialog (`shadow-lg`). Transiciones 150 ms + `motion-reduce:transition-none`.

## 2. Shell
- Sidebar 232 px / 56 px icon mode, mismo fondo que la página + `border-r`; ítem 32 px, activo `bg-sidebar-accent font-medium` e icono `text-primary`; marca de texto "PMO".
- Topbar `h-12`, `border-b`, `bg-background` sólido (sin blur); trigger + título de sección; sin subtítulo fijo. Derecha: campana, tema (mantener los dos botones con `aria-pressed` para no romper tests), avatar.
- Nav móvil inferior 56 px, ítems icono 20 px + etiqueta 11 px en columna, objetivo ≥ 44 px, activo en `text-primary` sin fondo; máx. 5 ítems + "Más" (Sheet).
- PageHeader: título + descripción `text-sm text-muted-foreground max-w-prose`, acciones a la derecha (apiladas a 360 px), una sola primaria.

## 3. Patrones
- KPI: Card `size=sm`, etiqueta 12 px arriba, valor 24 px; color solo si hay estado; rejilla `grid-cols-2 lg:grid-cols-4 gap-3`.
- Tablas: acciones al final (DropdownMenu o iconos ghost con aria-label + Tooltip); números a la derecha; < 768 px tarjetas de 2 líneas.
- Formularios/Sheet: etiqueta arriba, ayuda y error inline; máx. 2 columnas; Sheet `sm:max-w-md`, pie fijo Cancelar + primaria; grupos con `Separator`, sin cards anidadas.
- Filtros: una fila `flex flex-wrap gap-2`, búsqueda a la izquierda; a 360 px búsqueda full + `Collapsible` "Filtros (n)"; "Limpiar" solo si hay filtros activos.
- Estados: `Empty` sobrio; `Skeleton` con la forma real; error `Alert`/`StateMessage` con Reintentar.
- Toasts: abajo a la derecha (arriba en móvil), 4 s, fondo popover.
- Badges de estado sutiles (fondo 10 %, borde 25 %, texto del token, icono + texto); pendiente=warning, completo=success, rechazado=destructive.

## 4. Pantallas (por impacto)
1. Global: tokens, radios, Inter, contenedor.
2. Dashboard: KPIs neutros en 4 columnas; alertas por día en una sola Card con filas; gráficas `h-[220px]` con chart-1..5; `request-hours-card` en un solo bloque.
3. Reportes: tabla densa agrupada por día (cabecera de día `bg-muted/40`, total a la derecha); filtros sticky; skeleton en filas; ReportSheet según patrón.
4. Consolidado: totales a la derecha, fila total sticky, exportar como única primaria.
5. Auditoría: badges sutiles, Aprobar (primary) / Rechazar (outline), AlertDialog destructivo.
6. Plantillas y Configuración: secciones con `Separator`, formularios 1–2 columnas, pie de guardado a la derecha.
7. Importar: zona de carga neutra punteada, preview con patrón de tablas.
8. Login/placeholder: card centrada 360 px sin sombras.

## 5. Riesgos y lotes
- Tests sensibles: `inputs.test.tsx:71` (`text-primary`), `overflow-text.test.tsx` (`truncate`, `line-clamp-2`), `app-layout.test.tsx` (clase `dark`, botones de tema con `aria-pressed`), `page-header.test.tsx`, `state-message.test.tsx`, aria-labels de nav móvil.
- Lotes: 1) tokens + tipografía + card/table/badge/sonner; 2) shell; 3) compartidos (metric-card, state-message, badges, filtros); 4) Dashboard y Reportes; 5) Consolidado y Auditoría; 6) Plantillas, Configuración, Importar, Login; 7) QA a 360/1280 px claro/oscuro.
