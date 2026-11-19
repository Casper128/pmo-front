import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';
import { setViewportWidth } from '@/test/viewport';
import { formatHours } from '../dashboard/dashboard-format';

const PATH = '/registros/dashboard';

const report = (day: string, hours: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: `RH-${day}-${hours}-${overrides.tipoHora ?? 'L'}-${overrides.cliente ?? 'A'}`,
  fechaInicio: `${day}T05:00:00.000Z`,
  HoraInicio: `${day}T08:00:00.000Z`,
  HoraFin: `${day}T09:00:00.000Z`,
  tiempoRealHoras: hours,
  tipoHora: 'Laboral',
  cliente: 'Cliente Alfa',
  solicitud: 'Gestión Uno',
  ...overrides,
});

// Hoy simulado: viernes 2026-09-18. Lun 14 cumple, mar 15 faltan 4.5 h, mié 16 excede, jue 17 sin reporte.
const ROWS: ManagementReport[] = [
  report('2026-09-14', '8.5'),
  report('2026-09-15', '4', { cliente: 'Cliente Beta' }),
  report('2026-09-16', '10'),
  report('2026-09-16', '3', { tipoHora: 'Fábrica' }),
  report('2026-09-11', '8', { tipoHora: 'No facturable', cliente: 'Cliente Beta' }),
];

async function setup(list: TimeManagementGateway['list'] = vi.fn(async () => ROWS), path = PATH) {
  const timeManagement = { list } as unknown as TimeManagementGateway;
  const ctx = createDraftsContainer({ overrides: { timeManagement } });
  const view = renderApp(ctx.container, path);
  return { ...ctx, ...view, app: ctx.container, list, user: userEvent.setup() };
}

const search = (router: { state: { location: { search: string } } }) => new URLSearchParams(router.state.location.search);

describe('TimeDashboardPage', () => {
  beforeEach(() => {
    setViewportWidth(1366);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 18, 12) });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('muestra skeleton mientras carga', async () => {
    await setup(vi.fn(() => new Promise<ManagementReport[]>(() => {})));
    expect(await screen.findByRole('status', { name: 'Consultando registros...' }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('error con reintento', async () => {
    const list = vi.fn().mockRejectedValue(new Error('Fallo de red'));
    const { user } = await setup(list);
    expect(await screen.findByText('Fallo de red', undefined, { timeout: 4000 })).toBeInTheDocument();
    list.mockResolvedValue(ROWS);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Horas reportadas')).toBeInTheDocument();
  });

  it('vacío: "Sin registros en el periodo" con restablecer', async () => {
    await setup(vi.fn(async () => []));
    expect(await screen.findByText('Sin registros en el periodo')).toBeInTheDocument();
    expect(screen.queryByText('Estimaciones pendientes')).not.toBeInTheDocument();
  });

  it('los KPIs coinciden con el calculator y "Horas extra" pasó a "Horas Fábrica"', async () => {
    const { app } = await setup();
    await screen.findByText('Horas reportadas');
    const { kpis } = app.dashboardCalculator.build(ROWS, { from: '2026-06-19', to: '2026-09-18', client: '', hourType: '' });
    const kpiCard = (label: string) => screen.getByText(label).closest('[data-slot="card"]') as HTMLElement;

    expect(kpis.totalHours).toBe(33.5);
    expect(within(kpiCard('Horas reportadas')).getByText(`${formatHours(kpis.totalHours)} h`)).toBeInTheDocument();
    expect(within(kpiCard('Facturable')).getByText(`${formatHours(kpis.billablePct)}%`)).toBeInTheDocument();
    expect(within(kpiCard('Clientes atendidos')).getByText(String(kpis.clientCount))).toBeInTheDocument();
    expect(within(kpiCard('Horas Fábrica')).getByText(`${formatHours(kpis.extraHours)} h`)).toBeInTheDocument();
    expect(within(kpiCard('Días reportados')).getByText(`${kpis.reportedDays} / ${kpis.expectedDays}`)).toBeInTheDocument();
    expect(screen.queryByText('Horas extra')).not.toBeInTheDocument();
    expect(screen.getByText('Estimaciones pendientes')).toBeInTheDocument();
  });

  it('alertas por día: faltante, exceso y sin reporte; el fin de semana vacío no aparece', async () => {
    await setup();
    const card = (await screen.findByText('Alertas por día')).closest('[data-slot="card"]') as HTMLElement;
    const rows = within(card).getAllByRole('row').slice(1);
    const text = (row: HTMLElement) => row.textContent ?? '';
    expect(rows.find((row) => text(row).includes('18 Sep'))).toHaveTextContent('Sin reporte');
    expect(rows.find((row) => text(row).includes('17 Sep'))).toHaveTextContent('Sin reporte');
    expect(rows.find((row) => text(row).includes('16 Sep'))).toHaveTextContent('Excede 8.5h');
    expect(rows.find((row) => text(row).includes('15 Sep'))).toHaveTextContent('Faltan 4.5h');
    expect(rows.some((row) => /Sáb|Dom/.test(text(row)))).toBe(false);
  });

  it('los presets y los selectores actualizan la URL y los valores', async () => {
    const { router, user } = await setup();
    await screen.findByText('Horas reportadas');
    expect(screen.getByRole('radio', { name: '3 meses' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: '7 días' }));
    expect(search(router).get('desde')).toBe('2026-09-12');
    expect(search(router).get('hasta')).toBe('2026-09-18');
    expect(screen.getByRole('radio', { name: '7 días' })).toBeChecked();
    expect(screen.getByText('4 de 5 registros incluidos.')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.click(await screen.findByRole('option', { name: 'Cliente Beta' }));
    expect(search(router).get('cliente')).toBe('Cliente Beta');
    expect(await screen.findByText('1 de 5 registros incluidos.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Restablecer filtros' }));
    expect(router.state.location.search).toBe('');
    expect(screen.getByRole('radio', { name: '3 meses' })).toBeChecked();
  });

  it('lee los filtros de la URL y avisa si el rango es inválido', async () => {
    await setup(undefined, `${PATH}?desde=2026-09-16&hasta=2026-09-10`);
    expect(await screen.findByRole('alert')).toHaveTextContent('La fecha inicial no puede ser posterior a la fecha final.');
    await waitFor(() => expect(screen.queryByText('Horas reportadas')).not.toBeInTheDocument());
  });
});
