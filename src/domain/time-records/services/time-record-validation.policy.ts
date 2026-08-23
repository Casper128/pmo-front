import {
  DailyHoursLimitViolation,
  RecordHoursLimitViolation,
  REQUIRED_FIELDS,
  TimeRecord,
} from '../models/time-record.model';
import type { TimeRecordParameters } from './time-record-domain.service';
import { WorkdayHoursPolicy } from './workday-hours.policy';

export class TimeRecordValidationPolicy {
  private readonly minYear = 2000;
  private readonly maxYear = 2100;

  constructor(
    private readonly parameters: TimeRecordParameters,
    private readonly hoursPolicy = new WorkdayHoursPolicy(parameters),
  ) {}

  missingFields(record: TimeRecord): string[] {
    return REQUIRED_FIELDS.filter(
      ({ key }) => !record[key] || String(record[key]).trim() === '',
    ).map(({ label }) => label);
  }

  invalidFields(record: TimeRecord): string[] {
    const invalid: string[] = [];

    if (record.fecha && !this.isValidDateValue(record.fecha)) invalid.push('Fecha invalida');
    if (record.horaIni && !this.isValidTimeValue(record.horaIni))
      invalid.push('Hora inicio invalida');
    if (record.horaFin && !this.isValidTimeValue(record.horaFin)) invalid.push('Hora fin invalida');

    if (this.isValidTimeValue(record.horaIni) && this.isValidTimeValue(record.horaFin)) {
      const minutes = this.diffMinutes(record.horaIni, record.horaFin);
      if (minutes <= 0) invalid.push('Hora fin debe ser mayor a hora inicio');
      if (minutes > this.maxHoursPerRecord() * 60) {
        invalid.push(`Duracion maxima ${this.maxHoursPerRecord()}h`);
      }
    }

    const hours = Number(record.horas);
    if (!Number.isFinite(hours) || hours <= 0) invalid.push('Horas debe ser mayor a 0');

    return invalid;
  }

  recordHoursExceeded(records: TimeRecord[]): RecordHoursLimitViolation[] {
    return records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => this.hoursPolicy.isCountable(record.tipoHora))
      .map(({ record, index }) => ({
        index,
        fecha: record.fecha,
        horas: Number(record.horas || 0),
        limiteHoras: this.maxDailyLaborHours(),
        tipoHora: 'Computable',
      }))
      .filter((item) => Number.isFinite(item.horas) && item.horas > item.limiteHoras);
  }

  dailyHoursExceeded(records: TimeRecord[]): DailyHoursLimitViolation[] {
    const totals = new Map<string, number>();

    records
      .filter((record) => this.hoursPolicy.isCountable(record.tipoHora))
      .forEach((record) => {
        const hours = Number(record.horas);
        if (!Number.isFinite(hours)) return;
        totals.set(record.fecha, (totals.get(record.fecha) || 0) + hours);
      });

    return Array.from(totals.entries())
      .filter(([, totalHoras]) => totalHoras > this.maxDailyLaborHours())
      .map(([fecha, totalHoras]) => ({
        fecha,
        totalHoras,
        limiteHoras: this.maxDailyLaborHours(),
        tipoHora: 'Computable',
      }));
  }

  calcHours(horaIni: string, horaFin: string): string {
    if (!this.isValidTimeValue(horaIni) || !this.isValidTimeValue(horaFin)) return '';
    const mins = this.diffMinutes(horaIni, horaFin);
    return mins > 0 && mins <= this.maxHoursPerRecord() * 60 ? (mins / 60).toFixed(1) : '';
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
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  }

  isValidTimeValue(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value || '')) return false;
    const [hours, minutes] = value.split(':').map(Number);
    return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  }

  diffMinutes(horaIni: string, horaFin: string): number {
    const [ih, im] = horaIni.split(':').map(Number);
    const [fh, fm] = horaFin.split(':').map(Number);
    return fh * 60 + fm - (ih * 60 + im);
  }

  private maxHoursPerRecord(): number {
    return this.parameters.workSettings().maxHoursPerRecord;
  }

  private maxDailyLaborHours(): number {
    return this.parameters.workSettings().maxDailyLaborHours;
  }
}
