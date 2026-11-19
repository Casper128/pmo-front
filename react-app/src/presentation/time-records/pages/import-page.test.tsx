import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import type { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { completeTemplate, createDraftsContainer, createFakeTemplates, makeDraft, testCatalog } from '@/test/fakes/drafts-fixtures';
import { renderApp } from '@/test/fakes/render-app';
import { SendAllStub, log, result } from '@/test/fakes/send-all-stub';
import { setViewportWidth } from '@/test/viewport';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { DraftsProvider } from '../drafts/drafts-provider';
import { LAST_MANAGEMENT_STORAGE_KEY } from '../drafts/last-management-storage';
import { PENDING_RECORDS_STORAGE_KEY } from '../drafts/pending-records-storage';
import type { SendPhase } from '../drafts/send-phase';
import { TEXT_DRAFT_STORAGE_KEY } from '../drafts/text-draft-storage';
import { ImportPage } from './import-page';

const SAMPLE_TEXT = [
  '09/09/2026',
  '7:30AM-9:00AM | Desarrollo de ajuste | Funcional uno | RICEF uno',
  '-10:30AM | Revisión con usuario',
].join('\n');

const IMPORT_PATH = '/registros/importar';
const WIDE = 1366;

const stored = <T = TimeRecord[]>(key = PENDING_RECORDS_STORAGE_KEY) => JSON.parse(localStorage.getItem(key) ?? 'null') as T;
const seedDrafts = (...records: TimeRecord[]) => localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify(records));

async function setupApp(options: Parameters<typeof createDraftsContainer>[0] = {}, path = IMPORT_PATH) {
  const ctx = createDraftsContainer(options);
  const view = renderApp(ctx.container, path);
  await screen.findByRole('heading', { name: 'Reportar y revisar tiempos' });
  return { ...ctx, ...view, user: userEvent.setup() };
}

const textarea = () => screen.getByLabelText('Pega aquí tus registros de tiempo');
const paste = (value: string) => fireEvent.change(textarea(), { target: { value } });
const process = (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Procesar tiempos' }));

/** Abre un combobox (AppSelect) y elige una opción por su nombre. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string | RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('ImportPage', () => {
  afterEach(() => {
    localStorage.clear();
    // Sonner guarda sus avisos en un store global: se vacía para que no pasen al siguiente test.
    act(() => void toast.dismiss());
  });

  it('muestra el encabezado y el estado vacío de la vista previa con los textos de Angular', async () => {
    await setupApp();
    const header = screen.getByRole('heading', { name: 'Reportar y revisar tiempos' }).closest('header') as HTMLElement;
    expect(within(header).getByText('Tiempos')).toBeInTheDocument();
    expect(
      screen.getByText('Pega tus actividades, completa lo pendiente y registra con confianza.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pega y procesa tus tiempos')).toBeInTheDocument();
    expect(
      screen.getByText('La vista previa aparecerá aquí para completar y registrar tus actividades.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Registrar todos/ })).not.toBeInTheDocument();
  });

  describe('pegar texto', () => {
    it('procesa el texto, agrega los borradores y limpia el borrador del textarea', async () => {
      const { user } = await setupApp();

      paste(SAMPLE_TEXT);
      // El borrador del textarea se guarda al escribir, con el formato de Angular.
      expect(stored(TEXT_DRAFT_STORAGE_KEY)).toEqual({ rawText: SAMPLE_TEXT });

      await process(user);

      expect(await screen.findByText('Vista previa de registros')).toBeInTheDocument();
      expect(screen.getByText('2 registros en 1 día')).toBeInTheDocument();
      expect(screen.getByText('Borrador agregado a la vista previa.')).toBeInTheDocument();
      expect(textarea()).toHaveValue('');
      expect(localStorage.getItem(TEXT_DRAFT_STORAGE_KEY)).toBeNull();

      const pending = stored();
      expect(pending).toHaveLength(2);
      expect(pending[0]).toMatchObject({
        fecha: '2026-09-09',
        horaIni: '07:30',
        horaFin: '09:00',
        horas: '1.5',
        desc: 'Desarrollo de ajuste',
        funcional: 'Funcional uno',
        ricef: 'RICEF uno',
        tipoHora: 'Laboral',
      });
      expect(pending[1]).toMatchObject({ horaIni: '09:00', horaFin: '10:30', desc: 'Revisión con usuario' });
    });

    it('un segundo pegado se agrega a los existentes y los ordena por fecha y hora', async () => {
      const { user } = await setupApp();
      paste(SAMPLE_TEXT);
      await process(user);
      await screen.findByText('2 registros en 1 día');

      paste('08/09/2026\n6:00AM-7:00AM | Tarea del día anterior');
      await process(user);

      expect(await screen.findByText('3 registros en 2 días')).toBeInTheDocument();
      expect(stored().map((record) => record.fecha)).toEqual(['2026-09-08', '2026-09-09', '2026-09-09']);
    });

    it.each([
      ['texto sin fecha', 'Linea 1: agrega una fecha valida antes del registro'],
      ['09/09/2026\n9:00AM-8:00AM | Al revés', 'Linea 2: la duracion debe ser mayor a 0'],
      ['31/02/2026\n7:00AM-8:00AM | Fecha imposible', 'Linea 1: fecha invalida'],
      ['09/09/2026\n7:00AM-8:00AM |', 'Linea 2: agrega descripcion'],
      ['09/09/2026\nreunión sin horario', 'Linea 2: usa formato 7:30AM-9:00AM | descripcion'],
      ['', 'No se encontraron registros validos para agregar a la vista previa.'],
    ])('muestra los errores del dominio para %j', async (text, message) => {
      const { user } = await setupApp();
      paste(text);
      await process(user);

      const alert = await screen.findByRole('alert');
      expect(within(alert).getByText('Revisa antes de continuar:')).toBeInTheDocument();
      expect(within(alert).getByText(new RegExp(`^${message.replace(/[|]/g, '\\|')}`))).toBeInTheDocument();
      expect(screen.queryByText('Vista previa de registros')).not.toBeInTheDocument();
      // El texto no se pierde: sigue en el textarea y en su borrador.
      expect(textarea()).toHaveValue(text);
    });

    it('al escribir se descartan los errores y el mensaje anteriores', async () => {
      const { user } = await setupApp();
      paste('texto sin fecha');
      await process(user);
      await screen.findByRole('alert');

      paste('otra cosa');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('Limpiar vacía el textarea y borra su borrador', async () => {
      const { user } = await setupApp();
      paste(SAMPLE_TEXT);
      await user.click(screen.getByRole('button', { name: 'Limpiar' }));
      expect(textarea()).toHaveValue('');
      expect(localStorage.getItem(TEXT_DRAFT_STORAGE_KEY)).toBeNull();
    });
  });

  describe('restaurar tras recargar', () => {
    it('restaura los borradores y el texto pendiente (ambos borradores) y avisa una vez', async () => {
      seedDrafts(makeDraft({ desc: 'Primero' }), makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1', desc: 'Segundo' }));
      localStorage.setItem(TEXT_DRAFT_STORAGE_KEY, JSON.stringify({ rawText: 'texto a medias' }));

      await setupApp();

      expect(textarea()).toHaveValue('texto a medias');
      expect(await screen.findByText('2 registros en 1 día')).toBeInTheDocument();
      expect(screen.getByText('Primero')).toBeInTheDocument();
      expect(screen.getByText('Segundo')).toBeInTheDocument();
      expect(await screen.findAllByText('Se restauraron 2 registros pendientes.')).toHaveLength(1);
    });

    it('un borrador de texto dañado se descarta sin romper la página', async () => {
      localStorage.setItem(TEXT_DRAFT_STORAGE_KEY, '{dañado');
      await setupApp();
      expect(textarea()).toHaveValue('');
      expect(localStorage.getItem(TEXT_DRAFT_STORAGE_KEY)).toBeNull();
    });
  });

  describe('validaciones de horas en la vista previa', () => {
    it('Fábrica fuera de jornada (19:30-23:59) no bloquea, no cuenta y no pide revisión', async () => {
      seedDrafts(makeDraft({ tipoHora: 'Fábrica', horaIni: '19:30', horaFin: '23:59', horas: '4.5' }));
      await setupApp();

      expect(await screen.findByText('1 listos')).toBeInTheDocument();
      expect(screen.queryByText(/por revisar/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Revisa:/)).not.toBeInTheDocument();
      // No computa: el día queda en 0 h frente a la jornada del miércoles.
      expect(screen.getByText('0.0h · Faltan 8.5h')).toBeInTheDocument();
    });

    it('el mismo horario como hora laboral sí computa contra la jornada', async () => {
      seedDrafts(makeDraft({ tipoHora: 'Laboral', horaIni: '19:30', horaFin: '23:59', horas: '4.5' }));
      await setupApp();
      expect(await screen.findByText('4.5h · Faltan 4.0h')).toBeInTheDocument();
    });

    it('fin de semana: la jornada esperada es 0 h y cualquier hora laboral excede', async () => {
      seedDrafts(makeDraft({ fecha: '2026-09-12', horaIni: '08:00', horaFin: '10:00', horas: '2' }));
      await setupApp();
      expect(await screen.findByText('2.0h · Excede 0h')).toBeInTheDocument();
      expect(screen.getByText('Sáb 12 Sep 2026')).toBeInTheDocument();
      // La alerta del día no marca el registro como inválido.
      expect(screen.getByText('1 listos')).toBeInTheDocument();
    });

    it('un registro incompleto o inválido muestra los mensajes del dominio en su fila', async () => {
      seedDrafts(makeDraft({ cliente: '', solicitud: '', gestionId: '', desc: '' }));
      await setupApp();

      expect(await screen.findByText('Revisa: Cliente, Gestión Demanda, Descripción')).toBeInTheDocument();
      expect(screen.getByText('1 por revisar')).toBeInTheDocument();
      expect(screen.getByText('0 listos')).toBeInTheDocument();
    });

    it('Excede/Exacto/Faltan salen de la jornada configurada del día', async () => {
      seedDrafts(
        makeDraft({ horaIni: '07:00', horaFin: '15:30', horas: '8.5' }),
        makeDraft({ fecha: '2026-09-11', horaIni: '07:00', horaFin: '16:00', horas: '9' }),
      );
      await setupApp();
      expect(await screen.findByText('8.5h · Exacto 8.5h')).toBeInTheDocument();
      // Viernes: jornada de 8 h.
      expect(screen.getByText('9.0h · Excede 8h')).toBeInTheDocument();
    });
  });

  describe('editar, duplicar, eliminar y cancelar', () => {
    it('edita un registro y guarda con las horas recalculadas', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();

      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });
      expect(within(dialog).getByText('Ajusta solo lo necesario antes de enviar.')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Horas calculadas')).toHaveValue('1.5 h');

      fireEvent.change(within(dialog).getByLabelText('Hora fin'), { target: { value: '10:00' } });
      expect(within(dialog).getByLabelText('Horas calculadas')).toHaveValue('2.5 h');
      fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'Descripción editada' } });
      await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByText('Registro actualizado')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar registro' })).not.toBeInTheDocument());
      expect(screen.getByText('Descripción editada')).toBeInTheDocument();
      expect(stored()[0]).toMatchObject({ desc: 'Descripción editada', horaFin: '10:00', horas: '2.5' });
    });

    it('no deja guardar con campos faltantes y lista los mensajes del dominio', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: '' } });

      expect(await within(dialog).findByText('Revisa: Descripción')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('un horario de más de 16 h muestra la duración máxima y las horas inválidas', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      fireEvent.change(within(dialog).getByLabelText('Hora inicio'), { target: { value: '06:00' } });
      fireEvent.change(within(dialog).getByLabelText('Hora fin'), { target: { value: '23:00' } });

      expect(await within(dialog).findByText('Revisa: Duracion maxima 16h, Horas debe ser mayor a 0')).toBeInTheDocument();
      expect(within(dialog).getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('un registro computable de más del máximo diario se rechaza al guardar con un AlertDialog', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      fireEvent.change(within(dialog).getByLabelText('Hora inicio'), { target: { value: '06:00' } });
      fireEvent.change(within(dialog).getByLabelText('Hora fin'), { target: { value: '17:00' } });
      await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

      const alert = await screen.findByRole('alertdialog', { name: 'No se puede continuar' });
      expect(
        within(alert).getByText('No se puede guardar el registro: Un registro computable no puede superar 10 horas'),
      ).toBeInTheDocument();
      await user.click(within(alert).getByRole('button', { name: 'Entendido, revisar registros' }));
      await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
      // Nada se guardó.
      expect(stored()[0]).toMatchObject({ horaIni: '07:30', horaFin: '09:00' });
    });

    it('Fábrica de más del máximo diario sí se puede guardar (no computa)', async () => {
      seedDrafts(makeDraft({ tipoHora: 'Fábrica' }));
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      fireEvent.change(within(dialog).getByLabelText('Hora inicio'), { target: { value: '06:00' } });
      fireEvent.change(within(dialog).getByLabelText('Hora fin'), { target: { value: '20:00' } });
      await user.click(within(dialog).getByRole('button', { name: 'Guardar cambios' }));

      expect(await screen.findByText('Registro actualizado')).toBeInTheDocument();
      expect(stored()[0]).toMatchObject({ tipoHora: 'Fábrica', horas: '14.0' });
    });

    it('cancelar la edición no cambia el borrador', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });
      fireEvent.change(within(dialog).getByLabelText('Descripción'), { target: { value: 'No se guarda' } });

      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar registro' })).not.toBeInTheDocument());
      expect(stored()[0].desc).toBe('Actividad de prueba');
    });

    it('la vista de solo lectura muestra los campos avanzados de la plantilla de la gestión', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      expect(await within(dialog).findByText('Funcional de prueba')).toBeInTheDocument();
      expect(within(dialog).getByText('Campos avanzados que se enviarán')).toBeInTheDocument();
    });

    it('sin plantilla la vista de solo lectura lo indica', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp({ templates: createFakeTemplates() });
      await user.click(await screen.findByRole('button', { name: 'Editar registro 1' }));
      const dialog = await screen.findByRole('dialog', { name: 'Editar registro' });

      expect(
        await within(dialog).findByText('Esta gestión todavía no tiene plantilla de campos avanzados configurada.'),
      ).toBeInTheDocument();
    });

    it('duplica un registro, abre la copia para editarla y la deja marcada con su gestión de origen', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();

      await user.click(await screen.findByRole('button', { name: 'Duplicar registro 1' }));

      expect(await screen.findByText('Registro duplicado en borradores.')).toBeInTheDocument();
      expect(await screen.findByRole('dialog', { name: 'Editar registro' })).toBeInTheDocument();
      expect(stored()).toHaveLength(2);
      expect(stored()[1]).toMatchObject({ desc: 'Actividad de prueba', duplicatedFromGestionId: 'G-1' });
    });

    it('elimina un registro; al eliminar el último avisa "No hay registros" y vuelve al estado vacío', async () => {
      seedDrafts(makeDraft(), makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1', desc: 'Segundo' }));
      const { user } = await setupApp();

      await user.click(await screen.findByRole('button', { name: 'Eliminar registro 1' }));
      expect(screen.queryByText('Actividad de prueba')).not.toBeInTheDocument();
      expect(stored()).toHaveLength(1);

      await user.click(screen.getByRole('button', { name: 'Eliminar registro 1' }));

      const alert = await screen.findByRole('alertdialog', { name: 'No se puede continuar' });
      expect(within(alert).getByText('No hay registros')).toBeInTheDocument();
      expect(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY)).toBeNull();
      expect(screen.getByText('Pega y procesa tus tiempos')).toBeInTheDocument();
    });

    it('cancelar la importación vacía los borradores y su almacenamiento', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();

      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));

      expect(await screen.findByText('Pega y procesa tus tiempos')).toBeInTheDocument();
      expect(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY)).toBeNull();
    });
  });

  describe.each([
    ['tarjetas (móvil)', 360, /^Cliente$/, /^Gestión Demanda$/, /^Tipo hora$/],
    ['tabla (escritorio)', WIDE, /^Cliente del registro 1$/, /^Gestión Demanda del registro 1$/, /^Tipo hora del registro 1$/],
  ])('selects por fila en %s', (_layout, width, clienteName, gestionName, tipoName) => {
    beforeEach(() => setViewportWidth(width));

    it('usa tabla solo desde 1280 px', async () => {
      seedDrafts(makeDraft());
      await setupApp();
      await screen.findByText('1 listos');
      if (width >= 1280) {
        const table = screen.getByRole('table');
        expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
          'Fecha',
          'Horario',
          'Horas',
          'Tipo hora',
          'Cliente',
          'Gestión Demanda',
          'Acciones',
        ]);
      } else {
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      }
    });

    it('elegir el cliente reinicia la gestión y selecciona la primera disponible', async () => {
      seedDrafts(makeDraft({ cliente: '', proyecto: '', solicitud: '', gestionId: '' }));
      const { user, repository } = await setupApp();
      await screen.findByText('1 por revisar');
      expect(screen.getByRole('combobox', { name: gestionName })).toBeDisabled();

      await pick(user, clienteName, 'Cliente Beta');

      await waitFor(() => expect(screen.getByRole('combobox', { name: gestionName })).toHaveTextContent('Gestión Tres'));
      expect(stored()[0]).toMatchObject({
        cliente: 'Cliente Beta',
        proyecto: 'Proyecto B',
        solicitud: 'Gestión Tres',
        gestionId: 'G-3',
      });
      expect(stored<Record<string, string>>(LAST_MANAGEMENT_STORAGE_KEY)).toEqual({ 'Cliente Beta': 'G-3' });
      expect(await screen.findByText('1 listos')).toBeInTheDocument();
      // Precarga al iniciar: las gestiones de todos los clientes se piden al abrir la página.
      expect(repository.getSolicitudOptions).toHaveBeenCalledWith('Cliente Alfa', 'Proyecto A');
      expect(repository.getSolicitudOptions).toHaveBeenCalledWith('Cliente Beta', 'Proyecto B');
    });

    it('autoselecciona la gestión recordada para ese cliente', async () => {
      localStorage.setItem(LAST_MANAGEMENT_STORAGE_KEY, JSON.stringify({ 'Cliente Alfa': 'G-2' }));
      seedDrafts(makeDraft({ cliente: 'Cliente Beta', proyecto: 'Proyecto B', solicitud: 'Gestión Tres', gestionId: 'G-3' }));
      const { user } = await setupApp();
      await screen.findByText('1 listos');

      await pick(user, clienteName, 'Cliente Alfa');

      await waitFor(() => expect(screen.getByRole('combobox', { name: gestionName })).toHaveTextContent('Gestión Dos'));
      expect(stored()[0]).toMatchObject({ cliente: 'Cliente Alfa', gestionId: 'G-2' });
    });

    it('cambiar la gestión a mano la recuerda para el cliente', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await screen.findByText('1 listos');
      await waitFor(() => expect(screen.getByRole('combobox', { name: gestionName })).not.toHaveAttribute('aria-busy', 'true'));

      await pick(user, gestionName, 'Gestión Dos');

      expect(stored()[0]).toMatchObject({ gestionId: 'G-2', solicitud: 'Gestión Dos' });
      expect(stored<Record<string, string>>(LAST_MANAGEMENT_STORAGE_KEY)).toEqual({ 'Cliente Alfa': 'G-2' });
    });

    it('cambiar el tipo de hora actualiza el borrador y el total del día', async () => {
      seedDrafts(makeDraft());
      const { user } = await setupApp();
      await screen.findByText('1.5h · Faltan 7.0h');

      await pick(user, tipoName, 'Fábrica');

      expect(stored()[0].tipoHora).toBe('Fábrica');
      expect(await screen.findByText('0.0h · Faltan 8.5h')).toBeInTheDocument();
    });

    it('un registro restaurado con cliente y sin gestión recibe la gestión preferida', async () => {
      seedDrafts(makeDraft({ proyecto: '', solicitud: '', gestionId: '' }));
      await setupApp();

      await waitFor(() => expect(stored()[0]).toMatchObject({ gestionId: 'G-1', solicitud: 'Gestión Uno', proyecto: 'Proyecto A' }));
    });
  });

  describe('plantilla obligatoria por gestión', () => {
    async function openTemplateDialog() {
      seedDrafts(makeDraft());
      const ctx = await setupApp({ templates: createFakeTemplates() });
      await screen.findByText('1 listos');
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Gestión Demanda' })).not.toHaveAttribute('aria-busy', 'true'));
      await pick(ctx.user, 'Gestión Demanda', 'Gestión Dos');
      const dialog = await screen.findByRole('dialog', { name: 'Configurar gestión' });
      return { ...ctx, dialog };
    }

    it('al elegir una gestión sin plantilla abre el diálogo con sus valores por defecto', async () => {
      const { dialog, templates } = await openTemplateDialog();

      expect(templates.registerKnownManagement).toHaveBeenCalledWith(expect.objectContaining({ id: 'G-2', client: 'Cliente Alfa' }));
      expect(within(dialog).getByText('Gestión Dos')).toBeInTheDocument();
      expect(within(dialog).getByText(/Configura estos valores una vez/)).toBeInTheDocument();
      // Tipo actividad trae el valor por defecto configurado; los demás obligatorios faltan.
      expect(within(dialog).getByText('1 de 11 obligatorios')).toBeInTheDocument();
      expect(within(dialog).getByLabelText('Proyecto')).toHaveValue('Proyecto A');
      expect(within(dialog).getAllByText('Campo obligatorio')).toHaveLength(10);
    });

    it('con la plantilla completa no abre el diálogo', async () => {
      seedDrafts(makeDraft());
      const { user, templates } = await setupApp();
      await screen.findByText('1 listos');
      await waitFor(() => expect(screen.getByRole('combobox', { name: 'Gestión Demanda' })).not.toHaveAttribute('aria-busy', 'true'));

      await pick(user, 'Gestión Demanda', 'Gestión Dos');

      await waitFor(() =>
        expect(templates.registerKnownManagement).toHaveBeenCalledWith(expect.objectContaining({ id: 'G-2' })),
      );
      expect(screen.queryByRole('dialog', { name: 'Configurar gestión' })).not.toBeInTheDocument();
      expect(templates.save).not.toHaveBeenCalled();
    });

    it('no guarda con obligatorios vacíos y los lista en el mismo orden que Angular', async () => {
      const { user, dialog, templates } = await openTemplateDialog();

      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      const alert = await screen.findByRole('alertdialog', { name: 'No se puede continuar' });
      expect(
        within(alert).getByText(
          'Faltan campos obligatorios: Funcional, Causa, Complejidad, Impacto, Equipo, Modo actuación, Lenguaje, Prefijo, RICEF object, Categoría.',
        ),
      ).toBeInTheDocument();
      expect(templates.save).not.toHaveBeenCalled();
    });

    it('guarda la plantilla completa, la marca como completada y cierra el diálogo', async () => {
      const { user, dialog, templates } = await openTemplateDialog();

      await user.type(within(dialog).getByLabelText(/^Funcional/), 'Funcional nuevo');
      const choices: Array<[string, string]> = [
        ['Causa', 'Error'],
        ['Complejidad', 'Media'],
        ['Impacto', 'Alto'],
        ['Equipo', 'Equipo B'],
        ['Modo actuación', 'Evolutivo'],
        ['Lenguaje', 'Java'],
        ['Prefijo', 'Y'],
        ['RICEF object', 'Interfaz'],
        ['Categoría', 'Proyecto'],
      ];
      for (const [label, option] of choices) await pick(user, label, option);
      expect(within(dialog).getByText('11 de 11 obligatorios')).toBeInTheDocument();

      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      expect(await screen.findByText('Configuración avanzada guardada para la gestión.')).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Configurar gestión' })).not.toBeInTheDocument());
      expect(templates.save).toHaveBeenCalledTimes(1);
      expect(templates.save).toHaveBeenCalledWith(
        expect.objectContaining({
          gestionId: 'G-2',
          gestionName: 'Gestión Dos',
          completed: true,
          values: expect.objectContaining({ funcional: 'Funcional nuevo', causa: 'Error', lenguaje: 'Java', categoria: 'Proyecto' }),
        }),
      );
    });

    it('si el guardado falla muestra el motivo y mantiene el diálogo abierto', async () => {
      const { user, dialog, templates } = await openTemplateDialog();
      templates.save.mockRejectedValueOnce(new Error('servicio no disponible'));
      await user.type(within(dialog).getByLabelText(/^Funcional/), 'F');
      for (const [label, option] of [
        ['Causa', 'Error'],
        ['Complejidad', 'Media'],
        ['Impacto', 'Alto'],
        ['Equipo', 'Equipo B'],
        ['Modo actuación', 'Evolutivo'],
        ['Lenguaje', 'Java'],
        ['Prefijo', 'Y'],
        ['RICEF object', 'Interfaz'],
        ['Categoría', 'Proyecto'],
      ]) {
        await pick(user, label, option);
      }

      await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

      const alert = await screen.findByRole('alertdialog');
      expect(within(alert).getByText('No se pudo guardar la configuración: servicio no disponible')).toBeInTheDocument();
      await user.click(within(alert).getByRole('button', { name: 'Entendido, revisar registros' }));
      expect(await screen.findByRole('dialog', { name: 'Configurar gestión' })).toBeInTheDocument();
    });

    it('Cancelar cierra el diálogo sin guardar', async () => {
      const { user, dialog, templates } = await openTemplateDialog();
      await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Configurar gestión' })).not.toBeInTheDocument());
      expect(templates.save).not.toHaveBeenCalled();
    });
  });

  describe('navegación', () => {
    it('salir de la página y volver conserva los borradores y no repite el aviso de restauración', async () => {
      seedDrafts(makeDraft({ desc: 'Se conserva' }));
      const { router, user } = await setupApp();
      expect(await screen.findAllByText('Se restauraron 1 registros pendientes.')).toHaveLength(1);
      await user.click(await screen.findByRole('button', { name: 'Duplicar registro 1' }));
      await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Editar registro' })).not.toBeInTheDocument());
      expect(screen.getAllByText('Se conserva')).toHaveLength(2);

      await act(() => router.navigate('/registros/dashboard'));
      expect(await screen.findByRole('heading', { name: 'Dashboard de tiempos' })).toBeInTheDocument();
      await act(() => router.navigate(IMPORT_PATH));

      expect(await screen.findByText('2 registros en 1 día')).toBeInTheDocument();
      expect(screen.getAllByText('Se conserva')).toHaveLength(2);
      expect(stored()).toHaveLength(2);
      expect(screen.queryAllByText(/Se restauraron/)).toHaveLength(1);
    });

    it('lo pegado se conserva al cambiar de ruta sin recargar', async () => {
      const { router, user } = await setupApp();
      paste(SAMPLE_TEXT);
      await process(user);
      await screen.findByText('2 registros en 1 día');

      await act(() => router.navigate('/registros/reportes'));
      await screen.findByRole('heading', { name: 'Reportes' });
      await act(() => router.navigate(IMPORT_PATH));

      expect(await screen.findByText('2 registros en 1 día')).toBeInTheDocument();
    });
  });

  describe('con el envío bloqueado (sendLocked)', () => {
    function renderLocked(phase: SendPhase) {
      const { container } = createDraftsContainer();
      seedDrafts(makeDraft({ proyecto: '', solicitud: '', gestionId: '' }), makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1', desc: 'Segundo' }));
      localStorage.setItem(TEXT_DRAFT_STORAGE_KEY, JSON.stringify({ rawText: SAMPLE_TEXT }));
      const view = render(
        <StrictMode>
          <AppProviders container={container} queryClient={createQueryClient(container.auth)}>
            <DraftsProvider initialSendPhase={phase}>
              <ImportPage />
            </DraftsProvider>
          </AppProviders>
        </StrictMode>,
      );
      return { ...view, container, user: userEvent.setup() };
    }

    it.each<SendPhase>(['sending', 'saving-logs', 'log-error'])(
      'fase %s: selects, acciones, importación y cancelación quedan deshabilitados',
      async (phase) => {
        const { container } = renderLocked(phase);
        await screen.findByText('2 registros en 1 día');

        // El diálogo de progreso (modal) oculta la página a los lectores de pantalla: se consulta con `hidden`.
        for (const button of ['Duplicar registro 1', 'Editar registro 1', 'Eliminar registro 2']) {
          expect(screen.getByRole('button', { name: button, hidden: true })).toBeDisabled();
        }
        expect(screen.getByRole('button', { name: 'Cancelar', hidden: true })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Procesar tiempos', hidden: true })).toBeDisabled();
        expect(screen.getByRole('button', { name: /Enviando/, hidden: true })).toBeDisabled();
        for (const combo of screen.getAllByRole('combobox', { hidden: true })) expect(combo).toBeDisabled();
        expect(screen.getByText(/Hay un envío en curso o pendiente de confirmar/)).toBeInTheDocument();
        // El texto pendiente no se descarta.
        expect(textarea()).toHaveValue(SAMPLE_TEXT);

        // La autoselección de gestión no actúa: el registro con cliente y sin gestión sigue igual.
        await waitFor(() => expect(container.timeRecordRepository.getClientes).toBeDefined());
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
        });
        expect(stored()[0]).toMatchObject({ gestionId: '', solicitud: '' });
      },
    );

    it('el texto pendiente tampoco se procesa aunque se fuerce el clic', async () => {
      renderLocked('sending');
      await screen.findByText('2 registros en 1 día');
      fireEvent.click(screen.getByRole('button', { name: 'Procesar tiempos', hidden: true }));
      expect(stored()).toHaveLength(2);
      expect(textarea()).toHaveValue(SAMPLE_TEXT);
    });

    it('fase completed: los borradores vuelven a ser editables', async () => {
      renderLocked('completed');
      await screen.findByText('2 registros en 1 día');
      expect(screen.getByRole('button', { name: 'Eliminar registro 2' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Procesar tiempos' })).toBeEnabled();
    });
  });

  it('las gestiones y los clientes ya cargados no se vuelven a pedir al volver a la página', async () => {
    seedDrafts(makeDraft());
    const { repository, router } = await setupApp();
    await screen.findByText('1 listos');
    await waitFor(() => expect(repository.getClientes).toHaveBeenCalled());
    const clientesCalls = repository.getClientes.mock.calls.length;
    const gestionCalls = repository.getSolicitudOptions.mock.calls.length;
    expect(Object.keys(testCatalog)).toHaveLength(2);

    await act(() => router.navigate('/registros/dashboard'));
    await act(() => router.navigate(IMPORT_PATH));
    await screen.findByText('1 listos');

    expect(repository.getClientes.mock.calls.length).toBe(clientesCalls);
    expect(repository.getSolicitudOptions.mock.calls.length).toBe(gestionCalls);
  });
});

describe('ImportPage · registrar todos', () => {
  const THREE = [
    makeDraft({ horaIni: '07:30', horaFin: '09:00', horas: '1.5' }),
    makeDraft({ horaIni: '09:00', horaFin: '10:00', horas: '1' }),
    makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1' }),
  ];

  async function setupSend(drafts: TimeRecord[] = THREE, sent: ManagementReport[] | Error = [], templates?: ReturnType<typeof createFakeTemplates>) {
    const stub = new SendAllStub();
    const sendLogs = { createMany: vi.fn(async () => undefined) };
    const timeManagement = { list: vi.fn(async () => { if (sent instanceof Error) throw sent; return sent; }) };
    seedDrafts(...drafts);
    const ctx = await setupApp({
      templates,
      overrides: {
        sendAllRecords: stub as unknown as SendAllRecordsUseCase,
        sendLogs: sendLogs as unknown as SendLogGateway,
        timeManagement: timeManagement as unknown as TimeManagementGateway,
      },
    });
    await screen.findByText(new RegExp(`^${drafts.length} registros? en 1 día$`));
    return { ...ctx, stub, sendLogs, timeManagement };
  }

  const sendButton = () => screen.findByRole('button', { name: /Registrar todos/ });

  afterEach(() => {
    localStorage.clear();
    act(() => void toast.dismiss());
  });

  it('muestra el conteo y registra con un diálogo de progreso que no se puede cerrar', async () => {
    const { user, stub } = await setupSend();
    expect(await sendButton()).toHaveTextContent('Registrar todos (3)');

    await user.click(await sendButton());

    const dialog = await screen.findByRole('dialog', { name: 'Registrando reportes' });
    expect(within(dialog).getByText('0 de 3 registros procesados')).toBeInTheDocument();
    expect(within(dialog).getByRole('progressbar', { name: 'Progreso del envío' })).toHaveAttribute('aria-valuenow', '0');
    expect(within(dialog).queryByRole('button')).not.toBeInTheDocument();

    act(() => stub.runs[0].onProgress?.(log(0)));
    expect(within(dialog).getByText('1 de 3 registros procesados')).toBeInTheDocument();
    expect(within(dialog).getByText('33%')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Registrando reportes' })).toBeInTheDocument();
  });

  it('al terminar muestra el resultado por registro y "Seguir registrando" cierra el diálogo', async () => {
    const { user, stub, sendLogs } = await setupSend();
    await user.click(await sendButton());
    await screen.findByRole('dialog', { name: 'Registrando reportes' });

    act(() => {
      stub.runs[0].onProgress?.(log(0));
      stub.runs[0].onProgress?.(log(1, false));
      stub.runs[0].onProgress?.(log(2));
    });
    await act(async () => stub.runs[0].resolve(result([0, 2], [1])));

    const dialog = await screen.findByRole('dialog', { name: 'Envío finalizado' });
    expect(within(dialog).getByText('Los registros quedaron enviados.')).toBeInTheDocument();
    expect(within(dialog).getByText('2 correctos · 1 con error')).toBeInTheDocument();
    const items = within(within(dialog).getByRole('list', { name: 'Resultado por registro' })).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    // Los logs llegan en el orden del resultado: primero los correctos y después el error.
    expect(within(items[2]).getByText('Con error')).toBeInTheDocument();
    expect(within(items[2]).getByText('Falló')).toBeInTheDocument();
    expect(sendLogs.createMany).toHaveBeenCalledTimes(1);
    expect(stored().map((record) => record.horaIni)).toEqual(['09:00']);

    await user.click(within(dialog).getByRole('button', { name: 'Seguir registrando' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('log-error ofrece reintentar la confirmación del historial', async () => {
    const { user, stub, sendLogs } = await setupSend();
    sendLogs.createMany.mockRejectedValueOnce(new Error('sin historial'));
    await user.click(await sendButton());
    await screen.findByRole('dialog', { name: 'Registrando reportes' });
    await act(async () => stub.runs[0].resolve(result([], [0, 1, 2])));

    const dialog = await screen.findByRole('dialog', { name: 'El proceso necesita atención' });
    expect(within(dialog).getByText('No se pudo confirmar el historial.')).toBeInTheDocument();
    expect(within(dialog).getByText('sin historial')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Ver historial/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Reintentar confirmación' }));
    expect(await screen.findByRole('dialog', { name: 'Envío finalizado' })).toBeInTheDocument();
    expect(sendLogs.createMany).toHaveBeenCalledTimes(2);
  });

  it('un fallo del envío muestra el error y "Volver a los registros" libera los borradores', async () => {
    const { user, stub } = await setupSend();
    await user.click(await sendButton());
    await screen.findByRole('dialog', { name: 'Registrando reportes' });
    await act(async () => stub.runs[0].reject(new Error('Sin conexión')));

    const dialog = await screen.findByRole('dialog', { name: 'El proceso necesita atención' });
    expect(within(dialog).getByText('No fue posible completar el envío.')).toBeInTheDocument();
    expect(within(dialog).getByText('Sin conexión')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Volver a los registros' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await sendButton()).toBeEnabled();
  });

  it('navegar fuera y volver durante el envío conserva el bloqueo y no duplica el envío', async () => {
    const { user, stub, router } = await setupSend();
    await user.click(await sendButton());
    await screen.findByRole('dialog', { name: 'Registrando reportes' });
    act(() => stub.runs[0].onProgress?.(log(0)));

    await act(() => router.navigate('/registros/dashboard'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await act(() => router.navigate(IMPORT_PATH));

    const dialog = await screen.findByRole('dialog', { name: 'Registrando reportes' });
    expect(within(dialog).getByText('1 de 3 registros procesados')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Enviando/, hidden: true })).toBeDisabled();
    expect(stub.runs).toHaveLength(1);
  });

  it('con exceso de jornada por lo ya enviado pide confirmar; cancelar no envía y confirmar sí', async () => {
    const sent: ManagementReport[] = [
      { identificador: 'RH-1', idConsultor: undefined, HoraInicio: '2026-09-09T15:00:00.000Z', HoraFin: '2026-09-09T17:00:00.000Z', tiempoRealHoras: '2', tipoHora: 'Laboral' },
    ];
    const { user, stub } = await setupSend([makeDraft({ horaIni: '07:00', horaFin: '14:00', horas: '7' })], sent);

    await user.click(await sendButton());
    const alert = await screen.findByRole('alertdialog', { name: 'Exceso de jornada con lo ya enviado' });
    expect(within(alert).getByText(/9\.0h\/8\.5h \(2\.0h ya enviadas\)/)).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: 'Revisar registros' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(stub.runs).toHaveLength(0);
    expect(await sendButton()).toBeEnabled();

    await user.click(await sendButton());
    await user.click(await screen.findByRole('button', { name: 'Enviar de todos modos' }));
    expect(await screen.findByRole('dialog', { name: 'Registrando reportes' })).toBeInTheDocument();
    expect(stub.runs).toHaveLength(1);
  });

  it('un horario que se cruza con un registro ya enviado bloquea el envío', async () => {
    const sent: ManagementReport[] = [
      { identificador: 'RH-1', HoraInicio: '2026-09-09T08:00:00.000Z', HoraFin: '2026-09-09T09:30:00.000Z', tiempoRealHoras: '1.5', tipoHora: 'Laboral' },
    ];
    const { user, stub } = await setupSend([makeDraft()], sent);

    await user.click(await sendButton());

    const alert = await screen.findByRole('alertdialog', { name: 'Envío bloqueado por horario cruzado' });
    expect(within(alert).getByText(/se cruzan con horarios que ya enviaste.*07:30-09:00 con 08:00-09:30/)).toBeInTheDocument();
    expect(stub.runs).toHaveLength(0);
    await user.click(within(alert).getByRole('button', { name: 'Entendido, revisar registros' }));
    expect(await sendButton()).toBeEnabled();
  });

  it('si la consulta de lo enviado falla, avisa y envía igual', async () => {
    const { user, stub } = await setupSend([makeDraft()], new Error('sin red'));

    await user.click(await sendButton());

    expect(await screen.findByRole('dialog', { name: 'Registrando reportes' })).toBeInTheDocument();
    expect(stub.runs).toHaveLength(1);
    expect(await screen.findByText('No se pudo verificar lo ya enviado; se continúa sin esa comprobación.')).toBeInTheDocument();
  });

  it('una plantilla obligatoria incompleta abre el diálogo de configuración en modo edición', async () => {
    const templates = createFakeTemplates([{ ...completeTemplate('G-1', 'Gestión Uno'), completed: false }]);
    const { user, stub } = await setupSend([makeDraft()], [], templates);

    await user.click(await sendButton());

    const dialog = await screen.findByRole('dialog', { name: 'Editar configuración' });
    expect(within(dialog).getByText('Gestión Uno')).toBeInTheDocument();
    expect(await screen.findByText('Llena la configuración avanzada de la gestión antes de enviar.')).toBeInTheDocument();
    expect(stub.runs).toHaveLength(0);
  });

  it('sin plantilla para la gestión abre el diálogo de configuración nueva', async () => {
    const { user, stub } = await setupSend([makeDraft()], [], createFakeTemplates([]));

    await user.click(await sendButton());

    expect(await screen.findByRole('dialog', { name: 'Configurar gestión' })).toBeInTheDocument();
    expect(stub.runs).toHaveLength(0);
  });
});
