import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';
import { UiDateInputComponent } from '@presentation/shared/components/ui-date-input/ui-date-input.component';
import { UiTimeInputComponent } from '@presentation/shared/components/ui-time-input/ui-time-input.component';

interface ManualDraftRow {
  horaIni: string;
  horaFin: string;
  desc: string;
  observacion: string;
}

interface ManualDraft {
  fecha: string;
  cliente: string;
  gestionId: string;
  solicitud: string;
  tipoHora: string;
  rows: ManualDraftRow[];
}

@Component({
  selector: 'app-import-text-input',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    UiFieldComponent,
    UiSelectComponent,
    UiDateInputComponent,
    UiTimeInputComponent,
  ],
  templateUrl: './import-text-input.component.html',
})
export class ImportTextInputComponent implements OnChanges, OnInit {
  @Input() clientes: string[] = [];
  @Input() tipoHoraOptions: UiSelectOption[] = [];
  @Input() defaultSolicitudOptions: ManagementDemandOption[] = [];
  @Input() defaultCliente = '';
  @Input() defaultGestionId = '';
  @Input() loadingClientes = false;
  @Input() loadingGestiones = false;
  @Output() recordsChange = new EventEmitter<TimeRecord[]>();
  @Output() clienteChange = new EventEmitter<string>();
  @Output() gestionChange = new EventEmitter<string>();

  private readonly storageKey = 'pmo_manual_time_draft';
  draft: ManualDraft = this.loadDraft();

  ngOnInit(): void {
    this.emitRecords(false);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultCliente'] && this.defaultCliente && !this.draft.cliente) {
      this.draft.cliente = this.defaultCliente;
      this.persistDraft();
      this.emitRecords(false);
    }
    if (changes['defaultGestionId'] && this.defaultGestionId && !this.draft.gestionId) {
      this.onGestionChange(this.defaultGestionId, false);
    }
  }

  onClienteChange(cliente: string): void {
    this.draft.cliente = cliente;
    this.draft.gestionId = '';
    this.draft.solicitud = '';
    this.persistDraft();
    this.clienteChange.emit(cliente);
    this.emitRecords();
  }

  onGestionChange(gestionId: string, notify = true): void {
    const option = this.defaultSolicitudOptions.find((item) => item.id === gestionId);
    this.draft.gestionId = gestionId;
    this.draft.solicitud = option?.requestValue || option?.name || gestionId;
    this.persistDraft();
    if (notify) this.gestionChange.emit(gestionId);
    this.emitRecords();
  }

  addRow(): void {
    const suggestedTimes = this.suggestedTimesForNewRow();
    this.draft.rows.push({
      horaIni: suggestedTimes.horaIni,
      horaFin: suggestedTimes.horaFin,
      desc: '',
      observacion: '',
    });
    this.persistDraft();
    this.emitRecords();
  }

  removeRow(index: number): void {
    this.draft.rows.splice(index, 1);
    if (!this.draft.rows.length) this.addRow();
    this.persistDraft();
    this.emitRecords();
  }

  onDraftChange(): void {
    this.persistDraft();
    this.emitRecords();
  }

  clear(): void {
    this.draft = this.emptyDraft();
    this.persistDraft();
    this.recordsChange.emit([]);
  }

  clienteOptions(): UiSelectOption[] {
    return [
      { value: '', label: 'Seleccione un cliente' },
      ...this.clientes.map((cliente) => ({ value: cliente, label: cliente })),
    ];
  }

  gestionOptions(): UiSelectOption[] {
    return [
      { value: '', label: 'Seleccione una gestión' },
      ...this.defaultSolicitudOptions.map((item) => ({ value: item.id, label: item.name })),
    ];
  }

  calcHoras(start: string, end: string): string {
    const diff = Math.max(0, this.diffMinutes(start, end));
    return String(Number((diff / 60).toFixed(2)));
  }

  rowErrors(row: ManualDraftRow): string[] {
    if (!this.rowHasInput(row)) return [];
    const errors: string[] = [];
    if (!this.draft.fecha) errors.push('Selecciona una fecha.');
    if (!this.draft.cliente) errors.push('Selecciona un cliente.');
    if (!this.draft.gestionId) errors.push('Selecciona una gestión.');
    if (!this.draft.tipoHora) errors.push('Selecciona tipo de hora.');
    if (!row.horaIni) errors.push('Indica hora inicio.');
    if (!row.horaFin) errors.push('Indica hora fin.');
    if (row.horaIni && row.horaFin && this.diffMinutes(row.horaIni, row.horaFin) <= 0) {
      errors.push('La hora fin debe ser mayor a la hora inicio.');
    }
    if (!row.desc.trim()) errors.push('Agrega la descripción.');
    return errors;
  }

  private loadDraft(): ManualDraft {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<ManualDraft>;
        return {
          ...this.emptyDraft(),
          ...parsed,
          rows: parsed.rows?.length ? parsed.rows : this.emptyDraft().rows,
        };
      }
    } catch {
      localStorage.removeItem(this.storageKey);
    }
    return this.emptyDraft();
  }

  private persistDraft(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.draft));
  }

  private emitRecords(allowEmpty = true): void {
    const records = this.toRecords();
    if (records.length || allowEmpty) this.recordsChange.emit(records);
  }

  private toRecords(): TimeRecord[] {
    return this.draft.rows
      .filter((row) => this.canCreateRecord(row))
      .map((row) => {
        const description = row.desc.trim();
        return {
          fecha: this.draft.fecha,
          horaIni: row.horaIni,
          horaFin: row.horaFin,
          horas: this.calcHoras(row.horaIni, row.horaFin),
          desc: description,
          observacion: row.observacion.trim() || description,
          cliente: this.draft.cliente,
          proyecto: '',
          solicitud: this.draft.solicitud,
          gestionId: this.draft.gestionId,
          tipoHora: this.draft.tipoHora || 'Laboral',
        } satisfies TimeRecord;
      });
  }

  private canCreateRecord(row: ManualDraftRow): boolean {
    return this.rowHasInput(row) && this.rowErrors(row).length === 0;
  }

  private rowHasInput(row: ManualDraftRow): boolean {
    return !!(
      row.desc.trim() ||
      row.observacion.trim() ||
      (row.horaIni && row.horaFin && this.diffMinutes(row.horaIni, row.horaFin) <= 0)
    );
  }

  private diffMinutes(start: string, end: string): number {
    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return 0;
    return endHour * 60 + endMinute - (startHour * 60 + startMinute);
  }

  private emptyDraft(): ManualDraft {
    return {
      fecha: this.todayInputValue(),
      cliente: this.defaultCliente,
      gestionId: this.defaultGestionId,
      solicitud:
        this.defaultSolicitudOptions.find((item) => item.id === this.defaultGestionId)
          ?.requestValue || '',
      tipoHora: this.tipoHoraOptions[0]?.value || 'Laboral',
      rows: [{ horaIni: '07:30', horaFin: '09:00', desc: '', observacion: '' }],
    };
  }

  private todayInputValue(): string {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private suggestedTimesForNewRow(): Pick<ManualDraftRow, 'horaIni' | 'horaFin'> {
    const lastEnd = this.draft.rows.at(-1)?.horaFin;
    const suggestedStart = this.isTimeValue(lastEnd) ? lastEnd : '08:00';
    const currentTime = this.currentTimeInputValue();
    const suggestedEnd =
      this.diffMinutes(suggestedStart, currentTime) > 0
        ? currentTime
        : this.nextHour(suggestedStart);
    return {
      horaIni: suggestedStart,
      horaFin: suggestedEnd,
    };
  }

  private currentTimeInputValue(): string {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  private isTimeValue(value: string | undefined): value is string {
    return /^\d{2}:\d{2}$/.test(value || '');
  }

  private nextHour(value: string): string {
    const [hour, minute] = value.split(':').map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return '09:00';
    const date = new Date(2000, 0, 1, hour, minute);
    date.setHours(date.getHours() + 1);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
}
