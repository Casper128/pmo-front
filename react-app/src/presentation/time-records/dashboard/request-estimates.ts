import { estimatedHoursOf } from '@application/time-records/template-values';
import type { DashboardRequestSummary } from '@domain/time-records/models/time-dashboard.model';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { buildManagementTemplateMap, templateForManagement } from '../drafts/template-rules';

/**
 * Completa horas estimadas y consumo de cada solicitud con la plantilla de su gestión (una gestión = una plantilla).
 * El reporte guarda en `solicitud` el valor de la gestión, que coincide por texto exacto (sin tildes ni mayúsculas) con
 * el id o el nombre de la plantilla. Sin plantilla o sin horas estimadas, quedan en `null`.
 */
export function withEstimatedHours(
  requests: readonly DashboardRequestSummary[],
  templates: readonly ManagementAdvancedTemplate[],
): DashboardRequestSummary[] {
  const map = buildManagementTemplateMap(templates);
  return requests.map((request) => {
    const template = templateForManagement({ id: request.request, name: request.request }, map);
    const estimatedHours = template ? estimatedHoursOf(template.values) : null;
    return {
      ...request,
      estimatedHours,
      consumptionPct: estimatedHours ? (request.hours / estimatedHours) * 100 : null,
    };
  });
}
