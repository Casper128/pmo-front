const DIAS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Etiqueta de fecha (`fechaInicio`) anclada a las 12:00 de Colombia (-05:00).
 * Solo transporta el día: la hora real viaja en `HoraInicio`/`HoraFin`. El mediodía (17:00Z)
 * cae en el mismo día para cualquier zona horaria del servidor entre UTC-12 y UTC+6.
 */
export function colombiaDateLabel(fecha: string): string {
  const [y, mo, d] = fecha.split('-');
  const dow = DIAS[new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d))).getUTCDay()];
  return `${dow} ${MESES[Number(mo) - 1]} ${d} ${y} 12:00:00 GMT-0500 (Colombia Standard Time)`;
}
