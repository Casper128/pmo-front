import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { StateMessage } from '@presentation/shared/components/state-message';
import { formatFechaEsp } from '@presentation/shared/format';
import { formatHours } from './dashboard-format';
import type { DayAlert, DayAlertKind } from './day-alerts';

const badgeVariant: Record<DayAlertKind, 'destructive' | 'secondary' | 'outline'> = {
  excess: 'destructive',
  missing: 'secondary',
  none: 'outline',
};

/** Días del periodo con faltante, exceso o sin reporte; la lista hace scroll dentro de la tarjeta. */
export function DayAlertsCard({ alerts }: { readonly alerts: readonly DayAlert[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Alertas por día</CardTitle>
        <CardDescription>
          Días con horas faltantes, excedidas o sin reporte según la jornada (sin festivos). Ignora los filtros de
          cliente y tipo de hora; Fábrica no cuenta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {alerts.length ? (
          <div className="max-h-64 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="max-sm:px-2">Día</TableHead>
                  <TableHead className="max-sm:px-1">Alerta</TableHead>
                  <TableHead className="text-right max-sm:px-2">
                    <span className="max-sm:hidden">Reportadas</span>
                    <span className="sm:hidden">Rep./esp.</span>
                  </TableHead>
                  <TableHead className="text-right max-sm:hidden">Esperadas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.date}>
                    <TableCell className="whitespace-nowrap max-sm:px-2">
                      <span className="max-sm:hidden">{formatFechaEsp(alert.date)}</span>
                      <span className="sm:hidden">{formatFechaEsp(alert.date).replace(/ \d{4}$/, '')}</span>
                    </TableCell>
                    <TableCell className="max-sm:px-1">
                      <Badge variant={badgeVariant[alert.kind]}>{alert.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums max-sm:px-2">
                      {formatHours(alert.reportedHours)}
                      <span className="text-muted-foreground sm:hidden"> / {formatHours(alert.expectedHours)}</span>
                      <span> h</span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums max-sm:hidden">{formatHours(alert.expectedHours)} h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <StateMessage tone="success" title="Sin alertas" description="Todos los días del periodo cumplen la jornada." />
        )}
      </CardContent>
    </Card>
  );
}
