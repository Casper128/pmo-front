import { RefreshCw } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { useContainer } from '@presentation/providers/container-context';
import { AppSelect } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { PageHeader } from '@presentation/shared/components/page-header';
import { SearchInput } from '@presentation/shared/components/search-input';
import { StateMessage } from '@presentation/shared/components/state-message';
import { errorMessage } from '@presentation/shared/error-message';
import { useMediaQuery } from '@presentation/shared/hooks/use-media-query';
import { formatHours } from '../dashboard/dashboard-format';
import { DeleteReportDialog } from '../reports/delete-report-dialog';
import { DuplicateDialog, type DuplicateTarget } from '../reports/duplicate-dialog';
import { ReportDayCard, type ReportAction } from '../reports/report-day-card';
import {
  REPORT_PRESETS,
  filterReportRows,
  groupReportsByDay,
  summarizeReports,
  toReportRow,
  type ReportPreset,
  type ReportRow,
} from '../reports/report-list';
import { ReportSheet } from '../reports/report-sheet';
import { NO_DAY_KEY } from '../reports/report-view';
import { useMyDeleteRequests } from '../reports/use-my-delete-requests';
import { useMyReports } from '../reports/use-my-reports';
import { useReportFilters } from '../reports/use-report-filters';
import { useWorkdayPolicy } from '../reports/use-workday-policy';

const DAYS_PER_PAGE = 10;
/** md: tabla densa; por debajo, tarjetas de dos líneas. */
const WIDE_QUERY = '(min-width: 768px)';

function ReportsSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Consultando reportes...">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-32" />
      ))}
    </div>
  );
}

/** Reportes enviados del consultor (F9): filtros en la URL, lista por día frente a la jornada y acciones por registro. */
export function ReportsPage() {
  const { domainService } = useContainer();
  const filters = useReportFilters();
  const reports = useMyReports();
  const { byIdentifier: requests, isError: requestsFailed, refetch: refetchRequests } = useMyDeleteRequests();
  const policy = useWorkdayPolicy();
  const wide = useMediaQuery(WIDE_QUERY);
  const [duplicate, setDuplicate] = useState<DuplicateTarget | null>(null);
  const [deleting, setDeleting] = useState<ReportRow | null>(null);
  const [shown, setShown] = useState({ key: '', days: DAYS_PER_PAGE });

  const isCountable = useCallback((tipoHora: string) => domainService.isCountableHour(tipoHora), [domainService]);
  const allRows = useMemo(() => reports.data?.map((report) => toReportRow(report, isCountable)), [reports.data, isCountable]);
  const clients = useMemo(
    () => [...new Set((allRows ?? []).map((row) => row.clientName))].sort((a, b) => a.localeCompare(b, 'es')),
    [allRows],
  );
  const { from, to, q, client, dateError } = filters;
  const days = useMemo(
    () => (allRows && !dateError ? groupReportsByDay(filterReportRows(allRows, { from, to, q, client })) : []),
    [allRows, from, to, q, client, dateError],
  );
  const summary = useMemo(() => summarizeReports(days), [days]);

  const filterKey = `${from}|${to}|${q}|${client}`;
  const visibleCount = shown.key === filterKey ? shown.days : DAYS_PER_PAGE;
  const datedDays = days.filter((day) => day.dayKey !== NO_DAY_KEY);
  const visibleDays = [...datedDays.slice(0, visibleCount), ...days.filter((day) => day.dayKey === NO_DAY_KEY)];

  const onAction = (action: ReportAction, row: ReportRow) => {
    if (action === 'view' || action === 'edit') filters.openReport(row.view.id, action);
    else if (action === 'duplicate') setDuplicate({ kind: 'record', row });
    else setDeleting(row);
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Reportes"
        description="Consulta, edita y gestiona tus reportes enviados."
        aside={
          <Button type="button" variant="outline" disabled={reports.isFetching} onClick={() => void reports.refetch()}>
            <RefreshCw aria-hidden="true" className={reports.isFetching ? 'animate-spin' : undefined} />
            {reports.isFetching ? 'Actualizando...' : 'Actualizar datos'}
          </Button>
        }
      />

      <Card role="region" aria-labelledby="reports-filters-title">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle id="reports-filters-title">Periodo y filtros</CardTitle>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="w-full flex-wrap sm:w-auto"
            aria-label="Periodo rápido"
            value={filters.preset}
            onValueChange={(value) => value && filters.setPreset(value as ReportPreset)}
          >
            {REPORT_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value} className="max-sm:grow">
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filters.preset === 'custom' ? (
              <>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="reports-from">Desde</Label>
                  <DatePicker id="reports-from" value={from} onChange={filters.setFrom} />
                </div>
                <div className="flex min-w-0 flex-col gap-1.5">
                  <Label htmlFor="reports-to">Hasta</Label>
                  <DatePicker id="reports-to" value={to} onChange={filters.setTo} />
                </div>
              </>
            ) : null}
            <div className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
              <Label htmlFor="reports-search">Buscar</Label>
              <SearchInput
                id="reports-search"
                value={filters.searchText}
                onChange={filters.setSearchText}
                placeholder="Gestión, cliente o ID"
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="reports-client">Cliente</Label>
              <AppSelect
                id="reports-client"
                options={[{ value: '', label: 'Todos los clientes' }, ...clients.map((name) => ({ value: name, label: name }))]}
                value={client}
                onValueChange={filters.setClient}
                loading={reports.isPending}
              />
            </div>
          </div>
          {dateError ? (
            <p className="text-sm font-medium text-destructive" role="alert">
              {dateError}
            </p>
          ) : allRows ? (
            <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
              {summary.count} {summary.count === 1 ? 'registro' : 'registros'} en {summary.days} {summary.days === 1 ? 'día' : 'días'} ·{' '}
              <span className="tabular-nums">{formatHours(summary.computableHours, 2)} h computables</span>
              {summary.nonComputableHours > 0 ? (
                <span className="tabular-nums"> · {formatHours(summary.nonComputableHours, 2)} h que no computan (Fábrica)</span>
              ) : null}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {requestsFailed ? (
        <Alert role="status" className="flex flex-wrap items-center justify-between gap-2 py-2">
          <AlertDescription>No se pudo consultar el estado de tus solicitudes de eliminación.</AlertDescription>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetchRequests()}>
            Reintentar
          </Button>
        </Alert>
      ) : null}

      {reports.isPending ? (
        <ReportsSkeleton />
      ) : reports.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible consultar los reportes"
          description={errorMessage(reports.error) || 'No fue posible consultar tus reportes enviados.'}
          actionLabel="Reintentar"
          onAction={() => void reports.refetch()}
        />
      ) : !allRows?.length ? (
        <StateMessage title="Aún no tienes reportes enviados" description="Cuando registres tiempos desde Reportar aparecerán aquí." />
      ) : !dateError && !days.length ? (
        <StateMessage
          title="Sin resultados"
          description="No hay reportes para el periodo y los filtros seleccionados."
          actionLabel="Limpiar filtros"
          onAction={filters.clear}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visibleDays.map((day) => (
            <ReportDayCard
              key={day.dayKey}
              day={day}
              expectedHours={day.dayKey === NO_DAY_KEY ? 0 : policy.expectedHoursForDate(day.dayKey)}
              today={filters.today}
              wide={wide}
              requests={requests}
              onAction={onAction}
              onDuplicateDay={(target) => setDuplicate({ kind: 'day', day: target })}
            />
          ))}
          {datedDays.length > visibleCount ? (
            <Button type="button" variant="outline" className="self-center" onClick={() => setShown({ key: filterKey, days: visibleCount + DAYS_PER_PAGE })}>
              Mostrar más días ({datedDays.length - visibleCount} restantes)
            </Button>
          ) : null}
        </div>
      )}

      <ReportSheet
        reportId={filters.reportId}
        mode={filters.mode}
        rows={allRows}
        onModeChange={(mode) => filters.openReport(filters.reportId, mode)}
        onClose={filters.closeReport}
      />
      <DuplicateDialog target={duplicate} today={filters.today} onClose={() => setDuplicate(null)} />
      <DeleteReportDialog row={deleting} today={filters.today} onClose={() => setDeleting(null)} />
    </div>
  );
}
