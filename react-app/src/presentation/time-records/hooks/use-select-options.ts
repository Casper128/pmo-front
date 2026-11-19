import { useQuery } from '@tanstack/react-query';
import { useContainer } from '@presentation/providers/container-context';
import { clientesQueryOptions, managementOptionsQueryOptions } from './select-options-queries';

const NO_CLIENTES: string[] = [];

/** Clientes disponibles (`[]` mientras cargan o si la consulta falla, como Angular). */
export function useClientes() {
  const { loadSelectOptions } = useContainer();
  const query = useQuery(clientesQueryOptions(loadSelectOptions));
  return { clientes: query.data ?? NO_CLIENTES, loading: query.isPending };
}

/** Gestiones del cliente+proyecto; sin cliente no consulta. */
export function useManagementOptions(cliente: string, proyecto: string) {
  const { loadSelectOptions } = useContainer();
  return useQuery({
    ...managementOptionsQueryOptions(loadSelectOptions, cliente, proyecto),
    enabled: !!cliente,
  });
}

/**
 * Selección por defecto de la página (`loadDefaultSelection` de Angular): primer cliente, su primer proyecto
 * y las gestiones de ese proyecto. Solo se usa lo que tiene efecto: el proyecto como valor inicial de las
 * plantillas nuevas y las gestiones para detectar la gestión elegida en una fila.
 */
export function useDefaultSelection() {
  const { clientes } = useClientes();
  const { data } = useManagementOptions(clientes[0] ?? '', '');
  return {
    defaultProyecto: data?.project ?? '',
    solicitudOptions: data?.options,
  };
}
