import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import type { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { testParameterFields } from '@/test/fakes/fake-app-parameters';
import { renderApp } from '@/test/fakes/render-app';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { ConfigurationPage } from './configuration-page';

const PATH = '/configuracion';
const TITLE = 'Configuración global de tiempos';

async function setup(canManage = true) {
  const ctx = createDraftsContainer({ parameters: { canManage } });
  const save = vi.spyOn<AppParametersFacade, 'save'>(ctx.parameters, 'save');
  const resetLocal = vi.spyOn(ctx.parameters, 'resetLocal').mockImplementation(() =>
    ctx.parameters.set({ fields: testParameterFields().slice(0, 1) }),
  );
  if (canManage) renderApp(ctx.container, PATH);
  else {
    // Sin permiso la ruta real redirige; la página se monta directo para comprobar su modo de solo lectura.
    const router = createMemoryRouter([{ path: '/', element: <ConfigurationPage /> }]);
    render(
      <AppProviders container={ctx.container} queryClient={createQueryClient(ctx.container.auth)}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
  }
  await screen.findByRole('heading', { name: TITLE });
  return { ...ctx, save, resetLocal, user: userEvent.setup() };
}

const hours = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const clear = async (user: ReturnType<typeof userEvent.setup>, label: string, value: string) => {
  await user.clear(hours(label));
  if (value) await user.type(hours(label), value);
};
const save = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Guardar configuración global' }));

describe('ConfigurationPage', () => {
  it('muestra la jornada, los límites y el primer campo con sus opciones', async () => {
    await setup();
    expect(hours('Lunes')).toHaveValue(8.5);
    expect(hours('Viernes')).toHaveValue(8);
    expect(hours('Domingo')).toHaveValue(0);
    expect(hours('Máximo computable por día')).toHaveValue(10);
    expect(hours('Máximo por registro')).toHaveValue(16);
    expect(screen.getByRole('article', { name: 'Opciones de Tipo hora' })).toBeInTheDocument();
    expect(screen.getByLabelText('Valor interno', { selector: '#option-value-0-0' })).toHaveValue('Laboral');
    expect(screen.getByText('Administrador · jornada editable')).toBeInTheDocument();
  });

  it('la auditoría es informativa: se configura en el servidor y no hay campos de correo', async () => {
    await setup();
    expect(screen.getByText('PMO_AUDIT_EMAIL')).toBeInTheDocument();
    expect(screen.getByText('TECHNICAL_DELETE_EMAILS')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Correo/)).not.toBeInTheDocument();
  });

  it('guarda la jornada y los límites editados con números y avisa con un toast', async () => {
    const { user, save: saveSpy } = await setup();
    await clear(user, 'Lunes', '9');
    await clear(user, 'Viernes', '7.5');
    await clear(user, 'Máximo por registro', '12');
    await save(user);
    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));
    const [fields, settings] = saveSpy.mock.calls[0];
    expect(settings).toEqual({
      dailyHours: { 0: 0, 1: 9, 2: 8.5, 3: 8.5, 4: 8.5, 5: 7.5, 6: 0 },
      mondayThursdayHours: 9,
      fridayHours: 7.5,
      maxDailyLaborHours: 10,
      maxHoursPerRecord: 12,
    });
    expect(fields).toHaveLength(testParameterFields().length);
    expect(await screen.findByText('Configuración global guardada localmente.')).toBeInTheDocument();
  });

  it('no guarda con horas inválidas y marca cada campo con su mensaje', async () => {
    const { user, save: saveSpy } = await setup();
    await clear(user, 'Martes', '25');
    await clear(user, 'Máximo computable por día', '0');
    await clear(user, 'Máximo por registro', '');
    await save(user);
    expect(await screen.findByText('Usa un valor entre 0 y 24')).toBeInTheDocument();
    expect(screen.getAllByText('Debe ser mayor que 0 y hasta 24 horas')).toHaveLength(2);
    expect(hours('Martes')).toBeInvalid();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('si el guardado falla muestra el motivo y conserva lo editado', async () => {
    const { user, save: saveSpy } = await setup();
    saveSpy.mockRejectedValueOnce(new Error('El servidor rechazó la configuración'));
    await clear(user, 'Lunes', '9');
    await save(user);
    expect(await screen.findByText('El servidor rechazó la configuración')).toBeInTheDocument();
    expect(hours('Lunes')).toHaveValue(9);
  });

  it('agrega, reordena y quita opciones; quitar pide confirmación y ajusta el predeterminado', async () => {
    const { user, save: saveSpy } = await setup();
    await user.click(screen.getByRole('button', { name: 'Agregar opción' }));
    await user.type(screen.getByLabelText('Valor interno', { selector: '#option-value-0-3' }), 'Nueva');
    await user.type(screen.getByLabelText('Texto visible', { selector: '#option-label-0-3' }), 'Nueva visible');
    await user.click(screen.getByRole('button', { name: 'Subir Nueva visible' }));
    expect(screen.getByLabelText('Valor interno', { selector: '#option-value-0-2' })).toHaveValue('Nueva');

    // El predeterminado es 'Laboral': al quitarlo pasa a la primera opción activa restante.
    await user.click(screen.getByRole('button', { name: 'Eliminar Laboral' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Eliminar Laboral' });
    await user.click(within(dialog).getByRole('button', { name: 'Eliminar opción' }));
    await save(user);
    await waitFor(() => expect(saveSpy).toHaveBeenCalled());
    const tipoHora = saveSpy.mock.calls[0][0][0];
    expect(tipoHora.options.map((option) => [option.value, option.sortOrder])).toEqual([
      ['Fábrica', 0],
      ['Nueva', 1],
      ['No facturable', 2],
    ]);
    expect(tipoHora.defaultValue).toBe('Fábrica');
  });

  it('cancelar la confirmación conserva la opción', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Eliminar Fábrica' }));
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByLabelText('Valor interno', { selector: '#option-value-0-1' })).toHaveValue('Fábrica');
  });

  it('restaurar originales pide confirmación y recarga el formulario sin guardar', async () => {
    const { user, resetLocal, save: saveSpy } = await setup();
    await clear(user, 'Lunes', '9');
    await user.click(screen.getByRole('button', { name: 'Restaurar originales' }));
    expect(resetLocal).not.toHaveBeenCalled();
    await user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Restaurar originales' }));
    expect(resetLocal).toHaveBeenCalledTimes(1);
    expect(hours('Lunes')).toHaveValue(8.5);
    expect(await screen.findByText(/Se restauraron los valores originales/)).toBeInTheDocument();
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('sin permiso es de solo lectura: controles deshabilitados y sin guardar ni restaurar', async () => {
    await setup(false);
    expect(screen.getByText('Configuración global de solo lectura')).toBeInTheDocument();
    expect(hours('Lunes')).toBeDisabled();
    expect(hours('Máximo por registro')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Agregar opción' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Guardar configuración global' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restaurar originales' })).not.toBeInTheDocument();
  });

  it('mientras cargan los parámetros muestra el esqueleto', async () => {
    const ctx = createDraftsContainer({ parameters: { canManage: true, loading: true } });
    const router = createMemoryRouter([{ path: '/', element: <ConfigurationPage /> }]);
    render(
      <AppProviders container={ctx.container} queryClient={createQueryClient(ctx.container.auth)}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole('status', { name: 'Cargando configuración...' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: TITLE })).not.toBeInTheDocument();
  });
});
