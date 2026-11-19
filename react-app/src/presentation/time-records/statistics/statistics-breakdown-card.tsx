import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { StateMessage } from '@presentation/shared/components/state-message';
import { ClientHoursChart } from '../dashboard/dashboard-charts';
import { formatHours } from '../dashboard/dashboard-format';
import type { StatisticsGroup } from './statistics-breakdown';

/** Grupos que se grafican; la tabla muestra todos. */
const CHART_LIMIT = 8;

export interface StatisticsBreakdownCardProps {
  readonly title: string;
  readonly description: string;
  /** Encabezado de la primera columna de la tabla (Módulo, Actividad…). */
  readonly dimensionLabel: string;
  readonly groups: readonly StatisticsGroup[];
}

/** Desglose de horas por una dimensión: gráfica de barras de los mayores grupos y tabla con horas, registros y %. */
export function StatisticsBreakdownCard({ title, description, dimensionLabel, groups }: StatisticsBreakdownCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length ? (
          <>
            <ClientHoursChart data={groups.slice(0, CHART_LIMIT)} label={title} />
            <div className="max-h-72 overflow-auto rounded-md border">
              <Table aria-label={`${title}: detalle`}>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>{dimensionLabel}</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.label}>
                      <TableCell className="max-w-48 font-medium">
                        <OverflowText>{group.label}</OverflowText>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatHours(group.hours)}</TableCell>
                      <TableCell className="text-right tabular-nums">{group.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatHours(group.share)} %</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <StateMessage tone="warning" title="Sin datos para graficar" description="No hay registros con horas en el periodo." />
        )}
      </CardContent>
    </Card>
  );
}
