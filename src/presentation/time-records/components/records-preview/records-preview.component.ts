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
import { DayGroup, TimeRecord } from '@domain/time-records/models/time-record.model';
import { FechaEspPipe } from '../../pipes/fecha-esp.pipe';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { OverflowTooltipDirective } from '@presentation/shared/directives/overflow-tooltip.directive';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';

@Component({
  selector: 'app-records-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaEspPipe, OverflowTooltipDirective, UiSelectComponent],
  templateUrl: './records-preview.component.html',
  styleUrl: './records-preview.component.css',
})
export class RecordsPreviewComponent implements OnChanges {
  @Input() groups: DayGroup[] = [];
  @Input() totalGeneral = 0;
  @Input() sending = false;
  @Input() clientes: string[] = [];
  @Input() tipoHoraOptions: UiSelectOption[] = [];
  @Output() editRecord = new EventEmitter<number>();
  @Output() deleteRecord = new EventEmitter<number>();
  @Output() recordChange = new EventEmitter<{ index: number; record: TimeRecord }>();
  @Output() sendAll = new EventEmitter<void>();
  @Output() cancelImport = new EventEmitter<void>();

  private readonly options = inject(LoadSelectOptionsUseCase);
  private readonly gestionOptionsByIndex = new Map<number, ManagementDemandOption[]>();
  private readonly loadingGestionesByIndex = new Set<number>();
  private readonly lastGestionStorageKey = 'pmo_last_management_by_client';

  constructor(public domain: TimeRecordDomainService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['groups']) return;
    this.groups
      .flatMap((group) => group.records)
      .filter((item) => item.record.cliente && !this.gestionOptionsByIndex.has(item.index))
      .forEach((item) =>
        this.loadGestiones(item.index, item.record.cliente, item.record.proyecto, item.record),
      );
  }

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

  onClienteChange(index: number, record: TimeRecord, cliente: string): void {
    const updated: TimeRecord = {
      ...record,
      cliente,
      proyecto: '',
      solicitud: '',
      gestionId: '',
    };
    this.gestionOptionsByIndex.delete(index);
    this.recordChange.emit({ index, record: updated });
    if (cliente) this.loadGestiones(index, cliente, '', updated, true);
  }

  onGestionChange(index: number, record: TimeRecord, gestionId: string): void {
    const option = this.gestionOptionsByIndex.get(index)?.find((item) => item.id === gestionId);
    this.recordChange.emit({
      index,
      record: {
        ...record,
        gestionId,
        solicitud: option?.requestValue || option?.name || gestionId,
        proyecto: option?.project || record.proyecto,
      },
    });
    this.rememberGestion(record.cliente, gestionId);
  }

  onTipoHoraChange(index: number, record: TimeRecord, tipoHora: string): void {
    this.recordChange.emit({ index, record: { ...record, tipoHora } });
  }

  clienteOptions(currentValue = ''): UiSelectOption[] {
    const values = this.withCurrentValue(this.clientes, currentValue);
    return [
      { value: '', label: 'Seleccione un cliente' },
      ...values.map((cliente) => ({ value: cliente, label: cliente })),
    ];
  }

  gestionOptions(index: number, record: TimeRecord): UiSelectOption[] {
    const values = (this.gestionOptionsByIndex.get(index) || []).map((item) => ({
      value: item.id,
      label: item.name,
    }));
    const currentValue = record.gestionId || record.solicitud;
    if (currentValue && !values.some((option) => option.value === currentValue)) {
      values.unshift({ value: currentValue, label: record.solicitud || currentValue });
    }
    return [{ value: '', label: 'Seleccione una gestión' }, ...values];
  }

  tipoHoraSelectOptions(currentValue = ''): UiSelectOption[] {
    const options = [...this.tipoHoraOptions];
    if (currentValue && !options.some((option) => option.value === currentValue)) {
      options.unshift({ value: currentValue, label: currentValue });
    }
    return [{ value: '', label: 'Seleccione tipo de hora' }, ...options];
  }

  isLoadingGestiones(index: number): boolean {
    return this.loadingGestionesByIndex.has(index);
  }

  private loadGestiones(
    index: number,
    cliente: string,
    proyecto: string,
    record?: TimeRecord,
    selectPreferred = false,
  ): void {
    if (!cliente) return;
    this.loadingGestionesByIndex.add(index);
    this.options.proyectos(cliente).subscribe({
      next: (proyectos) => {
        const selectedProject = proyecto || proyectos[0] || '';
        this.options.solicitudOptions(cliente, selectedProject).subscribe({
          next: (solicitudes) => {
            this.gestionOptionsByIndex.set(
              index,
              solicitudes.map((solicitud) => ({
                ...solicitud,
                client: solicitud.client || cliente,
                project: solicitud.project || selectedProject,
              })),
            );
            this.loadingGestionesByIndex.delete(index);
            if (record && (selectPreferred || !record.gestionId)) {
              this.selectPreferredGestion(index, record);
            }
          },
          error: () => this.loadingGestionesByIndex.delete(index),
        });
      },
      error: () => this.loadingGestionesByIndex.delete(index),
    });
  }

  private selectPreferredGestion(index: number, record: TimeRecord): void {
    const options = this.gestionOptionsByIndex.get(index) || [];
    if (!record.cliente || !options.length) return;
    const remembered = this.rememberedGestion(record.cliente);
    const option =
      options.find((item) => item.id === remembered) ||
      options.find((item) => item.id === record.gestionId) ||
      options[0];
    if (option) this.onGestionChange(index, record, option.id);
  }

  private rememberedGestion(cliente: string): string {
    try {
      const stored = localStorage.getItem(this.lastGestionStorageKey);
      const parsed = stored ? (JSON.parse(stored) as Record<string, string>) : {};
      return parsed[cliente] || '';
    } catch {
      localStorage.removeItem(this.lastGestionStorageKey);
      return '';
    }
  }

  private rememberGestion(cliente: string, gestionId: string): void {
    if (!cliente || !gestionId) return;
    try {
      const stored = localStorage.getItem(this.lastGestionStorageKey);
      const parsed = stored ? (JSON.parse(stored) as Record<string, string>) : {};
      localStorage.setItem(
        this.lastGestionStorageKey,
        JSON.stringify({ ...parsed, [cliente]: gestionId }),
      );
    } catch {
      localStorage.removeItem(this.lastGestionStorageKey);
    }
  }

  private withCurrentValue(values: readonly string[], currentValue: string): string[] {
    const unique = new Set(values.filter(Boolean));
    if (currentValue) unique.add(currentValue);
    return [...unique];
  }
}
