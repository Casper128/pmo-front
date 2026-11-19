/** Notificación del usuario (campana). `data` es la carga que guarda el servidor (p. ej. `identifier` del reporte). */
export interface AppNotification {
  readonly id: string;
  /** `delete_request_created` (auditoría), `delete_request_approved` o `delete_request_rejected` (solicitante). */
  readonly kind: string;
  readonly requestId: string;
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
}

/** Notificaciones sin leer (las más recientes) y el total sin leer, que puede superar la lista. */
export interface NotificationFeed {
  readonly notifications: readonly AppNotification[];
  readonly unreadCount: number;
}

export abstract class NotificationGateway {
  abstract listUnread(): Promise<NotificationFeed>;
  abstract markRead(ids: readonly string[]): Promise<void>;
  abstract markAllRead(): Promise<void>;
}
