import { CircleAlert, CircleCheck, FileText, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';

export type StateTone = 'info' | 'warning' | 'error' | 'success';

export interface StateMessageProps {
  readonly title?: string;
  readonly description?: string;
  /** Texto del botón (p. ej. "Reintentar"); sin texto no hay botón. */
  readonly actionLabel?: string;
  readonly onAction?: () => void;
  readonly tone?: StateTone;
  readonly className?: string;
}

const toneIcons: Record<StateTone, LucideIcon> = {
  info: FileText,
  warning: TriangleAlert,
  error: CircleAlert,
  success: CircleCheck,
};

const toneClasses: Record<StateTone, string> = {
  info: 'text-muted-foreground',
  warning: 'text-warning',
  error: 'text-destructive',
  success: 'text-success',
};

/**
 * Estado vacío, de error o informativo (equivale a `ui-state-message`) sobre Shadcn `Empty`, con acción
 * opcional (reintentar). Los errores se anuncian con `role="alert"`; el resto con `role="status"`.
 */
export function StateMessage({
  title = 'Sin datos',
  description,
  actionLabel,
  onAction,
  tone = 'info',
  className,
}: StateMessageProps) {
  const Icon = toneIcons[tone];
  return (
    <Empty role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-lg border border-dashed p-6', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={toneClasses[tone]}>
          <Icon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description ? <EmptyDescription>{description}</EmptyDescription> : null}
      </EmptyHeader>
      {actionLabel ? (
        <EmptyContent>
          <Button type="button" variant={tone === 'error' ? 'outline' : 'default'} onClick={onAction}>
            {actionLabel}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
