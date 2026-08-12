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
import { AppParametersFacade } from '@application/configuration/app-parameters.facade';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiTimeInputComponent } from '@presentation/shared/components/ui-time-input/ui-time-input.component';

@Component({
  selector: 'app-edit-record-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiSelectComponent,
    UiDateInputComponent,
    UiTimeInputComponent,
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
    }
    if (!cliente) {
      this.proyectos = [];
      this.solicitudes = [];
      return;
    }
    this.loadProjects(cliente, resetFields ? '' : this.draft?.proyecto || '');
  }

  onProyectoChange(proyecto: string) {
    if (!this.draft?.cliente) return;
    this.draft.solicitud = '';
    this.loadSolicitudes(this.draft.cliente, proyecto);
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

  onTestDateChange() {
    this.refreshValidation();
  }

  onSave() {
    this.refreshValidation();
    if (this.draft && this.validationErrors.length === 0) this.save.emit({ ...this.draft });
  }

  private fillTestDatesFromRecordDate() {
    if (!this.draft?.fecha) return;
    if (!this.draft.fechaEstimada) this.draft.fechaEstimada = this.draft.fecha;
    if (!this.draft.fechaReal) this.draft.fechaReal = this.draft.fecha;
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

  get tiposActividad(): ParameterOption[] {
    return this.parameters.optionsFor('tipoActividad');
  }
  get causas(): ParameterOption[] {
    return this.parameters.optionsFor('causa');
  }
  get complejidades(): ParameterOption[] {
    return this.parameters.optionsFor('complejidad');
  }
  get impactos(): ParameterOption[] {
    return this.parameters.optionsFor('impacto');
  }
  get equipos(): ParameterOption[] {
    return this.parameters.optionsFor('equipo');
  }
  get modos(): ParameterOption[] {
    return this.parameters.optionsFor('modoActuacion');
  }
  get lenguajes(): ParameterOption[] {
    return this.parameters.optionsFor('lenguaje');
  }
  get tiposHora(): ParameterOption[] {
    return this.parameters.optionsFor('tipoHora');
  }
  get prefijos(): ParameterOption[] {
    return this.parameters.optionsFor('prefijo');
  }
  get objetosRicef(): ParameterOption[] {
    return this.parameters.optionsFor('objetoRicef');
  }
  get categorias(): ParameterOption[] {
    return this.parameters.optionsFor('categoria');
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
      this.loadSolicitudes(cliente, currentProject);
    });
  }

  private loadSolicitudes(cliente: string, proyecto: string): void {
    if (!proyecto) {
      this.solicitudes = [];
      return;
    }
    this.options.solicitudes(cliente, proyecto).subscribe((solicitudes) => {
      this.solicitudes = solicitudes;
    });
  }
}
