/** Claves de TanStack Query centralizadas (plan §1.5). Todas son tuplas `as const`. */
export const queryKeys = {
  options: {
    clientes: ['options', 'clientes'] as const,
    /** Gestiones de un cliente para un proyecto (`''` = primer proyecto del cliente). */
    gestiones: (cliente: string, proyecto: string) => ['options', 'gestiones', cliente, proyecto] as const,
  },
  templates: {
    all: ['templates'] as const,
    detail: (gestionId: string) => ['templates', 'detail', gestionId] as const,
  },
};
