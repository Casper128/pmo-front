import { Injectable } from '@angular/core';
import {
  TimeRecord,
  DayGroup,
  DailyHoursLimitViolation,
  HorasAlert,
  RecordHoursLimitViolation,
  REQUIRED_FIELDS,
  TIME_RECORD_DEFAULTS,
} from '../models/time-record.model';

@Injectable({ providedIn: 'root' })
export class TimeRecordDomainService {
  private readonly minYear = 2000;
  private readonly maxYear = 2100;
  private readonly maxHoursPerRecord = 16;
  private readonly maxDailyLaborHours = 10;

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
        const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        fechaActual = this.isValidDateValue(candidate) ? candidate : null;
        continue;
      }

      if (!fechaActual) continue;

      const horaMatch = trimmed.match(
        /^(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i
      );
      if (!horaMatch) continue;

      let [, ih, im, iampm, fh, fm, fampm, resto] = horaMatch;
      let ihN = parseInt(ih), fhN = parseInt(fh);
      const imN = parseInt(im), fmN = parseInt(fm);

      if (ihN < 1 || ihN > 12 || fhN < 1 || fhN > 12 || imN > 59 || fmN > 59) continue;

      if (iampm.toUpperCase() === 'PM' && ihN !== 12) ihN += 12;
      if (iampm.toUpperCase() === 'AM' && ihN === 12) ihN = 0;
      if (fampm.toUpperCase() === 'PM' && fhN !== 12) fhN += 12;
      if (fampm.toUpperCase() === 'AM' && fhN === 12) fhN = 0;

      const horaIni = `${String(ihN).padStart(2, '0')}:${im}`;
      const horaFin = `${String(fhN).padStart(2, '0')}:${fm}`;
      if (!this.isValidTimeValue(horaIni) || !this.isValidTimeValue(horaFin)) continue;

      const mins = (fhN * 60 + fmN) - (ihN * 60 + imN);
      if (mins <= 0 || mins > this.maxHoursPerRecord * 60) continue;
      const horas = mins > 0 ? (mins / 60).toFixed(1) : '0';
      const campos = resto.split('|').map(campo => campo.trim());
      const desc = campos[0] || '';
      const funcional = campos[1] || 'N/A';

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

  validateImportText(texto: string): string[] {
    const lineas = texto.replace(/;/g, '\n').trim().split('\n').filter(l => l.trim());
    const errors: string[] = [];
    let fechaActual = '';

    lineas.forEach((linea, index) => {
      const lineNumber = index + 1;
      const trimmed = linea.trim();
      const fechaMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

      if (fechaMatch) {
        const [, d, m, y] = fechaMatch;
        const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!this.isValidDateValue(candidate)) {
          errors.push(`Linea ${lineNumber}: fecha invalida`);
          fechaActual = '';
          return;
        }
        fechaActual = candidate;
        return;
      }

      if (!fechaActual) {
        errors.push(`Linea ${lineNumber}: agrega una fecha valida antes del registro`);
        return;
      }

      const horaMatch = trimmed.match(
        /^(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i
      );
      if (!horaMatch) {
        errors.push(`Linea ${lineNumber}: usa formato 7:30AM-9:00AM descripcion`);
        return;
      }

      const [, ih, im, iampm, fh, fm, fampm, resto] = horaMatch;
      const normalized = this.normalizeMeridianRange(ih, im, iampm, fh, fm, fampm);
      if (!normalized) {
        errors.push(`Linea ${lineNumber}: hora invalida`);
        return;
      }

      const horas = this.calcHoras(normalized.horaIni, normalized.horaFin);
      if (!horas || Number(horas) <= 0) {
        errors.push(`Linea ${lineNumber}: la duracion debe ser mayor a 0`);
      }
      if (!resto.trim()) {
        errors.push(`Linea ${lineNumber}: agrega descripcion`);
      }
    });

    return errors;
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

  getInvalidFields(record: TimeRecord): string[] {
    const invalid: string[] = [];

    if (record.fecha && !this.isValidDateValue(record.fecha)) invalid.push('Fecha invalida');
    if (record.fechaEstimada && !this.isValidDateValue(record.fechaEstimada)) {
      invalid.push('Fecha estimada invalida');
    }
    if (record.fechaReal && !this.isValidDateValue(record.fechaReal)) {
      invalid.push('Fecha real invalida');
    }
    if (record.horaIni && !this.isValidTimeValue(record.horaIni)) invalid.push('Hora inicio invalida');
    if (record.horaFin && !this.isValidTimeValue(record.horaFin)) invalid.push('Hora fin invalida');

    if (
      this.isValidTimeValue(record.horaIni) &&
      this.isValidTimeValue(record.horaFin)
    ) {
      const minutes = this.diffMinutes(record.horaIni, record.horaFin);
      if (minutes <= 0) invalid.push('Hora fin debe ser mayor a hora inicio');
      if (minutes > this.maxHoursPerRecord * 60) {
        invalid.push(`Duracion maxima ${this.maxHoursPerRecord}h`);
      }
    }

    const hours = Number(record.horas);
    if (!Number.isFinite(hours) || hours <= 0) invalid.push('Horas debe ser mayor a 0');

    return invalid;
  }

  getLaborRecordsHoursExceeded(records: TimeRecord[]): RecordHoursLimitViolation[] {
    return records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => this.isLaborHour(record.tipoHora))
      .map(({ record, index }) => ({
        index,
        fecha: record.fecha,
        horas: Number(record.horas || 0),
        limiteHoras: this.maxDailyLaborHours,
        tipoHora: 'Laboral',
      }))
      .filter(item => Number.isFinite(item.horas) && item.horas > item.limiteHoras);
  }

  getDailyLaborHoursExceeded(records: TimeRecord[]): DailyHoursLimitViolation[] {
    const totals = new Map<string, number>();

    records
      .filter(record => this.isLaborHour(record.tipoHora))
      .forEach(record => {
        const hours = Number(record.horas);
        if (!Number.isFinite(hours)) return;
        totals.set(record.fecha, (totals.get(record.fecha) || 0) + hours);
      });

    return Array.from(totals.entries())
      .filter(([, totalHoras]) => totalHoras > this.maxDailyLaborHours)
      .map(([fecha, totalHoras]) => ({
        fecha,
        totalHoras,
        limiteHoras: this.maxDailyLaborHours,
        tipoHora: 'Laboral',
      }));
  }

  getMaxDailyLaborHours(): number {
    return this.maxDailyLaborHours;
  }

  isLaborHour(tipoHora: string): boolean {
    return this.normalizeText(tipoHora) === 'laboral';
  }

  calcHoras(horaIni: string, horaFin: string): string {
    if (!this.isValidTimeValue(horaIni) || !this.isValidTimeValue(horaFin)) return '';
    const mins = this.diffMinutes(horaIni, horaFin);
    return mins > 0 && mins <= this.maxHoursPerRecord * 60 ? (mins / 60).toFixed(1) : '';
  }

  normalizeDateValue(value: string): string {
    if (!value || value === '0000-00-00') return '';
    const normalized = value.split('T')[0];
    return this.isValidDateValue(normalized) ? normalized : '';
  }

  isValidDateValue(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
    const [year, month, day] = value.split('-').map(Number);
    if (year < this.minYear || year > this.maxYear) return false;
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  isValidTimeValue(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return false;
    const [hours, minutes] = value.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  buildApiBody(reg: TimeRecord): object {
    const invalid = this.getInvalidFields(reg);
    if (invalid.length) {
      throw new Error(`Registro invalido: ${invalid.join(', ')}`);
    }

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

  private diffMinutes(horaIni: string, horaFin: string): number {
    const [ih, im] = horaIni.split(':').map(Number);
    const [fh, fm] = horaFin.split(':').map(Number);
    return (fh * 60 + fm) - (ih * 60 + im);
  }

  private normalizeMeridianRange(
    ih: string,
    im: string,
    iampm: string,
    fh: string,
    fm: string,
    fampm: string
  ): { horaIni: string; horaFin: string } | null {
    let ihN = parseInt(ih), fhN = parseInt(fh);
    const imN = parseInt(im), fmN = parseInt(fm);

    if (ihN < 1 || ihN > 12 || fhN < 1 || fhN > 12 || imN > 59 || fmN > 59) return null;

    if (iampm.toUpperCase() === 'PM' && ihN !== 12) ihN += 12;
    if (iampm.toUpperCase() === 'AM' && ihN === 12) ihN = 0;
    if (fampm.toUpperCase() === 'PM' && fhN !== 12) fhN += 12;
    if (fampm.toUpperCase() === 'AM' && fhN === 12) fhN = 0;

    return {
      horaIni: `${String(ihN).padStart(2, '0')}:${im}`,
      horaFin: `${String(fhN).padStart(2, '0')}:${fm}`,
    };
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
