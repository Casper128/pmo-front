import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord } from '@domain/time-records/models/time-record.model';
import { TimeRecordDomainService } from '@domain/time-records/services/time-record-domain.service';
import { LoadSelectOptionsUseCase } from '@application/time-records/use-cases/load-select-options.use-case';
import { ManagementDemandOption } from '@domain/time-records/models/management-template.model';
import { UiFieldComponent } from '@presentation/shared/components/ui-field/ui-field.component';
import {
  UiSelectComponent,
  UiSelectOption,
} from '@presentation/shared/components/ui-select/ui-select.component';

interface TextDraftRow {
  id: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  horas: string;
  desc: string;
  observacion: string;
  cliente: string;
  proyecto: string;
  gestionId: string;
  solicitud: string;
  tipoHora: string;
  gestionOptions: ManagementDemandOption[];
  loadingGestiones: boolean;
}

interface StoredTextDraft {
  rawText: string;
  rows: Partial<TextDraftRow>[];
}

@Component({
  selector: 'app-import-text-input',
  standalone: true,
  imports: [CommonModule, FormsModule, UiFieldComponent, UiSelectComponent],
  templateUrl: './import-text-input.component.html',
})
export class ImportTextInputComponent implements OnChanges, OnInit {
  @Input() clientes: string[] = [];
  @Input() tipoHoraOptions: UiSelectOption[] = [];
  @Input() defaultSolicitudOptions: ManagementDemandOption[] = [];
  @Input() defaultCliente = '';
  @Input() defaultGestionId = '';
  @Input() existingRecords: TimeRecord[] = [];
  @Input() loadingClientes = false;
  @Input() loadingGestiones = false;
  @Output() recordsChange = new EventEmitter<TimeRecord[]>();
  @Output() clienteChange = new EventEmitter<string>();
  @Output() gestionChange = new EventEmitter<string>();

  private readonly domain = inject(TimeRecordDomainService);
  private readonly options = inject(LoadSelectOptionsUseCase);
  private readonly storageKey = 'pmo_text_time_draft';
  private readonly lastGestionStorageKey = 'pmo_last_management_by_client';

  rawText = '';
  rows: TextDraftRow[] = [];
  draftMessage = '';
  parseErrors: string[] = [];

  ngOnInit(): void {
    this.restoreDraft();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['defaultSolicitudOptions'] && this.defaultSolicitudOptions.length) {
      this.rows
        .filter((row) => row.cliente === this.defaultCliente && !row.gestionOptions.length)
        .forEach((row) => {
          row.gestionOptions = this.defaultSolicitudOptions;
          if (!row.gestionId) this.selectPreferredGestion(row);
        });
      this.persistDraft();
    }
    if (changes['tipoHoraOptions'] && this.tipoHoraOptions.length) {
      this.rows
        .filter((row) => !row.tipoHora)
        .forEach((row) => {
          row.tipoHora = this.firstTipoHora();
        });
      this.persistDraft();
    }
  }

  processText(): void {
    this.parseErrors = this.domain.validateImportText(this.rawText);
    this.draftMessage = '';
    if (this.parseErrors.length) {
      this.rows = [];
      this.persistDraft();
      return;
    }

    const parsed = this.domain.parseText(this.rawText);
    if (!parsed.length) {
      this.parseErrors = ['No se encontraron registros validos para convertir en borrador.'];
      this.rows = [];
      this.persistDraft();
      return;
    }

    this.rows = parsed.map((record) => this.createRow(record));
    this.rows.forEach((row) => this.loadGestionesForRow(row, false));
    this.draftMessage = `${parsed.length} linea(s) lista(s) para completar.`;
    this.persistDraft();
  }

  onRawTextChange(): void {
    this.parseErrors = [];
    this.draftMessage = '';
    this.persistDraft();
  }

  onRowClienteChange(row: TextDraftRow, cliente: string): void {
    row.cliente = cliente;
    row.proyecto = '';
    row.gestionId = '';
    row.solicitud = '';
    row.gestionOptions = [];
    this.draftMessage = '';
    this.persistDraft();
    this.clienteChange.emit(cliente);
    this.loadGestionesForRow(row, true);
  }

  onRowGestionChange(row: TextDraftRow, gestionId: string): void {
    const option = row.gestionOptions.find((item) => item.id === gestionId);
    row.gestionId = gestionId;
    row.solicitud = option?.requestValue || option?.name || gestionId;
    row.proyecto = option?.project || row.proyecto;
    this.draftMessage = '';
    this.persistDraft();
    this.rememberGestion(row.cliente, gestionId);
    this.gestionChange.emit(gestionId);
  }

  onRowChange(): void {
    this.draftMessage = '';
    this.persistDraft();
  }

  removeRow(index: number): void {
    this.rows.splice(index, 1);
    this.draftMessage = '';
    this.persistDraft();
  }

  createDraftList(): void {
    const errors = this.rows.flatMap((row, index) =>
      this.baseRowErrors(row).map((error) => `Linea ${index + 1}: ${error}`),
    );
    if (!this.rows.length) errors.push('Pega y procesa al menos una actividad.');
    if (errors.length) {
      this.parseErrors = errors;
      this.draftMessage = '';
      return;
    }

    const records = [...this.existingRecords, ...this.rows.map((row) => this.toRecord(row))];
    this.recordsChange.emit(records);
    this.rows = [];
    this.rawText = '';
    this.parseErrors = [];
    this.draftMessage = 'Borrador agregado a la vista previa.';
    this.persistDraft();
  }

  clear(): void {
    this.rawText = '';
    this.rows = [];
    this.parseErrors = [];
    this.draftMessage = '';
    this.persistDraft();
    this.recordsChange.emit([]);
  }

  clienteOptions(currentValue = ''): UiSelectOption[] {
    const values = this.withCurrentValue(this.clientes, currentValue);
    return [
      { value: '', label: 'Seleccione un cliente' },
      ...values.map((cliente) => ({ value: cliente, label: cliente })),
    ];
  }

  gestionOptions(row: TextDraftRow): UiSelectOption[] {
    const values = row.gestionOptions.map((item) => ({
      value: item.id,
      label: item.name,
    }));
    if (row.gestionId && !values.some((option) => option.value === row.gestionId)) {
      values.unshift({ value: row.gestionId, label: row.solicitud || row.gestionId });
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

  rowErrors(row: TextDraftRow): string[] {
    return [...this.baseRowErrors(row), ...this.selectRowErrors(row)];
  }

  private baseRowErrors(row: TextDraftRow): string[] {
    const errors: string[] = [];
    if (!row.fecha) errors.push('fecha pendiente');
    if (!row.horaIni) errors.push('hora inicio pendiente');
    if (!row.horaFin) errors.push('hora fin pendiente');
    if (!row.horas || Number(row.horas) <= 0) errors.push('horas invalidas');
    if (!row.desc.trim()) errors.push('descripcion pendiente');
    return errors;
  }

  private selectRowErrors(row: TextDraftRow): string[] {
    const errors: string[] = [];
    if (!row.cliente) errors.push('cliente pendiente');
    if (!row.gestionId) errors.push('gestion pendiente');
    if (!row.tipoHora) errors.push('tipo de hora pendiente');
    return errors;
  }

  private restoreDraft(): void {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<StoredTextDraft>;
      this.rawText = parsed.rawText || '';
      this.rows = Array.isArray(parsed.rows) ? parsed.rows.map((row) => this.createRow(row)) : [];
      this.rows.forEach((row) => this.loadGestionesForRow(row, false));
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  private persistDraft(): void {
    const rows = this.rows.map(({ gestionOptions, loadingGestiones, ...row }) => row);
    if (!this.rawText.trim() && !rows.length) {
      localStorage.removeItem(this.storageKey);
      return;
    }
    localStorage.setItem(this.storageKey, JSON.stringify({ rawText: this.rawText, rows }));
  }

  private createRow(record: Partial<TimeRecord & TextDraftRow>): TextDraftRow {
    const gestionOptions =
      record.cliente === this.defaultCliente && this.defaultSolicitudOptions.length
        ? this.defaultSolicitudOptions
        : [];
    const gestionId = record.gestionId || '';
    const option = gestionOptions.find((item) => item.id === gestionId);
    return {
      id: record.id || this.rowId(),
      fecha: record.fecha || '',
      horaIni: record.horaIni || '',
      horaFin: record.horaFin || '',
      horas: record.horas || this.domain.calcHoras(record.horaIni || '', record.horaFin || ''),
      desc: record.desc || '',
      observacion: record.observacion || record.desc || '',
      cliente: record.cliente || '',
      proyecto: record.proyecto || option?.project || '',
      gestionId,
      solicitud: record.solicitud || option?.requestValue || option?.name || '',
      tipoHora: record.tipoHora || '',
      gestionOptions,
      loadingGestiones: false,
    };
  }

  private loadGestionesForRow(row: TextDraftRow, selectFirst: boolean): void {
    if (!row.cliente) return;
    if (row.cliente === this.defaultCliente && this.defaultSolicitudOptions.length) {
      row.gestionOptions = this.defaultSolicitudOptions;
      if (selectFirst || !row.gestionId) this.selectPreferredGestion(row);
      this.persistDraft();
      return;
    }

    row.loadingGestiones = true;
    this.options.proyectos(row.cliente).subscribe({
      next: (proyectos) => {
        const proyecto = row.proyecto || proyectos[0] || '';
        row.proyecto = proyecto;
        this.options.solicitudOptions(row.cliente, proyecto).subscribe({
          next: (solicitudes) => {
            row.gestionOptions = solicitudes.map((solicitud) => ({
              ...solicitud,
              client: solicitud.client || row.cliente,
              project: solicitud.project || proyecto,
            }));
            row.loadingGestiones = false;
            if (selectFirst || !row.gestionId) this.selectPreferredGestion(row);
            this.persistDraft();
          },
          error: () => {
            row.loadingGestiones = false;
            this.persistDraft();
          },
        });
      },
      error: () => {
        row.loadingGestiones = false;
        this.persistDraft();
      },
    });
  }

  private toRecord(row: TextDraftRow): TimeRecord {
    const description = row.desc.trim();
    return {
      fecha: row.fecha,
      horaIni: row.horaIni,
      horaFin: row.horaFin,
      horas: row.horas,
      desc: description,
      observacion: row.observacion.trim() || description,
      cliente: row.cliente,
      proyecto: row.proyecto,
      solicitud: row.solicitud,
      gestionId: row.gestionId,
      tipoHora: row.tipoHora,
    };
  }

  private firstTipoHora(): string {
    return this.tipoHoraOptions.find((option) => !option.disabled)?.value || '';
  }

  private selectPreferredGestion(row: TextDraftRow): void {
    if (!row.cliente || !row.gestionOptions.length) return;
    const remembered = this.rememberedGestion(row.cliente);
    const option =
      row.gestionOptions.find((item) => item.id === remembered) ||
      row.gestionOptions.find((item) => item.id === row.gestionId) ||
      row.gestionOptions[0];
    if (option) this.onRowGestionChange(row, option.id);
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

  private rowId(): string {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
