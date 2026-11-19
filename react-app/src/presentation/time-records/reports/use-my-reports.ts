import { queryOptions, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import type { TimeManagementGateway } from '@application/time-records/ports/time-management.gateway';
import type { AuthUser } from '@domain/auth/auth-user.model';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { isManagementReportOwnedBy } from '@domain/time-records/services/management-report-ownership.policy';
import { useContainer } from '@presentation/providers/container-context';
import { useAuth } from '@presentation/shared/hooks/use-auth';
import { queryKeys } from '@presentation/shared/query-keys';
import { useDrafts } from '../drafts/drafts-context';
import { buildDayLedger, toReportView } from './report-view';

/** Id con el que `loadManagementReports` de Angular consulta los reportes del consultor. */
export function consultantIdOf(user: AuthUser | null): string | number | null {
  const id = user?.id;
  const numeric = Number(id);
  return id && !Number.isNaN(numeric) ? numeric : id || null;
}

export function myReportsQueryOptions(timeManagement: TimeManagementGateway, consultantId: string | number | null) {
  return queryOptions({
    queryKey: queryKeys.reports.mine(consultantId),
    queryFn: () => timeManagement.list(consultantId),
  });
}

/** Regla de pertenencia estricta, aplicada una sola vez sobre lo que devuelve la consulta. */
export const ownReports = (rows: readonly ManagementReport[], user: AuthUser | null): ManagementReport[] =>
  rows.filter((report) => isManagementReportOwnedBy(report, user));

/** Reportes enviados del consultor autenticado. */
export function useMyReports() {
  const { timeManagement } = useContainer();
  const { user } = useAuth();
  const select = useCallback((rows: ManagementReport[]) => ownReports(rows, user), [user]);
  return useQuery({
    ...myReportsQueryOptions(timeManagement, consultantIdOf(user)),
    enabled: !!user,
    select,
  });
}

/** Horas por día de lo ya enviado y de los borradores. `ledger` es `null` mientras carga o si falla. */
export function useDayLedger() {
  const { domainService: domain } = useContainer();
  const { records } = useDrafts();
  const reports = useMyReports();
  const isCountable = useCallback((tipoHora: string) => domain.isCountableHour(tipoHora), [domain]);
  const ledger = useMemo(
    () =>
      reports.data
        ? buildDayLedger(reports.data.map((report) => toReportView(report, isCountable)), records, isCountable)
        : null,
    [reports.data, records, isCountable],
  );
  return { ledger, loading: reports.isPending, error: reports.isError };
}
