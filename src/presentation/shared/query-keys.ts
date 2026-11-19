/** Claves de TanStack Query centralizadas (plan §1.5). Todas son tuplas `as const`. */
export const queryKeys = {
  options: {
    clientes: ['options', 'clientes'] as const,
    /** Gestiones de un cliente para un proyecto (`''` = primer proyecto del cliente). */
    gestiones: (cliente: string, proyecto: string) => ['options', 'gestiones', cliente, proyecto] as const,
  },
  reports: {
    all: ['management-reports'] as const,
    mine: (consultantId: string | number | null) => ['management-reports', consultantId] as const,
  },
  deleteRequests: {
    all: ['delete-requests'] as const,
    mine: ['delete-requests', 'mine'] as const,
    pending: ['delete-requests', 'pending'] as const,
  },
  notifications: {
    unread: ['notifications', 'unread'] as const,
  },
  templates: {
    all: ['templates'] as const,
    detail: (gestionId: string) => ['templates', 'detail', gestionId] as const,
  },
};
