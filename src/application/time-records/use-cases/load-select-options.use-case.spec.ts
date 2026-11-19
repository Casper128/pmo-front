import { describe, expect, it, vi } from 'vitest';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import { LoadSelectOptionsUseCase } from './load-select-options.use-case';

function repositoryStub() {
  return {
    getClientes: vi.fn(() => Promise.resolve(['Cliente A', 'Cliente B'])),
    getProyectos: vi.fn((cliente: string) => Promise.resolve([`${cliente} P1`, `${cliente} P2`])),
    getSolicitudes: vi.fn(() => Promise.resolve([])),
    getSolicitudOptions: vi.fn((_cliente: string, proyecto: string) =>
      Promise.resolve([{ id: `${proyecto}-g1`, name: 'Gestión 1', requestValue: 'G1' }]),
    ),
  };
}

describe('LoadSelectOptionsUseCase · caché de gestiones', () => {
  it('consulta cada cliente una sola vez y resuelve el primer proyecto', async () => {
    const repo = repositoryStub();
    const useCase = new LoadSelectOptionsUseCase(repo as unknown as TimeRecordRepository);

    const first = await useCase.managementOptions('Cliente A');
    await useCase.managementOptions('Cliente A');
    // Alias por proyecto resuelto: no vuelve a consultar.
    await useCase.managementOptions('Cliente A', 'Cliente A P1');

    expect(first.project).toBe('Cliente A P1');
    expect(first.options[0]).toMatchObject({ client: 'Cliente A', project: 'Cliente A P1' });
    expect(repo.getProyectos).toHaveBeenCalledTimes(1);
    expect(repo.getSolicitudOptions).toHaveBeenCalledTimes(1);
  });

  it('precarga todos los clientes sin duplicados', async () => {
    const repo = repositoryStub();
    const useCase = new LoadSelectOptionsUseCase(repo as unknown as TimeRecordRepository);

    await useCase.preloadManagementOptions(['Cliente A', 'Cliente B', 'Cliente A', '']);
    await useCase.managementOptions('Cliente B');

    expect(repo.getSolicitudOptions).toHaveBeenCalledTimes(2);
  });

  it('descarta la entrada fallida para permitir reintentar y la precarga no falla', async () => {
    const repo = repositoryStub();
    repo.getSolicitudOptions.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const useCase = new LoadSelectOptionsUseCase(repo as unknown as TimeRecordRepository);

    await useCase.preloadManagementOptions(['Cliente A']);
    const retry = await useCase.managementOptions('Cliente A');

    expect(retry.options).toHaveLength(1);
    expect(repo.getSolicitudOptions).toHaveBeenCalledTimes(2);
  });
});
