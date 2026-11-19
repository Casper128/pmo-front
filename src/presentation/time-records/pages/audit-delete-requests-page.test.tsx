import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { testUser } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';

const PATH = '/auditoria/eliminaciones';

const request = (id: string, overrides: Partial<ManagementDeleteRequest> = {}): ManagementDeleteRequest => ({
  id,
  identifier: `RH-${id}`,
  requesterKey: 'consultor.uno@example.test',
  requesterEmail: 'consultor.uno@example.test',
  auditorEmail: testUser.email,
  report: {
    solicitud: `Gestión ${id}`,
    cliente: 'Cliente Alfa',
    fechaInicio: '2026-09-15T05:00:00.000Z',
    tiempoRealHoras: '2.5',
    descripcionActividad: `Actividad ${id}`,
    tipoHora: 'Laboral',
    HoraInicio: '2026-09-15T08:00:00.000Z',
    HoraFin: '2026-09-15T10:30:00.000Z',
  },
  status: 'pending',
  requestedAt: `2026-09-1${id}T10:00:00.000Z`,
  ...overrides,
});

interface SetupOptions {
  readonly requests?: ManagementDeleteRequest[] | Error;
  readonly approve?: ManagementDeleteRequestGateway['approve'];
  readonly reject?: ManagementDeleteRequestGateway['reject'];
}

async function setup({ requests = [request('1'), request('2')], approve, reject }: SetupOptions = {}) {
  const list = vi.fn(async () => {
    if (requests instanceof Error) throw requests;
    return requests;
  });
  const approveFn = approve ?? vi.fn(async (id: string) => request(id, { status: 'approved' }));
  const rejectFn = reject ?? vi.fn(async (id: string) => request(id, { status: 'rejected' }));
  const deleteRequests = { list, approve: approveFn, reject: rejectFn } as unknown as ManagementDeleteRequestGateway;
  const timeManagement = { delete: vi.fn() } as unknown as TimeManagementGateway;
  const ctx = createDraftsContainer({
    parameters: { deletionSettings: { auditorEmail: testUser.email, technicalDeleteEmails: [] } },
    overrides: { deleteRequests, timeManagement },
  });
  const view = renderApp(ctx.container, PATH);
  await screen.findByRole('heading', { name: 'Solicitudes de eliminación' });
  return { ...ctx, ...view, list, approve: approveFn, reject: rejectFn, timeManagement, user: userEvent.setup() };
}

const card = (id: string) => screen.findByRole('article', { name: `Solicitud de eliminación RH-${id}` });

describe('AuditDeleteRequestsPage', () => {
  it('lista solo las pendientes, la más reciente primero, con su detalle', async () => {
    await setup({ requests: [request('1'), request('2'), request('3', { status: 'approved' })] });
    const first = await card('2');
    expect(screen.getAllByRole('article').map((item) => item.getAttribute('aria-label'))).toEqual([
      'Solicitud de eliminación RH-2',
      'Solicitud de eliminación RH-1',
    ]);
    expect(screen.getByText('2 pendientes')).toBeInTheDocument();
    expect(within(first).getByText('Gestión 2')).toBeInTheDocument();
    expect(within(first).getByText('consultor.uno@example.test')).toBeInTheDocument();
    expect(within(first).getByText('2026-09-15')).toBeInTheDocument();
    expect(within(first).getByText('2,5 h')).toBeInTheDocument();
    expect(within(first).getByText('Actividad 2')).toBeInTheDocument();
  });

  it('el detalle del reporte se despliega con los campos del jsonb', async () => {
    const { user } = await setup({ requests: [request('1')] });
    await user.click(within(await card('1')).getByRole('button', { name: 'Ver detalle del reporte' }));
    expect(await screen.findByText('Tipo de hora')).toBeInTheDocument();
    expect(screen.getByText('08:00 – 10:30')).toBeInTheDocument();
  });

  it('aprobar pide confirmación y elimina y aprueba en un solo paso, sin llamar a delete', async () => {
    const { approve, list, timeManagement, user } = await setup();
    await user.click(within(await card('1')).getByRole('button', { name: 'Eliminar y aprobar' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/de forma definitiva el reporte RH-1/)).toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Eliminar y aprobar' }));
    await waitFor(() => expect(approve).toHaveBeenCalledWith('1'));
    expect(await screen.findByText('Reporte eliminado y solicitud aprobada.')).toBeInTheDocument();
    expect(timeManagement.delete).not.toHaveBeenCalled();
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('rechazar envía la nota (opcional) y refresca la lista', async () => {
    const { reject, list, user } = await setup();
    await user.click(within(await card('1')).getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rechazar solicitud' });
    await user.type(within(dialog).getByRole('textbox', { name: /Motivo/ }), 'Falta el soporte');
    await user.click(within(dialog).getByRole('button', { name: 'Rechazar solicitud' }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith('1', 'Falta el soporte'));
    expect(await screen.findByText('Solicitud rechazada.')).toBeInTheDocument();
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
  });

  it('si el rechazo falla el diálogo sigue abierto y conserva la nota', async () => {
    const failing = vi.fn(async () => {
      throw { status: 500, error: { error: 'Servicio no disponible' } };
    });
    const { user } = await setup({ reject: failing as unknown as ManagementDeleteRequestGateway['reject'] });
    await user.click(within(await card('1')).getByRole('button', { name: 'Rechazar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rechazar solicitud' });
    await user.type(within(dialog).getByRole('textbox', { name: /Motivo/ }), 'Falta el soporte');
    await user.click(within(dialog).getByRole('button', { name: 'Rechazar solicitud' }));
    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Rechazar solicitud' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Motivo/ })).toHaveValue('Falta el soporte');
  });

  it('rechazar sin nota también funciona', async () => {
    const { reject, user } = await setup();
    await user.click(within(await card('2')).getByRole('button', { name: 'Rechazar' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rechazar solicitud' }));
    await waitFor(() => expect(reject).toHaveBeenCalledWith('2', ''));
  });

  it('un 409 avisa que otro auditor ya resolvió la solicitud y refresca la lista', async () => {
    const conflict = vi.fn(async () => {
      throw { status: 409, error: { error: 'La solicitud ya fue procesada' } }; // forma de HttpError
    });
    const { list, user } = await setup({ approve: conflict as unknown as ManagementDeleteRequestGateway['approve'] });
    await user.click(within(await card('1')).getByRole('button', { name: 'Eliminar y aprobar' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar y aprobar' }));
    expect(await screen.findByText('Ya fue resuelta por otro auditor')).toBeInTheDocument();
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(1));
  });

  it('otro error muestra el mensaje del servidor', async () => {
    const failing = vi.fn(async () => {
      throw { status: 500, error: { error: 'No se pudo borrar en PMO' } };
    });
    const { user } = await setup({ approve: failing as unknown as ManagementDeleteRequestGateway['approve'] });
    await user.click(within(await card('1')).getByRole('button', { name: 'Eliminar y aprobar' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar y aprobar' }));
    expect(await screen.findByText('No se pudo borrar en PMO')).toBeInTheDocument();
  });

  it('sin solicitudes pendientes muestra el estado vacío', async () => {
    await setup({ requests: [request('1', { status: 'rejected' })] });
    expect(await screen.findByText('No hay solicitudes pendientes')).toBeInTheDocument();
    expect(screen.getByText('0 pendientes')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error con reintento', async () => {
    const { list, user } = await setup({ requests: new Error('Sin servicio') });
    expect(await screen.findByText('No fue posible cargar auditoría')).toBeInTheDocument();
    const calls = list.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(list.mock.calls.length).toBeGreaterThan(calls));
  });
});
