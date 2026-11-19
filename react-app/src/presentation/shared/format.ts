import { format, isValid, parse } from 'date-fns';

/** Formato de los valores de fecha de la app (`YYYY-MM-DD`), igual que `ui-date-input` de Angular. */
export const DATE_VALUE_FORMAT = 'yyyy-MM-dd';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/**
 * Port de `fecha-esp.pipe.ts`: `'2026-11-18'` → `'Mié 18 Nov 2026'`. Mismo código que Angular: ancla la
 * fecha a las 12:00 en hora local (`T12:00:00`, sin zona), así el día no cambia en ninguna zona horaria.
 */
export function formatFechaEsp(fechaISO: string): string {
  const d = new Date(`${fechaISO}T12:00:00`);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * `YYYY-MM-DD` → `Date` a medianoche local, con parseo explícito (nunca `new Date('YYYY-MM-DD')`, que
 * interpreta UTC y desplaza el día al oeste de Greenwich). `undefined` si el valor no es una fecha real.
 */
export function parseDateValue(value: string | null | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parse(value, DATE_VALUE_FORMAT, new Date(2000, 0, 1));
  return isValid(date) ? date : undefined;
}

/** `Date` → `YYYY-MM-DD` con el día local (el que ve el usuario en el calendario). */
export function toDateValue(date: Date): string {
  return format(date, DATE_VALUE_FORMAT);
}

/** Hoy en formato `YYYY-MM-DD` (día local). */
export function todayDateValue(): string {
  return toDateValue(new Date());
}

/**
 * Texto del disparador de `DatePicker` (mismo `Intl` que `ui-date-input`); `''` si el valor no es válido.
 * El formateador se crea en cada llamada: `Intl.DateTimeFormat` fija la zona horaria al construirse.
 */
export function formatDateDisplay(value: string): string {
  const date = parseDateValue(value);
  return date
    ? new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
    : '';
}

/**
 * Port del pipe de Angular `date: 'yyyy-MM-dd'` (auditoría de solicitudes). Como `DatePipe`: una fecha
 * `YYYY-MM-DD` (o parcial `YYYY-MM`) se conserva tal cual (Angular la construye en hora local) y una fecha-hora ISO se muestra con
 * el día local. Vacío o inválido → `''` (Angular devuelve `null` para vacío y lanza error si es inválido).
 */
export function formatDateYmd(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string') {
    // Como `DatePipe`: `YYYY`, `YYYY-M` y `YYYY-M-D` (ISO parcial) se construyen en hora local.
    const dateOnly = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(value.trim());
    if (dateOnly) {
      const year = Number(dateOnly[1]);
      const month = Number(dateOnly[2] ?? 1);
      const day = Number(dateOnly[3] ?? 1);
      const date = new Date(year, month - 1, day);
      return isValid(date) ? toDateValue(date) : '';
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? toDateValue(date) : '';
}

/**
 * Normaliza una hora a `HH:mm` (port de `UiTimeInputComponent.normalize`): acepta `H:mm` y segundos
 * (`08:30:00`); devuelve `''` si no es una hora válida. `Input type="time"` solo acepta `HH:mm`.
 */
export function normalizeTime(value: string | null | undefined): string {
  const match = String(value ?? '')
    .trim()
    .match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60
    ? `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    : '';
}

/** Sin tildes, en minúsculas y sin espacios en los extremos (`normalizeText` de Angular; búsqueda de `ui-select`). */
export function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** `formatFullDate` de `MultipleImportPageComponent`: `mié, 09 sept`; `Sin fecha` si falta. */
export function formatFullDate(value: string): string {
  if (!value) return 'Sin fecha';
  const date = parseDateValue(value);
  return date ? new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).format(date) : value;
}
