import type { DayLedger } from '../reports/report-view';

export type DayAlertKind = 'missing' | 'excess' | 'none';

export interface DayAlert {
  readonly date: string;
  readonly kind: DayAlertKind;
  readonly reportedHours: number;
  readonly expectedHours: number;
  /** Texto de la política de jornada (`Faltan 2.5h`, `Excede 8.5h`) o `Sin reporte`. */
  readonly label: string;
}

/** Subconjunto de `WorkdayHoursPolicy` que necesita el cálculo (permite probarlo sin parámetros reales). */
export interface DayAlertPolicy {
  expectedHoursForDate(date: string): number;
  alert(total: number, date: string): { label: string };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Fechas `YYYY-MM-DD` de `from` a `to`, ambas incluidas, con aritmética UTC (sin depender de la zona). */
function daysBetween(from: string, to: string): string[] {
  const days: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let time = Date.parse(`${from}T00:00:00Z`); time <= end; time += 86_400_000) {
    days.push(new Date(time).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Días del periodo con faltante, exceso o sin reporte, del más reciente al más antiguo. Usa las horas
 * computables ya enviadas (Fábrica no cuenta, como en la jornada) y la jornada esperada de la política.
 * Un día sin registros solo es alerta si su jornada es mayor que 0 (fines de semana no); los días
 * posteriores a `today` no son alerta porque todavía no han ocurrido.
 */
export function buildDayAlerts(
  ledger: DayLedger,
  range: { readonly from: string; readonly to: string },
  policy: DayAlertPolicy,
  today: string,
): DayAlert[] {
  const alerts: DayAlert[] = [];
  for (const date of daysBetween(range.from, range.to)) {
    if (date > today) break;
    const expectedHours = policy.expectedHoursForDate(date);
    const reportedHours = round(ledger.get(date)?.sentHours ?? 0);
    if (reportedHours === 0 && expectedHours > 0) {
      alerts.push({ date, kind: 'none', reportedHours, expectedHours, label: 'Sin reporte' });
    } else if (reportedHours > 0 && reportedHours !== expectedHours) {
      alerts.push({
        date,
        kind: reportedHours > expectedHours ? 'excess' : 'missing',
        reportedHours,
        expectedHours,
        label: policy.alert(reportedHours, date).label,
      });
    }
  }
  return alerts.reverse();
}
