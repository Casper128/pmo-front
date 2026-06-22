import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DayGroup, TimeRecord } from '../../../domain/models/time-record.model';
import { FechaEspPipe } from '../../pipes/fecha-esp.pipe';
import { TimeRecordDomainService } from '../../../domain/services/time-record-domain.service';
import { LoadSelectOptionsUseCase } from '../../../application/use-cases/load-select-options.use-case';

@Component({
  selector: 'app-records-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, FechaEspPipe],
  templateUrl: './records-preview.component.html',
})
export class RecordsPreviewComponent {
  @Input() groups: DayGroup[] = [];
  @Input() totalGeneral = 0;
  @Input() sending = false;
  @Input() clientes: string[] = [];
  @Input() defaultSolicitudes: string[] = [];
  @Output() editRecord = new EventEmitter<number>();
  @Output() deleteRecord = new EventEmitter<number>();
  @Output() updateRecord = new EventEmitter<{ index: number; record: TimeRecord }>();
  @Output() sendAll = new EventEmitter<void>();
  @Output() cancelImport = new EventEmitter<void>();

  solicitudesByIndex: Record<number, string[]> = {};
  loadingDemandByIndex: Record<number, boolean> = {};

  constructor(
    public domain: TimeRecordDomainService,
    private options: LoadSelectOptionsUseCase
  ) {}

  get recordCount(): number {
    return this.groups.reduce((total, group) => total + group.records.length, 0);
  }

  getMissing(record: TimeRecord): string[] {
    return this.domain.getMissingFields(record);
  }

  getErrors(record: TimeRecord): string[] {
    return [...this.domain.getMissingFields(record), ...this.domain.getInvalidFields(record)];
  }

  getSolicitudes(index: number): string[] {
    return this.solicitudesByIndex[index] ?? this.defaultSolicitudes;
  }

  onClienteChange(index: number, record: TimeRecord, cliente: string) {
    const baseRecord = { ...record, cliente, proyecto: '', solicitud: '' };
    this.updateRecord.emit({ index, record: baseRecord });
    this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: [] };

    if (!cliente) return;

    this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: true };
    this.options.proyectos(cliente).subscribe(proyectos => {
      const proyecto = proyectos[0] ?? '';
      this.options.solicitudes(cliente, proyecto).subscribe(solicitudes => {
        const solicitud = solicitudes[0] ?? '';
        this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: solicitudes };
        this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: false };
        this.updateRecord.emit({
          index,
          record: { ...baseRecord, proyecto, solicitud },
        });
      });
    });
  }

  onSolicitudChange(index: number, record: TimeRecord, solicitud: string) {
    this.updateRecord.emit({ index, record: { ...record, solicitud } });
  }

  ensureSolicitudes(index: number, record: TimeRecord) {
    if (!record.cliente || this.solicitudesByIndex[index] || this.loadingDemandByIndex[index]) return;

    this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: true };
    this.options.solicitudes(record.cliente, record.proyecto).subscribe(solicitudes => {
      this.solicitudesByIndex = { ...this.solicitudesByIndex, [index]: solicitudes };
      this.loadingDemandByIndex = { ...this.loadingDemandByIndex, [index]: false };
    });
  }
}
