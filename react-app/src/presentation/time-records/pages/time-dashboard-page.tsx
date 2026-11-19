import { RefreshCw } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import type { TimeDashboardPeriodPreset } from '@domain/time-records/models/time-dashboard.model';
import { WorkdayHoursPolicy } from '@domain/time-records/services/workday-hours.policy';
import { useContainer } from '@presentation/providers/container-context';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { errorMessage } from '@presentation/shared/error-message';
import { BillingChart, ClientHoursChart, DailyHoursChart, MonthlyChart } from '../dashboard/dashboard-charts';
import { formatHours, formatSigned } from '../dashboard/dashboard-format';
import { RequestHoursCard } from '../dashboard/request-hours-card';
import { DayAlertsCard } from '../dashboard/day-alerts-card';
import { buildDayAlerts } from '../dashboard/day-alerts';
import { PERIOD_PRESETS, useDashboardFilters } from '../dashboard/use-dashboard-filters';
import { buildDayLedger, toReportView } from '../reports/report-view';
import { useMyReports } from '../reports/use-my-reports';

const asOptions = (values: readonly string[], emptyLabel: string): AppSelectOption[] => [
  { value: '', label: emptyLabel },
  ...values.map((value) => ({ value, label: value })),
];

function ChartCard({
  title,
  description,
  className,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Consultando registros...">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-80" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

/** Dashboard de tiempos del consultor (F6): filtros en la URL, KPIs, gráficas y alertas por día. */
export function TimeDashboardPage() {
  const { dashboardCalculator: calculator, domainService, parameters } = useContainer();
  const reports = useMyReports();
  const workSettings = useAppParameters((p) => p.workSettings());
  const filters = useDashboardFilters(calculator);
  const { filter } = filters;
  const rows = reports.data;

  const options = useMemo(() => (rows ? calculator.filterOptions(rows) : { clients: [], hourTypes: [] }), [calculator, rows]);
  // `workSettings` no se lee aquí: es la dependencia que invalida el cálculo cuando cambia la jornada.
  const snapshot = useMemo(
    () => (rows && !filters.dateError ? calculator.build(rows, filter) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [calculator, rows, filter.from, filter.to, filter.client, filter.hourType, filters.dateError, workSettings],
  );
  const alerts = useMemo(() => {
    if (!rows || filters.dateError) return [];
    const isCountable = (tipoHora: string) => domainService.isCountableHour(tipoHora);
    const ledger = buildDayLedger(rows.map((report) => toReportView(report, isCountable)), [], isCountable);
    return buildDayAlerts(ledger, filter, new WorkdayHoursPolicy(parameters), filters.today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter.from, filter.to, filters.dateError, filters.today, domainService, parameters, workSettings]);

  const kpis = snapshot?.kpis;
  const variation = kpis?.variationPct ?? null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        title="Dashboard de tiempos"
        description="Revisa si completaste tu jornada y cómo se clasificó tu tiempo."
        aside={
          <Button type="button" variant="outline" disabled={reports.isFetching} onClick={() => void reports.refetch()}>
            <RefreshCw aria-hidden="true" className={reports.isFetching ? 'animate-spin' : undefined} />
            {reports.isFetching ? 'Actualizando...' : 'Actualizar datos'}
          </Button>
        }
      />

      <Card aria-labelledby="dashboard-filters-title" role="region">
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle id="dashboard-filters-title">Periodo y filtros</CardTitle>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            aria-label="Periodo rápido"
            value={filters.activePreset}
            onValueChange={(value) => value && filters.applyPreset(value as TimeDashboardPeriodPreset)}
          >
            {PERIOD_PRESETS.map((preset) => (
              <ToggleGroupItem key={preset.value} value={preset.value} className="max-sm:flex-1">
                {preset.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="dashboard-from">Desde</Label>
              <DatePicker id="dashboard-from" value={filter.from} onChange={filters.setFrom} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="dashboard-to">Hasta</Label>
              <DatePicker id="dashboard-to" value={filter.to} onChange={filters.setTo} />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="dashboard-client">Cliente</Label>
              <AppSelect
                id="dashboard-client"
                options={asOptions(options.clients, 'Todos los clientes')}
                value={filter.client}
                onValueChange={filters.setClient}
                loading={reports.isPending}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="dashboard-hour-type">Tipo de hora</Label>
              <AppSelect
                id="dashboard-hour-type"
                options={asOptions(options.hourTypes, 'Todos los tipos de hora')}
                value={filter.hourType}
                onValueChange={filters.setHourType}
                loading={reports.isPending}
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {filters.dateError ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {filters.dateError}
              </p>
            ) : (
              <p className="text-xs font-medium text-muted-foreground">
                {snapshot?.rowCount ?? 0} de {rows?.length ?? 0} registros incluidos.
              </p>
            )}
            <Button type="button" variant="link" size="sm" onClick={filters.reset}>
              Restablecer filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {reports.isPending ? (
        <DashboardSkeleton />
      ) : reports.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible consultar los registros"
          description={errorMessage(reports.error) || 'No fue posible consultar los registros del consultor.'}
          actionLabel="Reintentar"
          onAction={() => void reports.refetch()}
        />
      ) : snapshot && kpis ? (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4" aria-label="Indicadores del periodo">
            <MetricCard
              className="col-span-2 lg:col-span-1"
              label="Días reportados"
              value={`${kpis.reportedDays} / ${kpis.expectedDays}`}
              tone={kpis.reportedDays < kpis.expectedDays ? 'amber' : 'slate'}
              description={`${formatHours(kpis.expectedHours)} h esperadas según la jornada (sin festivos)`}
            />
            <MetricCard
              label="Horas reportadas"
              value={`${formatHours(kpis.totalHours)} h`}
              tone="blue"
              delta={
                variation === null
                  ? undefined
                  : {
                      label: `${formatSigned(variation)} %`,
                      trend: variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral',
                      description: 'frente al periodo anterior',
                    }
              }
              description={variation === null ? 'Sin horas en el periodo anterior' : 'vs. periodo anterior'}
            />
            <MetricCard
              label="Facturable"
              value={`${formatHours(kpis.billablePct)}%`}
              tone="blue"
              description={`${formatHours(kpis.billableHours)} h facturables por tipo de hora`}
            />
            <MetricCard
              label="Horas Fábrica"
              value={`${formatHours(kpis.extraHours)} h`}
              tone={kpis.extraHours > 0 ? 'amber' : 'slate'}
              description="Registros con tipo de hora Fábrica"
            />
            <MetricCard label="Clientes atendidos" value={kpis.clientCount} description="Clientes con reportes en el periodo" />
          </section>

          {snapshot.rowCount ? (
            <section className="grid gap-4 xl:grid-cols-2">
              <DayAlertsCard alerts={alerts} />
              <ChartCard title="Facturable vs. no facturable" description="Clasificación según el tipo de hora de cada registro.">
                <BillingChart data={snapshot.billing} />
              </ChartCard>
              <ChartCard
                className="xl:col-span-2"
                title="Horas reportadas por día"
                description="Todos los días del rango, incluidos los días sin reportes."
              >
                <DailyHoursChart data={snapshot.daily} />
              </ChartCard>
              <ChartCard title="Horas por cliente" description="Distribución del esfuerzo por cliente, de mayor a menor.">
                <ClientHoursChart data={snapshot.byClient} />
              </ChartCard>
              <ChartCard
                title="Comparativo mes a mes"
                description="Horas por mes calendario y variación frente al mes anterior. Los meses parciales no se prorratean."
              >
                <MonthlyChart data={snapshot.months} />
              </ChartCard>
              <RequestHoursCard requests={snapshot.requests} />
            </section>
          ) : (
            <>
              <StateMessage
                title="Sin registros en el periodo"
                description="No hay horas reportadas para el rango y los filtros seleccionados. Amplía el periodo o restablece los filtros."
                actionLabel="Restablecer filtros"
                onAction={filters.reset}
              />
              <DayAlertsCard alerts={alerts} />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
