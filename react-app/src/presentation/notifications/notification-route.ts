import type { AppNotification } from '@application/notifications/notification.gateway';

export const AUDIT_REQUESTS_PATH = '/auditoria/eliminaciones';
const REPORTS_PATH = '/registros/reportes';

/** Destino de una notificación: la bandeja de auditoría para una solicitud nueva; el reporte (`?q=`) para su resolución. */
export function notificationPath(notification: AppNotification): string {
  if (notification.kind === 'delete_request_created') return AUDIT_REQUESTS_PATH;
  const identifier = notification.data['identifier'];
  return typeof identifier === 'string' && identifier ? `${REPORTS_PATH}?q=${encodeURIComponent(identifier)}` : REPORTS_PATH;
}
