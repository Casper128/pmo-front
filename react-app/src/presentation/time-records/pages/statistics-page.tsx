import { RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { useContainer } from '@presentation/providers/container-context';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { PageHeader } from '@presentation/shared/components/page-header';
import { StateMessage } from '@presentation/shared/components/state-message';
import { errorMessage } from '@presentation/shared/error-message';
import { DashboardFiltersCard } from '../dashboard/dashboard-filters-card';
import { formatHours } from '../dashboard/dashboard-format';
import { useDashboardFilters } from '../dashboard/use-dashboard-filters';
import { useMyReports } from '../reports/use-my-reports';
import { StatisticsBreakdownCard } from '../statistics/statistics-breakdown-card';
import { breakdownStatistics, filterStatisticsReports } from '../statistics/statistics-breakdown';

const BREAKDOWNS = [
  { dimension: 'module', title: 'Horas por módulo', dimensionLabel: 'Módulo', description: 'Módulos con mayor dedicación.' },
  { dimension: 'activity', title: 'Horas por actividad', dimensionLabel: 'Actividad', description: 'Tipos de actividad más recurrentes.' },
  { dimension: 'management', title: 'Horas por gestión', dimensionLabel: 'Gestión', description: 'Gestiones con más horas en el periodo.' },
  { dimension: 'category', title: 'Horas por categoría', dimensionLabel: 'Categoría', description: 'Distribución por categoría registrada.' },
] as const;

/** Datos del consultor (F11): horas, registros y % por módulo, actividad, gestión y categoría del periodo filtrado. */
export function StatisticsPage() {
  const { dashboardCalculator: calculator } = useContainer();
  const reports = useMyReports();
  const filters = useDashboardFilters(calculator);
  const rows = reports.data;

  const options = useMemo(() => (rows ? calculator.filterOptions(rows) : { clients: [], hourTypes: [] }), [calculator, rows]);
  const filtered = useMemo(
    () => (rows && !filters.dateError ? filterStatisticsReports(rows, filters.filter) : []),
    // `filters.filter` se recrea en cada render: se depende de sus campos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, filters.filter.from, filters.filter.to, filters.filter.client, filters.filter.hourType, filters.dateError],
  );
  const breakdowns = useMemo(() => BREAKDOWNS.map((item) => ({ ...item, groups: breakdownStatistics(filtered, item.dimension) })), [filtered]);
  const totalHours = breakdowns[0].groups.reduce((sum, group) => sum + group.hours, 0);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <PageHeader
        eyebrow="Analítica personal"
        title="Datos del consultor"
        description="Revisa en qué módulos, actividades, gestiones y categorías se concentran tus horas."
        aside={
          <Button type="button" variant="outline" disabled={reports.isFetching} onClick={() => void reports.refetch()}>
            <RefreshCw aria-hidden="true" className={reports.isFetching ? 'animate-spin' : undefined} />
            {reports.isFetching ? 'Actualizando...' : 'Actualizar datos'}
          </Button>
        }
      />

      <DashboardFiltersCard filters={filters} options={options} loading={reports.isPending} included={filtered.length} total={rows?.length ?? 0} />

      {reports.isPending ? (
        <div className="grid gap-4 xl:grid-cols-2" role="status" aria-label="Consultando registros...">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-96" />
          ))}
        </div>
      ) : reports.isError ? (
        <StateMessage
          tone="error"
          title="No fue posible consultar los registros"
          description={errorMessage(reports.error) || 'No fue posible consultar los registros del consultor.'}
          actionLabel="Reintentar"
          onAction={() => void reports.refetch()}
        />
      ) : filtered.length ? (
        <>
          <section className="grid grid-cols-2 gap-3" aria-label="Totales del periodo">
            <MetricCard label="Horas totales" value={`${formatHours(totalHours)} h`} tone="blue" description="En el periodo filtrado" />
            <MetricCard label="Registros" value={filtered.length} description="Actividades reportadas" />
          </section>
          <section className="grid gap-4 xl:grid-cols-2">
            {breakdowns.map(({ dimension, groups, ...card }) => (
              <StatisticsBreakdownCard key={dimension} {...card} groups={groups} />
            ))}
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
    </div>
  );
}
