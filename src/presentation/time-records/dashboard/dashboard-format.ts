import { DASHBOARD_BILLING_LABELS } from '@domain/time-records/models/time-dashboard.model';

/** Horas con coma decimal (es-CO) y hasta un decimal, como el dashboard de Angular; `digits` ajusta la precisión. */
export const formatHours = (value: number, digits = 1): string =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: digits }).format(value);

/** Igual que `formatHours`, con `+` en los positivos. */
export const formatSigned = (value: number): string => `${value > 0 ? '+' : ''}${formatHours(value)}`;

/** Colores de la clasificación de facturación (variables de la paleta de gráficas). */
export const BILLING_COLORS = { billable: 'var(--chart-1)', factory: 'var(--chart-3)', nonBillable: 'var(--chart-4)' } as const;

/** Clave de color según la etiqueta del dominio (los nombres de variable CSS no admiten espacios). */
export const billingKey = (label: string): keyof typeof BILLING_COLORS =>
  label === DASHBOARD_BILLING_LABELS.factory ? 'factory' : label === DASHBOARD_BILLING_LABELS.non_billable ? 'nonBillable' : 'billable';

export const billingColor = (label: string): string => BILLING_COLORS[billingKey(label)];
