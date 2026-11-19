import writeExcelFile from 'write-excel-file/node';

const HEADERS = [
  'Identificador', 'Solicitud', 'Categoría', 'Cliente', 'Consultor', 'Descripción actividad', 'Tiempo Real en Horas',
  'Tipo de Hora', 'Fecha inicio', 'Funcional', 'Gestión de demanda', 'Módulo', 'Tecnología', 'Tipo de actividad',
  'Proyecto', 'Hora de Inicio', 'Hora de Fin',
];

/** Fila ficticia del Excel del consolidado; `fecha` y las horas se escriben como celdas de fecha/hora reales. */
export interface FakeExcelRow {
  readonly id: string;
  readonly cliente: string;
  readonly consultor: string;
  readonly horas: number;
  readonly tipoHora?: string;
  /** `YYYY-MM-DD`, o texto libre (p. ej. `17/09/2026`) para probar el formato de texto. */
  readonly fecha: string;
  readonly inicio?: string;
  readonly fin?: string;
  readonly gestion?: string;
  readonly descripcion?: string;
}

const dateCell = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? { value: new Date(Date.UTC(year, month - 1, day)), type: Date, format: 'yyyy-mm-dd' }
    : { value, type: String };
};

const timeCell = (value?: string) => {
  if (!value) return null;
  const [hours, minutes] = value.split(':').map(Number);
  return { value: new Date(Date.UTC(1899, 11, 30, hours, minutes)), type: Date, format: 'hh:mm' };
};

/** Excel (base64) con una hoja "Tiempo consultores" y datos inventados, como el que devuelve `filtroDownload`. */
export async function fakeConsolidatedExcel(rows: readonly FakeExcelRow[], headers: readonly string[] = HEADERS): Promise<string> {
  const text = (value: string) => ({ value, type: String });
  const data = [
    headers.map(text),
    ...rows.map((row) => [
      text(row.id), text(`SOL-${row.id}`), text('Mantenimiento'), text(row.cliente), text(row.consultor),
      text(row.descripcion ?? `Actividad ${row.id}`), { value: row.horas, type: Number }, text(row.tipoHora ?? 'Laboral'),
      dateCell(row.fecha), text('Funcional X'), text(row.gestion ?? 'Soporte nómina'), text('FI'), text('ABAP'),
      text('Desarrollo'), text('Proyecto A'), timeCell(row.inicio), timeCell(row.fin),
    ]),
  ];
  const buffer = await writeExcelFile(data as never, { sheet: 'Tiempo consultores' }).toBuffer();
  return btoa(Array.from(new Uint8Array(buffer), (byte) => String.fromCharCode(byte)).join(''));
}

export const SAMPLE_ROWS: readonly FakeExcelRow[] = [
  { id: 'A1', cliente: 'Cliente Alfa', consultor: 'ANA PRUEBA', horas: 4, fecha: '2026-09-18', inicio: '08:00', fin: '12:00', descripcion: 'Desarrollo del reporte' },
  { id: 'A2', cliente: 'Cliente Beta', consultor: 'Ana Prueba', horas: 3, tipoHora: 'Fábrica', fecha: '2026-09-18', inicio: '13:00', fin: '16:00', gestion: 'Migración datos' },
  { id: 'L1', cliente: 'Cliente Alfa', consultor: 'Luis Ejemplo', horas: 5.5, fecha: '17/09/2026', inicio: '07:30', fin: '13:00' },
];
