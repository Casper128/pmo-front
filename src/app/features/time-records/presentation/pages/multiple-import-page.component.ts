import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimeRecord, DayGroup } from '../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../domain/services/time-record-domain.service';
import { SendAllRecordsUseCase } from '../../application/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '../../application/use-cases/load-select-options.use-case';
import { ImportTextInputComponent } from '../components/import-text-input/import-text-input.component';
import { RecordsPreviewComponent } from '../components/records-preview/records-preview.component';
import { EditRecordModalComponent } from '../components/edit-record-modal/edit-record-modal.component';
import { WeeklyHoursChartComponent } from '../components/weekly-hours-chart/weekly-hours-chart.component';
import { AuthService } from '../../../../core/auth/auth.service';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

interface ManagementReport {
  identificador?: string;
  tipoHora?: string;
  tipoActividad?: string;
  causa?: string;
  descripcionActividad?: string;
  fechaInicio?: string;
  categoria?: string;
  modulo?: string;
  observacion?: string;
  tecnologia?: string;
  funcional?: string;
  tiempoRealHoras?: string | number;
  HoraInicio?: string;
  HoraFin?: string;
  solicitud?: string;
  solicitud_tiemposConsultores?: {
    nombreGestion?: string;
    tipoSolicitud?: string;
    prioridad?: string;
    solicitud_cliente?: {
      nombre?: string;
    };
  };
}

interface DailyHours {
  date: string;
  label: string;
  shortLabel: string;
  hours: number;
  count: number;
}

@Component({
  selector: 'app-multiple-import-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ImportTextInputComponent,
    RecordsPreviewComponent,
    EditRecordModalComponent,
    WeeklyHoursChartComponent,
  ],
  templateUrl: './multiple-import-page.component.html',
})
export class MultipleImportPageComponent implements OnInit {
  private domain = inject(TimeRecordDomainService);
  private sendAll = inject(SendAllRecordsUseCase);
  private options = inject(LoadSelectOptionsUseCase);
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  currentView = signal<'import' | 'download' | 'management'>('import');
  records = signal<TimeRecord[]>([]);
  groups = signal<DayGroup[]>([]);
  totalGeneral = signal(0);

  sending = signal(false);
  showPreview = signal(false);

  // Alert message
  alert = signal<{ text: string; type: 'success' | 'error' } | null>(null);

  // Edit modal
  editingIndex = signal<number | null>(null);
  editingRecord = signal<TimeRecord | null>(null);
  modalVisible = signal(false);

  clientes = signal<string[]>([]);
  proyectos = signal<string[]>([]);
  solicitudes = signal<string[]>([]);
  defaultCliente = signal('');
  defaultProyecto = signal('');
  defaultSolicitud = signal('');
  loadingDemand = signal(false);

  reportCliente = '';
  reportFechaIni = '';
  reportFechaFin = '';
  downloadingReport = signal(false);
  reportResult = signal<{ type: 'success' | 'empty'; title: string; detail: string } | null>(null);

  managementReports = signal<ManagementReport[]>([]);
  managementLoading = signal(false);
  managementLoaded = signal(false);
  managementError = signal('');
  managementFechaIni = signal('');
  managementFechaFin = signal('');
  managementSearch = '';

  managementDateError = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (start && !this.domain.isValidDateValue(start)) return 'La fecha inicio no es valida';
    if (end && !this.domain.isValidDateValue(end)) return 'La fecha fin no es valida';
    if (start && end && start > end) return 'La fecha inicio no puede ser mayor a la fecha fin';
    return '';
  });

  dateFilteredManagementReports = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (this.managementDateError()) return [];

    return this.managementReports().filter(report => {
      const date = report.fechaInicio || '';
      if (!date) return false;
      if (start && date < start) return false;
      if (end && date > end) return false;
      return true;
    });
  });

  filteredManagementReports = computed(() => {
    const term = this.normalizeText(this.managementSearch);
    const rows = [...this.dateFilteredManagementReports()].sort((a, b) =>
      `${b.fechaInicio || ''} ${b.HoraInicio || ''}`.localeCompare(`${a.fechaInicio || ''} ${a.HoraInicio || ''}`)
    );
    if (!term) return rows;

    return rows.filter(report =>
      [
        report.identificador,
        report.descripcionActividad,
        report.solicitud,
        report.funcional,
        report.tecnologia,
        report.modulo,
        this.clientName(report),
      ]
        .some(value => this.normalizeText(value).includes(term))
    );
  });

  managementTotalHours = computed(() =>
    this.dateFilteredManagementReports().reduce((sum, report) => sum + this.reportHours(report), 0)
  );

  managementWeekChart = computed<DailyHours[]>(() => {
    const rows = this.dateFilteredManagementReports();
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();

    if (!start || !end) {
      const latestDate = rows
        .map(report => report.fechaInicio)
        .filter((date): date is string => !!date)
        .sort()
        .at(-1);
      const base = latestDate ? this.parseLocalDate(latestDate) : new Date();
      const monday = this.startOfWeek(base);
      return this.buildDailyHours(rows, monday, 7);
    }

    const startDate = this.parseLocalDate(start);
    const endDate = this.parseLocalDate(end);
    const days = Math.max(1, this.daysBetween(startDate, endDate) + 1);
    return this.buildDailyHours(rows, startDate, Math.min(days, 31));
  });

  managementRangeLabel = computed(() => {
    const start = this.managementFechaIni();
    const end = this.managementFechaFin();
    if (!start && !end) return 'Sin rango aplicado';
    if (start && end) return `${this.formatFullDate(start)} - ${this.formatFullDate(end)}`;
    return start ? `Desde ${this.formatFullDate(start)}` : `Hasta ${this.formatFullDate(end)}`;
  });

  managementReportCount = computed(() => this.dateFilteredManagementReports().length);

  private buildDailyHours(rows: ManagementReport[], startDate: Date, days: number): DailyHours[] {
    return Array.from({ length: days }, (_, index) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
      const date = this.toDateInputValue(day);
      const dayRows = rows.filter(report => report.fechaInicio === date);
      return {
        date,
        label: this.formatFullDate(date),
        shortLabel: this.formatShortDate(date),
        hours: dayRows.reduce((sum, report) => sum + this.reportHours(report), 0),
        count: dayRows.length,
      };
    });
  }

  managementWeekTotal = computed(() =>
    this.managementWeekChart().reduce((sum, day) => sum + day.hours, 0)
  );

  managementMaxDayHours = computed(() =>
    Math.max(1, ...this.managementWeekChart().map(day => day.hours))
  );

  ngOnInit(): void {
    this.loadDefaultSelection();
  }

  onProcess(rawText: string) {
    const importErrors = this.domain.validateImportText(rawText);
    if (importErrors.length > 0) {
      const detail = importErrors.slice(0, 4).join('; ');
      const suffix = importErrors.length > 4 ? `; y ${importErrors.length - 4} mas` : '';
      this.showAlert(`Corrige el formato antes de procesar: ${detail}${suffix}`, 'error');
      return;
    }

    const parsed = this.domain.parseText(rawText).map(record => this.applyDefaults(record));
    if (parsed.length === 0) {
      this.showAlert('No se encontraron registros válidos. Verifica el formato.', 'error');
      return;
    }
    this.records.set(parsed);
    this.refreshGroups();
    this.syncReportDatesFromRecords(parsed);
    this.showPreview.set(true);
    this.showAlert(`✓ Se encontraron ${parsed.length} registros`, 'success');
  }

  refreshGroups() {
    const recs = this.records();
    this.groups.set(this.domain.groupByDate(recs));
    this.totalGeneral.set(recs.reduce((s, r) => s + parseFloat(r.horas || '0'), 0));
  }

  onEdit(index: number) {
    this.editingIndex.set(index);
    this.editingRecord.set({ ...this.records()[index] });
    this.modalVisible.set(true);
  }

  onSaveEdit(updated: TimeRecord) {
    const recs = [...this.records()];
    const idx = this.editingIndex()!;
    // recalc horas
    updated.horas = this.domain.calcHoras(updated.horaIni, updated.horaFin);
    const errors = [...this.domain.getMissingFields(updated), ...this.domain.getInvalidFields(updated)];
    if (errors.length > 0) {
      this.showAlert(`No se puede guardar el registro: ${errors.join(', ')}`, 'error');
      return;
    }
    recs[idx] = updated;
    this.records.set(recs);
    this.refreshGroups();
    this.modalVisible.set(false);
    this.showAlert('✓ Registro actualizado', 'success');
  }

  onUpdateRecord(index: number, updated: TimeRecord) {
    const recs = [...this.records()];
    recs[index] = {
      ...updated,
      fechaEstimada: updated.fechaEstimada || updated.fecha,
      fechaReal: updated.fechaReal || updated.fecha,
    };
    this.records.set(recs);
    this.refreshGroups();
  }

  onDelete(index: number) {
    const recs = this.records().filter((_, i) => i !== index);
    this.records.set(recs);
    if (recs.length === 0) {
      this.showPreview.set(false);
      this.showAlert('No hay registros', 'error');
    } else {
      this.refreshGroups();
    }
  }

  onSendAll() {
    const invalidos = this.records()
      .map((reg, idx) => ({
        idx,
        errors: [...this.domain.getMissingFields(reg), ...this.domain.getInvalidFields(reg)],
      }))
      .filter(item => item.errors.length > 0);

    if (invalidos.length) {
      const ejemplos = invalidos
        .slice(0, 3)
        .map(item => `#${item.idx + 1} (${item.errors.join(', ')})`)
        .join('; ');
      this.showAlert(
        `Corrige ${invalidos.length} registros con datos invalidos antes de enviar. Ejemplos: ${ejemplos}`,
        'error'
      );
      return;
    }

    this.sending.set(true);
    this.sendAll.execute(this.records()).subscribe({
      next: ({ enviados, errores }) => {
        this.sending.set(false);
        if (errores === 0) {
          this.showAlert(`✓ ${enviados} registros enviados correctamente`, 'success');
          this.records.set([]);
          this.showPreview.set(false);
        } else {
          this.showAlert(`✓ ${enviados} enviados, ${errores} con error`, 'error');
        }
      },
      error: () => {
        this.sending.set(false);
        this.showAlert('Error al enviar registros', 'error');
      },
    });
  }

  onCancelImport() {
    this.records.set([]);
    this.groups.set([]);
    this.totalGeneral.set(0);
    this.showPreview.set(false);
    this.alert.set(null);
  }

  onDefaultClienteChange(cliente: string) {
    this.defaultCliente.set(cliente);
    this.defaultProyecto.set('');
    this.defaultSolicitud.set('');
    this.proyectos.set([]);
    this.solicitudes.set([]);

    if (!cliente) return;

    this.loadingDemand.set(true);
    this.options.proyectos(cliente).subscribe(proyectos => {
      this.proyectos.set(proyectos);
      const proyecto = proyectos[0] ?? '';
      this.defaultProyecto.set(proyecto);
      this.loadSolicitudes(cliente, proyecto);
    });
  }

  onDefaultProyectoChange(proyecto: string) {
    this.defaultProyecto.set(proyecto);
    this.defaultSolicitud.set('');
    this.solicitudes.set([]);
    this.loadSolicitudes(this.defaultCliente(), proyecto);
  }

  onDefaultSolicitudChange(solicitud: string) {
    this.defaultSolicitud.set(solicitud);
  }

  onReportFechaIniChange(value: string) {
    this.reportFechaIni = value;
    if (!this.reportFechaFin) this.reportFechaFin = value;
  }

  onReportFechaFinChange(value: string) {
    this.reportFechaFin = value;
    if (!this.reportFechaIni) this.reportFechaIni = value;
  }

  setView(view: 'import' | 'download' | 'management') {
    this.currentView.set(view);
    if (view === 'management' && !this.managementLoaded() && !this.managementLoading()) {
      this.loadManagementReports();
    }
  }

  loadManagementReports() {
    this.managementLoading.set(true);
    this.managementError.set('');
    this.http
      .post<any>(`${BASE}/tiemposConsultores/gestion`, {}, {
        headers: { Authorization: `Bearer ${this.auth.token}` },
      })
      .subscribe({
        next: response => {
          const rows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
          this.managementReports.set(rows);
          this.syncManagementDatesFromReports(rows);
          this.managementLoaded.set(true);
          this.managementLoading.set(false);
        },
        error: error => {
          this.managementLoading.set(false);
          this.managementError.set(error?.message || 'No se pudieron cargar los reportes de tiempos');
        },
      });
  }

  onManagementSearchChange(value: string) {
    this.managementSearch = value;
    this.managementReports.update(rows => [...rows]);
  }

  onManagementFechaIniChange(value: string) {
    this.managementFechaIni.set(value);
  }

  onManagementFechaFinChange(value: string) {
    this.managementFechaFin.set(value);
  }

  clearManagementFilters() {
    this.managementFechaIni.set('');
    this.managementFechaFin.set('');
    this.onManagementSearchChange('');
  }

  downloadReport() {
    this.alert.set(null);
    this.reportResult.set(null);
    if (!this.reportFechaIni || !this.reportFechaFin) {
      this.showAlert('Selecciona fecha inicio y fecha fin', 'error');
      return;
    }
    if (!this.domain.isValidDateValue(this.reportFechaIni) || !this.domain.isValidDateValue(this.reportFechaFin)) {
      this.showAlert('Revisa las fechas del reporte. Usa fechas reales en formato valido.', 'error');
      return;
    }
    if (this.reportFechaIni > this.reportFechaFin) {
      this.showAlert('La fecha inicio no puede ser mayor a la fecha fin', 'error');
      return;
    }

    const numericCliente = Number(this.reportCliente);
    const body = {
      fechaInicio: `${this.reportFechaIni}T05:00:00.000Z`,
      fechaFin: `${this.reportFechaFin}T05:00:00.000Z`,
      cliente: this.reportCliente ? (Number.isNaN(numericCliente) ? this.reportCliente : numericCliente) : null,
      idConsultor: null,
      proyecto: null,
      solicitud: null,
    };

    this.downloadingReport.set(true);
    this.http
      .post<any>(`${BASE}/tiemposConsultores/filtroDownload`, body, {
        headers: { Authorization: `Bearer ${this.auth.token}` },
      })
      .subscribe({
        next: data => {
          this.downloadingReport.set(false);
          if (data?.excel) {
            this.saveExcel(data.excel, `reporte_tiempos_${this.reportFechaIni}_${this.reportFechaFin}.xlsx`);
            this.reportResult.set({
              type: 'success',
              title: 'Reporte descargado',
              detail: `reporte_tiempos_${this.reportFechaIni}_${this.reportFechaFin}.xlsx`,
            });
            this.showAlert('✓ Reporte descargado correctamente', 'success');
            return;
          }
          this.reportResult.set({
            type: 'empty',
            title: 'Sin datos',
            detail: data?.mensaje || 'No hay registros para los filtros seleccionados.',
          });
        },
        error: error => {
          this.downloadingReport.set(false);
          this.showAlert(`Error al descargar el reporte: ${error?.message || 'intenta nuevamente'}`, 'error');
        },
      });
  }

  clearReport() {
    this.reportCliente = '';
    this.reportFechaIni = '';
    this.reportFechaFin = '';
    this.reportResult.set(null);
    this.alert.set(null);
  }

  reportHours(report: ManagementReport): number {
    const value = Number(report.tiempoRealHoras || 0);
    return Number.isFinite(value) ? value : 0;
  }

  clientName(report: ManagementReport): string {
    return report.solicitud_tiemposConsultores?.solicitud_cliente?.nombre || 'Sin cliente';
  }

  managementName(report: ManagementReport): string {
    return report.solicitud_tiemposConsultores?.nombreGestion || report.solicitud || report.identificador || 'Sin gestion';
  }

  formatHours(value: number): string {
    return value.toFixed(value % 1 === 0 ? 0 : 1);
  }

  formatFullDate(date: string): string {
    if (!date) return 'Sin fecha';
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    }).format(this.parseLocalDate(date));
  }

  formatShortDate(date: string): string {
    if (!date) return '--';
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'short',
      day: '2-digit',
    }).format(this.parseLocalDate(date));
  }

  showAlert(text: string, type: 'success' | 'error') {
    this.alert.set({ text, type });
    if (type !== 'error') setTimeout(() => this.alert.set(null), 5000);
  }

  private loadDefaultSelection() {
    this.options.clientes().subscribe(clientes => {
      this.clientes.set(clientes);
      const cliente = clientes[0] ?? '';
      if (!cliente) return;
      this.onDefaultClienteChange(cliente);
    });
  }

  private applyDefaults(record: TimeRecord): TimeRecord {
    return {
      ...record,
      cliente: record.cliente || this.defaultCliente(),
      proyecto: record.proyecto || this.defaultProyecto(),
      solicitud: record.solicitud || this.defaultSolicitud(),
      fechaEstimada: record.fechaEstimada || record.fecha,
      fechaReal: record.fechaReal || record.fecha,
    };
  }

  private loadSolicitudes(cliente: string, proyecto: string) {
    if (!cliente) {
      this.solicitudes.set([]);
      this.loadingDemand.set(false);
      return;
    }

    this.options.solicitudes(cliente, proyecto).subscribe(solicitudes => {
      this.solicitudes.set(solicitudes);
      this.defaultSolicitud.set(solicitudes[0] ?? '');
      this.loadingDemand.set(false);
    });
  }

  private syncReportDatesFromRecords(records: TimeRecord[]) {
    const fechas = records.map(record => record.fecha).filter(Boolean).sort();
    if (!fechas.length) return;
    this.reportFechaIni = fechas[0];
    this.reportFechaFin = fechas[fechas.length - 1];
  }

  private syncManagementDatesFromReports(reports: ManagementReport[]) {
    if (this.managementFechaIni() || this.managementFechaFin()) return;
    const latestDate = reports
      .map(report => report.fechaInicio)
      .filter((date): date is string => !!date)
      .sort()
      .at(-1);
    if (!latestDate) return;

    const monday = this.startOfWeek(this.parseLocalDate(latestDate));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    this.managementFechaIni.set(this.toDateInputValue(monday));
    this.managementFechaFin.set(this.toDateInputValue(sunday));
  }

  private saveExcel(base64: string, filename: string) {
    const byteChars = atob(base64);
    const byteNums = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNums)], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private normalizeText(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private parseLocalDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  private startOfWeek(date: Date): Date {
    const result = new Date(date);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - day + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private daysBetween(start: Date, end: Date): number {
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.round((end.getTime() - start.getTime()) / msPerDay);
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
