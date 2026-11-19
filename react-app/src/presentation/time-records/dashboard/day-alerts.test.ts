import { WorkdayHoursPolicy } from '@domain/time-records/services/workday-hours.policy';
import type { TimeRecordParameters } from '@domain/time-records/services/time-record-domain.service';
import type { DayLedger } from '../reports/report-view';
import { buildDayAlerts } from './day-alerts';

const parameters = {
  workSettings: () => ({
    mondayThursdayHours: 8.5,
    fridayHours: 8,
    dailyHours: { 0: 0, 1: 8.5, 2: 8.5, 3: 8.5, 4: 8.5, 5: 8, 6: 0 },
    maxDailyLaborHours: 10,
    maxHoursPerRecord: 16,
  }),
} as unknown as TimeRecordParameters;
const policy = new WorkdayHoursPolicy(parameters);

const ledger = (hours: Record<string, number>): DayLedger =>
  new Map(Object.entries(hours).map(([day, sentHours]) => [day, { sentHours, draftHours: 0, sentIntervals: [] }]));

// 2026-09-11 viernes ... 2026-09-18 viernes
const range = { from: '2026-09-11', to: '2026-09-18' };

describe('buildDayAlerts', () => {
  it('detecta faltante, exceso y sin reporte; exacto y fin de semana sin registros no son alerta', () => {
    const alerts = buildDayAlerts(
      ledger({ '2026-09-11': 8, '2026-09-14': 6, '2026-09-15': 10, '2026-09-16': 8.5 }),
      range,
      policy,
      '2026-09-18',
    );
    expect(alerts.map((a) => [a.date, a.kind])).toEqual([
      ['2026-09-18', 'none'],
      ['2026-09-17', 'none'],
      ['2026-09-15', 'excess'],
      ['2026-09-14', 'missing'],
    ]);
    expect(alerts.find((a) => a.date === '2026-09-14')).toMatchObject({ label: 'Faltan 2.5h', expectedHours: 8.5 });
    expect(alerts.find((a) => a.date === '2026-09-15')?.label).toBe('Excede 8.5h');
  });

  it('un fin de semana con horas reportadas excede la jornada de 0 h', () => {
    const [alert] = buildDayAlerts(ledger({ '2026-09-12': 2 }), { from: '2026-09-12', to: '2026-09-13' }, policy, '2026-09-18');
    expect(alert).toMatchObject({ date: '2026-09-12', kind: 'excess', expectedHours: 0 });
  });

  it('los días posteriores a hoy no son alerta', () => {
    expect(buildDayAlerts(ledger({}), { from: '2026-09-14', to: '2026-09-18' }, policy, '2026-09-14').map((a) => a.date)).toEqual(['2026-09-14']);
  });

  it('ignora diferencias de coma flotante', () => {
    expect(buildDayAlerts(ledger({ '2026-09-14': 8.5 + 1e-12 }), { from: '2026-09-14', to: '2026-09-14' }, policy, '2026-09-18')).toEqual([]);
  });
});
