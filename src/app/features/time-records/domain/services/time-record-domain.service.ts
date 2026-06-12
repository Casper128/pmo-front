import { Injectable } from '@angular/core';
import {
  TimeRecord,
  DayGroup,
  HorasAlert,
  REQUIRED_FIELDS,
  TIME_RECORD_DEFAULTS,
} from '../models/time-record.model';

@Injectable({ providedIn: 'root' })
export class TimeRecordDomainService {

  /**
   * Parsea texto en formato:
   *   26/05/2026
   *   7:30AM-9:00AM | Descripción | Funcional
   */
  parseText(texto: string): TimeRecord[] {
    const lineas = texto.replace(/;/g, '\n').trim().split('\n').filter(l => l.trim());
    const registros: TimeRecord[] = [];
    let fechaActual: string | null = null;

    for (const linea of lineas) {
      const trimmed = linea.trim();

      const fechaMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (fechaMatch) {
        const [, d, m, y] = fechaMatch;
        fechaActual = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        continue;
      }

      if (!fechaActual) continue;

      const horaMatch = trimmed.match(
        /^(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i
      );
      if (!horaMatch) continue;

      let [, ih, im, iampm, fh, fm, fampm, resto] = horaMatch;
      let ihN = parseInt(ih), fhN = parseInt(fh);

      if (iampm.toUpperCase() === 'PM' && ihN !== 12) ihN += 12;
      if (iampm.toUpperCase() === 'AM' && ihN === 12) ihN = 0;
      if (fampm.toUpperCase() === 'PM' && fhN !== 12) fhN += 12;
      if (fampm.toUpperCase() === 'AM' && fhN === 12) fhN = 0;

      const horaIni = `${String(ihN).padStart(2, '0')}:${im}`;
      const horaFin = `${String(fhN).padStart(2, '0')}:${fm}`;
      const mins = (fhN * 60 + parseInt(fm)) - (ihN * 60 + parseInt(im));
      const horas = mins > 0 ? (mins / 60).toFixed(1) : '0';
      const campos = resto.split('|').map(campo => campo.trim());
      const desc = campos[0] || '';
      const funcional = campos[1] || '';

      registros.push({
        ...TIME_RECORD_DEFAULTS,
        fecha: fechaActual,
        horaIni,
        horaFin,
        horas,
        desc,
        observacion: desc,
        funcional,
      });
    }

    return registros;
  }

  groupByDate(records: TimeRecord[]): DayGroup[] {
    const map = new Map<string, { record: TimeRecord; index: number }[]>();

    records.forEach((record, index) => {
      if (!map.has(record.fecha)) map.set(record.fecha, []);
      map.get(record.fecha)!.push({ record, index });
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, items]) => {
        const totalHoras = items.reduce((s, { record }) => s + parseFloat(record.horas || '0'), 0);
        return { fecha, records: items, totalHoras, alerta: this.calcAlert(totalHoras, fecha) };
      });
  }

  calcAlert(total: number, fecha: string): HorasAlert {
    const esViernes = new Date(fecha + 'T12:00:00').getDay() === 5;
    const meta = esViernes ? 8 : 9;
    if (total > meta)
      return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: '⚠️', label: `Excede ${meta}h` };
    if (total === meta)
      return { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: '✓', label: `Exacto ${meta}h` };
    return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: '🟡', label: `Faltan ${(meta - total).toFixed(1)}h` };
  }

  getMissingFields(record: TimeRecord): string[] {
    return REQUIRED_FIELDS
      .filter(({ key }) => !record[key] || String(record[key]).trim() === '')
      .map(({ label }) => label);
  }

  calcHoras(horaIni: string, horaFin: string): string {
    if (!horaIni || !horaFin) return '';
    const [ih, im] = horaIni.split(':').map(Number);
    const [fh, fm] = horaFin.split(':').map(Number);
    const mins = (fh * 60 + fm) - (ih * 60 + im);
    return mins > 0 ? (mins / 60).toFixed(1) : '';
  }

  normalizeDateValue(value: string): string {
    if (!value || value === '0000-00-00') return '';
    const normalized = value.split('T')[0];
    return normalized === '0000-00-00' ? '' : normalized;
  }

  buildApiBody(reg: TimeRecord): object {
    const [y, mo, d] = reg.fecha.split('-');
    const [ih, im] = reg.horaIni.split(':');
    const [fh, fm] = reg.horaFin.split(':');
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateObj = new Date(reg.fecha + 'T12:00:00');
    const fechaInicio = `${dias[dateObj.getDay()]} ${meses[parseInt(mo) - 1]} ${d} ${y} ${ih}:${im}:00 GMT-0500 (hora estándar de Colombia)`;

    return {
      cliente: reg.cliente,
      ricef: reg.ricef || '',
      proyecto: reg.proyecto || '',
      solicitud: reg.solicitud || '',
      tipoActividad: reg.tipoActividad || 'ActividadDesarrollo',
      HoraInicio: `${y}-${mo}-${d}T${ih}:${im}:00.000Z`,
      HoraFin: `${y}-${mo}-${d}T${fh}:${fm}:00.000Z`,
      fechaInicio,
      causa: reg.causa || 'Nueva Funcionalidad',
      complejidad: reg.complejidad || 'Media',
      impacto: reg.impacto || 'Media',
      equipo: reg.equipo || 'Comercial',
      modoActuacion: reg.modoActuacion || 'Basado-Datos-Integraciones',
      lenguaje: reg.lenguaje || 'ABAP',
      tipoHora: reg.tipoHora || 'Laboral',
      funcional: reg.funcional,
      prefijo: reg.prefijo || 'CH',
      objetoRicef: reg.objetoRicef || '',
      unity: reg.unity || '',
      descripcionActividad: reg.desc,
      observacion: reg.observacion || reg.desc,
      categoria: reg.categoria || 'Operacion',
      tiempoRealHoras: reg.horas,
      fechaEstimadaPruebas: this.normalizeDateValue(reg.fechaEstimada) || null,
      fechaEstimadaRealPruebas: this.normalizeDateValue(reg.fechaReal) || null,
    };
  }
}
