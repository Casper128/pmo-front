import { useMemo, useState, type CSSProperties } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Progress } from '@/shared/ui/progress';
import type { DashboardRequestSummary } from '@domain/time-records/models/time-dashboard.model';
import { AppSelect } from '@presentation/shared/components/app-select';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { billingColor, formatHours } from './dashboard-format';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `2026-09-09T08:30:00` → `09 sep 2026 · 08:30` (sin hora si es medianoche). Parseo textual: no depende de la zona. */
function formatDateTime(value: string): string {
  const [date = '', time = ''] = value.split('T');
  const [year, month, day] = date.split('-');
  const label = `${day} ${MONTHS[Number(month) - 1] ?? ''} ${year}`;
  return time && time !== '00:00:00' ? `${label} · ${time.slice(0, 5)}` : label;
}

const sharePct = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

/**
 * Detalle de una solicitud (gestión) del periodo: horas reales, días con actividad y clasificación de
 * facturación, en formato compacto. Las estimadas y el consumo vienen de la plantilla de la gestión
 * (`withEstimatedHours`); si las plantillas no cargaron (`estimatesError`) se avisa en vez de marcarlas "Sin dato".
 */
export function RequestHoursCard({
  requests,
  estimatesError = false,
}: {
  readonly requests: readonly DashboardRequestSummary[];
  readonly estimatesError?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const options = useMemo(
    () => requests.map((item) => ({ value: item.key, label: `${item.request} · ${item.client}` })),
    [requests],
  );
  // `requests` llega de la más reciente a la más antigua: por defecto, la última solicitud con tiempo reportado.
  const request = requests.find((item) => item.key === selectedKey) ?? requests[0] ?? null;

  return (
    <Card size="sm" className="min-w-0">
      <CardHeader className="gap-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
        <CardTitle>Horas por solicitud</CardTitle>
        {request ? (
          <div className="min-w-0 sm:w-full sm:max-w-md sm:justify-self-end">
            <Label htmlFor="request-select" className="sr-only">
              Solicitud
            </Label>
            <AppSelect
              id="request-select"
              options={options}
              value={request.key}
              onValueChange={setSelectedKey}
              searchPlaceholder="Buscar solicitud..."
              searchThreshold={0}
            />
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {request ? (
          <>
            <div className="min-w-0">
              <OverflowText lines={2} className="text-sm font-semibold">
                {request.request}
              </OverflowText>
              <p className="text-xs text-muted-foreground">
                {request.client} · {formatDateTime(request.firstAt)} → {formatDateTime(request.latestAt)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <MetricCard
                compact
                label="Horas reales"
                value={`${formatHours(request.hours)} h`}
                tone="blue"
                description={`${request.count} ${request.count === 1 ? 'registro' : 'registros'}`}
              />
              <MetricCard
                compact
                label="Estimadas"
                value={estimatesError ? '—' : request.estimatedHours === null ? 'Sin dato' : `${formatHours(request.estimatedHours)} h`}
                description={estimatesError ? undefined : request.estimatedHours === null ? 'Defínelas en Plantillas' : 'Según la plantilla'}
              />
              <MetricCard
                compact
                label="Consumo"
                value={estimatesError ? '—' : request.consumptionPct === null ? 'Sin dato' : `${formatHours(request.consumptionPct)} %`}
                tone={request.consumptionPct !== null && request.consumptionPct > 100 ? 'amber' : 'slate'}
                description={request.consumptionPct !== null && request.consumptionPct > 100 ? 'Supera lo estimado' : 'Reales / estimadas'}
              />
              <MetricCard
                compact
                label="Días con actividad"
                value={request.activeDays}
                description={`${formatHours(request.hours / (request.activeDays || 1))} h por día`}
              />
            </div>
            {estimatesError ? (
              <p role="alert" className="text-xs text-warning">
                No se pudieron cargar las estimaciones.
              </p>
            ) : null}
            <section aria-labelledby="request-billing-title">
              <h3 id="request-billing-title" className="mb-1.5 text-xs font-medium text-muted-foreground">
                Clasificación de horas
              </h3>
              <ul className="flex flex-col gap-1.5">
                {request.billing.map((item) => (
                  <li key={item.label} className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 text-xs">
                    <span className="truncate font-medium">{item.label}</span>
                    <Progress
                      aria-label={`${item.label}: ${formatHours(sharePct(item.hours, request.hours))} %`}
                      value={sharePct(item.hours, request.hours)}
                      className="h-1.5 *:data-[slot=progress-indicator]:bg-(--bar)"
                      style={{ '--bar': billingColor(item.label) } as CSSProperties}
                    />
                    <span className="tabular-nums text-muted-foreground">
                      {formatHours(item.hours)} h · {formatHours(sharePct(item.hours, request.hours))} %
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
