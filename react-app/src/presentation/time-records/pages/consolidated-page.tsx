import type { ReactNode } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { useContainer } from '@presentation/providers/container-context';
import { AppSelect } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { SearchInput } from '@presentation/shared/components/search-input';
import { StateMessage } from '@presentation/shared/components/state-message';
import { apiErrorMessage } from '@presentation/shared/error-message';
import { useMediaQuery } from '@presentation/shared/hooks/use-media-query';
import { formatFullDate } from '@presentation/shared/format';
import { downloadExcel } from '../consolidated/consolidated-excel';
import {
  CONSOLIDATED_PRESETS,
  HOUR_BILLING_OPTIONS,
  filterConsolidated,
  summarizeDaily,
  summarizeTotals,
  uniqueSorted,
  type ConsolidatedPreset,
} from '../consolidated/consolidated-report';
import { ActivityDetail, DailySummaryTable } from '../consolidated/consolidated-tables';
import { downloadFilter, useConsolidatedReport } from '../consolidated/use-consolidated-report';
import { useConsolidatedFilters } from '../consolidated/use-consolidated-filters';
import { formatHours } from '../dashboard/dashboard-format';
import { useClientes } from '../hooks/use-select-options';

/** md: tabla densa de detalle; por debajo, tarjetas de dos líneas. */
const WIDE_QUERY = '(min-width: 768px)';

const option = (value: string, label: string) => ({ value, label });

function ResultSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Consultando reporte...">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function Field({ id, label, children }: { readonly id: string; readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

/**
 * Consolidado de tiempos (F10, vista `download` de Angular): el usuario elige periodo y cliente, el servidor devuelve
 * un Excel que se lee en pantalla y se puede segmentar por consultor, cliente, día, clasificación de hora y texto.
 */
export function ConsolidatedPage() {
  const { domainService } = useContainer();
  const filters = useConsolidatedFilters();
  const { clientes, loading: clientsLoading } = useClientes();
  const report = useConsolidatedReport();
  const wide = useMediaQuery(WIDE_QUERY);
  const { result } = filters;
  const rows = report.data?.rows;

  const filtered = useMemo(
    () => (rows ? filterConsolidated(rows, result, (tipoHora, filter) => domainService.matchesHourBillingFilter(tipoHora, filter)) : []),
    [rows, result, domainService],
  );
  const daily = useMemo(() => summarizeDaily(filtered), [filtered]);
  const totals = useMemo(() => summarizeTotals(filtered), [filtered]);
  const consultants = useMemo(() => uniqueSorted((rows ?? []).map((row) => row.consultor)), [rows]);
  const resultClients = useMemo(() => uniqueSorted((rows ?? []).map((row) => row.cliente)), [rows]);
  const days = useMemo(() => uniqueSorted((rows ?? []).map((row) => row.fecha)).reverse(), [rows]);

  const generate = () => {
    filters.clearResult();
    report.mutate(downloadFilter(filters.from, filters.to, filters.client));
  };
  const clear = () => {
    report.reset();
    filters.clearAll();
  };
  const download = () => {
    const sent = report.variables;
    if (report.data?.excel && sent) {
      downloadExcel(report.data.excel, `consolidado-${sent.fechaInicio.slice(0, 10)}_${sent.fechaFin.slice(0, 10)}.xlsx`);
    }
  };
  const resultKey = JSON.stringify(result);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        eyebrow="Reporte de tiempos"
        title="Reporte consolidado"
        description="Consulta actividades por cliente y periodo para revisar horas facturables, de Fábrica y no facturables."
      />

      <Card role="region" aria-labelledby="consolidated-filters-title">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle id="consolidated-filters-title">Periodo y cliente</CardTitle>
            <CardDescription>El rango termina hoy y puede modificarse manualmente.</CardDescription>
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="w-full flex-wrap sm:w-auto"
            aria-label="Periodo rápido"
            value={filters.preset}
            onValueChange={(value) => value && filters.setPreset(value as ConsolidatedPreset)}
          >
            {CONSOLIDATED_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value} className="max-sm:grow">
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field id="consolidated-from" label="Fecha inicio">
              <DatePicker id="consolidated-from" value={filters.from} onChange={filters.setFrom} aria-invalid={!!filters.dateError} />
            </Field>
            <Field id="consolidated-to" label="Fecha fin">
              <DatePicker id="consolidated-to" value={filters.to} onChange={filters.setTo} aria-invalid={!!filters.dateError} />
            </Field>
            <Field id="consolidated-client" label="Cliente">
              <AppSelect
                id="consolidated-client"
                options={[option('', 'Todos los clientes'), ...clientes.map((name) => option(name, name))]}
                value={filters.client}
                onValueChange={filters.setClient}
                loading={clientsLoading}
              />
            </Field>
          </div>
          {filters.dateError ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {filters.dateError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="max-sm:flex-1" disabled={report.isPending || !!filters.dateError} onClick={generate}>
              {report.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
              {report.isPending ? 'Consultando reporte...' : 'Generar reporte'}
            </Button>
            <Button type="button" variant="outline" disabled={report.isPending} onClick={clear}>
              Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {report.isPending ? (
        <ResultSkeleton />
      ) : report.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible generar el reporte"
          description={apiErrorMessage(report.error, 'Error al generar el reporte. Intenta nuevamente.')}
          actionLabel="Reintentar"
          onAction={generate}
        />
      ) : !report.data ? (
        <StateMessage
          title="Genera un reporte para ver actividades"
          description="Selecciona cliente y rango de fechas. La app cargará el Excel recibido y lo convertirá en tablas verificables."
        />
      ) : !report.data.rows.length ? (
        <StateMessage tone="warning" title="Sin datos" description={report.data.message} />
      ) : (
        <section className="flex flex-col gap-4" aria-labelledby="consolidated-result-title">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 id="consolidated-result-title" className="text-lg font-semibold tracking-tight">
                Actividad del consultor
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {report.data.rows.length} registros procesados en pantalla. Los indicadores y las tablas se actualizan con los filtros.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={download}>
              <Download aria-hidden="true" />
              Descargar Excel
            </Button>
          </div>

          <Card role="region" aria-labelledby="consolidated-result-filters-title">
            <CardHeader>
              <CardTitle id="consolidated-result-filters-title">Filtros del resultado</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Field id="result-consultant" label="Consultor">
                <AppSelect
                  id="result-consultant"
                  options={[option('', 'Todos los consultores'), ...consultants.map((name) => option(name, name))]}
                  value={result.consultant}
                  onValueChange={(value) => filters.setResult('consultant', value)}
                />
              </Field>
              <Field id="result-client" label="Cliente atendido">
                <AppSelect
                  id="result-client"
                  options={[option('', 'Todos los clientes'), ...resultClients.map((name) => option(name, name))]}
                  value={result.client}
                  onValueChange={(value) => filters.setResult('resultClient', value)}
                />
              </Field>
              <Field id="result-day" label="Día reportado">
                <AppSelect
                  id="result-day"
                  options={[option('', 'Todos los días'), ...days.map((day) => option(day, formatFullDate(day)))]}
                  value={result.day}
                  onValueChange={(value) => filters.setResult('day', value)}
                />
              </Field>
              <Field id="result-hour-type" label="Clasificación de hora">
                <AppSelect
                  id="result-hour-type"
                  options={HOUR_BILLING_OPTIONS}
                  value={result.hourType}
                  onValueChange={(value) => filters.setResult('hourType', value)}
                />
              </Field>
              <Field id="result-search" label="Buscar en el reporte">
                <SearchInput
                  id="result-search"
                  value={filters.searchText}
                  onChange={filters.setSearchText}
                  placeholder="Solicitud, gestión..."
                />
              </Field>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Horas totales" value={`${formatHours(totals.hours, 2)} h`} description="Según los filtros activos" tone="blue" />
            <MetricCard label="Días trabajados" value={totals.days} description="Días con horas registradas" />
            <MetricCard label="Clientes atendidos" value={totals.clients} description="Clientes distintos" />
            <MetricCard label="Registros" value={totals.records} description="Actividades encontradas" tone="blue" />
          </div>

          {filtered.length ? (
            <>
              <DailySummaryTable key={`daily-${resultKey}`} rows={daily} />
              <ActivityDetail key={`detail-${resultKey}`} rows={filtered} wide={wide} />
            </>
          ) : (
            <StateMessage
              tone="warning"
              title="No hay actividades con esos filtros"
              description="Limpia la búsqueda, cambia cliente, consultor, fecha o clasificación de hora para recuperar registros visibles."
              actionLabel="Limpiar filtros"
              onAction={filters.clearResult}
            />
          )}
        </section>
      )}
    </div>
  );
}
