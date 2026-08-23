import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DayGroup, TimeRecord } from '@domain/time-records/models/time-record.model';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import { FechaEspPipe } from '../../pipes/fecha-esp.pipe';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';

@Component({
  selector: 'app-records-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaEspPipe, OverflowTooltipDirective, UiSelectComponent],
  templateUrl: './records-preview.component.html',
})
export class RecordsPreviewComponent {
  @Input() groups: DayGroup[] = [];
  @Input() totalGeneral = 0;
  @Input() sending = false;
  @Input() clientes: string[] = [];
  @Input() tipoHoraOptions: UiSelectOption[] = [];
  @Input() defaultSolicitudes: string[] = [];
  @Input() defaultSolicitudOptions: ManagementDemandOption[] = [];
  @Output() editRecord = new EventEmitter<number>();
  @Output() deleteRecord = new EventEmitter<number>();
  @Output() updateRecord = new EventEmitter<{ index: number; record: TimeRecord }>();
  @Output() managementSelected = new EventEmitter<ManagementDemandOption>();
  @Output() sendAll = new EventEmitter<void>();
  @Output() cancelImport = new EventEmitter<void>();

  solicitudesByIndex: Record<number, ManagementDemandOption[]> = {};
  loadingDemandByIndex: Record<number, boolean> = {};

  constructor(
    public domain: TimeRecordDomainService,
    private options: LoadSelectOptionsUseCase,
  ) {}

  get recordCount(): number {
    return this.groups.reduce((total, group) => total + group.records.length, 0);
  }

  get recordsToReview(): number {
    return this.groups.reduce(
      (total, group) =>
        total + group.records.filter((item) => this.getErrors(item.record).length > 0).length,
      0,
    );
  }

  get readyCount(): number {
    return Math.max(0, this.recordCount - this.recordsToReview);
  }

  getMissing(record: TimeRecord): string[] {
    return this.domain.getMissingFields(record);
  }

  getErrors(record: TimeRecord): string[] {
    return [...this.domain.getMissingFields(record), ...this.domain.getInvalidFields(record)];
  }

  getSolicitudes(index: number): ManagementDemandOption[] {
    return this.solicitudesByIndex[index] ?? this.defaultSolicitudOptions;
  }

  selectOptions(values: readonly string[], placeholder: string): UiSelectOption[] {
    return [{ value: '', label: placeholder }, ...values.map((value) => ({ value, label: value }))];
  }

  selectTipoHoraOptions(currentValue: string): UiSelectOption[] {
    const value = String(currentValue || '').trim();
    const options = this.tipoHoraOptions.length
      ? this.tipoHoraOptions
      : [{ value: 'Laboral', label: 'Laboral' }];
    if (value && !options.some((option) => option.value === value)) {
      return [{ value, label: value }, ...options];
    }
    return options;
  }

  solicitudSelectOptions(
    values: readonly ManagementDemandOption[],
    placeholder: string,
    currentRecord?: TimeRecord,
  ): UiSelectOption[] {
    const options = values.map((item) => ({ value: item.id, label: item.name }));
    if (
      currentRecord?.solicitud &&
      !options.some((item) => item.value === (currentRecord.gestionId || currentRecord.solicitud))
    ) {
      options.unshift({
        value: currentRecord.gestionId || currentRecord.solicitud,
        label: currentRecord.solicitud,
      });
    }
    return [{ value: '', label: placeholder }, ...options];
  }

  onClienteChange(index: number, record: TimeRecord, cliente: string) {
    const baseRecord = { ...record, cliente, proyecto: '', solicitud: '' };
    this.updateRecord.emit({ index, record: baseRecord });
    this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: [] };

    if (!cliente) return;

    this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: true };
    this.options.proyectos(cliente).subscribe((proyectos) => {
      const proyecto = proyectos[0] ?? '';
      this.options.solicitudOptions(cliente, proyecto).subscribe((solicitudes) => {
        const selected = solicitudes[0] ?? null;
        this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: solicitudes };
        this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: false };
        this.updateRecord.emit({
          index,
          record: {
            ...baseRecord,
            proyecto,
            solicitud: selected?.requestValue || selected?.name || '',
            gestionId: selected?.id || '',
          },
        });
        if (selected) this.managementSelected.emit(selected);
      });
    });
  }

  onSolicitudChange(index: number, record: TimeRecord, gestionId: string) {
    const option = this.getSolicitudes(index).find((item) => item.id === gestionId);
    this.updateRecord.emit({
      index,
      record: {
        ...record,
        gestionId,
        solicitud: option?.requestValue || option?.name || gestionId,
      },
    });
    if (option) this.managementSelected.emit(option);
  }

  onTipoHoraChange(index: number, record: TimeRecord, tipoHora: string) {
    this.updateRecord.emit({ index, record: { ...record, tipoHora } });
  }

  ensureSolicitudes(index: number, record: TimeRecord) {
    if (!record.cliente || this.solicitudesByIndex[index] || this.loadingDemandByIndex[index])
      return;

    this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: true };
    this.options.solicitudOptions(record.cliente, record.proyecto).subscribe((solicitudes) => {
      this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: solicitudes };
      this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: false };
    });
  }
}
