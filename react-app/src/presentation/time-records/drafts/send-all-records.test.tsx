import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { SendAllRecordsUseCase } from '@application/time-records/use-cases/send-all-records.use-case';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import { createDraftsContainer, makeDraft } from '@/test/fakes/drafts-fixtures';
import { SendAllStub, log, result } from '@/test/fakes/send-all-stub';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { useDrafts } from './drafts-context';
import { DraftsProvider } from './drafts-provider';
import { PENDING_RECORDS_STORAGE_KEY } from './pending-records-storage';

const THREE = [
  makeDraft({ horaIni: '07:30', horaFin: '09:00', horas: '1.5' }),
  makeDraft({ horaIni: '09:00', horaFin: '10:00', horas: '1' }),
  makeDraft({ horaIni: '10:00', horaFin: '11:00', horas: '1' }),
];

function setup(options: { createMany?: SendLogGateway['createMany'] } = {}) {
  const stub = new SendAllStub();
  const sendLogs = { createMany: vi.fn(options.createMany ?? (async () => undefined)) };
  const timeManagement = { list: vi.fn(async () => []) };
  const ctx = createDraftsContainer({
    overrides: {
      sendAllRecords: stub as unknown as SendAllRecordsUseCase,
      sendLogs: sendLogs as unknown as SendLogGateway,
      timeManagement: timeManagement as unknown as TimeManagementGateway,
    },
  });
  localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify(THREE));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <AppProviders container={ctx.container} queryClient={createQueryClient(ctx.container.auth)}>
        <DraftsProvider>{children}</DraftsProvider>
      </AppProviders>
    </StrictMode>
  );
  const hook = renderHook(() => useDrafts(), { wrapper });
  return { stub, sendLogs, timeManagement, ...hook };
}

const stored = () => (JSON.parse(localStorage.getItem(PENDING_RECORDS_STORAGE_KEY) ?? '[]') as TimeRecord[]).map((record) => record.horaIni);
const horas = (records: readonly TimeRecord[]) => records.map((record) => record.horaIni);

async function startSend(ctx: ReturnType<typeof setup>) {
  await act(async () => {
    await ctx.result.current.sendAll();
  });
  expect(ctx.stub.runs).toHaveLength(1);
  return ctx.stub.runs[0];
}

describe('envío masivo (useSendAllRecords en DraftsProvider)', () => {
  afterEach(() => localStorage.clear());

  it('un doble clic con StrictMode envía una sola vez y bloquea los cambios', async () => {
    const ctx = setup();
    const outcomes: string[] = [];
    await act(async () => {
      const first = ctx.result.current.sendAll();
      const second = ctx.result.current.sendAll();
      outcomes.push((await first).status, (await second).status);
    });

    expect(outcomes).toEqual(['started', 'ignored']);
    expect(ctx.stub.runs).toHaveLength(1);
    expect(ctx.stub.runs[0].records).toHaveLength(3);
    expect(ctx.result.current.sendPhase).toBe('sending');
    expect(ctx.result.current.sendLocked).toBe(true);

    const before = ctx.result.current.records;
    act(() => {
      expect(ctx.result.current.addRecords([makeDraft({ horaIni: '12:00', horaFin: '13:00' })])).toBe(false);
      ctx.result.current.updateRecord(0, (current) => ({ ...current, gestionId: 'G-2' }));
      expect(ctx.result.current.duplicateRecord(0)).toBeNull();
      ctx.result.current.clearRecords();
      ctx.result.current.continueAfterSend();
    });
    await act(async () => void (await ctx.result.current.sendAll()));
    expect(ctx.result.current.records).toBe(before);
    expect(ctx.result.current.sendPhase).toBe('sending');
    expect(ctx.stub.runs).toHaveLength(1);
  });

  it('el lote es una copia: cambios posteriores no alteran lo que se envía', async () => {
    const ctx = setup();
    const run = await startSend(ctx);
    expect(run.records).toEqual(THREE);
    expect(run.records).not.toBe(ctx.result.current.records);
  });

  it('el contador y el porcentaje nunca superan el total ni el 100 %', async () => {
    const ctx = setup();
    const run = await startSend(ctx);

    act(() => [0, 1, 2, 0, 1].forEach((index) => run.onProgress?.(log(index))));

    expect(ctx.result.current.sendProgress).toMatchObject({ total: 3, processed: 3, percent: 100 });
  });

  it('ignora el progreso y el resultado de una ejecución anterior', async () => {
    const ctx = setup();
    const first = await startSend(ctx);
    await act(async () => first.reject(new Error('fallo de red')));
    expect(ctx.result.current.sendPhase).toBe('failed');
    act(() => ctx.result.current.continueAfterSend());
    expect(ctx.result.current.sendPhase).toBe('idle');

    await act(async () => void (await ctx.result.current.sendAll()));
    expect(ctx.stub.runs).toHaveLength(2);

    act(() => {
      first.onProgress?.(log(0));
      first.onProgress?.(log(1));
    });
    await act(async () => first.resolve(result([0, 1, 2])));

    expect(ctx.result.current.sendProgress.processed).toBe(0);
    expect(ctx.result.current.sendPhase).toBe('sending');
    expect(ctx.result.current.records).toHaveLength(3);
    expect(stored()).toHaveLength(3);
  });

  it('retira de borradores y de localStorage cada registro en cuanto se confirma', async () => {
    const ctx = setup();
    const run = await startSend(ctx);

    act(() => run.onProgress?.(log(0)));
    expect(horas(ctx.result.current.records)).toEqual(['09:00', '10:00']);
    expect(stored()).toEqual(['09:00', '10:00']);

    act(() => run.onProgress?.(log(1, false)));
    expect(horas(ctx.result.current.records)).toEqual(['09:00', '10:00']);
    expect(stored()).toEqual(['09:00', '10:00']);

    act(() => run.onProgress?.(log(2)));
    expect(horas(ctx.result.current.records)).toEqual(['09:00']);
    expect(stored()).toEqual(['09:00']);
  });

  it('al completar guarda los logs, expone el resultado por registro y libera con "Seguir registrando"', async () => {
    const ctx = setup();
    const run = await startSend(ctx);
    act(() => {
      run.onProgress?.(log(0));
      run.onProgress?.(log(1));
      run.onProgress?.(log(2, false));
    });
    await act(async () => run.resolve(result([0, 1], [2])));

    await waitFor(() => expect(ctx.result.current.sendPhase).toBe('completed'));
    expect(ctx.sendLogs.createMany).toHaveBeenCalledWith([
      { itemIndex: 0, successful: true, reference: 'ID-0', errorMessage: undefined },
      { itemIndex: 1, successful: true, reference: 'ID-1', errorMessage: undefined },
      { itemIndex: 2, successful: false, reference: 'ID-2', errorMessage: 'Falló' },
    ]);
    expect(ctx.result.current.sendProgress).toMatchObject({ successCount: 2, errorCount: 1 });
    expect(ctx.result.current.sendProgress.results.map((item) => item.ok)).toEqual([true, true, false]);
    expect(horas(ctx.result.current.records)).toEqual(['10:00']);
    expect(stored()).toEqual(['10:00']);
    // Completed ya no bloquea los borradores.
    expect(ctx.result.current.sendLocked).toBe(false);

    act(() => ctx.result.current.continueAfterSend());
    expect(ctx.result.current.sendPhase).toBe('idle');
  });

  it('log-error mantiene el bloqueo, conserva lo confirmado fuera de borradores y reintenta el historial', async () => {
    const createMany = vi.fn<SendLogGateway['createMany']>().mockRejectedValueOnce(new Error('sin historial')).mockResolvedValue(undefined);
    const ctx = setup({ createMany });
    const run = await startSend(ctx);
    act(() => {
      run.onProgress?.(log(0));
      run.onProgress?.(log(1, false));
      run.onProgress?.(log(2));
    });
    await act(async () => run.resolve(result([0, 2], [1])));

    await waitFor(() => expect(ctx.result.current.sendPhase).toBe('log-error'));
    expect(ctx.result.current.sendProgress.failureMessage).toBe('sin historial');
    expect(ctx.result.current.sendLocked).toBe(true);
    expect(horas(ctx.result.current.records)).toEqual(['09:00']);
    expect(stored()).toEqual(['09:00']);
    // Con el historial pendiente no se acepta otro envío.
    await act(async () => void (await ctx.result.current.sendAll()));
    expect(ctx.stub.runs).toHaveLength(1);

    act(() => {
      ctx.result.current.retrySendLogs();
      ctx.result.current.retrySendLogs();
    });
    await waitFor(() => expect(ctx.result.current.sendPhase).toBe('completed'));
    expect(createMany).toHaveBeenCalledTimes(2);
    expect(ctx.result.current.sendProgress).toMatchObject({ successCount: 2, errorCount: 1 });
  });

  it('failed conserva lo no enviado, poda lo confirmado y no deja bloqueados los borradores', async () => {
    const ctx = setup();
    const run = await startSend(ctx);
    act(() => run.onProgress?.(log(0)));
    await act(async () => run.reject({ status: 0, error: { message: 'Sin conexión' } }));

    expect(ctx.result.current.sendPhase).toBe('failed');
    expect(ctx.result.current.sendProgress.failureMessage).toBe('Sin conexión');
    expect(horas(ctx.result.current.records)).toEqual(['09:00', '10:00']);
    expect(stored()).toEqual(['09:00', '10:00']);
    expect(ctx.result.current.sendLocked).toBe(false);

    act(() => ctx.result.current.continueAfterSend());
    expect(ctx.result.current.sendPhase).toBe('idle');
  });
});
