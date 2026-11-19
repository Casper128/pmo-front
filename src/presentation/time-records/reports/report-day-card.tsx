import { CircleCheck, Clock, Copy, Eye, MoreHorizontal, Pencil, Trash2, TriangleAlert } from 'lucide-react';
import type { ManagementDeleteRequest } from '@domain/time-records/models/management-delete-request.model';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { formatFechaEsp } from '@presentation/shared/format';
import { formatHours } from '../dashboard/dashboard-format';
import { dayStatus, type ReportDay, type ReportRow } from './report-list';
import { NO_DAY_KEY } from './report-view';

export type ReportAction = 'view' | 'edit' | 'duplicate' | 'delete';

export interface ReportDayCardProps {
  readonly day: ReportDay;
  /** Jornada esperada del día (0 en fines de semana). */
  readonly expectedHours: number;
  /** Hoy en Colombia: el dueño solo borra directo los reportes de hoy. */
  readonly today: string;
  /** Tabla densa (md+) o tarjetas de dos líneas. */
  readonly wide: boolean;
  readonly requests: ReadonlyMap<string, ManagementDeleteRequest>;
  readonly onAction: (action: ReportAction, row: ReportRow) => void;
  readonly onDuplicateDay: (day: ReportDay) => void;
}

const hoursText = (value: number) => `${formatHours(value, 2)} h`;

/** Total del día frente a la jornada, con icono y texto (no solo color). */
function DayStatusBadge({ day, expectedHours }: { readonly day: ReportDay; readonly expectedHours: number }) {
  const { kind, difference } = dayStatus(day.computableHours, expectedHours);
  if (kind === 'ok') {
    return (
      <Badge variant="outline" className="border-success/40 text-success">
        <CircleCheck aria-hidden="true" /> Jornada completa
      </Badge>
    );
  }
  return (
    <Badge variant={kind === 'excess' ? 'destructive' : 'secondary'}>
      <TriangleAlert aria-hidden="true" /> {kind === 'excess' ? 'Excede' : 'Faltan'} {hoursText(difference)}
    </Badge>
  );
}

/** Estado de la solicitud de eliminación del reporte; el rechazo muestra la nota de auditoría en un tooltip. */
function RequestBadge({ request }: { readonly request: ManagementDeleteRequest | undefined }) {
  if (!request) return null;
  if (request.status === 'pending') {
    return (
      <Badge variant="secondary">
        <Clock aria-hidden="true" /> Eliminación solicitada
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Badge variant="destructive">Eliminación rechazada</Badge>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{request.reviewNote || 'Auditoría no dejó una nota.'}</TooltipContent>
    </Tooltip>
  );
}

function RowMenu({
  row,
  today,
  pending,
  onAction,
}: {
  readonly row: ReportRow;
  readonly today: string;
  readonly pending: boolean;
  readonly onAction: ReportDayCardProps['onAction'];
}) {
  const direct = row.view.dayKey === today;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-10 md:size-8" aria-label={`Acciones del reporte ${row.view.id}`}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAction('view', row)}>
          <Eye aria-hidden="true" /> Ver detalle
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('edit', row)}>
          <Pencil aria-hidden="true" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('duplicate', row)}>
          <Copy aria-hidden="true" /> Duplicar registro
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => onAction('delete', row)}>
          <Trash2 aria-hidden="true" />
          {pending ? 'Eliminación ya solicitada' : direct ? 'Eliminar' : 'Solicitar eliminación'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const schedule = (row: ReportRow) => (row.start && row.end ? `${row.start}–${row.end}` : 'Sin horario');

function TipoHora({ row }: { readonly row: ReportRow }) {
  const computes = row.view.computableHours > 0 || row.hours === 0;
  return (
    <span className="flex flex-col">
      <span>{row.tipoHora}</span>
      {computes ? null : <span className="text-xs text-muted-foreground">no computa</span>}
    </span>
  );
}

function WideRows({ day, today, requests, onAction }: Pick<ReportDayCardProps, 'day' | 'today' | 'requests' | 'onAction'>) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/40 hover:bg-muted/40">
          <TableHead className="h-9 w-28">Horario</TableHead>
          <TableHead className="h-9 w-48">Cliente</TableHead>
          <TableHead className="h-9">Gestión</TableHead>
          <TableHead className="h-9 w-32">Tipo de hora</TableHead>
          <TableHead className="h-9 w-20 text-right">Horas</TableHead>
          <TableHead className="h-9 w-44">Estado</TableHead>
          <TableHead className="h-9 w-12">
            <span className="sr-only">Acciones</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {day.rows.map((row) => {
          const request = requests.get(row.view.id);
          return (
            <TableRow key={row.view.id || row.searchText} className="h-10">
              <TableCell className="font-mono text-xs whitespace-nowrap">{schedule(row)}</TableCell>
              <TableCell className="max-w-48">
                <OverflowText>{row.clientName}</OverflowText>
              </TableCell>
              <TableCell className="max-w-64">
                <OverflowText>{row.managementName}</OverflowText>
              </TableCell>
              <TableCell>
                <TipoHora row={row} />
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">{hoursText(row.hours)}</TableCell>
              <TableCell>
                <RequestBadge request={request} />
              </TableCell>
              <TableCell>
                <RowMenu row={row} today={today} pending={request?.status === 'pending'} onAction={onAction} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CardRows({ day, today, requests, onAction }: Pick<ReportDayCardProps, 'day' | 'today' | 'requests' | 'onAction'>) {
  return (
    <ul className="divide-y">
      {day.rows.map((row) => {
        const request = requests.get(row.view.id);
        return (
          <li key={row.view.id || row.searchText} className="flex items-start gap-2 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-mono text-xs font-semibold">{schedule(row)}</span>
                <span className="font-medium tabular-nums">{hoursText(row.hours)}</span>
              </p>
              <OverflowText className="text-sm">{`${row.clientName} · ${row.managementName}`}</OverflowText>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <TipoHora row={row} />
                <RequestBadge request={request} />
              </div>
            </div>
            <RowMenu row={row} today={today} pending={request?.status === 'pending'} onAction={onAction} />
          </li>
        );
      })}
    </ul>
  );
}

/** Un día de reportes: cabecera con total frente a la jornada y "Duplicar día", y sus registros. */
export function ReportDayCard({ day, expectedHours, wide, onDuplicateDay, ...rows }: ReportDayCardProps) {
  const dated = day.dayKey !== NO_DAY_KEY;
  const title = dated ? formatFechaEsp(day.dayKey) : 'Sin fecha';
  return (
    <Card role="region" aria-label={title} className="gap-0 overflow-clip py-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b bg-muted/40 px-3 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">
          {day.rows.length} {day.rows.length === 1 ? 'registro' : 'registros'}
        </span>
        {dated ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
            <span className="text-sm font-semibold tabular-nums">
              {hoursText(day.computableHours)} de {hoursText(expectedHours)}
            </span>
            <DayStatusBadge day={day} expectedHours={expectedHours} />
            <Button type="button" variant="ghost" size="sm" onClick={() => onDuplicateDay(day)}>
              <Copy aria-hidden="true" /> Duplicar día
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No se pudo determinar el día; no suman en los totales.</span>
        )}
      </div>
      {wide ? <WideRows day={day} {...rows} /> : <CardRows day={day} {...rows} />}
    </Card>
  );
}
