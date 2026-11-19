/** Horas con hasta un decimal y coma decimal, como el dashboard de Angular. */
export const formatHours = (value: number): string =>
  new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(value);

/** Igual que `formatHours`, con `+` en los positivos. */
export const formatSigned = (value: number): string => `${value > 0 ? '+' : ''}${formatHours(value)}`;
