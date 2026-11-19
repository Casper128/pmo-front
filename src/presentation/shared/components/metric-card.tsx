import { Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from 'cn';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

/** Tonos de `ui-metric-card`, mapeados a variables de la paleta (sin colores fijos). */
export type MetricTone = 'slate' | 'blue' | 'amber' | 'red';

export interface MetricDelta {
  /** Texto ya formateado, p. ej. `+2,5 h` o `-10 %`. */
  readonly label: string;
  readonly trend?: 'up' | 'down' | 'neutral';
  /** Descripción para lectores de pantalla, p. ej. "frente a la semana anterior". */
  readonly description?: string;
}

export interface MetricCardProps {
  readonly label: string;
  readonly value: string | number;
  readonly description?: string;
  readonly tone?: MetricTone;
  readonly delta?: MetricDelta;
  /** Icono en un chip redondeado, tintado con el color de gráfica `accent`. */
  readonly icon?: LucideIcon;
  /** Color de gráfica del chip (`--chart-1..5`). */
  readonly accent?: 1 | 2 | 3 | 4 | 5;
  /** Gráfica pequeña bajo el valor (p. ej. un sparkline). */
  readonly chart?: ReactNode;
  readonly className?: string;
  /** Versión densa para bloques de detalle: valor `text-lg` y descripción de una línea. */
  readonly compact?: boolean;
}

const toneClasses: Record<MetricTone, string> = {
  slate: 'text-foreground',
  blue: 'text-foreground', // neutro: el color del valor solo comunica estado (amber/red)
  amber: 'text-warning',
  red: 'text-destructive',
};

const deltaClasses = { up: 'text-success', down: 'text-destructive', neutral: 'text-muted-foreground' } as const;

const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus } as const;

/** KPI (equivale a `ui-metric-card`): Shadcn `Card` con etiqueta, valor, descripción y delta opcional en `Badge`. */
export function MetricCard({ label, value, description, tone = 'slate', delta, icon: Icon, accent = 1, chart, className, compact = false }: MetricCardProps) {
  const TrendIcon = trendIcons[delta?.trend ?? 'neutral'];
  return (
    <Card size="sm" className={cn('min-w-0', compact && 'gap-1 py-2', className)}>
      <CardHeader className={compact ? 'gap-0' : undefined}>
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        {Icon ? (
          <CardAction>
            <span
              aria-hidden="true"
              className="flex size-8 items-center justify-center rounded-lg text-(--accent-color) bg-[color-mix(in_oklab,var(--accent-color)_12%,transparent)] [&>svg]:size-4"
              style={{ '--accent-color': `var(--chart-${accent})` } as CSSProperties}
            >
              <Icon />
            </span>
          </CardAction>
        ) : null}
        <CardTitle className={cn(compact ? 'text-lg' : 'text-2xl', 'leading-tight font-semibold tabular-nums break-words', toneClasses[tone])}>
          {value}
        </CardTitle>
      </CardHeader>
      {description || delta ? (
        <CardContent className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', compact && 'truncate')}>
          {delta ? (
            <span className={cn('inline-flex items-center gap-1 font-medium tabular-nums', deltaClasses[delta.trend ?? 'neutral'])}>
              <TrendIcon aria-hidden="true" className="size-3.5" />
              {delta.label}
              {delta.description ? <span className="sr-only"> {delta.description}</span> : null}
            </span>
          ) : null}
          {description ? <p className="min-w-0">{description}</p> : null}
        </CardContent>
      ) : null}
      {chart ? <div className="px-(--card-spacing)">{chart}</div> : null}
    </Card>
  );
}
