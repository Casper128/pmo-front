import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { FakeAuthGateway } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';
import { setViewportWidth } from '@/test/viewport';
import { THEME_STORAGE_KEY } from '@presentation/shell/theme-context';

const PROFILE_USER = { name: 'Ana Prueba', email: 'ana@example.test', role: 'Consultor', position: 'Analista', area: 'PMO' };

const report = (day: string, hours: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: `RH-${day}-${hours}-${overrides.solicitud ?? 'A'}`,
  fechaInicio: `${day}T05:00:00.000Z`,
  HoraInicio: `${day}T08:00:00.000Z`,
  HoraFin: `${day}T09:00:00.000Z`,
  tiempoRealHoras: hours,
  tipoHora: 'Laboral',
  cliente: 'Cliente Alfa',
  solicitud: 'Gestión Uno',
  ...overrides,
});

// Hoy simulado: viernes 2026-09-18. En septiembre: 8,5 + 4 h en 2 registros; agosto no cuenta.
const ROWS = [
  report('2026-09-14', '8.5'),
  report('2026-09-15', '4', { solicitud: 'Gestión Dos', cliente: 'Cliente Beta' }),
  report('2026-08-20', '8'),
];

function setup(list: TimeManagementGateway['list'] = vi.fn(async () => ROWS)) {
  const auth = new FakeAuthGateway({ user: PROFILE_USER });
  const ctx = createDraftsContainer({ overrides: { auth, timeManagement: { list } as unknown as TimeManagementGateway } });
  const view = renderApp(ctx.container, '/perfil');
  return { ...ctx, ...view, auth, user: userEvent.setup() };
}

describe('ProfilePage', () => {
  beforeEach(() => {
    setViewportWidth(1366);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 8, 18, 12) });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('muestra los datos de la sesión y el resumen del mes', async () => {
    setup();
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    const identity = screen.getByRole('region', { name: 'Datos de la sesión' });
    expect(within(identity).getByRole('heading', { name: 'Ana Prueba' })).toBeInTheDocument();
    expect(within(identity).getByText('Consultor')).toBeInTheDocument();
    expect(within(identity).getByText('ana@example.test')).toBeInTheDocument();
    expect(within(identity).getByText('AP')).toBeInTheDocument();

    const summary = await screen.findByRole('region', { name: 'Resumen del mes' });
    const card = (label: string) => within(summary).getByText(label).closest('[data-slot="card"]') as HTMLElement;
    expect(within(card('Horas del mes')).getByText('12,5 h')).toBeInTheDocument();
    expect(within(card('Registros del mes')).getByText('2')).toBeInTheDocument();
    expect(within(card('Último reporte')).getByText(/Gestión Dos · Cliente Beta/)).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Cumplimiento de jornada' })).toBeInTheDocument();
  });

  it('muestra skeleton mientras carga', async () => {
    setup(vi.fn(() => new Promise<ManagementReport[]>(() => {})));
    expect(await screen.findByRole('status', { name: 'Consultando tu resumen...' }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('sin reportes muestra el estado vacío', async () => {
    setup(vi.fn(async () => []));
    expect(await screen.findByText('Aún no tienes reportes')).toBeInTheDocument();
  });

  it('error con reintento', async () => {
    const list = vi.fn().mockRejectedValue(new Error('Falla de red'));
    const { user } = setup(list);
    expect(await screen.findByText('No fue posible consultar tu resumen', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Falla de red')).toBeInTheDocument();
    list.mockResolvedValue(ROWS);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('region', { name: 'Resumen del mes' })).toBeInTheDocument();
  });

  it('preferencias: cambia el tema y muestra la meta diaria en solo lectura', async () => {
    const { user } = setup();
    const prefs = await screen.findByRole('region', { name: 'Preferencias' });
    expect(within(prefs).getByText(/Lun-jue/)).toBeInTheDocument();
    await user.click(within(prefs).getByRole('radio', { name: 'Oscuro' }));
    await waitFor(() => expect(sessionStorage.getItem(THEME_STORAGE_KEY)).toBe('dark'));
  });

  it('cerrar sesión limpia la sesión', async () => {
    const { user, auth } = setup();
    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }));
    await waitFor(() => expect(auth.isLoggedIn()).toBe(false));
  });

  it('se llega desde el menú de usuario del header', async () => {
    const { user, router } = setup();
    await screen.findByRole('heading', { name: 'Mi perfil' });
    await router.navigate('/registros/dashboard');
    await user.click(await screen.findByRole('button', { name: /Menú de usuario/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Mi perfil' }));
    expect(await screen.findByRole('heading', { name: 'Mi perfil' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/perfil');
  });
});
