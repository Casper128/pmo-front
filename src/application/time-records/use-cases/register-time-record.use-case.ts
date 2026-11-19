import type { LocationGateway, UserAuditGateway } from '@application/audit/audit.gateways';
import type {
  TimeRecordApiBody,
  TimeRecordRegistrationResponse,
} from '@domain/time-records/models/time-record-api.model';
import type { TimeRecord } from '@domain/time-records/models/time-record.model';
import type { TimeRecordRepository } from '@domain/time-records/repositories/time-record.repository';
import type { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import type { ManagementTemplateGateway } from '../ports/management-template.gateway';
import { applyTemplateValues } from '../template-values';
import {
  type ManagementAdvancedTemplate,
  REQUIRED_ADVANCED_TEMPLATE_FIELDS,
  isMissingAdvancedTemplateValue,
} from '@domain/time-records/models/management-template.model';

/** Opciones de geolocalización del reporte (paridad con Angular). */
const REPORT_LOCATION_REQUEST = { highAccuracy: true, maximumAgeMs: 0, timeoutMs: 15000 } as const;

export class RegisterTimeRecordUseCase {
  private readonly repository: TimeRecordRepository;
  private readonly location: LocationGateway;
  private readonly audit: UserAuditGateway;
  private readonly templates: ManagementTemplateGateway;
  private readonly bodyBuilder: TimeRecordApiBodyBuilder;

  constructor(
    repository: TimeRecordRepository,
    location: LocationGateway,
    audit: UserAuditGateway,
    templates: ManagementTemplateGateway,
    bodyBuilder: TimeRecordApiBodyBuilder,
  ) {
    this.repository = repository;
    this.location = location;
    this.audit = audit;
    this.templates = templates;
    this.bodyBuilder = bodyBuilder;
  }

  /**
   * Plantilla obligatoria → aplicar plantilla → construir cuerpo → capturar ubicación → registrar
   * → auditar el resultado (los fallos de auditoría se ignoran; el error de registro se relanza).
   */
  async execute(record: TimeRecord): Promise<TimeRecordRegistrationResponse> {
    const template = this.validTemplateOrFail(
      record,
      await this.templates.get(record.gestionId || record.solicitud),
    );
    const body = this.bodyBuilder.build(applyTemplateValues(record, template.values));
    const capturedLocation = await this.location.capture({ ...REPORT_LOCATION_REQUEST });

    let response: TimeRecordRegistrationResponse;
    try {
      response = await this.repository.register(body);
    } catch (error) {
      await this.auditResult(capturedLocation, body, false);
      throw error;
    }
    await this.auditResult(capturedLocation, body, true);
    return response;
  }

  private async auditResult(
    location: Awaited<ReturnType<LocationGateway['capture']>>,
    body: TimeRecordApiBody,
    successful: boolean,
  ): Promise<void> {
    try {
      await this.audit.recordTimeReport(
        location,
        {
          reference: body.solicitud,
          customer: body.cliente,
          date: body.HoraInicio.slice(0, 10),
        },
        successful,
      );
    } catch {
      // La auditoría nunca bloquea ni altera el resultado del registro.
    }
  }

  private validTemplateOrFail(
    record: TimeRecord,
    template: ManagementAdvancedTemplate | null,
  ): ManagementAdvancedTemplate {
    if (!template) {
      throw new Error(
        `La gestión "${record.solicitud || record.gestionId}" no tiene plantilla de campos avanzados configurada.`,
      );
    }

    if (template.completed !== true) {
      throw new Error(`La plantilla de "${template.gestionName}" todavía está pendiente.`);
    }

    const missing = REQUIRED_ADVANCED_TEMPLATE_FIELDS.filter((field) =>
      isMissingAdvancedTemplateValue(template.values[field.key]),
    ).map((field) => field.label);

    if (missing.length) {
      throw new Error(
        `La plantilla de "${template.gestionName}" está incompleta. Faltan: ${missing.join(', ')}.`,
      );
    }

    return template;
  }
}
