import { consolidatedPresetRange, filterConsolidated, summarizeDaily, summarizeTotals, type ConsolidatedFilter, type ConsolidatedRow } from './consolidated-report';

const row = (overrides: Partial<ConsolidatedRow>): ConsolidatedRow => ({
  identificador: 'ID', solicitud: '', categoria: '', cliente: 'Cliente Alfa', consultor: 'Ana Prueba', descripcion: '', horas: 1,
  tipoHora: 'Laboral', fecha: '2026-09-18', funcional: '', gestion: '', modulo: '', tecnologia: '', tipoActividad: '', proyecto: '',
  horaInicio: '', horaFin: '', ...overrides,
});
const none: ConsolidatedFilter = { consultant: '', client: '', day: '', hourType: 'all', q: '' };
const always = () => true;

describe('consolidatedPresetRange', () => {
  it('termina hoy y empieza el día siguiente al de hace N meses', () => {
    expect(consolidatedPresetRange('day', '2026-09-18')).toEqual({ from: '2026-09-18', to: '2026-09-18' });
    expect(consolidatedPresetRange('1m', '2026-09-18')).toEqual({ from: '2026-08-19', to: '2026-09-18' });
    expect(consolidatedPresetRange('6m', '2026-09-18')).toEqual({ from: '2026-03-19', to: '2026-09-18' });
  });

  it('recorta al último día del mes cuando el mes anterior es más corto', () => {
    expect(consolidatedPresetRange('1m', '2026-03-31')).toEqual({ from: '2026-03-01', to: '2026-03-31' });
  });
});

describe('filterConsolidated', () => {
  const rows = [
    row({ identificador: 'A', consultor: 'Ana Prueba', fecha: '2026-09-17', horaInicio: '08:00', gestion: 'Migración datos' }),
    row({ identificador: 'B', consultor: 'Luis Ejemplo', cliente: 'Cliente Beta', fecha: '2026-09-18', horaInicio: '09:00', tipoHora: 'Fábrica' }),
    row({ identificador: 'C', consultor: 'Ana Prueba', fecha: '2026-09-18', horaInicio: '13:00' }),
  ];

  it('ordena de la más reciente a la más antigua', () => {
    expect(filterConsolidated(rows, none, always).map((item) => item.identificador)).toEqual(['C', 'B', 'A']);
  });

  it('combina consultor, cliente, día y clasificación de hora', () => {
    expect(filterConsolidated(rows, { ...none, consultant: 'Ana Prueba', day: '2026-09-18' }, always).map((item) => item.identificador)).toEqual(['C']);
    expect(filterConsolidated(rows, { ...none, client: 'Cliente Beta' }, always).map((item) => item.identificador)).toEqual(['B']);
    const factory = (tipoHora: string) => tipoHora === 'Fábrica';
    expect(filterConsolidated(rows, { ...none, hourType: 'factory' }, factory).map((item) => item.identificador)).toEqual(['B']);
  });

  it('busca sin tildes ni mayúsculas', () => {
    expect(filterConsolidated(rows, { ...none, q: 'MIGRACION' }, always).map((item) => item.identificador)).toEqual(['A']);
  });
});

describe('resúmenes', () => {
  const rows = [
    row({ cliente: 'Cliente Beta', horas: 3, solicitud: 'S-1' }),
    row({ cliente: 'Cliente Alfa', horas: 4, gestion: 'G-1' }),
    row({ cliente: 'Cliente Alfa', horas: 2, solicitud: 'S-1', fecha: '2026-09-17' }),
    row({ consultor: 'Luis Ejemplo', horas: 1, fecha: '2026-09-18' }),
  ];

  it('agrupa por día y consultor con clientes juntos y solicitudes distintas', () => {
    expect(summarizeDaily(rows)).toEqual([
      { fecha: '2026-09-18', consultor: 'Ana Prueba', clientes: 'Cliente Alfa · Cliente Beta', horas: 7, registros: 2, solicitudes: 2 },
      { fecha: '2026-09-18', consultor: 'Luis Ejemplo', clientes: 'Cliente Alfa', horas: 1, registros: 1, solicitudes: 0 },
      { fecha: '2026-09-17', consultor: 'Ana Prueba', clientes: 'Cliente Alfa', horas: 2, registros: 1, solicitudes: 1 },
    ]);
  });

  it('totaliza horas, días, clientes y registros', () => {
    expect(summarizeTotals(rows)).toEqual({ hours: 10, days: 2, clients: 2, records: 4 });
  });
});
