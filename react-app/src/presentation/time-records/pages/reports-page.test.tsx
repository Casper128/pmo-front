import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import type { DeleteRequestBody, TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';
import { setViewportWidth } from '@/test/viewport';
import { PENDING_RECORDS_STORAGE_KEY } from '../drafts/pending-records-storage';

const PATH = '/registros/reportes';

const report = (id: string, day: string | null, start: string, end: string, hours: string, overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: id,
  ...(day ? { fechaInicio: `${day}T17:00:00.000Z`, HoraInicio: `${day}T${start}:00.000Z`, HoraFin: `${day}T${end}:00.000Z` } : {}),
  tiempoRealHoras: hours,
  tipoHora: 'Laboral',
  descripcionActividad: `Actividad ${id}`,
  solicitud: 'G-1',
  solicitud_tiemposConsultores: { nombreGestion: 'Soporte nómina', solicitud_cliente: { nombre: 'Cliente Alfa' } },
  ...overrides,
});

// Hoy simulado: viernes 2026-09-18 (Colombia). Jornada: lun-jue 8,5 h; viernes 8 h.
const ROWS: ManagementReport[] = [
  report('RH-1', '2026-09-18', '08:00', '12:00', '4'),
  report('RH-2', '2026-09-18', '13:00', '17:00', '4'),
  report('RH-3', '2026-09-16', '08:00', '12:00', '4'),
  report('RH-4', '2026-09-16', '13:00', '15:00', '2'),
  report('RH-5', '2026-09-16', '15:00', '18:00', '3', { tipoHora: 'Fábrica' }),
  report('RH-6', '2026-09-15', '07:00', '18:00', '11', {
    solicitud_tiemposConsultores: { nombreGestion: 'Migración datos', solicitud_cliente: { nombre: 'Cliente Beta' } },
  }),
  report('RH-7', null, '', '', '1'),
  report('RH-8', '2026-08-20', '08:00', '09:00', '1'),
];

const request = (identifier: string, status: ManagementDeleteRequest['status'], reviewNote?: string): ManagementDeleteRequest => ({
  id: `req-${identifier}`,
  identifier,
  requesterKey: 'consultor@example.test',
  requesterEmail: 'consultor@example.test',
  auditorEmail: 'auditor@example.test',
  report: {},
  status,
  requestedAt: '2026-09-17T10:00:00.000Z',
  reviewNote,
});

interface SetupOptions {
  readonly path?: string;
  readonly list?: TimeManagementGateway['list'];
  readonly requests?: ManagementDeleteRequest[] | Error;
  readonly requestDelete?: TimeManagementGateway['requestDelete'];
  readonly update?: TimeManagementGateway['update'];
  readonly technicalEmails?: string[];
}

async function setup({ path = PATH, list = vi.fn(async () => ROWS), requests = [], requestDelete, update, technicalEmails = [] }: SetupOptions = {}) {
  const timeManagement = {
    list,
    update: update ?? vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    requestDelete: requestDelete ?? vi.fn(async () => ({ duplicated: false })),
    technicalDelete: vi.fn(async () => undefined),
  } as unknown as TimeManagementGateway;
  const listMine = vi.fn(async () => {
    if (requests instanceof Error) throw requests;
    return requests;
  });
  const deleteRequests = { listMine } as unknown as ManagementDeleteRequestGateway;
  const ctx = createDraftsContainer({
    parameters: { deletionSettings: { auditorEmail: 'auditor@example.test', technicalDeleteEmails: technicalEmails } },
    overrides: { timeManagement, deleteRequests },
  });
  const view = renderApp(ctx.container, path);
  return { ...ctx, ...view, timeManagement, listMine, list, user: userEvent.setup() };
}

const day = (name: string) => screen.findByRole('region', { name });
const openMenu = async (user: ReturnType<typeof userEvent.setup>, id: string) =>
  user.click(await screen.findByRole('button', { name: `Acciones del reporte ${id}` }));
const drafts = () => JSON.parse(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY) ?? '[]') as { fecha: string; horaIni: string }[];

describe('ReportsPage', () => {
  beforeEach(() => {
    setViewportWidth(1366);
    // 12:00 en Colombia (17:00Z): el día de hoy es el mismo en UTC, Bogotá y Tokio.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-18T17:00:00Z') });
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('rango inicial: mes actual; los reportes de otro mes no aparecen', async () => {
    const { router } = await setup();
    await day('Vie 18 Sep 2026');
    expect(screen.getByRole('radio', { name: 'Mes' })).toBeChecked();
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('region', { name: 'Jue 20 Ago 2026' })).not.toBeInTheDocument();
    expect(screen.getByText(/7 registros en 3 días/)).toBeInTheDocument();
  });

  it('agrupa por día con el total frente a la jornada y marca Fábrica como "no computa"', async () => {
    await setup();
    expect(within(await day('Vie 18 Sep 2026')).getByText('Jornada completa')).toBeInTheDocument();
    const wednesday = await day('Mié 16 Sep 2026');
    expect(within(wednesday).getByText('Faltan 2,5 h')).toBeInTheDocument();
    expect(within(wednesday).getByText('6 h de 8,5 h')).toBeInTheDocument();
    expect(within(wednesday).getByText('no computa')).toBeInTheDocument();
    expect(within(await day('Mar 15 Sep 2026')).getByText('Excede 2,5 h')).toBeInTheDocument();
  });

  it('el grupo "Sin fecha" es visible aunque el rango no lo incluya y no suma en los totales', async () => {
    await setup();
    const group = await day('Sin fecha');
    expect(within(group).getByText('Sin horario')).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'Duplicar día' })).not.toBeInTheDocument();
    expect(screen.getByText('25 h computables')).toBeInTheDocument();
    expect(screen.getByText(/3 h que no computan/)).toBeInTheDocument();
  });

  it('busca por nombre de gestión sin tildes, con debounce, y lo guarda en la URL', async () => {
    const { router, user } = await setup();
    await day('Vie 18 Sep 2026');
    await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'migracion');
    await waitFor(() => expect(router.state.location.search).toBe('?q=migracion'), { timeout: 3000 });
    expect(screen.getByRole('region', { name: 'Mar 15 Sep 2026' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Vie 18 Sep 2026' })).not.toBeInTheDocument(), { timeout: 3000 });

    await user.clear(screen.getByRole('searchbox', { name: /Buscar/ }));
    await user.type(screen.getByRole('searchbox', { name: /Buscar/ }), 'zzz');
    expect(await screen.findByText('Sin resultados', {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(await day('Vie 18 Sep 2026')).toBeInTheDocument();
  });

  it('Desde/Hasta siempre visibles; editar una fecha pasa a Personalizado y "Últimos 6 meses" ajusta el rango', async () => {
    const { router, user } = await setup();
    await day('Vie 18 Sep 2026');
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Hoy' }));
    expect(router.state.location.search).toBe('?preset=today');
    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Últimos 6 meses' }));
    expect(router.state.location.search).toBe('?preset=6m');
    await user.click(screen.getByRole('radio', { name: 'Personalizado' }));
    expect(new URLSearchParams(router.state.location.search).get('from')).toBe('2026-03-19');
  });

  it('en móvil usa tarjetas en lugar de tabla', async () => {
    setViewportWidth(360);
    await setup();
    const card = await day('Vie 18 Sep 2026');
    expect(within(card).queryByRole('table')).not.toBeInTheDocument();
    expect(within(card).getAllByRole('listitem')).toHaveLength(2);
  });

  describe('duplicar', () => {
    it('un registro: dos clics seguidos crean un solo borrador, avisa del solape y luego bloquea la huella', async () => {
      const { user } = await setup();
      await openMenu(user, 'RH-1');
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicar registro' }));
      const dialog = await screen.findByRole('dialog', { name: 'Duplicar registro' });
      expect(within(dialog).getByText(/se cruza con un reporte ya enviado/)).toBeInTheDocument();
      expect(within(dialog).getByText(/El día destino quedaría en 12 h/)).toBeInTheDocument();

      await user.dblClick(within(dialog).getByRole('button', { name: 'Crear de todos modos' }));
      await waitFor(() => expect(drafts()).toHaveLength(1));
      expect(drafts()[0]).toMatchObject({ fecha: '2026-09-18', horaIni: '08:00' });
      expect(await screen.findByRole('button', { name: 'Ir a Reportar' })).toBeInTheDocument();

      await openMenu(user, 'RH-1');
      await user.click(await screen.findByRole('menuitem', { name: 'Duplicar registro' }));
      const again = await screen.findByRole('dialog', { name: 'Duplicar registro' });
      expect(within(again).getByText(/Ya está en borradores/)).toBeInTheDocument();
      expect(within(again).getByRole('button', { name: /Crear/ })).toBeDisabled();
      expect(drafts()).toHaveLength(1);
    });

    it('un día: una sola llamada con todos los registros y "Solapa" donde cruza lo enviado', async () => {
      const { user } = await setup();
      const wednesday = await day('Mié 16 Sep 2026');
      await user.click(within(wednesday).getByRole('button', { name: 'Duplicar día' }));
      const dialog = await screen.findByRole('dialog', { name: /Duplicar el Mié 16 Sep 2026/ });
      expect(within(dialog).getAllByText('Solapa').length).toBeGreaterThan(0);
      expect(within(dialog).getByText('3 h · no computa')).toBeInTheDocument();

      await user.dblClick(within(dialog).getByRole('button', { name: 'Crear de todos modos' }));
      await waitFor(() => expect(drafts()).toHaveLength(3));
      expect(drafts().every((draft) => draft.fecha === '2026-09-18')).toBe(true);
    });

    it('un día: con destino igual al origen no se puede crear', async () => {
      const { user } = await setup();
      const today = await day('Vie 18 Sep 2026');
      await user.click(within(today).getByRole('button', { name: 'Duplicar día' }));
      const dialog = await screen.findByRole('dialog', { name: /Duplicar el Vie 18 Sep 2026/ });
      expect(within(dialog).getByText('Elige una fecha distinta a la del día original.')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: /Crear/ })).toBeDisabled();
      expect(drafts()).toHaveLength(0);
    });
  });

  describe('eliminar', () => {
    it('un reporte de hoy se elimina directo', async () => {
      const { user, timeManagement } = await setup();
      await openMenu(user, 'RH-1');
      await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar reporte' });
      await user.click(within(dialog).getByRole('button', { name: 'Eliminar reporte' }));
      await waitFor(() => expect(timeManagement.delete).toHaveBeenCalledWith('RH-1'));
      expect(timeManagement.requestDelete).not.toHaveBeenCalled();
      expect(screen.queryByText('Clave técnica (opcional)')).not.toBeInTheDocument();
    });

    it('un reporte de otro día envía una solicitud a auditoría y avisa si ya existía', async () => {
      const requestDelete = vi.fn(async (_body: DeleteRequestBody) => ({ duplicated: true }));
      const { user, timeManagement } = await setup({ requestDelete });
      await openMenu(user, 'RH-6');
      await user.click(await screen.findByRole('menuitem', { name: 'Solicitar eliminación' }));
      const dialog = await screen.findByRole('alertdialog', { name: 'Solicitar eliminación a auditoría' });
      await user.click(within(dialog).getByRole('button', { name: 'Enviar solicitud' }));
      await waitFor(() => expect(requestDelete).toHaveBeenCalledOnce());
      expect(requestDelete.mock.calls[0]?.[0]).toMatchObject({ identifier: 'RH-6', auditorEmail: 'auditor@example.test' });
      expect(timeManagement.delete).not.toHaveBeenCalled();
      expect(await screen.findByText('Ya existe una solicitud pendiente para este reporte.')).toBeInTheDocument();
    });

    it('la clave técnica solo aparece para quien puede usarla', async () => {
      const { user, timeManagement } = await setup({ technicalEmails: ['consultor@example.test'] });
      await openMenu(user, 'RH-6');
      await user.click(await screen.findByRole('menuitem', { name: 'Solicitar eliminación' }));
      const dialog = await screen.findByRole('alertdialog');
      await user.type(within(dialog).getByLabelText('Clave técnica (opcional)'), 'clave-de-prueba');
      await user.click(within(dialog).getByRole('button', { name: 'Eliminar reporte' }));
      await waitFor(() =>
        expect(timeManagement.technicalDelete).toHaveBeenCalledWith({ identifier: 'RH-6', technicalKey: 'clave-de-prueba', requesterEmail: 'consultor@example.test' }),
      );
    });
  });

  describe('estado de las solicitudes', () => {
    it('pendiente deshabilita eliminar; rechazada muestra la nota y permite pedir de nuevo', async () => {
      const { user } = await setup({ requests: [request('RH-2', 'pending'), request('RH-6', 'rejected', 'Falta el soporte')] });
      const today = await day('Vie 18 Sep 2026');
      expect(await within(today).findByText('Eliminación solicitada')).toBeInTheDocument();
      await openMenu(user, 'RH-2');
      expect(await screen.findByRole('menuitem', { name: 'Eliminación ya solicitada' })).toHaveAttribute('aria-disabled', 'true');
      await user.keyboard('{Escape}');

      const rejected = await within(await day('Mar 15 Sep 2026')).findByText('Eliminación rechazada');
      await user.hover(rejected);
      expect((await screen.findAllByText('Falta el soporte')).length).toBeGreaterThan(0);
      await openMenu(user, 'RH-6');
      expect(await screen.findByRole('menuitem', { name: 'Solicitar eliminación' })).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('si falla listMine avisa con reintento, sin badges y la lista sigue funcionando', async () => {
      const { listMine, user } = await setup({ requests: new Error('Sin servicio') });
      await day('Vie 18 Sep 2026');
      expect(await screen.findByText(/No se pudo consultar el estado de tus solicitudes/)).toBeInTheDocument();
      expect(screen.queryByText('Eliminación solicitada')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Acciones del reporte RH-1' })).toBeEnabled();
      const calls = listMine.mock.calls.length;
      await user.click(screen.getByRole('button', { name: 'Reintentar' }));
      await waitFor(() => expect(listMine.mock.calls.length).toBeGreaterThan(calls));
    });
  });

  describe('detalle y edición', () => {
    it('Ver abre el panel con el detalle y deja el reporte en la URL', async () => {
      const { router, user } = await setup();
      await openMenu(user, 'RH-6');
      await user.click(await screen.findByRole('menuitem', { name: 'Ver detalle' }));
      const sheet = await screen.findByRole('dialog', { name: 'Detalle del reporte' });
      expect(within(sheet).getByText('Actividad RH-6')).toBeInTheDocument();
      expect(router.state.location.search).toBe('?report=RH-6');
    });

    it('guarda con el cuerpo esperado, invalida la lista y cierra el panel', async () => {
      const update = vi.fn(async () => undefined);
      const list = vi.fn(async () => ROWS);
      const { user, router } = await setup({ path: `${PATH}?report=RH-1&mode=edit`, update, list });
      const description = await screen.findByLabelText('Descripción');
      await user.clear(description);
      await user.type(description, 'Nueva descripción');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      await waitFor(() => expect(update).toHaveBeenCalledOnce());
      expect(update).toHaveBeenCalledWith(
        'RH-1',
        expect.objectContaining({ HoraInicio: '2026-09-18T08:00:00.000Z', HoraFin: '2026-09-18T12:00:00.000Z', tiempoRealHoras: '4.0', descripcionActividad: 'Nueva descripción' }),
      );
      await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(router.state.location.search).toBe(''));
    });

    it('muestra el mensaje del servidor si el guardado falla y conserva el formulario', async () => {
      const update = vi.fn().mockRejectedValue({ status: 400, message: 'Http failure', error: { error: 'PMO rechazó el horario' } });
      const { user } = await setup({ path: `${PATH}?report=RH-1&mode=edit`, update });
      const description = await screen.findByLabelText('Descripción');
      await user.type(description, ' extra');
      await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
      expect(await screen.findByText('PMO rechazó el horario')).toBeInTheDocument();
      expect(screen.getByLabelText('Descripción')).toHaveValue('Actividad RH-1 extra');
    });

    it('bloquea el guardado si el horario se cruza con otro reporte del día', async () => {
      const { user } = await setup({ path: `${PATH}?report=RH-2&mode=edit` });
      const start = await screen.findByLabelText('Hora inicio');
      await user.clear(start);
      await user.type(start, '1100');
      expect(await screen.findByText(/se cruza con otro reporte enviado/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Guardar/ })).toBeDisabled();
    });
  });

  it('error de carga con reintento', async () => {
    const list = vi.fn().mockRejectedValue(new Error('Fallo de red'));
    const { user } = await setup({ list });
    expect(await screen.findByText('Fallo de red', undefined, { timeout: 4000 })).toBeInTheDocument();
    list.mockResolvedValue(ROWS);
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await day('Vie 18 Sep 2026')).toBeInTheDocument();
  });

  it('muestra el skeleton mientras carga y el vacío sin reportes', async () => {
    await setup({ list: vi.fn(() => new Promise<ManagementReport[]>(() => {})) });
    expect(await screen.findByRole('status', { name: 'Consultando reportes...' }, { timeout: 4000 })).toBeInTheDocument();
  });

  it('sin reportes enviados explica qué pasa', async () => {
    await setup({ list: vi.fn(async () => []) });
    expect(await screen.findByText('Aún no tienes reportes enviados')).toBeInTheDocument();
  });
});
