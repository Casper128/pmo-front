import type { CSSProperties } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Progress } from '@/shared/ui/progress';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { formatHours } from './dashboard-format';
import { seriesColor, type ShareItem } from './dashboard-insights';

export interface RankedHoursCardProps {
  readonly title: string;
  readonly description: string;
  /** Ya ordenados de mayor a menor, con su % del total. */
  readonly items: readonly ShareItem[];
  readonly className?: string;
}

/** Lista ranqueada: una fila por grupo con barra de progreso proporcional, horas y %. */
export function RankedHoursCard({ title, description, items, className }: RankedHoursCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-3" aria-label={title}>
          {items.map((item, index) => (
            <li key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <OverflowText className="min-w-0 font-medium">{item.label}</OverflowText>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatHours(item.hours)} h · {formatHours(item.share)} %
                </span>
              </div>
              <Progress
                aria-label={`${item.label}: ${formatHours(item.share)} %`}
                value={item.share}
                className="h-2 *:data-[slot=progress-indicator]:bg-(--bar)"
                style={{ '--bar': seriesColor(index) } as CSSProperties}
              />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
