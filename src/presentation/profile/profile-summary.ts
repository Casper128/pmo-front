import type { ManagementReport } from '@domain/time-records/models/management-report.model';

export interface LastReport {
  /** `YYYY-MM-DD` */
  readonly date: string;
  readonly request: string;
  readonly client: string;
}

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());
const dateOf = (report: ManagementReport) =>
  text(report.fechaInicio).match(DATE_PATTERN)?.[0] || text(report.HoraInicio).match(DATE_PATTERN)?.[0] || '';

/** Primer día del mes de `today` (`YYYY-MM-DD`) y el propio `today`: el periodo "del mes" hasta hoy. */
export function monthToDateRange(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** Reporte más reciente (por fecha y hora de inicio) o `null` si no hay ninguno con fecha. */
export function latestReport(rows: readonly ManagementReport[]): LastReport | null {
  let best: { key: string; report: ManagementReport; date: string } | null = null;
  for (const report of rows) {
    const date = dateOf(report);
    if (!date) continue;
    const key = `${date}|${text(report.HoraInicio)}`;
    if (!best || key > best.key) best = { key, report, date };
  }
  if (!best) return null;
  const { report, date } = best;
  return {
    date,
    request: text(report.solicitud_tiemposConsultores?.nombreGestion) || text(report.gestionDemanda) || text(report.solicitud) || 'Sin solicitud',
    client: text(report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre) || text(report.cliente) || 'Sin cliente',
  };
}
