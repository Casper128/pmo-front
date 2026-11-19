import readXlsxFile from 'read-excel-file/browser';
import { normalizeText } from '@presentation/shared/format';
import type { ConsolidatedRow } from './consolidated-report';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Excel recibido en base64 (con o sin prefijo `data:`) → `Blob`. */
export function excelBlob(base64: string): Blob {
  const content = base64.includes(',') ? base64.slice(base64.indexOf(',') + 1) : base64;
  const decoded = atob(content.replace(/\s/g, ''));
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  return new Blob([bytes], { type: XLSX_TYPE });
}

/** Entrega el Excel recibido como descarga del navegador. */
export function downloadExcel(base64: string, fileName: string): void {
  const url = URL.createObjectURL(excelBlob(base64));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

const normalizeHeader = (value: unknown) => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').trim();
const personNameKey = (value: unknown) => normalizeText(value).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim());

function number(value: unknown): number {
  if (typeof value === 'number') return value;
  const parsed = Number(text(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

const pad = (value: number | string) => String(value).padStart(2, '0');
const isDate = (value: unknown): value is Date => value instanceof Date && !Number.isNaN(value.getTime());

/**
 * Las celdas de fecha/hora de Excel no llevan zona: `read-excel-file` las entrega como `Date` en UTC, así que se
 * leen con getters UTC (los locales correrían el día en zonas al oeste de Greenwich).
 */
function date(value: unknown): string {
  if (isDate(value)) return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  const raw = text(value);
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const local = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  return local ? `${local[3]}-${pad(local[2])}-${pad(local[1])}` : '';
}

function time(value: unknown): string {
  if (isDate(value)) return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
  const match = text(value).match(/(\d{1,2}):(\d{2})/);
  return match ? `${pad(match[1])}:${match[2]}` : '';
}

const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y']);

function formatPersonName(value: unknown): string {
  return text(value)
    .toLocaleLowerCase('es-CO')
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => (index > 0 && CONNECTORS.has(normalizeText(word)) ? word : word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1)))
    .join(' ');
}

/** Prefiere la grafía con tildes y mayúsculas mixtas cuando el mismo consultor llega escrito de varias formas. */
function personNameScore(value: unknown): number {
  const raw = text(value);
  const accents = (raw.match(/[áéíóúñÁÉÍÓÚÑ]/g) || []).length;
  const mixedCase = raw !== raw.toLocaleUpperCase('es-CO') && raw !== raw.toLocaleLowerCase('es-CO');
  return accents * 10 + (mixedCase ? 2 : 0);
}

/**
 * Lee el Excel del consolidado (hoja "Tiempo consultores" o la primera) por nombre de cabecera, con los mismos alias
 * que Angular, y devuelve las actividades con fecha y horas válidas. Lanza `Error` con un motivo legible si el
 * archivo no sirve.
 */
export async function parseConsolidatedExcel(base64: string): Promise<ConsolidatedRow[]> {
  const workbook = await readXlsxFile(excelBlob(base64));
  const sheet = workbook.find((item) => normalizeText(item.sheet).includes('tiempo consultores')) || workbook[0];
  if (!sheet?.data?.length) throw new Error('el archivo no contiene datos');

  const [headerRow, ...rows] = sheet.data as unknown[][];
  const indexes = new Map<string, number>();
  headerRow.forEach((value, index) => indexes.set(normalizeHeader(value), index));
  const column = (name: string) => indexes.get(normalizeHeader(name)) ?? -1;
  const columns = {
    identificador: column('Identificador'),
    solicitud: column('Solicitud'),
    categoria: column('Categoria'),
    cliente: column('Cliente'),
    consultor: column('Consultor'),
    descripcion: column('Descripcion actividad'),
    horas: column('Tiempo Real en Horas'),
    tipoHora: column('Tipo de Hora'),
    fecha: column('fecha inicio'),
    funcional: column('Funcional'),
    gestion: column('Gestion de demanda'),
    modulo: column('Modulo'),
    tecnologia: column('Tecnologia'),
    tipoActividad: column('Tipo de actividad'),
    proyecto: column('Proyecto'),
    horaInicio: column('Hora de Inicio'),
    horaFin: column('Hora de Fin'),
  };
  if (columns.fecha < 0 || columns.horas < 0) throw new Error('faltan las columnas Fecha inicio o Tiempo Real en Horas');

  const valueAt = (row: unknown[], index: number): unknown => (index >= 0 ? row[index] : '');
  const parsed = rows
    .map((row) => ({
      identificador: text(valueAt(row, columns.identificador)),
      solicitud: text(valueAt(row, columns.solicitud)),
      categoria: text(valueAt(row, columns.categoria)),
      cliente: text(valueAt(row, columns.cliente)) || 'Sin cliente',
      consultor: text(valueAt(row, columns.consultor)) || 'Sin consultor',
      descripcion: text(valueAt(row, columns.descripcion)),
      horas: number(valueAt(row, columns.horas)),
      tipoHora: text(valueAt(row, columns.tipoHora)),
      fecha: date(valueAt(row, columns.fecha)),
      funcional: text(valueAt(row, columns.funcional)),
      gestion: text(valueAt(row, columns.gestion)),
      modulo: text(valueAt(row, columns.modulo)),
      tecnologia: text(valueAt(row, columns.tecnologia)),
      tipoActividad: text(valueAt(row, columns.tipoActividad)),
      proyecto: text(valueAt(row, columns.proyecto)),
      horaInicio: time(valueAt(row, columns.horaInicio)),
      horaFin: time(valueAt(row, columns.horaFin)),
    }))
    .filter((row) => row.fecha && Number.isFinite(row.horas));
  if (!parsed.length) throw new Error('no se encontraron registros de tiempo válidos');

  const preferred = new Map<string, { label: string; score: number }>();
  for (const { consultor } of parsed) {
    const key = personNameKey(consultor);
    const score = personNameScore(consultor);
    if (score > (preferred.get(key)?.score ?? -1)) preferred.set(key, { label: formatPersonName(consultor), score });
  }
  return parsed.map((row) => ({ ...row, consultor: preferred.get(personNameKey(row.consultor))?.label ?? formatPersonName(row.consultor) }));
}
