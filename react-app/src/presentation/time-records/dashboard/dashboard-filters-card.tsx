import type { TimeDashboardPeriodPreset, TimeDashboardFilterOptions } from '@domain/time-records/models/time-dashboard.model';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { AppSelect, type AppSelectOption } from '@presentation/shared/components/app-select';
import { DatePicker } from '@presentation/shared/components/date-picker';
import { PERIOD_PRESETS, type useDashboardFilters } from './use-dashboard-filters';

const asOptions = (values: readonly string[], emptyLabel: string): AppSelectOption[] => [
  { value: '', label: emptyLabel },
  ...values.map((value) => ({ value, label: value })),
];

export interface DashboardFiltersCardProps {
  readonly filters: ReturnType<typeof useDashboardFilters>;
  readonly options: TimeDashboardFilterOptions;
  readonly loading: boolean;
  readonly included: number;
  readonly total: number;
}

/** Periodo y filtros (cliente, tipo de hora) en la URL: los comparten el Dashboard y Datos. */
export function DashboardFiltersCard({ filters, options, loading, included, total }: DashboardFiltersCardProps) {
  const { filter } = filters;
  return (
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
              loading={loading}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="dashboard-hour-type">Tipo de hora</Label>
            <AppSelect
              id="dashboard-hour-type"
              options={asOptions(options.hourTypes, 'Todos los tipos de hora')}
              value={filter.hourType}
              onValueChange={filters.setHourType}
              loading={loading}
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
              {included} de {total} registros incluidos.
            </p>
          )}
          <Button type="button" variant="link" size="sm" onClick={filters.reset}>
            Restablecer filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
