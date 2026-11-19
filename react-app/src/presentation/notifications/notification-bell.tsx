import { Bell, CircleAlert, CircleCheck, CircleX, Loader2, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { AppNotification } from '@application/notifications/notification.gateway';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Skeleton } from '@/shared/ui/skeleton';
import { notificationPath } from './notification-route';
import { useNotifications } from './use-notifications';

const MAX_BADGE = 99;

const kindIcons: Record<string, { Icon: LucideIcon; className: string }> = {
  delete_request_created: { Icon: CircleAlert, className: 'text-warning' },
  delete_request_approved: { Icon: CircleCheck, className: 'text-success' },
  delete_request_rejected: { Icon: CircleX, className: 'text-destructive' },
};
const fallbackIcon = { Icon: Bell, className: 'text-muted-foreground' };

const formatWhen = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
};

function NotificationItem({ notification, onOpen }: { readonly notification: AppNotification; readonly onOpen: () => void }) {
  const { Icon, className } = kindIcons[notification.kind] ?? fallbackIcon;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 w-full items-start gap-3 px-4 py-3 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${className}`} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm font-medium">{notification.title}</span>
          <span className="line-clamp-2 text-sm break-words text-muted-foreground">{notification.body}</span>
          <span className="text-xs text-muted-foreground">{formatWhen(notification.createdAt)}</span>
        </span>
      </button>
    </li>
  );
}

/** Campana del header: no leídas en un `Popover`; un clic marca la notificación como leída y lleva a su destino. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, unreadCount, isPending, isError, refetch, markRead, markAllRead } = useNotifications();

  const openNotification = (notification: AppNotification) => {
    markRead.mutate([notification.id]);
    setOpen(false);
    void navigate(notificationPath(notification));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
        >
          <Bell aria-hidden="true" />
          {unreadCount ? (
            <Badge aria-hidden="true" className="absolute -top-1 -right-1 h-4 min-w-4 bg-destructive px-1 text-[10px] text-white tabular-nums">
              {unreadCount > MAX_BADGE ? `${MAX_BADGE}+` : unreadCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-[min(22rem,calc(100vw-1.5rem))] gap-0 p-0" aria-label="Notificaciones">
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <h2 className="text-sm font-semibold">Notificaciones</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!unreadCount || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            {markAllRead.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Marcar todas como leídas
          </Button>
        </div>
        {isPending ? (
          <div className="flex flex-col gap-2 p-4" role="status" aria-label="Cargando notificaciones...">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : isError && !notifications.length ? (
          <div className="flex flex-col items-start gap-2 p-4 text-sm" role="alert">
            <p>No se pudieron cargar las notificaciones.</p>
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              Reintentar
            </Button>
          </div>
        ) : !notifications.length ? (
          <p className="p-4 text-sm text-muted-foreground">No tienes notificaciones sin leer.</p>
        ) : (
          <>
            <ScrollArea className="[&_[data-slot=scroll-area-viewport]]:max-h-80">
              <ul className="divide-y">
                {notifications.map((notification) => (
                  <NotificationItem key={notification.id} notification={notification} onOpen={() => openNotification(notification)} />
                ))}
              </ul>
            </ScrollArea>
            {unreadCount > notifications.length ? (
              <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                Mostrando las {notifications.length} más recientes de {unreadCount} sin leer.
              </p>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
