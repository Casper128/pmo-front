import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { SendLogGateway } from '@application/time-records/ports/send-log.gateway';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { TimeRecordApiBody } from '@domain/time-records/models/time-record-api.model';
import { createDraftsContainer, createFakeRepository, makeDraft } from '@/test/fakes/drafts-fixtures';
import { TEST_TIMEZONES, TIMEZONE_OFFSETS, useTimezone } from '@/test/timezones';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { useDrafts } from './drafts-context';
import { DraftsProvider } from './drafts-provider';

/** Fábrica 19:30-23:59: en UTC el reloj ya cambió de día, por eso la fecha viaja anclada a 12:00 de Colombia. */
const FACTORY = makeDraft({
  fecha: '2026-09-09',
  horaIni: '19:30',
  horaFin: '23:59',
  horas: '4.5',
  tipoHora: 'Fábrica',
  desc: 'Pruebas en fábrica',
});

describe.each(TEST_TIMEZONES)('envío de un registro de Fábrica (zona %s)', (timezone) => {
  useTimezone(timezone);
  afterEach(() => localStorage.clear());

  it('el cuerpo enviado trae la fecha del día trabajado, igual en cualquier zona', async () => {
    expect(new Date().getTimezoneOffset()).toBe(TIMEZONE_OFFSETS[timezone]);

    const bodies: TimeRecordApiBody[] = [];
    const repository = {
      ...createFakeRepository(),
      register: vi.fn(async (body: TimeRecordApiBody) => {
        bodies.push(body);
        return { status: 200, identificador: 'RH-FABRICA-DO-1' };
      }),
    };
    const { container } = createDraftsContainer({
      repository,
      overrides: {
        // Casos de uso reales (envío -> registro -> constructor del cuerpo); solo se sustituyen los puertos.
        sendLogs: { createMany: vi.fn(async () => undefined) } as unknown as SendLogGateway,
        timeManagement: { list: vi.fn(async () => []) } as unknown as TimeManagementGateway,
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <AppProviders container={container} queryClient={createQueryClient(container.auth)}>
          <DraftsProvider>{children}</DraftsProvider>
        </AppProviders>
      </StrictMode>
    );
    const { result } = renderHook(() => useDrafts(), { wrapper });

    act(() => void result.current.addRecords([FACTORY]));
    await act(async () => {
      expect((await result.current.sendAll()).status).toBe('started');
    });
    await waitFor(() => expect(result.current.sendPhase).toBe('completed'));

    expect(bodies).toHaveLength(1);
    const [body] = bodies;
    expect(body.fechaInicio).toBe('Wed Sep 09 2026 12:00:00 GMT-0500 (Colombia Standard Time)');
    expect(new Date(body.fechaInicio).toISOString()).toBe('2026-09-09T17:00:00.000Z');
    expect(body.HoraInicio).toBe('2026-09-09T19:30:00.000Z');
    expect(body.HoraFin).toBe('2026-09-09T23:59:00.000Z');
    expect(body.tipoHora).toBe('Fábrica');
    expect(result.current.records).toEqual([]);
  });
});
