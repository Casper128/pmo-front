import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  DeleteRequestResult,
  TechnicalDeleteBody,
} from '@application/time-records/ports/time-management.gateway';
import type { ManagementReport } from '@domain/time-records/models/management-report.model';
import { useContainer } from '@presentation/providers/container-context';
import { queryKeys } from '@presentation/shared/query-keys';

/** Mutaciones de Reportes: cada una invalida lo que cambia en el servidor (sin edición local de la lista). */
export function useReportMutations() {
  const { timeManagement, parameters } = useContainer();
  const queryClient = useQueryClient();
  const refreshReports = () => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });

  const update = useMutation({
    mutationFn: ({ identifier, body }: { identifier: string; body: Record<string, unknown> }) =>
      timeManagement.update(identifier, body),
    onSuccess: refreshReports,
  });
  const remove = useMutation({
    mutationFn: (identifier: string) => timeManagement.delete(identifier),
    onSuccess: refreshReports,
  });
  const technicalRemove = useMutation({
    mutationFn: (body: TechnicalDeleteBody) => timeManagement.technicalDelete(body),
    onSuccess: refreshReports,
  });
  const requestRemoval = useMutation<DeleteRequestResult, unknown, ManagementReport>({
    mutationFn: (report) =>
      timeManagement.requestDelete({
        identifier: String(report.identificador || ''),
        auditorEmail: parameters.deletionSettings().auditorEmail,
        report,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.deleteRequests.mine }),
  });

  return { update, remove, technicalRemove, requestRemoval };
}
