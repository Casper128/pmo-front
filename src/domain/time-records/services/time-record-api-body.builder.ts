import {
  AdvancedTemplateFieldKey,
  AdvancedTemplateValues,
} from '../models/management-template.model';
import { TimeRecordApiBody } from '../models/time-record-api.model';
import { TimeRecord } from '../models/time-record.model';
import type { TimeRecordParameters } from './time-record-domain.service';
import { TimeRecordValidationPolicy } from './time-record-validation.policy';

type TimeRecordApiBuildInput = TimeRecord & AdvancedTemplateValues;

export class TimeRecordApiBodyBuilder {
  constructor(
    private readonly parameters: TimeRecordParameters,
    private readonly validation = new TimeRecordValidationPolicy(parameters),
  ) {}

  build(reg: TimeRecordApiBuildInput): TimeRecordApiBody {
    const invalid = this.validation.invalidFields(reg);
    if (invalid.length) {
      throw new Error(`Registro invalido: ${invalid.join(', ')}`);
    }

    const [y, mo, d] = reg.fecha.split('-');
    const [ih, im] = reg.horaIni.split(':');
    const [fh, fm] = reg.horaFin.split(':');
    const fechaInicio = this.colombianDateString(reg.fecha, y, mo, d, ih, im);
    const fechaRealPruebas = this.validation.normalizeDateValue(this.templateValue(reg, 'fechaReal'));

    return {
      cliente: reg.cliente,
      ricef: this.templateValue(reg, 'ricef'),
      proyecto: this.templateValue(reg, 'proyecto') || reg.proyecto || '',
      solicitud: reg.solicitud || '',
      tipoActividad:
        this.templateValue(reg, 'tipoActividad') || this.parameters.defaultFor('tipoActividad'),
      HoraInicio: `${y}-${mo}-${d}T${ih}:${im}:00.000Z`,
      HoraFin: `${y}-${mo}-${d}T${fh}:${fm}:00.000Z`,
      horaFin: this.legacyDisplayTime(fh, fm),
      fechaInicio,
      causa: this.templateValue(reg, 'causa') || this.parameters.defaultFor('causa'),
      complejidad:
        this.templateValue(reg, 'complejidad') || this.parameters.defaultFor('complejidad'),
      impacto: this.templateValue(reg, 'impacto') || this.parameters.defaultFor('impacto'),
      equipo: this.teamValue(reg),
      modoActuacion:
        this.templateValue(reg, 'modoActuacion') || this.parameters.defaultFor('modoActuacion'),
      lenguaje: this.templateValue(reg, 'lenguaje') || this.parameters.defaultFor('lenguaje'),
      tipoHora: reg.tipoHora || this.parameters.defaultFor('tipoHora'),
      funcional: this.templateValue(reg, 'funcional'),
      prefijo: this.templateValue(reg, 'prefijo') || this.parameters.defaultFor('prefijo'),
      objetoRicef: this.templateValue(reg, 'objetoRicef'),
      unity: this.sapModuleFromTeam(this.teamValue(reg)),
      descripcionActividad: reg.desc,
      observacion: reg.observacion || reg.desc,
      categoria: this.templateValue(reg, 'categoria') || this.parameters.defaultFor('categoria'),
      tiempoRealHoras: reg.horas,
      fechaEstimadaPruebas:
        this.validation.normalizeDateValue(this.templateValue(reg, 'fechaEstimada')) || null,
      fechaEstimadarealPruebas: fechaRealPruebas,
      fechaEstimadaRealPruebas: fechaRealPruebas || null,
    };
  }

  private colombianDateString(
    fecha: string,
    year: string,
    month: string,
    day: string,
    hour: string,
    minute: string,
  ): string {
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const meses = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dateObj = new Date(fecha + 'T12:00:00');
    return `${dias[dateObj.getDay()]} ${meses[parseInt(month) - 1]} ${day} ${year} ${hour}:${minute}:00 GMT-0500 (Colombia Standard Time)`;
  }

  private templateValue(reg: AdvancedTemplateValues, key: AdvancedTemplateFieldKey): string {
    return String(reg[key] || '').trim();
  }

  private teamValue(reg: AdvancedTemplateValues): string {
    return this.templateValue(reg, 'equipo') || this.parameters.defaultFor('equipo');
  }

  private sapModuleFromTeam(team: string): string {
    const normalized = team
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    const modulesByTeam: Record<string, string> = {
      financiero: 'FI',
      comercial: 'SD',
      logistico: 'LO',
      planeaciondemanda: 'PP',
      analitica: 'BW',
      portales: 'FIORI',
      infraestructura: 'BASIS',
    };
    return modulesByTeam[normalized] || '';
  }

  private legacyDisplayTime(hour: string, minute: string): string {
    const numericHour = Number(hour);
    if (!Number.isFinite(numericHour)) return '';
    const suffix = numericHour >= 12 ? 'P' : 'A';
    const displayHour = numericHour % 12 || 12;
    return `${displayHour}:${minute}${suffix} `;
  }

}
