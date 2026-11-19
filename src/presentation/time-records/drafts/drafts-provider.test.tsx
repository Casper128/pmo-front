import { act, renderHook, screen } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { createDraftsContainer, makeDraft } from '@/test/fakes/drafts-fixtures';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { useDrafts } from './drafts-context';
import { DraftsProvider } from './drafts-provider';
import { PENDING_RECORDS_STORAGE_KEY } from './pending-records-storage';
import type { SendPhase } from './send-phase';

function setup(sendPhase: SendPhase = 'idle', parameters = {}) {
  const { container } = createDraftsContainer({ parameters });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <AppProviders container={container} queryClient={createQueryClient(container.auth)}>
        <DraftsProvider initialSendPhase={sendPhase}>{children}</DraftsProvider>
      </AppProviders>
    </StrictMode>
  );
  return renderHook(() => useDrafts(), { wrapper });
}

const stored = () => JSON.parse(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY) ?? 'null') as unknown;

describe('DraftsProvider', () => {
  afterEach(() => localStorage.clear());

  it('restaura los borradores de pmo_pending_time_records ordenados y avisa una sola vez (StrictMode)', async () => {
    const late = makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1', desc: 'Tarde' });
    const early = makeDraft({ desc: 'Temprano' });
    localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify([late, early]));

    const { result } = setup();

    expect(result.current.records.map((record) => record.desc)).toEqual(['Temprano', 'Tarde']);
    expect(await screen.findAllByText('Se restauraron 2 registros pendientes.')).toHaveLength(1);
    expect(result.current.groups).toHaveLength(1);
    expect(result.current.totalGeneral).toBe(2.5);
  });

  it('sin datos o con JSON dañado arranca vacío y borra la clave dañada', () => {
    localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, '{no es json');
    const { result } = setup();
    expect(result.current.records).toEqual([]);
    expect(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY)).toBeNull();
  });

  it('persiste en cada cambio con el formato de Angular y borra la clave al quedar vacío', () => {
    const { result } = setup();

    let added = false;
    act(() => {
      added = result.current.addRecords([makeDraft({ tipoHora: '' }), makeDraft({ horaIni: '06:00', horaFin: '07:00', horas: '1' })]);
    });
    expect(added).toBe(true);
    expect(result.current.records.map((record) => record.horaIni)).toEqual(['06:00', '07:30']);
    // El tipo de hora vacío toma el predeterminado configurado.
    expect(result.current.records[1].tipoHora).toBe('Laboral');
    expect(stored()).toEqual(result.current.records);

    act(() => result.current.clearRecords());
    expect(result.current.records).toEqual([]);
    expect(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY)).toBeNull();
  });

  it('updateRecord recalcula las horas y devuelve el registro actualizado', () => {
    const { result } = setup();
    act(() => void result.current.addRecords([makeDraft()]));

    let updated: ReturnType<typeof result.current.updateRecord> = null;
    act(() => {
      updated = result.current.updateRecord(0, (current) => ({ ...current, horaFin: '10:00', tipoHora: 'Fábrica' }));
    });

    expect(updated).toMatchObject({ horas: '2.5', tipoHora: 'Fábrica' });
    expect(result.current.records[0]).toMatchObject({ horas: '2.5', tipoHora: 'Fábrica' });
    // Fábrica no cuenta para el total.
    expect(result.current.totalGeneral).toBe(0);
  });

  it('dos cambios seguidos en el mismo tick no se pisan (lee el estado más reciente)', () => {
    const { result } = setup();
    act(() => void result.current.addRecords([makeDraft()]));
    act(() => {
      result.current.updateRecord(0, (current) => ({ ...current, cliente: 'Cliente Beta' }));
      result.current.updateRecord(0, (current) => ({ ...current, tipoHora: 'No facturable' }));
    });
    expect(result.current.records[0]).toMatchObject({ cliente: 'Cliente Beta', tipoHora: 'No facturable' });
  });

  it('saveEdit valida con el dominio y el tope diario de un registro computable', () => {
    const { result } = setup();
    act(() => void result.current.addRecords([makeDraft()]));

    let outcome: ReturnType<typeof result.current.saveEdit> | undefined;
    act(() => {
      outcome = result.current.saveEdit(0, makeDraft({ desc: '', horaIni: '06:00', horaFin: '17:00' }));
    });
    expect(outcome).toEqual({
      status: 'invalid',
      errors: ['Descripción', 'Un registro computable no puede superar 10 horas'],
    });
    expect(result.current.records[0].desc).toBe('Actividad de prueba');

    act(() => {
      outcome = result.current.saveEdit(0, makeDraft({ desc: 'Nueva', horas: '999' }));
    });
    expect(outcome).toEqual({ status: 'saved' });
    // Las horas se recalculan desde el horario, no se confía en el valor recibido.
    expect(result.current.records[0]).toMatchObject({ desc: 'Nueva', horas: '1.5' });
  });

  it('deleteRecord devuelve cuántos quedan; índices inexistentes no hacen nada', () => {
    const { result } = setup();
    act(() => void result.current.addRecords([makeDraft(), makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1' })]));

    let remaining: number | null = null;
    act(() => {
      remaining = result.current.deleteRecord(5);
    });
    expect(remaining).toBeNull();
    act(() => {
      remaining = result.current.deleteRecord(0);
    });
    expect(remaining).toBe(1);
    act(() => {
      remaining = result.current.deleteRecord(0);
    });
    expect(remaining).toBe(0);
    expect(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY)).toBeNull();
  });

  it('duplicateRecord agrega la copia marcada con su gestión de origen y devuelve su índice', () => {
    const { result } = setup();
    act(() => void result.current.addRecords([makeDraft()]));

    let copy: ReturnType<typeof result.current.duplicateRecord> = null;
    act(() => {
      copy = result.current.duplicateRecord(0);
    });

    expect(result.current.records).toHaveLength(2);
    expect(copy).toMatchObject({ record: { duplicatedFromGestionId: 'G-1', desc: 'Actividad de prueba' } });
    expect(result.current.records[(copy as unknown as { index: number }).index]).toEqual(
      (copy as unknown as { record: unknown }).record,
    );
  });

  it.each<SendPhase>(['sending', 'saving-logs', 'log-error'])(
    'con la fase %s todos los mutadores quedan bloqueados',
    (phase) => {
      const draft = makeDraft();
      localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify([draft]));
      const { result } = setup(phase);
      expect(result.current.sendLocked).toBe(true);

      let saved: ReturnType<typeof result.current.saveEdit> | undefined;
      let updated: ReturnType<typeof result.current.updateRecord> = makeDraft();
      let removed: number | null = 0;
      let copy: ReturnType<typeof result.current.duplicateRecord> = { index: 0, record: draft };
      let added = true;
      act(() => {
        added = result.current.addRecords([makeDraft({ desc: 'nuevo' })]);
        updated = result.current.updateRecord(0, (current) => ({ ...current, cliente: 'Cliente Beta' }));
        saved = result.current.saveEdit(0, makeDraft({ desc: 'editado' }));
        removed = result.current.deleteRecord(0);
        copy = result.current.duplicateRecord(0);
        result.current.clearRecords();
      });

      expect([added, updated, removed, copy]).toEqual([false, null, null, null]);
      expect(saved).toEqual({ status: 'locked' });
      expect(result.current.records).toEqual([draft]);
      expect(stored()).toEqual([draft]);
    },
  );

  it.each<SendPhase>(['idle', 'completed', 'failed'])('con la fase %s los borradores se pueden modificar', (phase) => {
    const { result } = setup(phase);
    expect(result.current.sendLocked).toBe(false);
    let added = false;
    act(() => {
      added = result.current.addRecords([makeDraft()]);
    });
    expect(added).toBe(true);
    // Modificar los borradores tras un envío finalizado libera la fase (resetSendTracking de Angular).
    expect(result.current.sendPhase).toBe('idle');
  });
});
