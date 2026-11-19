import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { DEFAULT_REPORT_PRESET, dayStatus, filterReportRows, groupReportsByDay, reportPresetRange, summarizeReports, toReportRow } from './report-list';

const isCountable = (tipoHora: string) => tipoHora !== 'Fábrica';

const report = (id: string, day: string | null, start: string, hours: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: id,
  ...(day ? { HoraInicio: `${day}T${start}:00.000Z`, HoraFin: `${day}T${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00:00.000Z` } : {}),
  tiempoRealHoras: hours,
  tipoHora: 'Laboral',
  solicitud_tiemposConsultores: { nombreGestion: 'Soporte nómina', solicitud_cliente: { nombre: 'Cliente Alfa' } },
  ...overrides,
});

const rows = [
  report('A', '2026-09-10', '09:00', '1'),
  report('B', '2026-09-10', '08:00', '2', { tipoHora: 'Fábrica' }),
  report('C', '2026-09-12', '08:00', '1.5', {
    solicitud_tiemposConsultores: { nombreGestion: 'Migración datos', solicitud_cliente: { nombre: 'Cliente Beta' } },
  }),
  report('D', null, '', '1'),
].map((item) => toReportRow(item, isCountable));

describe('reportPresetRange', () => {
  it('hoy, semana (lunes a domingo), mes calendario y 3 meses hasta hoy', () => {
    expect(DEFAULT_REPORT_PRESET).toBe('month');
    expect(reportPresetRange('today', '2026-09-18')).toEqual({ from: '2026-09-18', to: '2026-09-18' });
    expect(reportPresetRange('week', '2026-09-18')).toEqual({ from: '2026-09-14', to: '2026-09-20' });
    expect(reportPresetRange('month', '2026-09-18')).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(reportPresetRange('3m', '2026-09-18')).toEqual({ from: '2026-06-19', to: '2026-09-18' });
  });
});

describe('filterReportRows', () => {
  const ids = (filter: Partial<Parameters<typeof filterReportRows>[1]>) =>
    filterReportRows(rows, { from: '2026-09-01', to: '2026-09-30', q: '', client: '', ...filter }).map((row) => row.view.id);

  it('filtra por rango, pero deja visibles los reportes sin fecha', () => {
    expect(ids({ from: '2026-09-11', to: '2026-09-30' })).toEqual(['C', 'D']);
  });

  it('busca sin tildes ni mayúsculas, incluido el nombre de la gestión y el cliente', () => {
    expect(ids({ q: 'MIGRACION' })).toEqual(['C']);
    expect(ids({ q: 'cliente beta' })).toEqual(['C']);
    expect(ids({ q: 'nomina' })).toEqual(['A', 'B', 'D']);
  });

  it('filtra por cliente', () => {
    expect(ids({ client: 'Cliente Beta' })).toEqual(['C']);
  });
});

describe('groupReportsByDay y resumen', () => {
  const days = groupReportsByDay(rows);

  it('ordena los días del más reciente al más antiguo, "Sin fecha" al final y los registros por hora', () => {
    expect(days.map((day) => day.dayKey)).toEqual(['2026-09-12', '2026-09-10', 'sin-fecha']);
    expect(days[1]?.rows.map((row) => row.view.id)).toEqual(['B', 'A']);
  });

  it('las horas computables excluyen Fábrica', () => {
    expect(days[1]?.computableHours).toBe(1);
  });

  it('el resumen no suma el grupo sin fecha y separa lo que no computa', () => {
    expect(summarizeReports(days)).toEqual({ count: 4, days: 2, computableHours: 2.5, nonComputableHours: 2 });
  });
});

describe('dayStatus', () => {
  it('compara con la jornada', () => {
    expect(dayStatus(8.5, 8.5)).toEqual({ kind: 'ok', difference: 0 });
    expect(dayStatus(6, 8.5)).toEqual({ kind: 'missing', difference: 2.5 });
    expect(dayStatus(9, 8)).toEqual({ kind: 'excess', difference: 1 });
    expect(dayStatus(0.1 + 0.2, 0.3).kind).toBe('ok');
  });
});
