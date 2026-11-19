import { useState, type ReactNode } from 'react';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { formatFullDate } from '@presentation/shared/format';
import { formatHours } from '../dashboard/dashboard-format';
import type { ConsolidatedRow, DailySummaryRow } from './consolidated-report';

const PAGE_SIZE = 50;

/** Tabla con scroll propio y encabezado fijo (el contenedor de `Table` es el que desplaza). */
const SCROLL_TABLE =
  'rounded-md border [&_[data-slot=table-container]]:max-h-[28rem] [&_[data-slot=table-container]]:overflow-y-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-muted';

const hoursText = (value: number) => `${formatHours(value, 2)} h`;

function TableCard({ title, description, total, shown, onMore, children }: {
  readonly title: string;
  readonly description: string;
  readonly total: number;
  readonly shown: number;
  readonly onMore: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Card className="min-w-0" role="region" aria-label={title}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        {total > shown ? (
          <Button type="button" variant="outline" className="self-center" onClick={onMore}>
            Mostrar más ({total - shown} restantes)
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Total de horas por día y consultor. Cambiar `key` al cambiar los filtros reinicia la paginación. */
export function DailySummaryTable({ rows }: { readonly rows: readonly DailySummaryRow[] }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return (
    <TableCard
      title="Total de horas por día y consultor"
      description="Cada consultor aparece una sola vez por día; los clientes atendidos se muestran juntos en la misma fila."
      total={rows.length}
      shown={limit}
      onMore={() => setLimit(limit + PAGE_SIZE)}
    >
      <div className={SCROLL_TABLE}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Consultor</TableHead>
              <TableHead className="max-md:hidden">Clientes atendidos</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right max-sm:hidden">Registros</TableHead>
              <TableHead className="text-right max-sm:hidden">Solicitudes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, limit).map((row) => (
              <TableRow key={`${row.fecha}|${row.consultor}`}>
                <TableCell className="font-medium whitespace-nowrap">{formatFullDate(row.fecha)}</TableCell>
                <TableCell className="max-w-48 min-w-0">
                  <OverflowText lines={2}>{row.consultor}</OverflowText>
                  <span className="block text-xs text-muted-foreground md:hidden">{row.clientes}</span>
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {row.registros} reg. · {row.solicitudes} sol.
                  </span>
                </TableCell>
                <TableCell className="max-w-64 min-w-0 max-md:hidden">
                  <OverflowText lines={2}>{row.clientes}</OverflowText>
                </TableCell>
                <TableCell className="text-right font-medium whitespace-nowrap tabular-nums">{hoursText(row.horas)}</TableCell>
                <TableCell className="text-right tabular-nums max-sm:hidden">{row.registros}</TableCell>
                <TableCell className="text-right tabular-nums max-sm:hidden">{row.solicitudes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TableCard>
  );
}

const schedule = (row: ConsolidatedRow) => (row.horaInicio || row.horaFin ? `${row.horaInicio || '--'} – ${row.horaFin || '--'}` : '');
const managementOf = (row: ConsolidatedRow) => row.gestion || row.identificador || 'Sin gestión';

/** Detalle de actividades: tabla densa en pantallas anchas y tarjetas de dos líneas en móvil. */
export function ActivityDetail({ rows, wide }: { readonly rows: readonly ConsolidatedRow[]; readonly wide: boolean }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const visible = rows.slice(0, limit);
  return (
    <TableCard
      title="Detalle de actividades reportadas"
      description="Trazabilidad completa del reporte recibido desde el servicio."
      total={rows.length}
      shown={limit}
      onMore={() => setLimit(limit + PAGE_SIZE)}
    >
      {wide ? (
        <div className={SCROLL_TABLE}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Consultor / cliente</TableHead>
                <TableHead>Gestión / solicitud</TableHead>
                <TableHead>Actividad</TableHead>
                <TableHead>Clasificación</TableHead>
                <TableHead className="text-right">Horas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row, index) => (
                <TableRow key={`${row.identificador}|${row.fecha}|${index}`} className="align-top">
                  <TableCell className="whitespace-nowrap">
                    <span className="block font-medium">{formatFullDate(row.fecha)}</span>
                    <span className="block text-xs text-muted-foreground">{schedule(row)}</span>
                  </TableCell>
                  <TableCell className="max-w-44 min-w-0">
                    <OverflowText lines={2} className="font-medium">{row.consultor}</OverflowText>
                    <OverflowText lines={2} className="text-xs text-muted-foreground">{row.cliente}</OverflowText>
                  </TableCell>
                  <TableCell className="max-w-44 min-w-0">
                    <OverflowText lines={2} className="font-medium text-primary">{managementOf(row)}</OverflowText>
                    <OverflowText lines={2} className="text-xs text-muted-foreground">
                      {row.solicitud || row.proyecto || 'Sin solicitud'}
                    </OverflowText>
                  </TableCell>
                  <TableCell className="max-w-72 min-w-0">
                    <OverflowText lines={2}>{row.descripcion || 'Sin descripción'}</OverflowText>
                    {row.funcional ? (
                      <OverflowText lines={1} className="text-xs text-muted-foreground">{`Funcional: ${row.funcional}`}</OverflowText>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-48 min-w-0">
                    <OverflowText lines={1} className="font-medium">{row.tipoActividad || row.categoria || 'Sin tipo'}</OverflowText>
                    <OverflowText lines={1} className="text-xs text-muted-foreground">
                      {`${row.modulo || 'Sin módulo'} · ${row.tecnologia || 'Sin tecnología'}`}
                    </OverflowText>
                    <Badge variant="outline" className="mt-1">{row.tipoHora || 'Laboral'}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold whitespace-nowrap tabular-nums">{hoursText(row.horas)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {visible.map((row, index) => (
            <li key={`${row.identificador}|${row.fecha}|${index}`} className="flex min-w-0 flex-col gap-1 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-sm font-medium">
                  {formatFullDate(row.fecha)} · {row.consultor}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">{hoursText(row.horas)}</span>
              </div>
              <p className="line-clamp-2 text-sm break-words">{row.descripcion || managementOf(row)}</p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="min-w-0 truncate">{row.cliente}</span>
                <Badge variant="outline">{row.tipoHora || 'Laboral'}</Badge>
              </p>
            </li>
          ))}
        </ul>
      )}
    </TableCard>
  );
}
