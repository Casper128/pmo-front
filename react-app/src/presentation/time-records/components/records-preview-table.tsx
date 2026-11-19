import { CircleAlert, Loader2 } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useRef } from 'react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import type { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import type { DayGroup, TimeRecord } from '@domain/time-records/models/time-record.model';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { useContainer } from '@presentation/providers/container-context';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { formatFechaEsp } from '@presentation/shared/format';
import { useMediaQuery } from '@presentation/shared/hooks/use-media-query';
import { useDrafts } from '../drafts/drafts-context';
import {
  applyClienteChange,
  applyGestionChange,
  preferredGestion,
  recordErrors,
} from '../drafts/draft-records';
import { rememberGestion, rememberedGestion } from '../drafts/last-management-storage';
import { useClientes } from '../hooks/use-select-options';
import { managementOptionsQueryOptions } from '../hooks/select-options-queries';
import { useParameterOptions } from '../hooks/use-parameter-options';
import { PreviewContext, type PreviewContextValue } from './preview-context';
import { ClienteSelect, GestionSelect, RecordActions, RecordExtras, TipoHoraSelect } from './record-fields';

/** Mismo punto de corte que Angular (`xl`): filas en tabla desde 1280 px y tarjetas por debajo. */
const WIDE_QUERY = '(min-width: 1280px)';

interface PreviewRow {
  readonly record: TimeRecord;
  readonly index: number;
  readonly group: DayGroup;
}

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, PreviewRow>();

/**
 * Columnas estables (a nivel de módulo, como exige TanStack Table). Las celdas leen el estado y las
 * acciones del contexto de la vista previa en lugar de capturarlos.
 */
const columns = columnHelper.columns([
  columnHelper.display({
    id: 'fecha',
    header: 'Fecha',
    cell: ({ row }) => <span className="text-xs text-muted-foreground">{row.original.record.fecha}</span>,
  }),
  columnHelper.display({
    id: 'horario',
    header: 'Horario',
    cell: ({ row }) => (
      <span className="font-mono text-xs font-semibold">
        {row.original.record.horaIni} - {row.original.record.horaFin}
      </span>
    ),
  }),
  columnHelper.display({
    id: 'horas',
    header: 'Horas',
    cell: ({ row }) => <span className="font-semibold text-primary">{row.original.record.horas}h</span>,
  }),
  columnHelper.display({
    id: 'tipoHora',
    header: 'Tipo hora',
    cell: ({ row }) => <TipoHoraSelect record={row.original.record} index={row.original.index} />,
  }),
  columnHelper.display({
    id: 'cliente',
    header: 'Cliente',
    cell: ({ row }) => <ClienteSelect record={row.original.record} index={row.original.index} />,
  }),
  columnHelper.display({
    id: 'gestion',
    header: 'Gestión Demanda',
    cell: ({ row }) => <GestionSelect record={row.original.record} index={row.original.index} />,
  }),
  columnHelper.display({
    id: 'acciones',
    header: () => <span className="block text-right">Acciones</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <RecordActions index={row.original.index} compact />
      </div>
    ),
  }),
]);

const columnWidths: Record<string, string> = {
  fecha: 'w-24',
  horario: 'w-32',
  horas: 'w-16',
  tipoHora: 'w-40',
  cliente: 'w-44',
  gestion: 'min-w-56',
  acciones: 'w-32',
};

const countLabel = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

/** Chip de horas del día con los colores de `HorasAlert` (variables `--ui-hours-*` de la paleta). */
function DayAlert({ group }: { readonly group: DayGroup }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: group.alerta.color, borderColor: group.alerta.border }}
    >
      {group.totalHoras.toFixed(1)}h · {group.alerta.label}
    </span>
  );
}

function DayBand({ group }: { readonly group: DayGroup }) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-y px-4 py-2.5"
      style={{ background: group.alerta.bg, borderColor: group.alerta.border }}
    >
      <p className="text-sm font-semibold">
        {formatFechaEsp(group.fecha)}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          · {countLabel(group.records.length, 'registro', 'registros')}
        </span>
      </p>
      <DayAlert group={group} />
    </div>
  );
}

function RowErrors({ errors }: { readonly errors: readonly string[] }) {
  if (!errors.length) return null;
  return (
    <p className="flex items-start gap-1.5 text-xs font-medium text-destructive">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>Revisa: {errors.join(', ')}</span>
    </p>
  );
}

function WideTable({ rows }: { readonly rows: PreviewRow[] }) {
  const { domainService: domain } = useContainer();
  const table = useTable({ features, columns, data: rows });
  const tableRows = table.getRowModel().rows;

  return (
    <Table className="min-w-[64rem]">
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className="bg-muted/60 hover:bg-muted/60">
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id} className={`h-10 text-xs font-semibold uppercase ${columnWidths[header.column.id] ?? ''}`}>
                {header.isPlaceholder ? null : <table.FlexRender header={header} />}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {tableRows.map((row, position) => {
          const { record, group } = row.original;
          const previous = tableRows[position - 1]?.original.group;
          const errors = recordErrors(domain, record);
          return (
            <Fragment key={row.id}>
              {previous !== group ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={columns.length} className="p-0">
                    <DayBand group={group} />
                  </TableCell>
                </TableRow>
              ) : null}
              <TableRow className={errors.length ? 'border-b-0 bg-destructive/5 hover:bg-destructive/10' : 'border-b-0'}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className="align-middle">
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className={errors.length ? 'bg-destructive/5 hover:bg-destructive/10' : ''}>
                <TableCell colSpan={columns.length} className="pt-0 pb-3 whitespace-normal">
                  <div className="flex flex-col gap-1 rounded-md bg-muted/60 px-3 py-2">
                    <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Descripción</span>
                    <OverflowText lines={3} className="text-sm">
                      {record.desc}
                    </OverflowText>
                    <RecordExtras record={record} />
                    <RowErrors errors={errors} />
                  </div>
                </TableCell>
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function CardList({ groups }: { readonly groups: readonly DayGroup[] }) {
  const { domainService: domain } = useContainer();
  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4">
      {groups.map((group) => (
        <section key={group.fecha} aria-label={formatFechaEsp(group.fecha)} className="overflow-hidden rounded-xl border bg-card">
          <DayBand group={group} />
          <ul className="divide-y">
            {group.records.map(({ record, index }) => {
              const errors = recordErrors(domain, record);
              return (
                <li key={index} className={`flex flex-col gap-3 p-4 ${errors.length ? 'bg-destructive/5' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-muted-foreground">
                        {record.horaIni} - {record.horaFin}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-primary">{record.horas}h</p>
                    </div>
                    <RecordActions index={index} />
                  </div>
                  <p className="text-sm break-words">{record.desc}</p>
                  <RecordExtras record={record} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <ClienteSelect record={record} index={index} labelled />
                    <GestionSelect record={record} index={index} labelled />
                    <TipoHoraSelect record={record} index={index} labelled />
                  </div>
                  <RowErrors errors={errors} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

const rowKey = (record: TimeRecord) =>
  `${record.fecha}|${record.horaIni}|${record.horaFin}|${record.desc}|${record.cliente}`;

export interface RecordsPreviewTableProps {
  /** Cambio de un borrador desde la vista previa; devuelve el registro nuevo (o `null` si está bloqueado). */
  readonly onRecordChange: (index: number, change: (current: TimeRecord) => TimeRecord) => TimeRecord | null;
  readonly onEditRecord: (index: number) => void;
  readonly onDuplicateRecord: (index: number) => void;
  readonly onDeleteRecord: (index: number) => void;
  readonly onSendAll: () => void;
  readonly onCancelImport: () => void;
}

/**
 * Vista previa de los borradores agrupados por día (equivale a `RecordsPreviewComponent`): tabla de
 * TanStack Table desde 1280 px y tarjetas por debajo, con selects por fila de cliente, gestión y tipo de hora.
 * Las opciones de gestión salen de TanStack Query y la gestión preferida se elige sola como en Angular
 * (la recordada para el cliente, la actual o la primera), salvo con el envío bloqueado.
 */
export function RecordsPreviewTable({
  onRecordChange,
  onEditRecord,
  onDuplicateRecord,
  onDeleteRecord,
  onSendAll,
  onCancelImport,
}: RecordsPreviewTableProps) {
  const { domainService: domain, loadSelectOptions } = useContainer();
  const queryClient = useQueryClient();
  const { groups, totalGeneral, sendLocked } = useDrafts();
  const { clientes } = useClientes();
  const tipoHoraOptions = useParameterOptions('tipoHora');
  const wide = useMediaQuery(WIDE_QUERY);

  const rows = useMemo<PreviewRow[]>(
    () => groups.flatMap((group) => group.records.map(({ record, index }) => ({ record, index, group }))),
    [groups],
  );
  const recordCount = rows.length;
  const recordsToReview = rows.filter(({ record }) => recordErrors(domain, record).length > 0).length;
  const readyCount = Math.max(0, recordCount - recordsToReview);

  /** Registros ya tratados por la autoselección de gestión (un registro con cliente y sin gestión). */
  const initialized = useRef(new Set<string>());

  const autoSelectGestion = useCallback(
    async (index: number, cliente: string, proyecto: string) => {
      try {
        const { options } = await queryClient.ensureQueryData(
          managementOptionsQueryOptions(loadSelectOptions, cliente, proyecto),
        );
        const picked: { option?: ManagementDemandOption } = {};
        const updated = onRecordChange(index, (current) => {
          // Tras el await el usuario pudo cambiar el cliente o elegir la gestión a mano: no se pisa.
          if (current.cliente !== cliente || current.gestionId) return current;
          const option = preferredGestion(options, rememberedGestion(cliente), current.gestionId);
          if (!option) return current;
          picked.option = option;
          return applyGestionChange(current, option, option.id);
        });
        if (updated && picked.option) rememberGestion(cliente, picked.option.id);
      } catch {
        // Igual que Angular: si las gestiones no cargan, el usuario las elige a mano.
      }
    },
    [queryClient, loadSelectOptions, onRecordChange],
  );

  // Registros restaurados o duplicados que traen cliente pero no gestión.
  useEffect(() => {
    if (sendLocked) return;
    for (const { record, index } of rows) {
      if (!record.cliente || record.gestionId) continue;
      const key = rowKey(record);
      if (initialized.current.has(key)) continue;
      initialized.current.add(key);
      void autoSelectGestion(index, record.cliente, record.proyecto);
    }
  }, [rows, sendLocked, autoSelectGestion]);

  const context = useMemo<PreviewContextValue>(
    () => ({
      locked: sendLocked,
      clientes,
      tipoHoraOptions,
      onClienteChange: (index, cliente) => {
        const updated = onRecordChange(index, (current) => applyClienteChange(current, cliente));
        if (!updated || !cliente) return;
        initialized.current.add(rowKey(updated));
        void autoSelectGestion(index, cliente, '');
      },
      onGestionChange: (index, record, option, gestionId) => {
        onRecordChange(index, (current) => applyGestionChange(current, option, gestionId));
        rememberGestion(record.cliente, gestionId);
      },
      onTipoHoraChange: (index, tipoHora) => onRecordChange(index, (current) => ({ ...current, tipoHora })),
      onEdit: onEditRecord,
      onDuplicate: onDuplicateRecord,
      onDelete: onDeleteRecord,
    }),
    [sendLocked, clientes, tipoHoraOptions, onRecordChange, autoSelectGestion, onEditRecord, onDuplicateRecord, onDeleteRecord],
  );

  return (
    <PreviewContext.Provider value={context}>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle>Vista previa de registros</CardTitle>
          <CardDescription>
            {countLabel(recordCount, 'registro', 'registros')} en {countLabel(groups.length, 'día', 'días')}
            {groups.length > 1 ? <span className="font-semibold text-primary"> · {totalGeneral.toFixed(1)}h totales</span> : null}
          </CardDescription>
          <div className="flex flex-wrap gap-2 sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end" role="status" aria-live="polite">
            <Badge variant="outline" className="border-success/40 text-success">
              {readyCount} listos
            </Badge>
            {recordsToReview > 0 ? <Badge variant="destructive">{recordsToReview} por revisar</Badge> : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {wide ? <WideTable rows={rows} /> : <CardList groups={groups} />}
          {groups.length > 1 ? (
            <div className="border-t-2 border-primary/30 bg-primary/5 px-4 py-3 text-right">
              <span className="text-sm text-muted-foreground">Total general:</span>
              <span className="ml-2 text-base font-semibold text-primary">
                {totalGeneral.toFixed(1)}h en {groups.length} días
              </span>
            </div>
          ) : null}
        </CardContent>
        <CardFooter className="flex-col gap-2 border-t py-4 sm:flex-row">
          <Button
            type="button"
            className="w-full sm:flex-1"
            disabled={sendLocked || recordsToReview > 0}
            title={recordsToReview > 0 ? 'Completa los registros por revisar antes de registrar' : 'Registrar todos los tiempos'}
            onClick={onSendAll}
          >
            {sendLocked ? (
              <>
                <Loader2 aria-hidden="true" className="animate-spin" />
                Enviando...
              </>
            ) : recordsToReview > 0 ? (
              `Completa ${countLabel(recordsToReview, 'pendiente', 'pendientes')}`
            ) : (
              `Registrar todos (${recordCount})`
            )}
          </Button>
          <Button type="button" variant="outline" className="w-full sm:w-auto" disabled={sendLocked} onClick={onCancelImport}>
            Cancelar
          </Button>
        </CardFooter>
      </Card>
    </PreviewContext.Provider>
  );
}
