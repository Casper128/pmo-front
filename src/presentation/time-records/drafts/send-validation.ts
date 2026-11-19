import type {
  ManagementAdvancedTemplate,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { formatFullDate } from '@presentation/shared/format';
import type { DayLedger } from '../reports/report-view';
import { intervalsOverlap } from '../reports/report-view';
import { minutesOf, recordErrors } from './draft-records';
import { missingRequiredTemplateFields, templateForManagement, type TemplateMap } from './template-rules';

export type SendCheck =
  | { readonly status: 'ok' }
  /** Detiene el envío y se muestra en el diálogo de validación. */
  | { readonly status: 'blocked'; readonly title: string; readonly text: string }
  /** Falta (o está incompleta) la plantilla de una gestión: hay que abrir su diálogo. */
  | {
      readonly status: 'template';
      readonly option: ManagementDemandOption;
      readonly template: ManagementAdvancedTemplate | null;
      readonly text: string;
    }
  /** Hay un exceso de jornada con lo ya enviado: se envía solo si el usuario confirma. */
  | { readonly status: 'confirm'; readonly title: string; readonly text: string };

export interface SendValidationInput {
  readonly records: readonly TimeRecord[];
  readonly domain: TimeRecordDomainService;
  readonly templates: TemplateMap;
  readonly knownManagement: (gestionId: string) => ManagementDemandOption | null;
  /** Horas por día de lo ya enviado; `null` si no se pudo consultar (se valida sin ello). */
  readonly ledger: DayLedger | null;
  /** El usuario ya aceptó enviar pese al exceso de jornada con lo ya enviado. */
  readonly confirmExcess: boolean;
}

const blocked = (title: string, text: string): SendCheck => ({ status: 'blocked', title, text });
const EXAMPLES = 3;

/** `firstBlockedManagementTemplate` de Angular. */
function firstBlockedTemplate({ records, templates, knownManagement }: SendValidationInput): SendCheck | null {
  for (const record of records) {
    const gestionId = (record.gestionId || record.solicitud || '').trim();
    if (!gestionId) continue;
    const option = knownManagement(gestionId) || {
      id: gestionId,
      name: record.solicitud || gestionId,
      client: record.cliente,
      project: record.proyecto,
    };
    const template = templateForManagement(option, templates);
    if (!template) return templateCheck(option, null, []);
    const missing = missingRequiredTemplateFields(template);
    if (template.completed !== true || missing.length) return templateCheck(option, template, missing);
  }
  return null;
}

function templateCheck(
  option: ManagementDemandOption,
  template: ManagementAdvancedTemplate | null,
  missing: string[],
): SendCheck {
  const missingText = missing.length ? ` Faltan: ${missing.join(', ')}.` : '';
  return {
    status: 'template',
    option,
    template,
    text: `Llena la configuración avanzada de la gestión antes de enviar.${missingText}`,
  };
}

/** Registros del lote que se cruzan con un horario ya enviado el mismo día. */
function overlapsWithSent({ records, ledger }: SendValidationInput): string[] {
  if (!ledger) return [];
  const clock = (minutes: number) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return records.flatMap((record, index) => {
    const interval = { startMin: minutesOf(record.horaIni), endMin: minutesOf(record.horaFin) };
    const other = ledger.get(record.fecha)?.sentIntervals.find((sent) => intervalsOverlap(interval, sent));
    return other
      ? [
          `#${index + 1} ${formatFullDate(record.fecha)} ${record.horaIni}-${record.horaFin} con ${clock(other.startMin)}-${clock(other.endMin)}`,
        ]
      : [];
  });
}

/**
 * Validaciones previas al envío (`onSendAll` de Angular), en el mismo orden y con los mismos mensajes, más dos
 * comprobaciones contra lo ya enviado: horario cruzado (bloquea) y exceso de jornada (pide confirmar).
 */
export function validateBeforeSend(input: SendValidationInput): SendCheck {
  const { records, domain, ledger, confirmExcess } = input;
  if (records.length === 0) return blocked('Envío bloqueado', 'No hay registros listos para enviar.');

  const templateBlock = firstBlockedTemplate(input);
  if (templateBlock) return templateBlock;

  const invalidos = records
    .map((record, idx) => ({ idx, errors: recordErrors(domain, record) }))
    .filter((item) => item.errors.length > 0);
  if (invalidos.length) {
    const ejemplos = invalidos
      .slice(0, EXAMPLES)
      .map((item) => `#${item.idx + 1} (${item.errors.join(', ')})`)
      .join('; ');
    return blocked(
      'Envío bloqueado por datos incompletos',
      `Corrige ${invalidos.length} registros con datos invalidos antes de enviar. Ejemplos: ${ejemplos}`,
    );
  }

  const max = domain.getMaxDailyLaborHours();
  const registrosExcedidos = domain.getLaborRecordsHoursExceeded([...records]);
  if (registrosExcedidos.length) {
    const ejemplos = registrosExcedidos
      .slice(0, EXAMPLES)
      .map((item) => `#${item.index + 1} ${formatFullDate(item.fecha)}: ${item.horas.toFixed(1)}h/${item.limiteHoras}h`)
      .join('; ');
    const suffix = registrosExcedidos.length > EXAMPLES ? `; y ${registrosExcedidos.length - EXAMPLES} registro(s) mas` : '';
    return blocked(
      'Envío bloqueado por duración inválida',
      `No se pueden enviar registros computables de más de ${max} horas. Ajusta: ${ejemplos}${suffix}`,
    );
  }

  const diasExcedidos = domain.getDailyLaborHoursExceeded([...records]);
  if (diasExcedidos.length) {
    const ejemplos = diasExcedidos
      .slice(0, EXAMPLES)
      .map((item) => `${formatFullDate(item.fecha)}: ${item.totalHoras.toFixed(1)}h/${item.limiteHoras}h ${item.tipoHora}`)
      .join('; ');
    const suffix = diasExcedidos.length > EXAMPLES ? `; y ${diasExcedidos.length - EXAMPLES} dia(s) mas` : '';
    return blocked(
      'Envío bloqueado por exceso diario',
      `No se pueden enviar registros con más de ${max} horas computables por día. Ajusta: ${ejemplos}${suffix}`,
    );
  }

  const overlaps = overlapsWithSent(input);
  if (overlaps.length) {
    const suffix = overlaps.length > EXAMPLES ? `; y ${overlaps.length - EXAMPLES} más` : '';
    return blocked(
      'Envío bloqueado por horario cruzado',
      `${overlaps.length} registro(s) se cruzan con horarios que ya enviaste. Ajusta o elimina: ${overlaps.slice(0, EXAMPLES).join('; ')}${suffix}`,
    );
  }

  if (ledger && !confirmExcess) {
    // El dominio calcula el tope de cada día: se le suman las horas ya enviadas como un registro más.
    const sentAsRecords = [...ledger.entries()]
      .filter(([, day]) => day.sentHours > 0)
      .map(([fecha, day]) => ({ ...records[0], fecha, horas: String(day.sentHours), tipoHora: 'Laboral' }));
    const withSent = domain
      .getDailyLaborHoursExceeded([...records, ...sentAsRecords])
      .filter((item) => (ledger.get(item.fecha)?.draftHours ?? 0) > 0);
    if (withSent.length) {
      const ejemplos = withSent
        .slice(0, EXAMPLES)
        .map(
          (item) =>
            `${formatFullDate(item.fecha)}: ${item.totalHoras.toFixed(1)}h/${item.limiteHoras}h (${(ledger.get(item.fecha)?.sentHours ?? 0).toFixed(1)}h ya enviadas)`,
        )
        .join('; ');
      const suffix = withSent.length > EXAMPLES ? `; y ${withSent.length - EXAMPLES} dia(s) mas` : '';
      return {
        status: 'confirm',
        title: 'Exceso de jornada con lo ya enviado',
        text: `Con lo que ya enviaste, estos días superan las horas computables permitidas: ${ejemplos}${suffix}. ¿Quieres enviar de todos modos?`,
      };
    }
  }

  return { status: 'ok' };
}
