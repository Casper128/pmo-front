import { TimeRecordApiBody } from '../models/time-record-api.model';
import { AdvancedTemplateValues } from '../models/management-template.model';
import {
  TimeRecord,
  DayGroup,
  DailyHoursLimitViolation,
  HorasAlert,
  RecordHoursLimitViolation,
  TIME_RECORD_DEFAULTS,
} from '../models/time-record.model';
import { TimeRecordApiBodyBuilder } from './time-record-api-body.builder';
import { TimeRecordValidationPolicy } from './time-record-validation.policy';
import { WorkdayHoursPolicy } from './workday-hours.policy';

export type ConfigurableTimeRecordField =
  | 'tipoActividad'
  | 'causa'
  | 'complejidad'
  | 'impacto'
  | 'equipo'
  | 'modoActuacion'
  | 'lenguaje'
  | 'tipoHora'
  | 'prefijo'
  | 'objetoRicef'
  | 'categoria';

export type HourBillingCategory = 'billable' | 'factory' | 'non_billable';
export type HourBillingFilter = 'all' | HourBillingCategory;

export interface TimeRecordParameters {
  defaultFor(key: ConfigurableTimeRecordField): string;
  defaults(): Record<ConfigurableTimeRecordField, string>;
  workSettings(): {
    mondayThursdayHours: number;
    fridayHours: number;
    dailyHours: Record<number, number>;
    maxDailyLaborHours: number;
    maxHoursPerRecord: number;
  };
}

export class TimeRecordDomainService {
  private readonly validation: TimeRecordValidationPolicy;
  private readonly hoursPolicy: WorkdayHoursPolicy;
  private readonly apiBodyBuilder: TimeRecordApiBodyBuilder;

  constructor(private readonly parameters: TimeRecordParameters) {
    this.validation = new TimeRecordValidationPolicy(parameters);
    this.hoursPolicy = new WorkdayHoursPolicy(parameters);
    this.apiBodyBuilder = new TimeRecordApiBodyBuilder(parameters, this.validation);
  }

  /**
   * Parsea texto en formato:
   *   26/05/2026
   *   7:30AM-9:00AM | Descripción
   *   7:30AM-9:00AM | Descripción | Funcional opcional
   *   7:30AM-9:00AM | Descripción | Funcional opcional | RICEF opcional
   *   -10:30AM | Descripción con inicio heredado de la línea anterior
   */
  parseText(texto: string): TimeRecord[] {
    const lineas = texto
      .replace(/;/g, '\n')
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    const registros: TimeRecord[] = [];
    let fechaActual: string | null = null;
    let horaFinAnterior = '';

    for (const linea of lineas) {
      const trimmed = linea.trim();

      const fechaMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (fechaMatch) {
        const [, d, m, y] = fechaMatch;
        const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        fechaActual = this.validation.isValidDateValue(candidate) ? candidate : null;
        horaFinAnterior = '';
        continue;
      }

      if (!fechaActual) continue;

      const parsedLine = this.parseImportTimeLine(trimmed, horaFinAnterior);
      if (!parsedLine) continue;
      const { horaIni, horaFin, resto } = parsedLine;

      const mins = this.validation.diffMinutes(horaIni, horaFin);
      if (mins <= 0 || mins > this.maxHoursPerRecord() * 60) continue;
      const horas = mins > 0 ? (mins / 60).toFixed(1) : '0';
      const campos = resto.split('|').map((campo) => campo.trim());
      const desc = campos[0] || '';
      const funcional = campos[1] || '';
      const ricef = campos[2] || '';

      registros.push({
        ...this.configuredDefaults(),
        fecha: fechaActual,
        horaIni,
        horaFin,
        horas,
        desc,
        funcional,
        ricef,
        observacion: desc,
      });
      horaFinAnterior = horaFin;
    }

    return registros;
  }

  validateImportText(texto: string): string[] {
    const lineas = texto
      .replace(/;/g, '\n')
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    const errors: string[] = [];
    let fechaActual = '';
    let horaFinAnterior = '';

    lineas.forEach((linea, index) => {
      const lineNumber = index + 1;
      const trimmed = linea.trim();
      const fechaMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

      if (fechaMatch) {
        const [, d, m, y] = fechaMatch;
        const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (!this.validation.isValidDateValue(candidate)) {
          errors.push(`Linea ${lineNumber}: fecha invalida`);
          fechaActual = '';
          horaFinAnterior = '';
          return;
        }
        fechaActual = candidate;
        horaFinAnterior = '';
        return;
      }

      if (!fechaActual) {
        errors.push(`Linea ${lineNumber}: agrega una fecha valida antes del registro`);
        return;
      }

      if (this.isShortImportTimeLine(trimmed) && !horaFinAnterior) {
        errors.push(`Linea ${lineNumber}: agrega un rango completo antes de usar inicio heredado`);
        return;
      }

      const parsedLine = this.parseImportTimeLine(trimmed, horaFinAnterior);
      if (!parsedLine) {
        errors.push(
          `Linea ${lineNumber}: usa formato 7:30AM-9:00AM | descripcion | funcional opcional | RICEF opcional o -10:30AM | descripcion | funcional opcional | RICEF opcional`,
        );
        return;
      }

      const { horaIni, horaFin, resto } = parsedLine;
      if (
        !this.validation.isValidTimeValue(horaIni) ||
        !this.validation.isValidTimeValue(horaFin)
      ) {
        errors.push(`Linea ${lineNumber}: hora invalida`);
        return;
      }

      const horas = this.calcHoras(horaIni, horaFin);
      if (!horas || Number(horas) <= 0) {
        errors.push(`Linea ${lineNumber}: la duracion debe ser mayor a 0`);
        return;
      }
      const [desc] = resto.split('|').map((campo) => campo.trim());
      if (!desc) {
        errors.push(`Linea ${lineNumber}: agrega descripcion`);
        return;
      }
      horaFinAnterior = horaFin;
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
        const totalHoras = items.reduce(
          (sum, { record }) =>
            this.isCountableHour(record.tipoHora) ? sum + parseFloat(record.horas || '0') : sum,
          0,
        );
        return {
          fecha,
          records: items,
          totalHoras,
          alerta: this.hoursPolicy.alert(totalHoras, fecha),
        };
      });
  }

  calcAlert(total: number, fecha: string): HorasAlert {
    return this.hoursPolicy.alert(total, fecha);
  }

  getMissingFields(record: TimeRecord): string[] {
    return this.validation.missingFields(record);
  }

  getInvalidFields(record: TimeRecord): string[] {
    return this.validation.invalidFields(record);
  }

  getLaborRecordsHoursExceeded(records: TimeRecord[]): RecordHoursLimitViolation[] {
    return this.validation.recordHoursExceeded(records);
  }

  getDailyLaborHoursExceeded(records: TimeRecord[]): DailyHoursLimitViolation[] {
    return this.validation.dailyHoursExceeded(records);
  }

  getMaxDailyLaborHours(): number {
    return this.maxDailyLaborHours();
  }

  isLaborHour(tipoHora: string): boolean {
    return this.hoursPolicy.isLabor(tipoHora);
  }

  isFactoryHour(tipoHora: string): boolean {
    return this.hoursPolicy.isFactory(tipoHora);
  }

  isCountableHour(tipoHora: string): boolean {
    return this.hoursPolicy.isCountable(tipoHora);
  }

  hourBillingCategory(tipoHora: string): HourBillingCategory {
    return this.hoursPolicy.billingCategory(tipoHora);
  }

  matchesHourBillingFilter(tipoHora: string, filter: HourBillingFilter): boolean {
    return this.hoursPolicy.matchesBillingFilter(tipoHora, filter);
  }

  calcHoras(horaIni: string, horaFin: string): string {
    return this.validation.calcHours(horaIni, horaFin);
  }

  normalizeDateValue(value: string): string {
    return this.validation.normalizeDateValue(value);
  }

  isValidDateValue(value: string): boolean {
    return this.validation.isValidDateValue(value);
  }

  isValidTimeValue(value: string): boolean {
    return this.validation.isValidTimeValue(value);
  }

  buildApiBody(reg: TimeRecord & AdvancedTemplateValues): TimeRecordApiBody {
    return this.apiBodyBuilder.build(reg);
  }

  private maxHoursPerRecord(): number {
    return this.parameters.workSettings().maxHoursPerRecord;
  }

  private maxDailyLaborHours(): number {
    return this.parameters.workSettings().maxDailyLaborHours;
  }

  private configuredDefaults(): typeof TIME_RECORD_DEFAULTS {
    return { ...TIME_RECORD_DEFAULTS, ...this.parameters.defaults() };
  }

  private diffMinutes(horaIni: string, horaFin: string): number {
    return this.validation.diffMinutes(horaIni, horaFin);
  }

  private normalizeMeridianRange(
    ih: string,
    im: string,
    iampm: string,
    fh: string,
    fm: string,
    fampm: string,
  ): { horaIni: string; horaFin: string } | null {
    const horaIni = this.normalizeMeridianTime(ih, im, iampm);
    const horaFin = this.normalizeMeridianTime(fh, fm, fampm);
    if (!horaIni || !horaFin) return null;

    return {
      horaIni,
      horaFin,
    };
  }

  private parseImportTimeLine(
    line: string,
    inheritedStart: string,
  ): { horaIni: string; horaFin: string; resto: string } | null {
    const fullMatch = line.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i,
    );
    if (fullMatch) {
      const [, ih, im, iampm, fh, fm, fampm, resto] = fullMatch;
      const normalized = this.normalizeMeridianRange(ih, im, iampm, fh, fm, fampm);
      return normalized ? { ...normalized, resto } : null;
    }

    const shortMatch = line.match(/^-\s*(\d{1,2}):(\d{2})\s*(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i);
    if (!shortMatch || !inheritedStart) return null;
    const [, fh, fm, fampm, resto] = shortMatch;
    const horaFin = this.normalizeMeridianTime(fh, fm, fampm);
    return horaFin ? { horaIni: inheritedStart, horaFin, resto } : null;
  }

  private isShortImportTimeLine(line: string): boolean {
    return /^-\s*\d{1,2}:\d{2}\s*(AM|PM)(?:\s*\|\s*|\s+).+$/i.test(line);
  }

  private normalizeMeridianTime(hour: string, minute: string, meridian: string): string | null {
    let hourNumber = parseInt(hour);
    const minuteNumber = parseInt(minute);

    if (hourNumber < 1 || hourNumber > 12 || minuteNumber > 59) return null;

    if (meridian.toUpperCase() === 'PM' && hourNumber !== 12) hourNumber += 12;
    if (meridian.toUpperCase() === 'AM' && hourNumber === 12) hourNumber = 0;

    return `${String(hourNumber).padStart(2, '0')}:${minute}`;
  }

  private normalizeText(value: string): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
