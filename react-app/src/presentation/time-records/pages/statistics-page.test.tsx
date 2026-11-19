import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';
import { setViewportWidth } from '@/test/viewport';

const PATH = '/registros/estadisticas';

const report = (hours: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: `RH-${hours}-${overrides.modulo ?? 'x'}`,
  fechaInicio: '2026-09-14T05:00:00.000Z',
  HoraInicio: '2026-09-14T08:00:00.000Z',
  tiempoRealHoras: hours,
  tipoHora: 'Laboral',
  cliente: 'Cliente Alfa',
  solicitud: 'Gestión Uno',
  modulo: 'MM',
  tipoActividad: 'Desarrollo',
  categoria: 'Mejora',
  ...overrides,
});

const ROWS = [report('6'), report('2', { modulo: 'SD', tipoActividad: 'Pruebas' })];

function setup(list: TimeManagementGateway['list'] = vi.fn(async () => ROWS)) {
  const ctx = createDraftsContainer({ overrides: { timeManagement: { list } as unknown as TimeManagementGateway } });
  renderApp(ctx.container, PATH);
  return userEvent.setup();
}

describe('StatisticsPage', () => {
  beforeEach(() => {
    setViewportWidth(1366);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 18, 12) });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('muestra horas, registros y % por módulo, actividad, gestión y categoría', async () => {
    setup();
    const table = await screen.findByRole('table', { name: 'Horas por módulo: detalle' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('MM');
    expect(rows[0]).toHaveTextContent('6');
    expect(rows[0]).toHaveTextContent('75 %');
    expect(rows[1]).toHaveTextContent('SD');
    for (const name of ['Horas por actividad', 'Horas por gestión', 'Horas por categoría']) {
      expect(screen.getByRole('table', { name: `${name}: detalle` })).toBeInTheDocument();
    }
    expect(screen.getByText('8 h')).toBeInTheDocument();
  });

  it('sin registros muestra el estado vacío', async () => {
    setup(vi.fn(async () => []));
    expect(await screen.findByText('Sin registros en el periodo')).toBeInTheDocument();
  });

  it('error con reintento', async () => {
    const list = vi.fn().mockRejectedValue(new Error('Fallo de red'));
    const user = setup(list);
    expect(await screen.findByText('Fallo de red', undefined, { timeout: 4000 })).toBeInTheDocument();
    list.mockResolvedValue(ROWS);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('table', { name: 'Horas por módulo: detalle' })).toBeInTheDocument();
  });
});
