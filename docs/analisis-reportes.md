# Análisis de reportes del dashboard (enfoque de Ingeniería Industrial)

Autor: kiro-architect (modo plan) · 2026-11-18. Evidencia: código (`time-dashboard.calculator.ts`, `workday-hours.policy.ts`), inventario funcional y documentación del repo. No hay documentación de propósito, audiencia ni metas: lo no documentado se marca como supuesto.

## 1. Diagnóstico
- **Proceso medido:** registrar tiempo contra gestión de demanda (CH/SR/IN/PRY) → clasificar (facturable, Fábrica, no facturable) → cumplir jornada → corregir con auditoría. Pregunta operativa del consultor: "¿completé mi jornada y cómo se clasificó mi tiempo?". Estratégica (líder/PMO/facturación, no confirmada): "¿dónde se va la capacidad y qué se factura?".
- **Ruido:** Datos tiene 11 dimensiones (solo cliente, módulo, actividad, gestión y tipo de hora apoyan decisiones); Datos y Dashboard agregan el mismo endpoint por separado con periodos por defecto distintos (cifras que no cuadran); "Estimadas vs reales" siempre pendiente; "Horas extra" es en realidad Fábrica; prefijo de Datos inferido por regex frente al campo real.
- **Puntos ciegos:** no hay cumplimiento de jornada en horas (`expectedHours` ya se calcula y no se muestra); no hay alertas por día (faltantes, excesos, días sin reporte); no se mide desvío planeado vs real aunque existen `fechaEstimadaPruebas`/`fechaEstimadaRealPruebas`; "sin festivos" infla los días esperados.
- **Documentación:** README desactualizado; sin definición de KPIs, meta de % facturable ni significado de "Fábrica"; riesgo de pertenencia por `record.funcional`.

## 2. Matriz de decisión
| Reporte / visualización | Decisión | Justificación | Acción |
|---|---|---|---|
| Dashboard · Horas reportadas (+ variación) | MANTENER | Control de carga; variación detecta desvíos. | Migrar 1:1. |
| Dashboard · Facturable % | MANTENER | KPI principal de valor. | Migrar; documentar definición. |
| Dashboard · Clientes atendidos | OPTIMIZAR | Cuenta "Sin cliente". | Excluirlo del conteo. |
| Dashboard · "Horas extra" (Fábrica) | OPTIMIZAR | Nombre engañoso. | Renombrar "Horas Fábrica" (solo texto). |
| Dashboard · Días reportados x/y | OPTIMIZAR | Sin festivos infla el esperado. | Añadir cumplimiento en horas (reportadas ÷ esperadas). |
| Dashboard · Gráfica por día | MANTENER | Único lugar donde se ve la jornada. | Añadir línea de meta de jornada. |
| Dashboard · Por cliente | MANTENER | Dónde va la capacidad. | Fuente única "por cliente". |
| Dashboard · Facturable vs no | MANTENER | Desglose de facturación. | Migrar. |
| Dashboard · Mes a mes apilado | MANTENER | Único horizonte largo. | Migrar. |
| Dashboard · Estimadas vs reales | ELIMINAR/ARCHIVAR | Estimaciones siempre null; confunde. | Omitir (requiere decisión: P13 pedía solo visual). |
| Datos · KPIs horas/registros/promedio/facturables | CONSOLIDAR | Duplican Dashboard; promedio no usa jornada. | Quitar duplicados. |
| Datos · Desglose cliente / tipo de hora | CONSOLIDAR | Duplican Dashboard. | Quitar. |
| Datos · módulo, actividad, gestión, tipo gestión | MANTENER | Tipo de trabajo; no está en Dashboard. | Migrar. |
| Datos · funcional, prefijo | OPTIMIZAR | Prefijo por regex. | Usar el campo `prefijo`. |
| Datos · tecnología, categoría, causa, complejidad | ELIMINAR (candidato) | Sin KPI ni decisión asociada. | No migrar hasta que se pidan. |
| Datos · tendencia y resumen | CONSOLIDAR | Solapa con por día y mes a mes. | Quitar salvo granularidad semanal. |
| Datos · tabla con "Crear borrador" | MANTENER | Única acción de Datos. | Migrar (o sustituir por Duplicar de Reportes). |
| Datos · exportación PNG | ELIMINAR | Inalcanzable (P14). | No migrar. |
| Consolidado · tarjetas, resumen por día y consultor, detalle | MANTENER | Única vista multi-consultor; conciliación. | Migrar. |
| Reportes · lista por día con CRUD | MANTENER | Punto de corrección y auditoría. | Migrar (F9). |
| Logs / Ubicaciones | ELIMINAR | Decidido (P11, P12). | — |

## 3. Reportes nuevos (máx. 3)
- **A. Desvío de fechas de pruebas** (planeado vs real por gestión): % a tiempo, días de desvío, atrasadas. Fuente: `fechaEstimadaPruebas`, `fechaEstimadaRealPruebas`, `solicitud`, `nombreGestion`. Solo si esos campos vienen poblados.
- **B. Alertas de jornada por día** (lista en el Dashboard): días con exceso, con faltante, sin reporte, brecha en horas. Fuente: política de jornada existente. Función pura + tabla pequeña.
- **C. Mezcla de capacidad** (% de cada clase de hora sobre lo esperado, mensual). Variación del mes a mes; no agregar salvo que se pida.

## 4. Documentación faltante / supuestos
Definición de "Fábrica" y "Horas extra"; metas de % facturable y cumplimiento; audiencia real; frecuencia de uso (no hay analítica); si las fechas de pruebas vienen pobladas; calendario de festivos; procesos de aprobación y cierre; alcance real de Consolidado en el backend; pertenencia por `record.funcional`; retención.

## 5. Impacto en el plan
- **F6 Dashboard:** renombrar "Horas Fábrica", excluir "Sin cliente", línea de meta diaria, cumplimiento en horas y alertas por día (B). Estimadas vs reales según decisión.
- **F11 Datos:** reducir a módulo, actividad, gestión, tipo de gestión, funcional y prefijo (campo); mismo hook y calculador que el Dashboard; fusión completa después de F16 si el uso lo justifica.
- **F10 Consolidado:** migrar como está; reutilizar la lista por día de Reportes.
- **F9 Reportes:** sin cambios respecto al diseño.
- **Transversal:** política de pertenencia única y revisar `record.funcional`.

## 6. Decisiones del usuario (2026-11-18)
- Audiencia confirmada: consultores y **líderes de equipo**.
- Dashboard: **renombrar "Horas extra" a "Horas Fábrica"** y **agregar alertas por día** (faltante, exceso, sin reporte). No se agregan cumplimiento en horas ni el cambio de "Sin cliente".
- "Estimadas vs reales": **hacerla funcional** con un atributo nuevo e independiente de horas estimadas por asignación (pendiente confirmar qué pantalla es "asignaciones").
- Datos: el usuario decidirá qué desgloses quedan a partir de la lista de 11.
