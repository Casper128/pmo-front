import { ManagementReport } from '../models/management-report.model';
import { TimeDashboardFilter } from '../models/time-dashboard.model';
import { TimeDashboardCalculator } from './time-dashboard.calculator';
import type { TimeRecordParameters } from './time-record-domain.service';

const parameters: TimeRecordParameters = {
  defaultFor: () => '',
  defaults: () => ({}) as ReturnType<TimeRecordParameters['defaults']>,
  workSettings: () => ({
    mondayThursdayHours: 9,
    fridayHours: 8,
    dailyHours: { 0: 0, 1: 9, 2: 9, 3: 9, 4: 9, 5: 8, 6: 0 },
    maxDailyLaborHours: 9,
    maxHoursPerRecord: 9,
  }),
};

function row(
  fechaInicio: string,
  tiempoRealHoras: string,
  overrides: Partial<ManagementReport> = {},
): ManagementReport {
  return {
    fechaInicio,
    HoraInicio: '7:30:00',
    tiempoRealHoras,
    tipoHora: 'Laboral',
    cliente: '2',
    solicitud: 'Solicitud A',
    solicitud_tiemposConsultores: { solicitud_cliente: { nombre: 'Cliente Uno' } },
    ...overrides,
  };
}

const filter = (overrides: Partial<TimeDashboardFilter> = {}): TimeDashboardFilter => ({
  from: '2026-11-02',
  to: '2026-11-08',
  client: '',
  hourType: '',
  ...overrides,
});

describe('TimeDashboardCalculator', () => {
  const calculator = new TimeDashboardCalculator(parameters);

  it('filtra por rango, cliente y tipo de hora, y excluye fechas atípicas', () => {
    const rows = [
      row('2026-11-02', '5.0'),
      row('2026-11-03', '2', { tipoHora: 'Fabrica' }),
      row('2026-11-04', '1', {
        cliente: '3',
        solicitud_tiemposConsultores: { solicitud_cliente: { nombre: 'Cliente Dos' } },
      }),
      row('2025-05-26', '4', { HoraInicio: '4:30:00' }),
      row('', '3'),
    ];
    expect(calculator.build(rows, filter()).kpis.totalHours).toBe(8);
    expect(calculator.build(rows, filter({ client: 'Cliente Dos' })).kpis.totalHours).toBe(1);
    expect(calculator.build(rows, filter({ hourType: 'Fabrica' })).kpis.totalHours).toBe(2);
  });

  it('convierte tiempoRealHoras de texto y trata NaN o negativos como 0', () => {
    const rows = [
      row('2026-11-02', '0.7'),
      row('2026-11-02', 'abc'),
      row('2026-11-02', '-2'),
      row('2026-11-02', undefined as unknown as string),
    ];
    const snapshot = calculator.build(rows, filter());
    expect(snapshot.kpis.totalHours).toBeCloseTo(0.7);
    expect(snapshot.rowCount).toBe(4);
  });

  it('clasifica la facturación solo por tipoHora', () => {
    const rows = [
      row('2026-11-02', '4', { tipoHora: 'Laboral', solicitud: 'Reuniones No Facturable' }),
      row('2026-11-02', '1', { tipoHora: 'Laboral Facturable' }),
      row('2026-11-03', '2', { tipoHora: 'Fabrica' }),
      row('2026-11-04', '3', { tipoHora: 'Laboral No Facturable' }),
    ];
    const snapshot = calculator.build(rows, filter());
    expect(snapshot.billing).toEqual([
      { label: 'Facturable', hours: 5, count: 2 },
      { label: 'Fábrica', hours: 2, count: 1 },
      { label: 'No facturable', hours: 3, count: 1 },
    ]);
    expect(snapshot.kpis.billableHours).toBe(5);
    expect(snapshot.kpis.billablePct).toBe(50);
    expect(snapshot.kpis.extraHours).toBe(2);
  });

  it('omite segmentos de facturación en 0 y devuelve 0 % sin horas', () => {
    expect(calculator.build([row('2026-11-02', '2')], filter()).billing).toEqual([
      { label: 'Facturable', hours: 2, count: 1 },
    ]);
    expect(calculator.build([], filter()).kpis.billablePct).toBe(0);
  });

  it('calcula la variación contra los mismos días del periodo anterior', () => {
    const rows = [row('2026-11-02', '6'), row('2026-10-30', '4'), row('2026-10-25', '9')];
    const { kpis } = calculator.build(rows, filter());
    expect(kpis.previousPeriodHours).toBe(4);
    expect(kpis.variationPct).toBe(50);
    expect(calculator.build([row('2026-11-02', '6')], filter()).kpis.variationPct).toBeNull();
  });

  it('cuenta clientes, días reportados y días/horas esperadas con la jornada configurada', () => {
    const rows = [
      row('2026-11-02', '4'),
      row('2026-11-02', '4'),
      row('2026-11-06', '8', {
        cliente: '3',
        solicitud_tiemposConsultores: undefined,
      }),
    ];
    const { kpis } = calculator.build(rows, filter());
    expect(kpis.clientCount).toBe(2);
    expect(kpis.reportedDays).toBe(2);
    expect(kpis.expectedDays).toBe(5);
    expect(kpis.expectedHours).toBe(44);
  });

  it('usa el campo numérico cliente si no hay nombre de cliente', () => {
    const rows = [
      row('2026-11-02', '1', {
        cliente: 15 as unknown as string,
        solicitud_tiemposConsultores: undefined,
      }),
    ];
    expect(calculator.build(rows, filter()).byClient).toEqual([
      { label: '15', hours: 1, count: 1 },
    ]);
  });

  it('rellena todos los días y meses del rango', () => {
    const snapshot = calculator.build([row('2026-11-03', '2')], filter({ from: '2026-10-30' }));
    expect(snapshot.daily.map((day) => day.date)).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ]);
    expect(snapshot.daily[4]).toMatchObject({ hours: 2, count: 1 });
    expect(snapshot.months.map((month) => [month.month, month.total, month.variationPct])).toEqual([
      ['2026-10', 0, null],
      ['2026-11', 2, null],
    ]);
  });

  it('calcula la variación mensual y el apilado por facturación', () => {
    const rows = [
      row('2026-10-10', '4'),
      row('2026-11-03', '4'),
      row('2026-11-04', '2', { tipoHora: 'Fabrica' }),
    ];
    const [october, november] = calculator.build(
      rows,
      filter({ from: '2026-10-01', to: '2026-11-30' }),
    ).months;
    expect(october.variationPct).toBeNull();
    expect(november).toMatchObject({ billable: 4, factory: 2, nonBillable: 0, total: 6 });
    expect(november.variationPct).toBe(50);
  });

  it('devuelve todas las solicitudes, de la más reciente a la más antigua, con hora sin relleno', () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      row(`2026-11-0${(index % 7) + 2}`, '1', { solicitud: `Solicitud ${index}` }),
    );
    rows.push(row('2026-11-08', '2', { solicitud: 'Tarde', HoraInicio: '14:00:00' }));
    rows.push(row('2026-11-08', '3', { solicitud: 'Temprano', HoraInicio: '9:15:00' }));
    rows.push(row('2026-11-08', '1', { solicitud: 'Tarde', HoraInicio: '7:00:00' }));

    const latest = calculator.build(rows, filter()).requests;
    expect(latest).toHaveLength(14);
    expect(latest[0]).toMatchObject({
      request: 'Tarde',
      hours: 3,
      count: 2,
      latestAt: '2026-11-08T14:00:00',
      estimatedHours: null,
      consumptionPct: null,
    });
    expect(latest[1]).toMatchObject({ request: 'Temprano', latestAt: '2026-11-08T09:15:00' });
    for (let index = 1; index < latest.length; index++)
      expect(latest[index - 1].latestAt >= latest[index].latestAt).toBe(true);
  });

  it('agrupa solicitudes por cliente + solicitud', () => {
    const rows = [
      row('2026-11-02', '1'),
      row('2026-11-03', '1', {
        cliente: '3',
        solicitud_tiemposConsultores: { solicitud_cliente: { nombre: 'Cliente Dos' } },
      }),
    ];
    expect(calculator.build(rows, filter()).requests).toHaveLength(2);
  });

  it('devuelve un snapshot vacío con rango inválido', () => {
    const snapshot = calculator.build([row('2026-11-02', '1')], filter({ from: '2026-11-09' }));
    expect(snapshot.rowCount).toBe(0);
    expect(snapshot.daily).toEqual([]);
    expect(calculator.build([row('2026-11-02', '1')], filter({ from: '' })).daily).toEqual([]);
  });

  it('expone opciones de filtro únicas y ordenadas', () => {
    const rows = [
      row('2026-11-02', '1', { tipoHora: 'Laboral' }),
      row('2026-11-02', '1', {
        tipoHora: 'Fabrica',
        cliente: '3',
        solicitud_tiemposConsultores: undefined,
      }),
      row('2026-11-02', '1', { tipoHora: '' }),
    ];
    expect(calculator.filterOptions(rows)).toEqual({
      clients: ['3', 'Cliente Uno'],
      hourTypes: ['Fabrica', 'Laboral', 'Sin tipo de hora'],
    });
  });

  it('calcula los rangos de los atajos hasta hoy', () => {
    expect(calculator.presetRange('7', '2026-11-17')).toEqual({
      from: '2026-11-11',
      to: '2026-11-17',
    });
    expect(calculator.presetRange('30', '2026-11-17')).toEqual({
      from: '2026-10-19',
      to: '2026-11-17',
    });
    expect(calculator.presetRange('3m', '2026-11-17')).toEqual({
      from: '2026-08-18',
      to: '2026-11-17',
    });
    expect(calculator.presetRange('6m', '2026-11-17')).toEqual({
      from: '2026-05-18',
      to: '2026-11-17',
    });
  });

  it('no desborda los atajos de meses cuando hoy es fin de mes', () => {
    expect(calculator.presetRange('3m', '2026-05-31').from).toBe('2026-03-01');
    expect(calculator.presetRange('6m', '2026-03-31').from).toBe('2025-10-01');
    expect(calculator.presetRange('3m', '2026-12-31').from).toBe('2026-10-01');
    expect(calculator.presetRange('6m', '2026-08-31').from).toBe('2026-03-01');
  });

  it('incluye el detalle por solicitud: rango, días activos y facturación', () => {
    const rows = [
      row('2026-11-03', '2', { solicitud: 'Detalle', HoraInicio: '9:00:00' }),
      row('2026-11-03', '1', { solicitud: 'Detalle', HoraInicio: '14:00:00', tipoHora: 'Fabrica' }),
      row('2026-11-05', '3', { solicitud: 'Detalle', HoraInicio: '7:30:00' }),
    ];
    const [detail] = calculator.build(rows, filter()).requests;
    expect(detail).toMatchObject({
      request: 'Detalle',
      hours: 6,
      count: 3,
      firstAt: '2026-11-03T09:00:00',
      latestAt: '2026-11-05T07:30:00',
      activeDays: 2,
    });
    expect(detail.billing.map((item) => [item.label, item.hours])).toEqual([
      ['Facturable', 5],
      ['Fábrica', 1],
    ]);
  });
});
