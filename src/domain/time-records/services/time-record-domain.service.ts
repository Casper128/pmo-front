import { TimeRecordApiBody } from '../models/time-record-api.model';
import {
  AdvancedTemplateValues,
} from '../models/management-template.model';
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
   */
  parseText(texto: string): TimeRecord[] {
    const lineas = texto
      .replace(/;/g, '\n')
      .trim()
      .split('\n')
      .filter((l) => l.trim());
    const registros: TimeRecord[] = [];
    let fechaActual: string | null = null;

    for (const linea of lineas) {
      const trimmed = linea.trim();

      const fechaMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (fechaMatch) {
        const [, d, m, y] = fechaMatch;
        const candidate = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        fechaActual = this.validation.isValidDateValue(candidate) ? candidate : null;
        continue;
      }

      if (!fechaActual) continue;

      const horaMatch = trimmed.match(
        /^(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i,
      );
      if (!horaMatch) continue;

      let [, ih, im, iampm, fh, fm, fampm, resto] = horaMatch;
      let ihN = parseInt(ih),
        fhN = parseInt(fh);
      const imN = parseInt(im),
        fmN = parseInt(fm);

      if (ihN < 1 || ihN > 12 || fhN < 1 || fhN > 12 || imN > 59 || fmN > 59) continue;

      if (iampm.toUpperCase() === 'PM' && ihN !== 12) ihN += 12;
      if (iampm.toUpperCase() === 'AM' && ihN === 12) ihN = 0;
      if (fampm.toUpperCase() === 'PM' && fhN !== 12) fhN += 12;
      if (fampm.toUpperCase() === 'AM' && fhN === 12) fhN = 0;

      const horaIni = `${String(ihN).padStart(2, '0')}:${im}`;
      const horaFin = `${String(fhN).padStart(2, '0')}:${fm}`;
      if (!this.validation.isValidTimeValue(horaIni) || !this.validation.isValidTimeValue(horaFin)) continue;

      const mins = this.validation.diffMinutes(horaIni, horaFin);
      if (mins <= 0 || mins > this.maxHoursPerRecord() * 60) continue;
      const horas = mins > 0 ? (mins / 60).toFixed(1) : '0';
      const campos = resto.split('|').map((campo) => campo.trim());
      const desc = campos[0] || '';

      registros.push({
        ...this.configuredDefaults(),
        fecha: fechaActual,
        horaIni,
        horaFin,
        horas,
        desc,
        observacion: desc,
      });
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
        /^(\d{1,2}):(\d{2})(AM|PM)-(\d{1,2}):(\d{2})(AM|PM)(?:\s*\|\s*|\s+)(.+)$/i,
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
        const totalHoras = items.reduce(
          (sum, { record }) =>
            this.isCountableHour(record.tipoHora)
              ? sum + parseFloat(record.horas || '0')
              : sum,
          0,
        );
        return { fecha, records: items, totalHoras, alerta: this.hoursPolicy.alert(totalHoras, fecha) };
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
    let ihN = parseInt(ih),
      fhN = parseInt(fh);
    const imN = parseInt(im),
      fmN = parseInt(fm);

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
