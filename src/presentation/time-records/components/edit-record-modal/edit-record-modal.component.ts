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
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { ParameterOption } from '@domain/configuration/app-parameters.model';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
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

  draft: TimeRecord | null = null;
  horasReal = '';
  validationErrors: string[] = [];

  clientes: string[] = [];
  proyectos: string[] = [];
  solicitudes: string[] = [];
  solicitudOptionsList: ManagementDemandOption[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['record'] && this.record) {
      this.draft = { ...this.record };
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
      this.refreshValidation();
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
    }
    if (!cliente) {
      this.proyectos = [];
      this.solicitudes = [];
      this.solicitudOptionsList = [];
      return;
    }
    this.loadProjects(cliente, resetFields ? '' : this.draft?.proyecto || '');
  }

  onProyectoChange(proyecto: string) {
    if (!this.draft?.cliente) return;
    this.draft.solicitud = '';
    this.draft.gestionId = '';
    this.loadSolicitudes(this.draft.cliente, proyecto);
  }

  onSolicitudChange(gestionId: string): void {
    if (!this.draft) return;
    const option = this.solicitudOptionsList.find((item) => item.id === gestionId);
    this.draft.gestionId = gestionId;
    this.draft.solicitud = option?.requestValue || option?.name || gestionId;
    this.refreshValidation();
  }

  calcHoras() {
    if (this.draft) {
      this.horasReal = this.domain.calcHoras(this.draft.horaIni, this.draft.horaFin);
      this.draft.horas = this.horasReal || '0';
      this.refreshValidation();
    }
  }

  onFechaChange() {
    this.refreshValidation();
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
