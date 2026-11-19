import { useQuery } from '@tanstack/react-query';
import { useContainer } from '@presentation/providers/container-context';
import { queryKeys } from '@presentation/shared/query-keys';

/** Lista de plantillas por gestión (`['templates']`): la comparten Plantillas, el registro y el Dashboard. */
export function useManagementTemplatesList() {
  const { templates } = useContainer();
  return useQuery({ queryKey: queryKeys.templates.all, queryFn: () => templates.list() });
}
