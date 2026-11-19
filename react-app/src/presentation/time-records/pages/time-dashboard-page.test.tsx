import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { completeTemplate, createDraftsContainer, createFakeTemplates } from '@/test/fakes/drafts-fixtures';
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

async function setup(
  list: TimeManagementGateway['list'] = vi.fn(async () => ROWS),
  path = PATH,
  templates?: ReturnType<typeof createFakeTemplates>,
) {
  const timeManagement = { list } as unknown as TimeManagementGateway;
  const ctx = createDraftsContainer({ templates, overrides: { timeManagement } });
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
    expect(screen.queryByText('Horas por solicitud')).not.toBeInTheDocument();
  });

  it('los KPIs coinciden con el calculator y "Horas extra" pasó a "Horas Fábrica"', async () => {
    const { app } = await setup();
    await screen.findByText('Horas reportadas');
    const { kpis } = app.dashboardCalculator.build(ROWS, { from: '2026-06-19', to: '2026-09-18', client: '', hourType: '' });
    const kpiCard = (label: string) => within(screen.getByRole('region', { name: 'Indicadores del periodo' })).getByText(label).closest('[data-slot="card"]') as HTMLElement;

    expect(kpis.totalHours).toBe(33.5);
    expect(within(kpiCard('Horas reportadas')).getByText(`${formatHours(kpis.totalHours)} h`)).toBeInTheDocument();
    expect(within(kpiCard('Facturable')).getByText(`${formatHours(kpis.billablePct)}%`)).toBeInTheDocument();
    expect(within(kpiCard('Clientes atendidos')).getByText(String(kpis.clientCount))).toBeInTheDocument();
    expect(within(kpiCard('Horas Fábrica')).getByText(`${formatHours(kpis.extraHours)} h`)).toBeInTheDocument();
    expect(within(kpiCard('Días reportados')).getByText(`${kpis.reportedDays} / ${kpis.expectedDays}`)).toBeInTheDocument();
    expect(screen.queryByText('Horas extra')).not.toBeInTheDocument();
  });

  it('ya no muestra "Alertas por día"; "Horas por cliente" ocupa su lugar y "Horas por solicitud" va primero', async () => {
    await setup();
    const requestTitle = await screen.findByText('Horas por solicitud');
    expect(screen.queryByText('Alertas por día')).not.toBeInTheDocument();
    const clients = screen.getByText('Horas por cliente');
    const filters = screen.getByRole('radio', { name: '7 días' });
    expect(requestTitle.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(requestTitle.compareDocumentPosition(clients) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('horas por solicitud: usa los últimos 6 meses aunque el periodo filtrado esté vacío', async () => {
    await setup(vi.fn(async () => [report('2026-05-20', '2', { solicitud: 'Gestión Vieja' })]));
    expect(await screen.findByText('Sin registros en el periodo')).toBeInTheDocument();
    const card = screen.getByText('Horas por solicitud').closest('[data-slot="card"]') as HTMLElement;
    expect(within(card).getByRole('combobox', { name: 'Solicitud' })).toHaveTextContent('Gestión Vieja');
  });

  it('horas por solicitud: si fallan las plantillas avisa en vez de "Sin dato"', async () => {
    const templates = createFakeTemplates();
    templates.list.mockRejectedValue(new Error('Plantillas caídas'));
    await setup(undefined, PATH, templates);
    const card = (await screen.findByText('Horas por solicitud')).closest('[data-slot="card"]') as HTMLElement;
    expect(await within(card).findByText('No se pudieron cargar las estimaciones.')).toBeInTheDocument();
    expect(within(card).queryByText('Sin dato')).not.toBeInTheDocument();
    expect(within(card).queryByText('Defínelas en Plantillas')).not.toBeInTheDocument();
  });

  it('horas por solicitud: detalle de la seleccionada (sin estimación en la plantilla)', async () => {
    const { app, user } = await setup();
    const heading = await screen.findByText('Horas por solicitud');
    const card = heading.closest('[data-slot="card"]') as HTMLElement;
    const { requests } = app.dashboardCalculator.build(ROWS, { from: '2026-06-19', to: '2026-09-18', client: '', hourType: '' });
    expect(requests).toHaveLength(2);
    const metric = (label: string) => within(card).getByText(label).closest('[data-slot="card"]') as HTMLElement;

    const [first, second] = requests;
    expect(within(card).getByRole('combobox', { name: 'Solicitud' })).toHaveTextContent(first.client);
    expect(within(metric('Horas reales')).getByText(`${formatHours(first.hours)} h`)).toBeInTheDocument();
    expect(within(metric('Días con actividad')).getByText(String(first.activeDays))).toBeInTheDocument();
    expect(within(metric('Estimadas')).getByText('Sin dato')).toBeInTheDocument();
    expect(within(metric('Consumo')).getByText('Sin dato')).toBeInTheDocument();
    expect(within(card).getByText('Clasificación de horas')).toBeInTheDocument();
    for (const item of first.billing) expect(within(card).getByText(item.label)).toBeInTheDocument();

    await user.click(within(card).getByRole('combobox', { name: 'Solicitud' }));
    await user.click(await screen.findByRole('option', { name: `${second.request} · ${second.client}` }));
    expect(within(metric('Horas reales')).getByText(`${formatHours(second.hours)} h`)).toBeInTheDocument();
  });

  it('horas por solicitud: estimadas y consumo salen de la plantilla de la gestión', async () => {
    const withHours = { ...completeTemplate('G1', 'Gestión Uno'), values: { ...completeTemplate('G1', 'Gestión Uno').values, horasEstimadas: '50' } };
    await setup(undefined, PATH, createFakeTemplates([withHours as ReturnType<typeof completeTemplate>]));
    const card = (await screen.findByText('Horas por solicitud')).closest('[data-slot="card"]') as HTMLElement;
    const metric = (label: string) => within(card).getByText(label).closest('[data-slot="card"]') as HTMLElement;
    await waitFor(() => expect(within(metric('Estimadas')).getByText('50 h')).toBeInTheDocument());
    expect(within(metric('Consumo')).getByText(/%$/)).toBeInTheDocument();
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
