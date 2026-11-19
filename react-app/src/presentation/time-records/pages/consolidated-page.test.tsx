import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ReportDownloadResponse } from '@domain/time-records/models/management-report.model';
import { fakeConsolidatedExcel, SAMPLE_ROWS } from '@/test/fakes/consolidated-excel';
import { createDraftsContainer } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';
import { setViewportWidth } from '@/test/viewport';

const PATH = '/registros/consolidado';

async function setup(response?: ReportDownloadResponse | Error, path = PATH) {
  const body = response ?? { excel: await fakeConsolidatedExcel(SAMPLE_ROWS) };
  const download = vi.fn(async () => {
    if (body instanceof Error) throw body;
    return body;
  });
  const timeManagement = { download } as unknown as TimeManagementGateway;
  const ctx = createDraftsContainer({ overrides: { timeManagement } });
  const view = renderApp(ctx.container, path);
  await screen.findByRole('button', { name: 'Generar reporte' });
  return { ...ctx, ...view, download, user: userEvent.setup() };
}

const generate = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Generar reporte' }));
const metric = (label: string) =>
  screen.getAllByText(label).find((element) => element.getAttribute('data-slot') === 'card-description')!.closest('[data-slot="card"]') as HTMLElement;
const search = (router: { state: { location: { search: string } } }) => new URLSearchParams(router.state.location.search);

describe('ConsolidatedPage', () => {
  beforeEach(() => {
    setViewportWidth(1366);
    // 12:00 en Colombia: el día de hoy es el mismo en UTC, Bogotá y Tokio.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-09-18T17:00:00Z') });
  });
  afterEach(() => vi.useRealTimers());

  it('antes de generar muestra el estado inicial y pide el último mes hasta hoy', async () => {
    const { download, user } = await setup();
    expect(await screen.findByText('Genera un reporte para ver actividades')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1 mes' })).toBeChecked();
    expect(download).not.toHaveBeenCalled();

    await generate(user);
    await screen.findByRole('region', { name: 'Total de horas por día y consultor' });
    expect(download).toHaveBeenCalledWith({
      fechaInicio: '2026-08-19T05:00:00.000Z',
      fechaFin: '2026-09-18T05:00:00.000Z',
      cliente: null,
      idConsultor: null,
      proyecto: null,
      solicitud: null,
    });
  });

  it('muestra tarjetas, resumen por día y consultor y detalle', async () => {
    const { user } = await setup();
    await generate(user);
    const summary = await screen.findByRole('region', { name: 'Total de horas por día y consultor' });

    expect(within(metric('Horas totales')).getByText('12,5 h')).toBeInTheDocument();
    expect(within(metric('Días trabajados')).getByText('2')).toBeInTheDocument();
    expect(within(metric('Clientes atendidos')).getByText('2')).toBeInTheDocument();
    expect(within(metric('Registros')).getByText('3')).toBeInTheDocument();

    const rows = within(summary).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Ana Prueba');
    expect(rows[0]).toHaveTextContent('Cliente Alfa · Cliente Beta');
    expect(rows[0]).toHaveTextContent('7 h');
    expect(rows[1]).toHaveTextContent('Luis Ejemplo');
    expect(rows[1]).toHaveTextContent('5,5 h');

    const detail = screen.getByRole('region', { name: 'Detalle de actividades reportadas' });
    expect(within(detail).getAllByRole('row')).toHaveLength(4);
    expect(within(detail).getByText('Desarrollo del reporte')).toBeInTheDocument();
  });

  it('filtra por búsqueda (en la URL) y por clasificación de hora', async () => {
    const { router, user } = await setup();
    await generate(user);
    await screen.findByRole('region', { name: 'Detalle de actividades reportadas' });

    await user.type(screen.getByRole('searchbox', { name: /Buscar en el reporte/ }), 'migracion');
    await waitFor(() => expect(search(router).get('q')).toBe('migracion'), { timeout: 3000 });
    await waitFor(() => expect(within(metric('Registros')).getByText('1')).toBeInTheDocument());
    expect(within(metric('Horas totales')).getByText('3 h')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: /Buscar en el reporte/ }));
    await waitFor(() => expect(search(router).get('q')).toBeNull(), { timeout: 3000 });
    await user.click(screen.getByRole('combobox', { name: 'Clasificación de hora' }));
    await user.click(await screen.findByRole('option', { name: 'Fábrica' }));
    expect(search(router).get('tipoHora')).toBe('factory');
    await waitFor(() => expect(within(metric('Registros')).getByText('1')).toBeInTheDocument());
    expect(within(metric('Horas totales')).getByText('3 h')).toBeInTheDocument();
  });

  it('filtra por consultor y avisa cuando ningún registro coincide, con acción para limpiar', async () => {
    const { router, user } = await setup();
    await generate(user);
    await screen.findByRole('region', { name: 'Detalle de actividades reportadas' });

    await user.click(screen.getByRole('combobox', { name: 'Consultor' }));
    await user.click(await screen.findByRole('option', { name: 'Luis Ejemplo' }));
    expect(search(router).get('consultor')).toBe('Luis Ejemplo');
    await waitFor(() => expect(within(metric('Horas totales')).getByText('5,5 h')).toBeInTheDocument());

    await user.type(screen.getByRole('searchbox', { name: /Buscar en el reporte/ }), 'zzz');
    expect(await screen.findByText('No hay actividades con esos filtros', {}, { timeout: 3000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));
    expect(await screen.findByRole('region', { name: 'Detalle de actividades reportadas' })).toBeInTheDocument();
    expect(search(router).has('consultor')).toBe(false);
  });

  it('el cliente y el rango personalizado viajan en la solicitud', async () => {
    const { download, router, user } = await setup(undefined, `${PATH}?preset=custom&desde=2026-09-01&hasta=2026-09-10`);
    await user.click(screen.getByRole('combobox', { name: 'Cliente' }));
    await user.click(await screen.findByRole('option', { name: 'Cliente Beta' }));
    expect(search(router).get('cliente')).toBe('Cliente Beta');
    await generate(user);
    await waitFor(() => expect(download).toHaveBeenCalled());
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ fechaInicio: '2026-09-01T05:00:00.000Z', fechaFin: '2026-09-10T05:00:00.000Z', cliente: 'Cliente Beta' }),
    );
  });

  it('con el rango invertido avisa y no deja generar', async () => {
    await setup(undefined, `${PATH}?preset=custom&desde=2026-09-10&hasta=2026-09-01`);
    expect(await screen.findByText('La fecha inicial no puede ser posterior a la fecha final.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar reporte' })).toBeDisabled();
  });

  it('sin Excel muestra "Sin datos" con el mensaje del servidor', async () => {
    const { user } = await setup({ mensaje: 'No hay registros para el cliente.' });
    await generate(user);
    expect(await screen.findByText('Sin datos')).toBeInTheDocument();
    expect(screen.getByText('No hay registros para el cliente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Descargar Excel' })).not.toBeInTheDocument();
  });

  it('si falla la consulta muestra el error y permite reintentar', async () => {
    const { download, user } = await setup(new Error('Servicio no disponible'));
    await generate(user);
    expect(await screen.findByText('No fue posible generar el reporte')).toBeInTheDocument();
    expect(screen.getByText('Servicio no disponible')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
  });

  it('un Excel ilegible se informa como error de lectura', async () => {
    const { user } = await setup({ excel: btoa('no es un excel') });
    await generate(user);
    expect(await screen.findByText(/No se pudo leer el reporte recibido/)).toBeInTheDocument();
  });

  it('Descargar Excel entrega el archivo recibido con el rango en el nombre', async () => {
    const createObjectURL = vi.fn(() => 'blob:consolidado');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('consolidado-2026-08-19_2026-09-18.xlsx');
    });
    const { user } = await setup();
    await generate(user);
    await user.click(await screen.findByRole('button', { name: 'Descargar Excel' }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });

  it('Limpiar descarta el resultado y los filtros', async () => {
    const { router, user } = await setup(undefined, `${PATH}?preset=3m&cliente=Cliente%20Alfa`);
    await generate(user);
    await screen.findByRole('region', { name: 'Detalle de actividades reportadas' });
    await user.click(screen.getByRole('button', { name: 'Limpiar' }));
    expect(await screen.findByText('Genera un reporte para ver actividades')).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('en móvil el detalle pasa a tarjetas', async () => {
    setViewportWidth(360);
    const { user } = await setup();
    await generate(user);
    const detail = await screen.findByRole('region', { name: 'Detalle de actividades reportadas' });
    expect(within(detail).queryByRole('table')).not.toBeInTheDocument();
    expect(within(detail).getAllByRole('listitem')).toHaveLength(3);
  });
});
