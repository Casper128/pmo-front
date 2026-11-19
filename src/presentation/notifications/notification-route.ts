import type { AppNotification } from '@application/notifications/notification.gateway';

export const AUDIT_REQUESTS_PATH = '/auditoria/eliminaciones';
const REPORTS_PATH = '/registros/reportes';

/** Destino de una notificación: la bandeja de auditoría para una solicitud nueva; Reportes con `?preset=3m&q=` para su resolución (el reporte puede ser de meses anteriores). */
export function notificationPath(notification: AppNotification): string {
  if (notification.kind === 'delete_request_created') return AUDIT_REQUESTS_PATH;
  const identifier = notification.data['identifier'];
  return typeof identifier === 'string' && identifier ? `${REPORTS_PATH}?preset=3m&q=${encodeURIComponent(identifier)}` : REPORTS_PATH;
}
