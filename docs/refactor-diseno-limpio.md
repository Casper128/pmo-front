# Refactor de diseño limpio de react-app (2026-11-18)

Criterios: KISS, SRP, capas, DIP, contratos en su capa y cohesión sin fragmentación artificial. Autor del plan: kiro-architect.

## Cambios aprobados
1. **Fuente única de `applyTemplateValues`** en `application/time-records/template-values.ts`. Corrige la divergencia: la vista "Campos avanzados que se enviarán" aplicaba la plantilla distinto al envío. Semántica: la del envío (conserva `funcional`/`ricef` no vacíos).
2. **`interpretRegistration`** en `application/time-records/registration-outcome.ts`: el caso de uso de envío deja de interpretar el formato del servidor y construye el log una sola vez por intento.
3. **`LoginUseCase`** en `application/auth/`: login + `setUser` + auditoría de ubicación sin bloquear salen de `auth-gate.tsx`.
4. **Defaults de configuración** a `infrastructure/configuration/app-parameters.defaults.ts` (re-exportados).
5. **Retirar `consultantLocations`** (P11) del container, puerto y adaptador (el modelo de domain se queda por la sincronización), y los wrappers sin consumidor de `LoadSelectOptionsUseCase`.
6. **Utilidades duplicadas** (mensaje de error, normalización, tope diario) solo donde sean semánticamente idénticas. Workarounds de lint se corrigen si el arreglo es trivial; si no, se documentan.

## Descartado a propósito
Dividir `edit-record-dialog.tsx` y `records-preview-table.tsx` (cohesivos, comparten estado); mover `send-validation`/`report-view` a application (arrastraría UI sin ganancia hoy); tocar `domain` (sincronizado); mover `SendResult`/`SendProgress` (ya en su capa); puertos para storage en presentación (sin segundo implementador); unificar tipos de una línea; memoizar sin medición; quitar exports usados por tests; código reservado para F6-F14 (`metric-card`, `search-input`, `deleteRequests`, `dashboardCalculator`, `formatDateYmd`).

## Decisiones
Retirar `consultantLocations` ya; vista previa con la semántica del envío; no endurecer `check:architecture` para storage; workarounds de lint revisados en el lote 3.
