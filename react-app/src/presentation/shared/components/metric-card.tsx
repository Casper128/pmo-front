import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from 'cn';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';

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

const trendIcons = { up: TrendingUp, down: TrendingDown, neutral: Minus } as const;

/** KPI (equivale a `ui-metric-card`): Shadcn `Card` con etiqueta, valor, descripción y delta opcional en `Badge`. */
export function MetricCard({ label, value, description, tone = 'slate', delta, className, compact = false }: MetricCardProps) {
  const TrendIcon = trendIcons[delta?.trend ?? 'neutral'];
  return (
    <Card size="sm" className={cn('min-w-0', compact && 'gap-1 py-2', className)}>
      <CardHeader className={compact ? 'gap-0' : undefined}>
        <CardDescription className="text-xs font-medium">{label}</CardDescription>
        <CardTitle className={cn(compact ? 'text-lg' : 'text-2xl', 'leading-tight font-semibold tabular-nums break-words', toneClasses[tone])}>
          {value}
        </CardTitle>
      </CardHeader>
      {description || delta ? (
        <CardContent className={cn('flex flex-wrap items-center gap-2 text-xs text-muted-foreground', compact && 'truncate')}>
          {delta ? (
            <Badge variant="secondary" className="tabular-nums">
              <TrendIcon aria-hidden="true" />
              {delta.label}
              {delta.description ? <span className="sr-only"> {delta.description}</span> : null}
            </Badge>
          ) : null}
          {description ? <p className="min-w-0">{description}</p> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
