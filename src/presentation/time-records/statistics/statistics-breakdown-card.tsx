import { createColumnHelper, createPaginatedRowModel, rowPaginationFeature, tableFeatures, useTable } from '@tanstack/react-table';
import { useMemo } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { StateMessage } from '@presentation/shared/components/state-message';
import { ClientHoursChart, DonutChart } from '../dashboard/dashboard-charts';
import { formatHours } from '../dashboard/dashboard-format';
import { topWithOthers } from '../dashboard/dashboard-insights';
import type { StatisticsGroup } from './statistics-breakdown';

/** Grupos que se grafican en barras; la dona agrupa el resto en "Otros" y la tabla muestra todos. */
const CHART_LIMIT = 8;
const DONUT_LIMIT = 6;
const PAGE_SIZE = 10;

const features = tableFeatures({ rowPaginationFeature, paginatedRowModel: createPaginatedRowModel() });
const columnHelper = createColumnHelper<typeof features, StatisticsGroup>();

export interface StatisticsBreakdownCardProps {
  readonly title: string;
  readonly description: string;
  /** Encabezado de la primera columna de la tabla (Módulo, Actividad…). */
  readonly dimensionLabel: string;
  readonly groups: readonly StatisticsGroup[];
  /** Tipo de gráfica: barras (por defecto) o dona con total al centro. */
  readonly chart?: 'bar' | 'donut';
}

/** Tabla del desglose; con más de `PAGE_SIZE` filas se pagina con TanStack Table. */
function BreakdownTable({ title, dimensionLabel, groups }: Pick<StatisticsBreakdownCardProps, 'title' | 'dimensionLabel' | 'groups'>) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: 'label',
          header: dimensionLabel,
          cell: ({ row }) => <OverflowText>{row.original.label}</OverflowText>,
        }),
        columnHelper.display({ id: 'hours', header: 'Horas', cell: ({ row }) => formatHours(row.original.hours) }),
        columnHelper.display({ id: 'count', header: 'Registros', cell: ({ row }) => row.original.count }),
        columnHelper.display({ id: 'share', header: '%', cell: ({ row }) => `${formatHours(row.original.share)} %` }),
      ]),
    [dimensionLabel],
  );
  const table = useTable({ features, columns, data: groups as StatisticsGroup[], initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } } });
  const { pageIndex } = table.state.pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-auto rounded-md border">
        <Table aria-label={`${title}: detalle`}>
          <TableHeader className="sticky top-0 bg-card">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.id === 'label' ? undefined : 'text-right'}>
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.original.label}>
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cell.column.id === 'label' ? 'max-w-48 font-medium' : 'text-right tabular-nums'}>
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pageCount > 1 ? (
        <nav aria-label={`${title}: paginación`} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            Página {pageIndex + 1} de {pageCount}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
              Anterior
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
              Siguiente
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

/** Desglose de horas por una dimensión: gráfica de barras de los mayores grupos y tabla con horas, registros y %. */
export function StatisticsBreakdownCard({ title, description, dimensionLabel, groups, chart = 'bar' }: StatisticsBreakdownCardProps) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.length ? (
          <>
            {chart === 'donut' ? (
              <DonutChart data={topWithOthers(groups, DONUT_LIMIT)} label={title} />
            ) : (
              <ClientHoursChart data={groups.slice(0, CHART_LIMIT)} label={title} />
            )}
            <BreakdownTable title={title} dimensionLabel={dimensionLabel} groups={groups} />
          </>
        ) : (
          <StateMessage tone="warning" title="Sin datos para graficar" description="No hay registros con horas en el periodo." />
        )}
      </CardContent>
    </Card>
  );
}
