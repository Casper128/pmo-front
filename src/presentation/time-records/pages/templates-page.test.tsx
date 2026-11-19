import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ManagementAdvancedTemplate } from '@domain/time-records/models/management-template.model';
import { completeTemplate, createDraftsContainer, createFakeTemplates } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';

const PATH = '/registros/plantillas';

const withUpdate = (template: ManagementAdvancedTemplate, updatedAt: string): ManagementAdvancedTemplate => ({ ...template, updatedAt });
const withProject = (template: ManagementAdvancedTemplate): ManagementAdvancedTemplate => ({ ...template, values: { ...template.values, proyecto: template.project } });
const seed = () => [
  withUpdate(withProject(completeTemplate('G-1', 'Gestión Uno', 'Cliente Alfa', 'Proyecto A')), '2026-03-01'),
  withUpdate({ ...completeTemplate('G-2', 'Gestión Dos', 'Cliente Alfa', 'Proyecto A'), completed: false }, '2026-05-01'),
  withUpdate({ gestionId: 'G-3', gestionName: 'Gestión Tres', client: 'Cliente Beta', values: {}, completed: false }, '2026-04-01'),
];

async function setup(templates: ManagementAdvancedTemplate[] = seed()) {
  const fake = createFakeTemplates(templates);
  const ctx = createDraftsContainer({ templates: fake });
  const view = renderApp(ctx.container, PATH);
  await screen.findByRole('heading', { name: 'Mis plantillas por gestión' });
  return { ...ctx, ...view, fake, user: userEvent.setup() };
}

const names = () => screen.queryAllByRole('article', { hidden: true }).map((item) => item.getAttribute('aria-label'));
const card = (name: string) => screen.findByRole('article', { name: `Plantilla ${name}` });

describe('TemplatesPage', () => {
  it('lista las plantillas, la más reciente primero, con su estado y contadores', async () => {
    await setup();
    await card('Gestión Uno');
    expect(names()).toEqual(['Plantilla Gestión Dos', 'Plantilla Gestión Tres', 'Plantilla Gestión Uno']);
    expect(screen.getByText('3 plantillas')).toBeInTheDocument();
    expect(screen.getByText('1 configuradas')).toBeInTheDocument();
    const uno = await card('Gestión Uno');
    expect(within(uno).getByText('Configurada')).toBeInTheDocument();
    expect(within(uno).getByText('Proyecto A')).toBeInTheDocument();
    expect(within(await card('Gestión Dos')).getByText('Pendiente')).toBeInTheDocument();
  });

  it('busca sin tildes y filtra por estado', async () => {
    const { user } = await setup();
    await card('Gestión Uno');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar gestión' }), 'gestion tres');
    await waitFor(() => expect(names()).toEqual(['Plantilla Gestión Tres']));
    await user.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    await user.click(screen.getByRole('radio', { name: 'Configuradas' }));
    expect(names()).toEqual(['Plantilla Gestión Uno']);
    await user.click(screen.getByRole('radio', { name: 'Pendientes' }));
    expect(names()).toEqual(['Plantilla Gestión Dos', 'Plantilla Gestión Tres']);
  });

  it('sin coincidencias muestra el estado vacío con recarga', async () => {
    const { user, fake } = await setup();
    await card('Gestión Uno');
    await user.type(screen.getByRole('searchbox', { name: 'Buscar gestión' }), 'zzz');
    expect(await screen.findByText('No encontramos plantillas con esos filtros')).toBeInTheDocument();
    const calls = fake.list.mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Recargar plantillas' }));
    await waitFor(() => expect(fake.list.mock.calls.length).toBeGreaterThan(calls));
  });

  it('sin plantillas explica cómo se crean', async () => {
    await setup([]);
    expect(await screen.findByText('Aún no tienes plantillas por gestión')).toBeInTheDocument();
    expect(screen.getByText('0 plantillas')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error con reintento', async () => {
    const fake = createFakeTemplates();
    fake.list.mockRejectedValueOnce(new Error('Sin conexión')).mockRejectedValueOnce(new Error('Sin conexión'));
    const ctx = createDraftsContainer({ templates: fake });
    renderApp(ctx.container, PATH);
    expect(await screen.findByText('No fue posible cargar tus plantillas')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('heading', { name: 'Mis plantillas por gestión' })).toBeInTheDocument();
  });

  it('editar guarda con el formulario existente y actualiza la tarjeta', async () => {
    const { user, fake } = await setup();
    await user.click(within(await card('Gestión Uno')).getByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar configuración' });
    const funcional = within(dialog).getByLabelText(/^Funcional/);
    await user.clear(funcional);
    await user.type(funcional, 'Funcional nuevo');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fake.save).toHaveBeenCalled());
    expect(fake.save.mock.calls[0][0]).toMatchObject({ gestionId: 'G-1', completed: true, values: { funcional: 'Funcional nuevo' } });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar configuración' })).not.toBeInTheDocument());
    expect(await screen.findByText('Configuración avanzada guardada para la gestión.')).toBeInTheDocument();
  });

  it('guarda las horas estimadas (decimales) y valida que no sean negativas', async () => {
    const { user, fake } = await setup();
    await user.click(within(await card('Gestión Uno')).getByRole('button', { name: 'Editar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar configuración' });
    const hours = within(dialog).getByLabelText('Horas estimadas');
    await user.type(hours, '-2');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await within(dialog).findByText('Ingresa un número mayor o igual a 0')).toBeInTheDocument();
    expect(fake.save).not.toHaveBeenCalled();
    await user.clear(hours);
    await user.type(hours, '12.5');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(fake.save).toHaveBeenCalled());
    expect(fake.save.mock.calls[0][0].values).toMatchObject({ horasEstimadas: '12.5' });
  });

  it('configurar una pendiente sin obligatorios no guarda y avisa cuáles faltan', async () => {
    const { user, fake } = await setup();
    await user.click(within(await card('Gestión Tres')).getByRole('button', { name: 'Configurar' }));
    const dialog = await screen.findByRole('dialog', { name: 'Editar configuración' });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/Llena los campos obligatorios antes de guardar la plantilla: Funcional/)).toBeInTheDocument();
    expect(fake.save).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Editar configuración' })).toBeInTheDocument();
  });

  it('marcar como pendiente guarda la plantilla sin completar', async () => {
    const { user, fake } = await setup();
    await user.click(within(await card('Gestión Uno')).getByRole('button', { name: 'Más acciones de Gestión Uno' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Marcar como pendiente' }));
    await waitFor(() => expect(fake.save).toHaveBeenCalledWith(expect.objectContaining({ gestionId: 'G-1', completed: false })));
    expect(await screen.findByText('Plantilla marcada como pendiente.')).toBeInTheDocument();
    await waitFor(() => expect(within(screen.getByRole('article', { name: 'Plantilla Gestión Uno' })).getByText('Pendiente')).toBeInTheDocument());
  });

  it('una plantilla pendiente no ofrece marcarla como pendiente', async () => {
    const { user } = await setup();
    await user.click(within(await card('Gestión Dos')).getByRole('button', { name: 'Más acciones de Gestión Dos' }));
    expect(await screen.findByRole('menuitem', { name: 'Eliminar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Marcar como pendiente' })).not.toBeInTheDocument();
  });

  it('eliminar pide confirmación con la consecuencia y quita la tarjeta', async () => {
    const { user, fake } = await setup();
    await user.click(within(await card('Gestión Uno')).getByRole('button', { name: 'Más acciones de Gestión Uno' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar plantilla' });
    expect(within(dialog).getByText(/dejará de usarse/)).toBeInTheDocument();
    expect(fake.remove).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar plantilla' }));
    await waitFor(() => expect(fake.remove).toHaveBeenCalledWith('G-1'));
    expect(await screen.findByText(/Plantilla eliminada/)).toBeInTheDocument();
    await waitFor(() => expect(names()).not.toContain('Plantilla Gestión Uno'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('si eliminar falla el diálogo sigue abierto y avisa del error', async () => {
    const { user, fake } = await setup();
    fake.remove.mockRejectedValueOnce({ status: 500, error: { error: 'No se pudo eliminar en el servidor' } });
    await user.click(within(await card('Gestión Uno')).getByRole('button', { name: 'Más acciones de Gestión Uno' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Eliminar' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Eliminar plantilla' }));
    expect(await screen.findByText('No se pudo eliminar en el servidor')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog', { name: 'Eliminar plantilla' })).toBeInTheDocument();
    expect(names()).toContain('Plantilla Gestión Uno');
  });
});
