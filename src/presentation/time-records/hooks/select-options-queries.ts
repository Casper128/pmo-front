import { queryOptions } from '@tanstack/react-query';
import type { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { queryKeys } from '@presentation/shared/query-keys';

/**
 * Clientes (`staleTime` infinito: `LoadSelectOptionsUseCase` ya cachea por sesión). Al cargar se precargan
 * las gestiones de todos los clientes (concurrencia 4, sin esperar ni propagar fallos), como Angular.
 */
export const clientesQueryOptions = (loadSelectOptions: LoadSelectOptionsUseCase) =>
  queryOptions({
    queryKey: queryKeys.options.clientes,
    staleTime: Infinity,
    queryFn: async () => {
      const clientes = await loadSelectOptions.clientes();
      void loadSelectOptions.preloadManagementOptions(clientes);
      return clientes;
    },
  });

/**
 * Gestiones de un cliente (`proyecto` vacío = primer proyecto). Al resolver se guarda también bajo el
 * proyecto resuelto: al fijarse el proyecto en el registro la fila no vuelve a mostrar "Cargando...".
 */
export const managementOptionsQueryOptions = (
  loadSelectOptions: LoadSelectOptionsUseCase,
  cliente: string,
  proyecto: string,
) =>
  queryOptions({
    queryKey: queryKeys.options.gestiones(cliente, proyecto),
    staleTime: Infinity,
    queryFn: async ({ client }) => {
      const result = await loadSelectOptions.managementOptions(cliente, proyecto);
      client.setQueryData(queryKeys.options.gestiones(cliente, result.project), result);
      return result;
    },
  });
