import { CalendarCheck, Clock, Factory, Receipt, RefreshCw, Users } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { WorkdayHoursPolicy } from '@domain/time-records/services/workday-hours.policy';
import { useContainer } from '@presentation/providers/container-context';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { useAppParameters } from '@presentation/shared/hooks/use-app-parameters';
import { errorMessage } from '@presentation/shared/error-message';
import { BillingChart, ClientHoursChart, DailyHoursChart, HoursSparkline, MonthlyChart } from '../dashboard/dashboard-charts';
import { ComplianceCard } from '../dashboard/compliance-card';
import { formatHours } from '../dashboard/dashboard-format';
import { buildDelta, complianceSummary, lastDays } from '../dashboard/dashboard-insights';
import { RankedHoursCard } from '../dashboard/ranked-hours-card';
import { DashboardFiltersCard } from '../dashboard/dashboard-filters-card';
import { RequestHoursCard } from '../dashboard/request-hours-card';
import { withEstimatedHours } from '../dashboard/request-estimates';
import { useManagementTemplatesList } from '../hooks/use-management-templates-list';
import { useDashboardFilters } from '../dashboard/use-dashboard-filters';
import { useMyReports } from '../reports/use-my-reports';
import { breakdownStatistics, filterStatisticsReports } from '../statistics/statistics-breakdown';

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
      <div className="grid gap-4 xl:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80 xl:col-span-2" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-80" />
        ))}
      </div>
    </div>
  );
}

/** Dashboard de tiempos del consultor (F6): filtros en la URL, KPIs y gráficas. */
export function TimeDashboardPage() {
  const { dashboardCalculator: calculator, parameters } = useContainer();
  const reports = useMyReports();
  const templates = useManagementTemplatesList();
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
  // Horas por solicitud usa los últimos 6 meses, sin importar el periodo ni los filtros del resto del dashboard.
  const requests = useMemo(() => {
    if (!rows) return [];
    const { from, to } = calculator.presetRange('6m', filters.today);
    const { requests: recent } = calculator.build(rows, { from, to, client: '', hourType: '' });
    return withEstimatedHours(recent, templates.data ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculator, rows, filters.today, templates.data, workSettings]);
  const kpis = snapshot?.kpis;
  // La jornada esperada por fecha sale de la configuración; `workSettings` invalida el cálculo al cambiar.
  const compliance = useMemo(() => {
    if (!snapshot) return null;
    const expectedFor = (date: string) => new WorkdayHoursPolicy(parameters).expectedHoursForDate(date);
    return { summary: complianceSummary(snapshot.daily, expectedFor), trend: lastDays(snapshot.daily, 7) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, parameters, workSettings]);
  const dailySpark = useMemo(
    () => snapshot?.daily.map(({ shortLabel, hours }) => ({ label: shortLabel, hours })) ?? [],
    [snapshot],
  );
  const hourTypes = useMemo(
    () => (rows && snapshot ? breakdownStatistics(filterStatisticsReports(rows, filter), 'hourType').slice(0, 5) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, snapshot, filter.from, filter.to, filter.client, filter.hourType],
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 md:py-8">
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

      {requests.length > 0 ? <RequestHoursCard requests={requests} estimatesError={templates.isError} /> : null}

      <DashboardFiltersCard
        filters={filters}
        options={options}
        loading={reports.isPending}
        included={snapshot?.rowCount ?? 0}
        total={rows?.length ?? 0}
      />

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
              icon={CalendarCheck}
              accent={2}
              description={`${formatHours(kpis.expectedHours)} h esperadas según la jornada (sin festivos)`}
            />
            <MetricCard
              label="Horas reportadas"
              value={`${formatHours(kpis.totalHours)} h`}
              tone="blue"
              icon={Clock}
              accent={1}
              delta={buildDelta(kpis.variationPct)}
              description={kpis.variationPct === null ? 'Sin horas en el periodo anterior' : 'vs. periodo anterior'}
              chart={<HoursSparkline data={dailySpark} label="Horas por día del periodo" />}
            />
            <MetricCard
              label="Facturable"
              value={`${formatHours(kpis.billablePct)}%`}
              tone="blue"
              icon={Receipt}
              accent={5}
              description={`${formatHours(kpis.billableHours)} h facturables por tipo de hora`}
            />
            <MetricCard
              label="Horas Fábrica"
              value={`${formatHours(kpis.extraHours)} h`}
              tone={kpis.extraHours > 0 ? 'amber' : 'slate'}
              icon={Factory}
              accent={3}
              description="Registros con tipo de hora Fábrica"
            />
            <MetricCard label="Clientes atendidos" value={kpis.clientCount} icon={Users} accent={4} description="Clientes con reportes en el periodo" />
          </section>

          {snapshot.rowCount && compliance ? (
            <>
              <section className="grid gap-4 xl:grid-cols-3">
                <ComplianceCard summary={compliance.summary} trend={compliance.trend} />
                <ChartCard
                  className="xl:col-span-2"
                  title="Horas reportadas por día"
                  description="Todos los días del rango, incluidos los días sin reportes, frente a la meta diaria."
                >
                  <DailyHoursChart data={snapshot.daily} goal={workSettings.mondayThursdayHours} />
                </ChartCard>
              </section>
              <section className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Horas por cliente" description="Distribución del esfuerzo por cliente, de mayor a menor.">
                  <ClientHoursChart data={snapshot.byClient} />
                </ChartCard>
                <ChartCard title="Facturable vs. no facturable" description="Clasificación según el tipo de hora de cada registro.">
                  <BillingChart data={snapshot.billing} />
                </ChartCard>
                <RankedHoursCard title="Horas por tipo de hora" description="Los cinco tipos con más horas y su participación." items={hourTypes} />
                <ChartCard
                  title="Comparativo mes a mes"
                  description="Horas por mes calendario y variación frente al mes anterior. Los meses parciales no se prorratean."
                >
                  <MonthlyChart data={snapshot.months} />
                </ChartCard>
              </section>
            </>
          ) : (
            <StateMessage
              title="Sin registros en el periodo"
              description="No hay horas reportadas para el rango y los filtros seleccionados. Amplía el periodo o restablece los filtros."
              actionLabel="Restablecer filtros"
              onAction={filters.reset}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
