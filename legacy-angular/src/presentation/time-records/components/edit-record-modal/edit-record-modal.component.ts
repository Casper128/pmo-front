import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { TimeRecordApiBody } from '@domain/time-records/models/time-record-api.model';
import { TimeRecordApiBodyBuilder } from '@domain/time-records/services/time-record-api-body.builder';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { ParameterOption } from '@domain/configuration/app-parameters.model';
import { ManagementTemplateGateway } from '@application/time-records/ports/management-template.gateway';
import {
  AdvancedTemplateFieldKey,
  AdvancedTemplateValues,
  ManagementDemandOption,
} from '@domain/time-records/models/management-template.model';
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiTimeInputComponent } from '@presentation/shared/components/ui-time-input/ui-time-input.component';
import { UiModalComponent } from '@presentation/shared/components/ui-modal/ui-modal.component';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';
import { UiFormSectionComponent } from '@presentation/shared/components/ui-form-section/ui-form-section.component';

@Component({
  selector: 'app-edit-record-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiSelectComponent,
    UiDateInputComponent,
    UiTimeInputComponent,
    UiModalComponent,
    UiFieldComponent,
    UiFormSectionComponent,
  ],
  templateUrl: './edit-record-modal.component.html',
})
export class EditRecordModalComponent implements OnChanges {
  @Input() record: TimeRecord | null = null;
  @Input() visible = false;
  @Output() save = new EventEmitter<TimeRecord>();
  @Output() cancel = new EventEmitter<void>();

  private domain = inject(TimeRecordDomainService);
  private options = inject(LoadSelectOptionsUseCase);
  private parameters = inject(AppParametersFacade);
  private templates = inject(ManagementTemplateGateway);
  private bodyBuilder = inject(TimeRecordApiBodyBuilder);

  draft: TimeRecord | null = null;
  horasReal = '';
  validationErrors: string[] = [];
  payloadPreviewFields: { label: string; value: string }[] = [];
  payloadPreviewMessage = '';
  payloadPreviewLoading = false;

  clientes: string[] = [];
  proyectos: string[] = [];
  solicitudes: string[] = [];
  solicitudOptionsList: ManagementDemandOption[] = [];
  private previewRequestKey = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['record'] && this.record) {
      this.draft = { ...this.record };
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
      this.refreshValidation();
      this.refreshPayloadPreview();
    }
    if (changes['visible'] && this.visible) {
      this.loadClientes();
    }
  }

  loadClientes() {
    this.options.clientes().subscribe((c) => {
      this.clientes = c;
      if (this.draft?.cliente) this.loadProjects(this.draft.cliente, this.draft.proyecto);
    });
  }

  onClienteChange(cliente: string, resetFields = true) {
    if (resetFields && this.draft) {
      this.draft.proyecto = '';
      this.draft.solicitud = '';
      this.draft.gestionId = '';
      this.clearDuplicatedAdvancedFields();
    }
    if (!cliente) {
      this.proyectos = [];
      this.solicitudes = [];
      this.solicitudOptionsList = [];
      this.refreshPayloadPreview();
      return;
    }
    this.refreshValidation();
    this.refreshPayloadPreview();
    this.loadProjects(cliente, resetFields ? '' : this.draft?.proyecto || '');
  }

  onProyectoChange(proyecto: string) {
    if (!this.draft?.cliente) return;
    this.draft.solicitud = '';
    this.draft.gestionId = '';
    this.clearDuplicatedAdvancedFields();
    this.refreshValidation();
    this.refreshPayloadPreview();
    this.loadSolicitudes(this.draft.cliente, proyecto);
  }

  onSolicitudChange(gestionId: string): void {
    if (!this.draft) return;
    const option = this.solicitudOptionsList.find((item) => item.id === gestionId);
    const changedDuplicatedGestion =
      !!this.draft.duplicatedFromGestionId && this.draft.duplicatedFromGestionId !== gestionId;
    this.draft.gestionId = gestionId;
    this.draft.solicitud = option?.requestValue || option?.name || gestionId;
    if (changedDuplicatedGestion) {
      this.clearDuplicatedAdvancedFields();
    }
    this.refreshValidation();
    this.refreshPayloadPreview();
  }

  calcHoras() {
    if (this.draft) {
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
      this.draft.horas = this.horasReal || '0';
      this.refreshValidation();
      this.refreshPayloadPreview();
    }
  }

  onFechaChange() {
    this.refreshValidation();
    this.refreshPayloadPreview();
  }

  onEditablePayloadFieldChange(): void {
    this.refreshValidation();
    this.refreshPayloadPreview();
  }

  onSave() {
    this.refreshValidation();
    if (this.draft && this.validationErrors.length === 0) this.save.emit({ ...this.draft });
  }

  private refreshValidation() {
    if (!this.draft) {
      this.validationErrors = [];
      return;
    }
    this.validationErrors = [
      ...this.domain.getMissingFields(this.draft),
      ...this.domain.getInvalidFields(this.draft),
    ];
  }

  private clearDuplicatedAdvancedFields(): void {
    if (!this.draft?.duplicatedFromGestionId) return;
    this.draft.funcional = '';
    this.draft.ricef = '';
    this.draft.duplicatedFromGestionId = undefined;
  }

  private refreshPayloadPreview(): void {
    const draft = this.draft;
    const gestionId = (draft?.gestionId || draft?.solicitud || '').trim();
    if (!draft || !gestionId) {
      this.payloadPreviewFields = [];
      this.payloadPreviewMessage = 'Selecciona una gestión para revisar los campos automáticos.';
      this.payloadPreviewLoading = false;
      return;
    }

    const requestKey = `${gestionId}|${draft.fecha}|${draft.horaIni}|${draft.horaFin}|${draft.horas}|${draft.tipoHora}|${draft.desc}|${draft.observacion}`;
    this.previewRequestKey = requestKey;
    this.payloadPreviewLoading = true;
    this.payloadPreviewMessage = '';

    this.templates.get(gestionId).subscribe({
      next: (template) => {
        if (this.previewRequestKey !== requestKey) return;
        this.payloadPreviewLoading = false;
        if (!template) {
          this.payloadPreviewFields = [];
          this.payloadPreviewMessage =
            'Esta gestión todavía no tiene plantilla de campos avanzados configurada.';
          return;
        }
        try {
          const prepared = this.applyTemplate(draft, template.values);
          const payload = this.bodyBuilder.build(prepared);
          this.payloadPreviewFields = this.payloadFields(payload);
          this.payloadPreviewMessage = '';
        } catch (error) {
          this.payloadPreviewFields = [];
          this.payloadPreviewMessage =
            error instanceof Error
              ? error.message
              : 'No fue posible construir la vista previa del envío.';
        }
      },
      error: () => {
        if (this.previewRequestKey !== requestKey) return;
        this.payloadPreviewLoading = false;
        this.payloadPreviewFields = [];
        this.payloadPreviewMessage = 'No fue posible consultar la plantilla de esta gestión.';
      },
    });
  }

  private applyTemplate(
    record: TimeRecord,
    values: AdvancedTemplateValues,
  ): TimeRecord & AdvancedTemplateValues {
    const copy: TimeRecord & AdvancedTemplateValues = { ...record };
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'tipoHora') return;
      if (value === undefined || value === null || String(value).trim() === '') return;
      copy[key as AdvancedTemplateFieldKey] = String(value);
    });
    return copy;
  }

  private payloadFields(payload: TimeRecordApiBody): { label: string; value: string }[] {
    return [
      { label: 'RICEF', value: payload.ricef },
      { label: 'Proyecto', value: payload.proyecto },
      { label: 'Funcional', value: payload.funcional },
      { label: 'Tipo actividad', value: payload.tipoActividad },
      { label: 'Causa', value: payload.causa },
      { label: 'Complejidad', value: payload.complejidad },
      { label: 'Impacto', value: payload.impacto },
      { label: 'Equipo', value: payload.equipo },
      { label: 'Módulo SAP', value: payload.unity },
      { label: 'Modo actuación', value: payload.modoActuacion },
      { label: 'Lenguaje', value: payload.lenguaje },
      { label: 'Prefijo', value: payload.prefijo },
      { label: 'RICEF object', value: payload.objetoRicef },
      { label: 'Categoría', value: payload.categoria },
      { label: 'Fecha estimada pruebas', value: payload.fechaEstimadaPruebas || '' },
      { label: 'Fecha real pruebas', value: payload.fechaEstimadaRealPruebas || '' },
    ].map((field) => ({ ...field, value: field.value || 'Sin valor' }));
  }

  get tiposHora(): ParameterOption[] {
    return this.parameters.optionsFor('tipoHora');
  }

  selectOptions(
    values: readonly (string | ParameterOption)[],
    emptyLabel?: string,
    currentValue?: string,
  ): UiSelectOption[] {
    const mapped = values.map((item) =>
      typeof item === 'string'
        ? { value: item, label: item }
        : { value: item.value, label: item.label, disabled: !item.active },
    );
    const options =
      currentValue && !mapped.some((item) => item.value === currentValue)
        ? [{ value: currentValue, label: currentValue }, ...mapped]
        : mapped;
    return emptyLabel ? [{ value: '', label: emptyLabel }, ...options] : options;
  }

  private loadProjects(cliente: string, currentProject: string): void {
    this.options.proyectos(cliente).subscribe((projects) => {
      this.proyectos = projects;
      const project = currentProject || projects[0] || '';
      if (this.draft && !this.draft.proyecto) this.draft.proyecto = project;
      this.loadSolicitudes(cliente, project);
    });
  }

  private loadSolicitudes(cliente: string, proyecto: string): void {
    if (!proyecto) {
      this.solicitudes = [];
      this.solicitudOptionsList = [];
      return;
    }
    this.options.solicitudOptions(cliente, proyecto).subscribe((solicitudes) => {
      this.solicitudOptionsList = solicitudes;
      this.solicitudes = solicitudes.map((item) => item.name);
    });
  }

  solicitudSelectOptions(currentRecord?: TimeRecord): UiSelectOption[] {
    const mapped = this.solicitudOptionsList.map((item) => ({ value: item.id, label: item.name }));
    if (
      currentRecord?.solicitud &&
      !mapped.some((item) => item.value === (currentRecord.gestionId || currentRecord.solicitud))
    ) {
      mapped.unshift({
        value: currentRecord.gestionId || currentRecord.solicitud,
        label: currentRecord.solicitud,
      });
    }
    return [{ value: '', label: 'Seleccione una gestión' }, ...mapped];
  }
}
