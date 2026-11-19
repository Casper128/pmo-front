import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { formatDateYmd } from '@presentation/shared/format';
import { formatHours } from '../dashboard/dashboard-format';
import { reportTime } from '../reports/report-view';

/** Nombre de la gestión del reporte solicitado (como Angular: solicitud, gestión o nombre de la gestión). */
export function requestTitle({ report }: ManagementDeleteRequest): string {
  return String(report.solicitud || report.gestionDemanda || report.solicitud_tiemposConsultores?.nombreGestion || 'Reporte sin nombre');
}

export const requestDescription = ({ report }: ManagementDeleteRequest): string =>
  String(report.descripcionActividad || report.observacion || 'Sin detalle');

export function requestHours({ report }: ManagementDeleteRequest): string {
  const hours = report.tiempoRealHoras;
  if (hours === undefined || hours === null || hours === '') return 'N/A';
  return Number.isFinite(Number(hours)) ? `${formatHours(Number(hours), 2)} h` : `${hours} h`;
}

export const requestRequester = (request: ManagementDeleteRequest): string =>
  request.requesterEmail || request.requesterKey || 'Consultor no identificado';

export const requestDate = ({ report, requestedAt }: ManagementDeleteRequest): string =>
  formatDateYmd(report.fechaInicio || requestedAt) || 'N/A';

/** Campos del reporte (`report` jsonb) que ayudan a decidir; solo los que traen valor. */
export function requestDetailFields({ report }: ManagementDeleteRequest): { label: string; value: string }[] {
  const start = reportTime(report.HoraInicio);
  const end = reportTime(report.HoraFin);
  const fields: [string, unknown][] = [
    ['Solicitud', report.solicitud],
    ['Tipo de hora', report.tipoHora],
    ['Horario', start || end ? `${start || '--'} – ${end || '--'}` : ''],
    ['Tipo de actividad', report.tipoActividad],
    ['Proyecto', report.proyecto],
    ['Módulo', report.modulo],
    ['Tecnología', report.tecnologia],
    ['Funcional', report.funcional],
    ['Observación', report.observacion],
  ];
  return fields.filter(([, value]) => value).map(([label, value]) => ({ label, value: String(value) }));
}

/** 409 del servidor: otro auditor ya resolvió la solicitud. */
export const isAlreadyResolved = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'status' in error && error.status === 409;
