import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { AppNotification, NotificationFeed, NotificationGateway } from '@application/notifications/notification.gateway';
import type { ManagementDeleteRequestGateway } from '@application/time-records/ports/management-delete-request.gateway';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { testUser } from '@/test/fakes/fake-auth';
import { renderApp } from '@/test/fakes/render-app';
import { queryKeys } from '../shared/query-keys';
import { notificationPath } from './notification-route';

const notification = (id: string, kind: string, overrides: Partial<AppNotification> = {}): AppNotification => ({
  id,
  kind,
  requestId: `req-${id}`,
  title: `Aviso ${id}`,
  body: `Detalle del aviso ${id}`,
  data: { identifier: `RH-${id}` },
  createdAt: '2026-09-18T15:00:00.000Z',
  ...overrides,
});

const feed = (...items: AppNotification[]): NotificationFeed => ({ notifications: items, unreadCount: items.length });

async function setup(initial: NotificationFeed | Error, path = '/registros/dashboard') {
  let current = initial;
  const gateway = {
    listUnread: vi.fn(async () => {
      if (current instanceof Error) throw current;
      return current;
    }),
    markRead: vi.fn(async () => undefined),
    markAllRead: vi.fn(async () => undefined),
  } satisfies NotificationGateway;
  const deleteRequests = { list: vi.fn(async () => []), listMine: vi.fn(async () => []) } as unknown as ManagementDeleteRequestGateway;
  const ctx = createDraftsContainer({
    // El usuario de prueba también es el auditor configurado: puede abrir la bandeja de auditoría.
    parameters: { deletionSettings: { auditorEmail: testUser.email, technicalDeleteEmails: [] } },
    overrides: { notifications: gateway, deleteRequests },
  });
  const view = renderApp(ctx.container, path);
  await screen.findByRole('button', { name: /^Notificaciones/ });
  return {
    ...ctx,
    ...view,
    gateway,
    deleteRequests,
    user: userEvent.setup(),
    setFeed: (next: NotificationFeed | Error) => {
      current = next;
    },
    refetch: () => view.queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread }),
  };
}

const bell = () => screen.findByRole('button', { name: /^Notificaciones/ });

describe('NotificationBell', () => {
  it('muestra el conteo de no leídas en la campana y en su nombre accesible', async () => {
    await setup(feed(notification('1', 'delete_request_created'), notification('2', 'delete_request_approved')));
    expect(await screen.findByRole('button', { name: 'Notificaciones, 2 sin leer' })).toHaveTextContent('2');
  });

  it('sin no leídas no muestra el distintivo y el popover lo explica', async () => {
    const { user } = await setup(feed());
    expect(await bell()).toHaveAccessibleName('Notificaciones');
    await user.click(await bell());
    expect(await screen.findByText('No tienes notificaciones sin leer.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marcar todas como leídas' })).toBeDisabled();
  });

  it('abre la lista y "Marcar todas como leídas" las limpia', async () => {
    const { gateway, setFeed, user } = await setup(feed(notification('1', 'delete_request_created'), notification('2', 'delete_request_rejected')));
    await user.click(await screen.findByRole('button', { name: 'Notificaciones, 2 sin leer' }));
    const popover = await screen.findByRole('dialog', { name: 'Notificaciones' });
    expect(within(popover).getByText('Aviso 1')).toBeInTheDocument();
    expect(within(popover).getByText('Detalle del aviso 2')).toBeInTheDocument();

    setFeed(feed());
    await user.click(within(popover).getByRole('button', { name: 'Marcar todas como leídas' }));
    await waitFor(() => expect(gateway.markAllRead).toHaveBeenCalledTimes(1));
    expect(await within(popover).findByText('No tienes notificaciones sin leer.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Notificaciones' })).toBeInTheDocument();
  });

  it('un clic en una de auditoría la marca leída y abre la bandeja de auditoría', async () => {
    const { gateway, router, user } = await setup(feed(notification('1', 'delete_request_created')));
    await user.click(await bell());
    await user.click(await screen.findByRole('button', { name: /Aviso 1/ }));
    await waitFor(() => expect(gateway.markRead).toHaveBeenCalledWith(['1']));
    await waitFor(() => expect(router.state.location.pathname).toBe('/auditoria/eliminaciones'));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Notificaciones' })).not.toBeInTheDocument());
  });

  it('un clic en una resolución abre Reportes buscando el identificador', async () => {
    const { gateway, router, user } = await setup(feed(notification('7', 'delete_request_rejected', { data: { identifier: 'RH 7/ñ' } })));
    await user.click(await bell());
    await user.click(await screen.findByRole('button', { name: /Aviso 7/ }));
    await waitFor(() => expect(gateway.markRead).toHaveBeenCalledWith(['7']));
    await waitFor(() => expect(router.state.location.pathname).toBe('/registros/reportes'));
    expect(router.state.location.search).toBe('?preset=3m&q=RH%207%2F%C3%B1');
  });

  it('avisa con un toast solo de las notificaciones nuevas, no de las de la primera carga', async () => {
    const { gateway, refetch, setFeed } = await setup(feed(notification('1', 'delete_request_created')));
    await waitFor(() => expect(gateway.listUnread).toHaveBeenCalled());
    expect(screen.queryByText('Aviso 1')).not.toBeInTheDocument();

    await refetch(); // mismas notificaciones: sin aviso
    expect(screen.queryByText('Aviso 1')).not.toBeInTheDocument();

    setFeed(feed(notification('2', 'delete_request_approved'), notification('1', 'delete_request_created')));
    await refetch();
    expect(await screen.findByText('Aviso 2')).toBeInTheDocument();
    expect(screen.getByText('Detalle del aviso 2')).toBeInTheDocument();
    expect(screen.queryByText('Aviso 1')).not.toBeInTheDocument();

    setFeed(feed(notification('3', 'delete_request_created'), notification('4', 'delete_request_created')));
    await refetch();
    expect(await screen.findByText('Tienes 2 notificaciones nuevas')).toBeInTheDocument();
  });

  it('al llegar una nueva refresca la bandeja de auditoría y las solicitudes propias', async () => {
    const { deleteRequests, refetch, setFeed } = await setup(feed(), '/auditoria/eliminaciones');
    await screen.findByText('No hay solicitudes pendientes');
    const calls = vi.mocked(deleteRequests.list).mock.calls.length;

    setFeed(feed(notification('9', 'delete_request_created')));
    await refetch();
    await screen.findByText('Aviso 9');
    await waitFor(() => expect(vi.mocked(deleteRequests.list).mock.calls.length).toBeGreaterThan(calls));
  });

  it('si falla la consulta ofrece reintentar', async () => {
    const { gateway, setFeed, user } = await setup(new Error('Sin servicio'));
    await user.click(await bell());
    expect(await screen.findByText('No se pudieron cargar las notificaciones.')).toBeInTheDocument();
    setFeed(feed(notification('1', 'delete_request_created')));
    await user.click(within(screen.getByRole('dialog', { name: 'Notificaciones' })).getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Aviso 1')).toBeInTheDocument();
    expect(gateway.listUnread.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('notificationPath', () => {
  it('auditoría para solicitudes nuevas; Reportes con el identificador para resoluciones', () => {
    expect(notificationPath(notification('1', 'delete_request_created'))).toBe('/auditoria/eliminaciones');
    expect(notificationPath(notification('1', 'delete_request_approved'))).toBe('/registros/reportes?preset=3m&q=RH-1');
    expect(notificationPath(notification('1', 'delete_request_approved', { data: {} }))).toBe('/registros/reportes');
  });
});
