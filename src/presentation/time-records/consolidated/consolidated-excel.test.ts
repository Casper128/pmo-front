import { fakeConsolidatedExcel, SAMPLE_ROWS } from '@/test/fakes/consolidated-excel';
import { parseConsolidatedExcel } from './consolidated-excel';

describe('parseConsolidatedExcel', () => {
  it('lee fechas, horas y textos por nombre de cabecera, sin depender de la zona horaria', async () => {
    const rows = await parseConsolidatedExcel(await fakeConsolidatedExcel(SAMPLE_ROWS));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      identificador: 'A1',
      cliente: 'Cliente Alfa',
      horas: 4,
      fecha: '2026-09-18',
      horaInicio: '08:00',
      horaFin: '12:00',
      gestion: 'Soporte nómina',
      tipoHora: 'Laboral',
    });
    expect(rows[2]).toMatchObject({ fecha: '2026-09-17', horaInicio: '07:30', horas: 5.5 });
  });

  it('unifica el nombre del consultor escrito de varias formas', async () => {
    const rows = await parseConsolidatedExcel(await fakeConsolidatedExcel(SAMPLE_ROWS));
    expect(rows.map((row) => row.consultor)).toEqual(['Ana Prueba', 'Ana Prueba', 'Luis Ejemplo']);
  });

  it('descarta filas sin fecha válida', async () => {
    const rows = await parseConsolidatedExcel(
      await fakeConsolidatedExcel([...SAMPLE_ROWS, { id: 'X', cliente: 'Cliente Alfa', consultor: 'Sin Fecha', horas: 1, fecha: 'pendiente' }]),
    );
    expect(rows).toHaveLength(3);
  });

  it('rechaza un archivo sin las columnas obligatorias', async () => {
    const headers = ['Identificador', 'Cliente', 'Consultor'];
    await expect(parseConsolidatedExcel(await fakeConsolidatedExcel(SAMPLE_ROWS, headers))).rejects.toThrow(/faltan las columnas/);
  });

  it('rechaza contenido que no es un Excel', async () => {
    await expect(parseConsolidatedExcel(btoa('no es un excel'))).rejects.toThrow();
  });
});
