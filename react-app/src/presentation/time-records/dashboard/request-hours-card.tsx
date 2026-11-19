import { useMemo, useState, type CSSProperties } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Progress } from '@/shared/ui/progress';
import type { DashboardRequestSummary } from '@domain/time-records/models/time-dashboard.model';
import { AppSelect } from '@presentation/shared/components/app-select';
import { MetricCard } from '@presentation/shared/components/metric-card';
import { OverflowText } from '@presentation/shared/components/overflow-text';
import { StateMessage } from '@presentation/shared/components/state-message';
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
 * facturación. Las estimadas y el consumo vienen de la plantilla de la gestión (`withEstimatedHours`).
 */
export function RequestHoursCard({ requests }: { readonly requests: readonly DashboardRequestSummary[] }) {
  const [selectedKey, setSelectedKey] = useState('');
  const options = useMemo(
    () => requests.map((item) => ({ value: item.key, label: `${item.request} · ${item.client}` })),
    [requests],
  );
  const request = requests.find((item) => item.key === selectedKey) ?? requests[0] ?? null;

  return (
    <Card className="min-w-0 xl:col-span-2">
      <CardHeader>
        <CardTitle>Horas por solicitud</CardTitle>
        <CardDescription>
          Selecciona una solicitud (cliente + gestión) del periodo filtrado para ver su detalle, de la más reciente a la
          más antigua.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {request ? (
          <>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="request-select">Solicitud</Label>
              <AppSelect
                id="request-select"
                options={options}
                value={request.key}
                onValueChange={setSelectedKey}
                searchPlaceholder="Buscar solicitud..."
                searchThreshold={0}
              />
            </div>
            <div className="min-w-0 rounded-lg border bg-muted/40 p-4">
              <OverflowText lines={2} className="font-semibold">
                {request.request}
              </OverflowText>
              <p className="text-xs font-medium text-muted-foreground">{request.client}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {formatDateTime(request.firstAt)} → {formatDateTime(request.latestAt)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <MetricCard
                label="Horas reales"
                value={`${formatHours(request.hours)} h`}
                tone="blue"
                description={`${request.count} ${request.count === 1 ? 'registro' : 'registros'}`}
              />
              <MetricCard
                label="Estimadas"
                value={request.estimatedHours === null ? 'Sin dato' : `${formatHours(request.estimatedHours)} h`}
                description={request.estimatedHours === null ? 'Defínelas en Plantillas' : 'Según la plantilla de la gestión'}
              />
              <MetricCard
                label="Consumo"
                value={request.consumptionPct === null ? 'Sin dato' : `${formatHours(request.consumptionPct)} %`}
                tone={request.consumptionPct !== null && request.consumptionPct > 100 ? 'amber' : 'slate'}
                description={request.consumptionPct !== null && request.consumptionPct > 100 ? 'Supera lo estimado' : 'Reales / estimadas'}
              />
              <MetricCard
                label="Días con actividad"
                value={request.activeDays}
                description={`${formatHours(request.hours / (request.activeDays || 1))} h promedio por día`}
              />
            </div>
            <section aria-labelledby="request-billing-title">
              <h3 id="request-billing-title" className="mb-2 text-sm font-semibold">
                Clasificación de horas
              </h3>
              <ul className="flex flex-col gap-3">
                {request.billing.map((item) => (
                  <li key={item.label} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium">{item.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatHours(item.hours)} h · {formatHours(sharePct(item.hours, request.hours))} %
                      </span>
                    </div>
                    <Progress
                      aria-label={`${item.label}: ${formatHours(sharePct(item.hours, request.hours))} %`}
                      value={sharePct(item.hours, request.hours)}
                      className="h-2 *:data-[slot=progress-indicator]:bg-(--bar)"
                      style={{ '--bar': billingColor(item.label) } as CSSProperties}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <StateMessage
            tone="warning"
            title="Sin solicitudes en el periodo"
            description="Ajusta el rango o los filtros para ver el detalle de una solicitud."
          />
        )}
      </CardContent>
    </Card>
  );
}
