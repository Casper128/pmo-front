import { describe, expect, it } from 'vitest';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { breakdownStatistics, cleanDimension, filterStatisticsReports } from './statistics-breakdown';

const report = (overrides: Partial<ManagementReport>): ManagementReport => ({
  fechaInicio: '2026-09-10T05:00:00.000Z',
  tiempoRealHoras: '1',
  cliente: 'Alfa',
  tipoHora: 'Laboral',
  ...overrides,
});

describe('cleanDimension', () => {
  it('unifica variantes, acrónimos y vacíos', () => {
    expect(cleanDimension('reuniones', 'x')).toBe('Reunión');
    expect(cleanDimension('sap_mm', 'x')).toBe('SAP MM');
    expect(cleanDimension('Soporte DE usuarios', 'x')).toBe('Soporte de Usuarios');
    expect(cleanDimension('N/A', 'Sin módulo')).toBe('Sin módulo');
    expect(cleanDimension(undefined, 'Sin módulo')).toBe('Sin módulo');
  });
});

describe('breakdownStatistics', () => {
  const rows = [
    report({ modulo: 'MM', tiempoRealHoras: '3' }),
    report({ modulo: 'mm', tiempoRealHoras: 1 }),
    report({ tecnologia: 'ABAP', tiempoRealHoras: '4' }),
    report({ tiempoRealHoras: 'x' }),
  ];

  it('agrupa por módulo (o tecnología) con horas, cantidad y % ordenados por horas', () => {
    const groups = breakdownStatistics(rows, 'module');
    expect(groups.map((g) => [g.label, g.hours, g.count])).toEqual([
      ['ABAP', 4, 1],
      ['MM', 4, 2],
      ['Sin módulo', 0, 1],
    ]);
    expect(groups[1].share).toBe(50);
    expect(groups.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(100);
  });

  it('actividad, gestión y categoría usan sus propios campos y etiquetas por defecto', () => {
    const data = [
      report({ tipoActividad: 'Desarrollo', categoria: 'Mejora', gestionDemanda: 'G-1' }),
      report({ solicitud_tiemposConsultores: { nombreGestion: 'Soporte' }, solicitud: 'DO-1' }),
    ];
    expect(breakdownStatistics(data, 'activity').map((g) => g.label).sort()).toEqual(['Desarrollo', 'Sin actividad']);
    expect(breakdownStatistics(data, 'management').map((g) => g.label).sort()).toEqual(['G 1', 'Soporte']);
    expect(breakdownStatistics(data, 'category').map((g) => g.label).sort()).toEqual(['Mejora', 'Sin categoría']);
  });

  it('sin registros devuelve lista vacía', () => {
    expect(breakdownStatistics([], 'module')).toEqual([]);
  });
});

describe('filterStatisticsReports', () => {
  const rows = [
    report({}),
    report({ fechaInicio: '2026-08-01T05:00:00.000Z' }),
    report({ cliente: 'Beta', tipoHora: 'Fábrica' }),
    report({ fechaInicio: '', HoraInicio: '' }),
  ];
  const base = { from: '2026-09-01', to: '2026-09-30', client: '', hourType: '' };

  it('filtra por rango, cliente y tipo de hora, y descarta filas sin fecha', () => {
    expect(filterStatisticsReports(rows, base)).toHaveLength(2);
    expect(filterStatisticsReports(rows, { ...base, client: 'Beta' })).toHaveLength(1);
    expect(filterStatisticsReports(rows, { ...base, hourType: 'Laboral' })).toHaveLength(1);
  });
});
