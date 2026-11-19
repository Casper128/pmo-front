import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordRegistrationResponse } from '@domain/time-records/models/time-record-api.model';
import type { RegisterTimeRecordUseCase } from './register-time-record.use-case';
import { SEND_DELAY_MS, SendAllRecordsUseCase, type SendRecordLog } from './send-all-records.use-case';

const record = (solicitud: string, desc = ''): TimeRecord => ({
  fecha: '2026-09-09',
  horaIni: '08:00',
  horaFin: '09:00',
  horas: '1',
  desc,
  observacion: '',
  cliente: 'Cliente',
  proyecto: 'Proyecto',
  solicitud,
  gestionId: `${solicitud}-id`,
  tipoHora: 'Laboral',
});

const ok = (identificador: string): TimeRecordRegistrationResponse => ({ status: 200, identificador });

function setup(execute: (record: TimeRecord) => Promise<TimeRecordRegistrationResponse>) {
  const register = { execute: vi.fn(execute) };
  const useCase = new SendAllRecordsUseCase(register as unknown as RegisterTimeRecordUseCase);
  return { register, useCase };
}

describe('SendAllRecordsUseCase', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('envía en orden, uno a uno, esperando 900 ms antes de cada registro salvo el primero', async () => {
    const { register, useCase } = setup(async (r) => ok(`ID-${r.solicitud}`));
    const records = [record('A'), record('B'), record('C')];

    const result = useCase.execute(records);

    await vi.advanceTimersByTimeAsync(0);
    expect(register.execute).toHaveBeenCalledTimes(1);
    expect(register.execute).toHaveBeenNthCalledWith(1, records[0]);

    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 1);
    expect(register.execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(register.execute).toHaveBeenCalledTimes(2);
    expect(register.execute).toHaveBeenNthCalledWith(2, records[1]);

    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS);
    expect(register.execute).toHaveBeenNthCalledWith(3, records[2]);

    await expect(result).resolves.toEqual({
      enviados: 3,
      errores: 0,
      enviadosIndices: [0, 1, 2],
      erroresIndices: [],
      logs: [
        { index: 0, ok: true, identificador: 'ID-A', response: ok('ID-A'), errorMessage: undefined },
        { index: 1, ok: true, identificador: 'ID-B', response: ok('ID-B'), errorMessage: undefined },
        { index: 2, ok: true, identificador: 'ID-C', response: ok('ID-C'), errorMessage: undefined },
      ],
    });
  });

  it('no espera a que pase el tiempo si el registro anterior tarda (espera tras cada respuesta)', async () => {
    let resolveFirst: (value: TimeRecordRegistrationResponse) => void = () => undefined;
    const { register, useCase } = setup((r) =>
      r.solicitud === 'A'
        ? new Promise((resolve) => (resolveFirst = resolve))
        : Promise.resolve(ok('ID-B')),
    );

    const result = useCase.execute([record('A'), record('B')]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(register.execute).toHaveBeenCalledTimes(1);

    resolveFirst(ok('ID-A'));
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS - 1);
    expect(register.execute).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(register.execute).toHaveBeenCalledTimes(2);
    await expect(result).resolves.toMatchObject({ enviados: 2 });
  });

  it('un error por registro no detiene el lote y notifica el progreso tras cada intento', async () => {
    const { useCase } = setup(async (r) => {
      if (r.solicitud === 'B') throw { statusText: 'Bad Gateway' };
      if (r.solicitud === 'C') return { status: 500, mensaje: 'Gestión cerrada' };
      if (r.solicitud === '') throw 'texto';
      return { mensaje: 'Tiempo REGISTRADO', data: { row: { identificador: 'RH-1' } } };
    });
    const progress: SendRecordLog[] = [];

    const result = useCase.execute(
      [record('A'), record('B'), record('C'), record('', 'Descripción'), record('', '')],
      (log) => progress.push(log),
    );
    await vi.runAllTimersAsync();

    const expectedLogs = [
      {
        index: 0,
        ok: true,
        identificador: 'RH-1',
        response: { mensaje: 'Tiempo REGISTRADO', data: { row: { identificador: 'RH-1' } } },
        errorMessage: undefined,
      },
      { index: 1, ok: false, identificador: 'B', errorMessage: 'Bad Gateway' },
      {
        index: 2,
        ok: false,
        identificador: 'C',
        response: { status: 500, mensaje: 'Gestión cerrada' },
        errorMessage: 'Gestión cerrada',
      },
      { index: 3, ok: false, identificador: 'Descripción', errorMessage: 'Error al registrar' },
      { index: 4, ok: false, identificador: 'Registro 5', errorMessage: 'Error al registrar' },
    ];
    await expect(result).resolves.toEqual({
      enviados: 1,
      errores: 4,
      enviadosIndices: [0],
      erroresIndices: [1, 2, 3, 4],
      logs: expectedLogs,
    });
    expect(progress).toEqual(expectedLogs);
    const { logs } = await result;
    progress.forEach((log, i) => expect(log).toBe(logs[i]));
  });

  it('extrae el identificador RH-…DO-n del cuerpo y usa "Respuesta no confirmada" sin mensaje', async () => {
    const { useCase } = setup(async (r) =>
      r.solicitud === 'A'
        ? { status: 200, detalle: 'Creado RH-2026-09-09-DO-77 correctamente' }
        : { status: 202 },
    );

    const result = useCase.execute([record('A'), record('B')]);
    await vi.runAllTimersAsync();

    const { logs } = await result;
    expect(logs[0]).toMatchObject({ ok: true, identificador: 'RH-2026-09-09-DO-77' });
    expect(logs[1]).toMatchObject({ ok: false, identificador: 'B', errorMessage: 'Respuesta no confirmada' });
  });

  it('devuelve un resultado vacío sin registros', async () => {
    const { register, useCase } = setup(async () => ok('x'));
    await expect(useCase.execute([])).resolves.toEqual({
      enviados: 0,
      errores: 0,
      enviadosIndices: [],
      erroresIndices: [],
      logs: [],
    });
    expect(register.execute).not.toHaveBeenCalled();
  });

  it('al abortar durante la espera no envía el siguiente registro y rechaza con el motivo', async () => {
    const { register, useCase } = setup(async (r) => ok(r.solicitud));
    const controller = new AbortController();
    const progress = vi.fn();

    const result = useCase.execute([record('A'), record('B')], progress, controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS / 2);
    controller.abort();
    await vi.runAllTimersAsync();

    await rejection;
    expect(register.execute).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it('con la señal ya abortada no envía nada', async () => {
    const { register, useCase } = setup(async () => ok('x'));
    const controller = new AbortController();
    controller.abort();

    await expect(useCase.execute([record('A')], undefined, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(register.execute).not.toHaveBeenCalled();
  });

  it('no cancela la petición en curso: el aborto se aplica antes del siguiente registro', async () => {
    const controller = new AbortController();
    const { register, useCase } = setup(async () => {
      controller.abort();
      return ok('A');
    });
    const progress = vi.fn();

    const result = useCase.execute([record('A'), record('B')], progress, controller.signal);
    const rejection = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.runAllTimersAsync();

    await rejection;
    expect(register.execute).toHaveBeenCalledTimes(1);
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ index: 0, ok: true }));
  });

  it('copia el lote: mutar el array original durante el envío no salta registros ni desalinea log.index', async () => {
    const { register, useCase } = setup(async (r) => ok(`ID-${r.solicitud}`));
    const records = [record('A'), record('B'), record('C')];
    const [a, b, c] = records;
    const progress: SendRecordLog[] = [];

    const result = useCase.execute(records, (log) => {
      progress.push(log);
      // Poda del consumidor: retira del array original el registro confirmado.
      if (log.ok) records.splice(0, 1);
    });
    await vi.runAllTimersAsync();

    expect(register.execute.mock.calls.map(([sent]) => sent)).toEqual([a, b, c]);
    expect(records).toEqual([]);
    expect(progress.map(({ index, identificador }) => [index, identificador])).toEqual([
      [0, 'ID-A'],
      [1, 'ID-B'],
      [2, 'ID-C'],
    ]);
    await expect(result).resolves.toMatchObject({ enviados: 3, enviadosIndices: [0, 1, 2] });
  });

  it('añadir registros al array original durante el envío no los incluye en el lote en curso', async () => {
    const { register, useCase } = setup(async (r) => ok(r.solicitud));
    const records = [record('A')];

    const result = useCase.execute(records, () => records.push(record('Z')));
    await vi.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ enviados: 1, enviadosIndices: [0] });
    expect(register.execute).toHaveBeenCalledTimes(1);
  });
});
