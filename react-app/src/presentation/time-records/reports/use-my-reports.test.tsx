import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { vi } from 'vitest';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { createDraftsContainer, makeDraft } from '@/test/fakes/drafts-fixtures';
import { testUser } from '@/test/fakes/fake-auth';
import { AppProviders } from '@presentation/providers/app-providers';
import { createQueryClient } from '@presentation/providers/query-client';
import { DraftsProvider } from '../drafts/drafts-provider';
import { PENDING_RECORDS_STORAGE_KEY } from '../drafts/pending-records-storage';
import { useDayLedger, useMyReports } from './use-my-reports';

const USER_ID = 84;

const mine = (overrides: Partial<ManagementReport> = {}): ManagementReport => ({
  identificador: 'RH-MIO',
  idConsultor: USER_ID,
  HoraInicio: '2026-09-09T12:00:00.000Z',
  HoraFin: '2026-09-09T13:00:00.000Z',
  tiempoRealHoras: '1',
  tipoHora: 'Laboral',
  ...overrides,
});

function setup(rows: ManagementReport[]) {
  const timeManagement = { list: vi.fn(async () => rows) } as unknown as TimeManagementGateway;
  const { container, auth } = createDraftsContainer({ overrides: { timeManagement } });
  auth.setUser({ ...testUser, id: USER_ID });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <AppProviders container={container} queryClient={createQueryClient(container.auth)}>
        <DraftsProvider>{children}</DraftsProvider>
      </AppProviders>
    </StrictMode>
  );
  return { timeManagement, wrapper };
}

describe('useMyReports y useDayLedger', () => {
  afterEach(() => localStorage.clear());

  it('devuelve solo los reportes del consultor (id o correo exacto) y consulta con su id', async () => {
    const { timeManagement, wrapper } = setup([mine(), mine({ identificador: 'RH-OTRO', idConsultor: 999, correo: 'otra.persona@example.test' })]);
    const { result } = renderHook(() => useMyReports(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.map((report) => report.identificador)).toEqual(['RH-MIO']);
    expect(timeManagement.list).toHaveBeenCalledWith(USER_ID);
  });

  it('el libro mayor suma lo enviado y los borradores del día, con Fábrica fuera', async () => {
    localStorage.setItem(PENDING_RECORDS_STORAGE_KEY, JSON.stringify([makeDraft({ horas: '1.5' })]));
    const { wrapper } = setup([mine(), mine({ identificador: 'RH-F', tipoHora: 'Fábrica', tiempoRealHoras: '4' })]);
    const { result } = renderHook(() => useDayLedger(), { wrapper });

    await waitFor(() => expect(result.current.ledger).not.toBeNull());
    expect(result.current.ledger?.get('2026-09-09')).toMatchObject({ sentHours: 1, draftHours: 1.5 });
  });
});
