import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import type { DashboardBreakdownItem, TimeDashboardFilter } from '@domain/time-records/models/time-dashboard.model';
import { normalizeText } from '@presentation/shared/format';

/** Grupo de un desglose: horas, registros y % del total de horas filtradas. */
export interface StatisticsGroup extends DashboardBreakdownItem {
  readonly share: number;
}

export type StatisticsDimension = 'module' | 'activity' | 'management' | 'category' | 'hourType';

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const text = (value: unknown) => (value === undefined || value === null ? '' : String(value).trim());
const dimensionKey = (value: unknown) => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();

const ALIASES: Readonly<Record<string, string>> = {
  'actividad desarrollo': 'Actividad desarrollo',
  'actividad de desarrollo': 'Actividad desarrollo',
  'analisis funcional': 'Análisis funcional',
  reunion: 'Reunión',
  reuniones: 'Reunión',
  analisis: 'Análisis',
  documentacion: 'Documentación',
  capacitacion: 'Capacitación',
  gestion: 'Gestión',
  test: 'Pruebas',
  testing: 'Pruebas',
};
const ACRONYMS = new Set(['abap', 'sap', 'sd', 'mm', 'lo', 'fi', 'co', 'wm', 'pp', 'qm', 'bw', 'bi', 'fiori', 'ui5', 'api']);
const CONNECTORS = new Set(['a', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'para', 'por', 'y']);

/** `cleanDimension` de Estadísticas (Angular): une variantes de escritura y da formato de título a la etiqueta. */
export function cleanDimension(value: unknown, fallback: string): string {
  const empty = (candidate: string) => !candidate || ['n/a', 'na', 'null', 'undefined', 'sin dato'].includes(normalizeText(candidate));
  if (empty(text(value))) return fallback;
  const clean = String(value || '')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .replace(/[_.\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (empty(clean)) return fallback;
  const alias = ALIASES[dimensionKey(clean)];
  if (alias) return alias;
  return clean
    .toLocaleLowerCase('es-CO')
    .split(' ')
    .map((word, index) => {
      const key = dimensionKey(word);
      if (ACRONYMS.has(key)) return word.toLocaleUpperCase('es-CO');
      if (index > 0 && CONNECTORS.has(key)) return word;
      return word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1);
    })
    .join(' ');
}

const LABELS: Record<StatisticsDimension, (report: ManagementReport) => string> = {
  module: (report) => cleanDimension(report.modulo || report.tecnologia, 'Sin módulo'),
  activity: (report) => cleanDimension(report.tipoActividad, 'Sin actividad'),
  management: (report) =>
    cleanDimension(report.solicitud_tiemposConsultores?.nombreGestion || report.gestionDemanda || report.solicitud, 'Sin gestión'),
  category: (report) => cleanDimension(report.categoria, 'Sin categoría'),
  hourType: (report) => cleanDimension(report.tipoHora, 'Sin tipo de hora'),
};

/** Mismos criterios de fecha, cliente y tipo de hora que `TimeDashboardCalculator`, para que Datos y Dashboard cuadren. */
export function filterStatisticsReports(reports: readonly ManagementReport[], filter: TimeDashboardFilter): ManagementReport[] {
  return reports.filter((report) => {
    const date = String(report.fechaInicio || '').match(DATE_PATTERN)?.[0] || String(report.HoraInicio || '').match(DATE_PATTERN)?.[0] || '';
    if (!date || date < filter.from || date > filter.to) return false;
    const client = text(report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre) || text(report.cliente) || 'Sin cliente';
    if (filter.client && client !== filter.client) return false;
    return !filter.hourType || (text(report.tipoHora) || 'Sin tipo de hora') === filter.hourType;
  });
}

const hoursOf = (report: ManagementReport) => {
  const value = Number(report.tiempoRealHoras || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

/** Horas, registros y % por grupo de la dimensión, de mayor a menor (`breakdownBy` de Angular, sin recorte). */
export function breakdownStatistics(reports: readonly ManagementReport[], dimension: StatisticsDimension): StatisticsGroup[] {
  const groups = new Map<string, DashboardBreakdownItem>();
  for (const report of reports) {
    const label = LABELS[dimension](report);
    const key = dimensionKey(label);
    const current = groups.get(key) ?? { label, hours: 0, count: 0 };
    groups.set(key, { label, hours: current.hours + hoursOf(report), count: current.count + 1 });
  }
  const total = [...groups.values()].reduce((sum, item) => sum + item.hours, 0);
  return [...groups.values()]
    .map((item) => ({ ...item, share: total ? (item.hours / total) * 100 : 0 }))
    .sort((a, b) => b.hours - a.hours || a.label.localeCompare(b.label, 'es'));
}
