import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { map, switchMap } from 'rxjs';
import { TimeRecord, DayGroup } from '../../domain/models/time-record.model';
import { TimeRecordDomainService } from '../../domain/services/time-record-domain.service';
import { SendAllRecordsUseCase, SendRecordLog } from '../../application/use-cases/send-all-records.use-case';
import { LoadSelectOptionsUseCase } from '../../application/use-cases/load-select-options.use-case';
import { ImportTextInputComponent } from '../components/import-text-input/import-text-input.component';
import { RecordsPreviewComponent } from '../components/records-preview/records-preview.component';
import { EditRecordModalComponent } from '../components/edit-record-modal/edit-record-modal.component';
import { WeeklyHoursChartComponent } from '../components/weekly-hours-chart/weekly-hours-chart.component';
import { AuthService } from '../../../../core/auth/auth.service';

const BASE = 'https://wwz8sswbkh.execute-api.us-west-2.amazonaws.com/dev';

interface ManagementReport {
  idConsultor?: string | number;
  idUsuario?: string | number;
  consultor?: string;
  nombreConsultor?: string;
  usuario?: string;
  email?: string;
  correo?: string;
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
  fechaEstimadaPruebas?: string;
  fechaEstimadaRealPruebas?: string;
  solicitud?: string;
  solicitud_tiemposConsultores?: {
    nombreGestion?: string;
    tipoSolicitud?: string;
    prioridad?: string;
    solicitud_cliente?: {
      nombre?: string;
    };
  };
  usuario_tiemposConsultores?: {
    id?: string | number;
    nombre?: string;
    email?: string;
    correo?: string;
    usuario?: string;
  };
}

interface ManagementEditDraft {
  identificador: string;
  fecha: string;
  horaIni: string;
  horaFin: string;
  horas: string;
  tipoHora: string;
  fechaEstimada: string;
  fechaReal: string;
}

interface DailyHours {
  date: string;
  label: string;
  shortLabel: string;
  hours: number;
  count: number;
}

interface StoredSendLog extends SendRecordLog {
  createdAt: string;
  userEmail: string;
  weekStart: string;
  weekEnd: string;
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
  private readonly auditEmail = 'auditoria.sap@netwconsulting.com';
  private readonly auditPassword = 'Auditoriaa2023*+';

  currentView = signal<'import' | 'download' | 'management'>('import');
  records = signal<TimeRecord[]>([]);
  groups = signal<DayGroup[]>([]);
  totalGeneral = signal(0);

  sending = signal(false);
  showPreview = signal(false);
  sendTotal = signal(0);
  sendProcessed = signal(0);
  sendLogs = signal<SendRecordLog[]>([]);
  weeklySendLogs = signal<StoredSendLog[]>([]);
  latestSentId = signal('');

  sendProgressPercent = computed(() => {
    const total = this.sendTotal();
    if (!total) return 0;
    return Math.round((this.sendProcessed() / total) * 100);
  });

  weeklyErrorLogs = computed(() => this.weeklySendLogs().filter(log => !log.ok));

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
  managementEditVisible = signal(false);
  managementEditSaving = signal(false);
  managementEditDraft = signal<ManagementEditDraft | null>(null);
  managementEditOriginal = signal<ManagementReport | null>(null);
  managementEditErrors = signal<string[]>([]);

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
      if (!this.isCurrentUserReport(report)) return false;
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
    this.loadWeeklySendLogs();
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
    this.resetSendTracking();
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
    if (this.domain.isLaborHour(updated.tipoHora) && Number(updated.horas || 0) > this.domain.getMaxDailyLaborHours()) {
      errors.push(`Un registro laboral no puede superar ${this.domain.getMaxDailyLaborHours()} horas`);
    }
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

    const registrosExcedidos = this.domain.getLaborRecordsHoursExceeded(this.records());
    if (registrosExcedidos.length) {
      const ejemplos = registrosExcedidos
        .slice(0, 3)
        .map(item => `#${item.index + 1} ${this.formatFullDate(item.fecha)}: ${item.horas.toFixed(1)}h/${item.limiteHoras}h`)
        .join('; ');
      const suffix = registrosExcedidos.length > 3 ? `; y ${registrosExcedidos.length - 3} registro(s) mas` : '';
      this.showAlert(
        `No se pueden enviar registros laborales de mas de ${this.domain.getMaxDailyLaborHours()} horas. Ajusta: ${ejemplos}${suffix}`,
        'error'
      );
      return;
    }

    const diasExcedidos = this.domain.getDailyLaborHoursExceeded(this.records());
    if (diasExcedidos.length) {
      const ejemplos = diasExcedidos
        .slice(0, 3)
        .map(item => `${this.formatFullDate(item.fecha)}: ${item.totalHoras.toFixed(1)}h/${item.limiteHoras}h ${item.tipoHora}`)
        .join('; ');
      const suffix = diasExcedidos.length > 3 ? `; y ${diasExcedidos.length - 3} dia(s) mas` : '';
      this.showAlert(
        `No se pueden enviar registros con mas de ${this.domain.getMaxDailyLaborHours()} horas laborales por dia. Ajusta: ${ejemplos}${suffix}`,
        'error'
      );
      return;
    }

    this.sending.set(true);
    this.sendTotal.set(this.records().length);
    this.sendProcessed.set(0);
    this.sendLogs.set([]);
    this.latestSentId.set('');
    this.sendAll.execute(this.records(), log => this.onSendProgress(log)).subscribe({
      next: ({ enviados, errores, enviadosIndices, logs }) => {
        this.sending.set(false);
        this.sendLogs.set(logs);
        this.logTemporarySendResponses(logs);
        if (errores === 0) {
          const ids = logs.map(log => log.identificador).filter(Boolean);
          const detail = ids.length ? ` IDs: ${ids.join(' | ')}` : '';
          this.showAlert(`OK ${enviados} registros enviados correctamente.${detail}`, 'success');
          this.records.set([]);
          this.showPreview.set(false);
        } else {
          this.records.set(this.records().filter((_, index) => !enviadosIndices.includes(index)));
          this.refreshGroups();
          this.showPreview.set(this.records().length > 0);
          this.showAlert(`${enviados} enviados. ${errores} quedaron pendientes para reintentar sin duplicar los exitosos.`, 'error');
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
    this.resetSendTracking();
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
    const userId = this.auth.user()?.id;
    const numericUserId = Number(userId);
    const body = {
      idConsultor: userId && !Number.isNaN(numericUserId) ? numericUserId : userId || null,
    };
    this.http
      .post<any>(`${BASE}/tiemposConsultores/gestion`, body, {
        headers: { Authorization: `Bearer ${this.auth.token}` },
      })
      .subscribe({
        next: response => {
          const rows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
          const ownRows = rows.filter((report: ManagementReport) => this.isCurrentUserReport(report));
          this.managementReports.set(ownRows);
          this.syncManagementDatesFromReports(ownRows);
          this.managementLoaded.set(true);
          this.managementLoading.set(false);
        },
        error: error => {
          this.managementLoading.set(false);
          if (error?.status === 401 || error?.status === 403) {
            this.auth.clearTokens();
            return;
          }
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

  openManagementEdit(report: ManagementReport) {
    const fecha = this.domain.normalizeDateValue(report.fechaInicio || '') || this.domain.normalizeDateValue(report.HoraInicio || '');
    const draft: ManagementEditDraft = {
      identificador: report.identificador || '',
      fecha,
      horaIni: this.extractTimeValue(report.HoraInicio || ''),
      horaFin: this.extractTimeValue(report.HoraFin || ''),
      horas: String(report.tiempoRealHoras || ''),
      tipoHora: report.tipoHora || 'Laboral',
      fechaEstimada: this.domain.normalizeDateValue(report.fechaEstimadaPruebas || ''),
      fechaReal: this.domain.normalizeDateValue(report.fechaEstimadaRealPruebas || ''),
    };

    if (!draft.horas && draft.horaIni && draft.horaFin) {
      draft.horas = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    }

    this.managementEditOriginal.set(report);
    this.managementEditDraft.set(draft);
    this.managementEditVisible.set(true);
    this.refreshManagementEditValidation();
  }

  closeManagementEdit() {
    if (this.managementEditSaving()) return;
    this.managementEditVisible.set(false);
    this.managementEditDraft.set(null);
    this.managementEditOriginal.set(null);
    this.managementEditErrors.set([]);
  }

  onManagementEditTimeChange() {
    const draft = this.managementEditDraft();
    if (!draft) return;
    const horas = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    this.managementEditDraft.set({ ...draft, horas: horas || draft.horas || '0' });
    this.refreshManagementEditValidation();
  }

  onManagementEditChange() {
    const draft = this.managementEditDraft();
    if (!draft) return;
    this.managementEditDraft.set({ ...draft });
    this.refreshManagementEditValidation();
  }

  saveManagementEdit() {
    this.refreshManagementEditValidation();
    const draft = this.managementEditDraft();
    if (!draft || this.managementEditErrors().length) return;

    this.managementEditSaving.set(true);
    this.loginAudit()
      .pipe(
        switchMap(token =>
          this.http.put<any>(
            `${BASE}/tiemposConsultores/tiempo/edit/${encodeURIComponent(draft.identificador)}`,
            this.buildManagementEditBody(draft),
            { headers: { Authorization: `Bearer ${token}` } }
          )
        )
      )
      .subscribe({
        next: () => {
          this.managementEditSaving.set(false);
          this.applyManagementEditLocally(draft);
          this.closeManagementEdit();
          this.showAlert('Reporte actualizado correctamente', 'success');
        },
        error: error => {
          this.managementEditSaving.set(false);
          this.showAlert(`No se pudo actualizar el reporte: ${error?.message || 'intenta nuevamente'}`, 'error');
        },
      });
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
          if (error?.status === 401 || error?.status === 403) {
            this.auth.clearTokens();
            return;
          }
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

  isCurrentUserReport(report: ManagementReport): boolean {
    const user = this.auth.user();
    if (!user) return false;

    const userIds = [user.id, this.valueFromRawUser('id'), this.valueFromRawUser('idUsuario'), this.valueFromRawUser('userId')]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => String(value).trim());
    const userTexts = [
      user.email,
      user.username,
      user.name,
      this.valueFromRawUser('correo'),
      this.valueFromRawUser('mail'),
      this.valueFromRawUser('usuario'),
      this.valueFromRawUser('nombre'),
      this.valueFromRawUser('nombreCompleto'),
    ]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => this.normalizeText(value));

    const reportIds = [
      report.idConsultor,
      report.idUsuario,
      report.usuario_tiemposConsultores?.id,
      this.valueFromObject(report, 'idConsultor'),
      this.valueFromObject(report, 'idUsuario'),
      this.valueFromObject(report, 'userId'),
    ]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => String(value).trim());

    if (reportIds.length && userIds.some(userId => reportIds.includes(userId))) return true;

    const reportTexts = [
      report.consultor,
      report.nombreConsultor,
      report.usuario,
      report.email,
      report.correo,
      report.funcional,
      report.usuario_tiemposConsultores?.nombre,
      report.usuario_tiemposConsultores?.email,
      report.usuario_tiemposConsultores?.correo,
      report.usuario_tiemposConsultores?.usuario,
      ...this.collectIdentityText(report),
    ]
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
      .map(value => this.normalizeText(value));

    if (!reportIds.length && !reportTexts.length) return true;

    return userTexts.some(userText =>
      reportTexts.some(reportText => reportText === userText || reportText.includes(userText) || userText.includes(reportText))
    );
  }

  managementDailyLaborHoursWithDraft(): number {
    const draft = this.managementEditDraft();
    if (!draft || !this.domain.isLaborHour(draft.tipoHora)) return 0;
    const original = this.managementEditOriginal();
    return this.managementReports().reduce((sum, report) => {
      if ((report.identificador || '') === (original?.identificador || '')) return sum;
      if (report.fechaInicio !== draft.fecha) return sum;
      if (!this.domain.isLaborHour(report.tipoHora || 'Laboral')) return sum;
      return sum + this.reportHours(report);
    }, Number(draft.horas || 0));
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

  copySendLog() {
    const text = this.sendLogs()
      .map(log => `${log.ok ? 'OK' : 'ERROR'} #${log.index + 1} ${log.identificador}${log.errorMessage ? ` - ${log.errorMessage}` : ''}`)
      .join('\n');
    if (!text) return;
    navigator.clipboard?.writeText(text);
    this.showAlert('Log temporal copiado al portapapeles', 'success');
  }

  copyWeeklySendLog() {
    const text = this.weeklySendLogs()
      .map(log => `${log.createdAt} ${log.ok ? 'OK' : 'ERROR'} #${log.index + 1} ${log.identificador}${log.errorMessage ? ` - ${log.errorMessage}` : ''}`)
      .join('\n');
    if (!text) return;
    navigator.clipboard?.writeText(text);
    this.showAlert('Log semanal copiado al portapapeles', 'success');
  }

  clearWeeklySendLog() {
    localStorage.removeItem(this.weeklySendLogKey());
    this.weeklySendLogs.set([]);
    this.showAlert('Log semanal limpiado', 'success');
  }

  private onSendProgress(log: SendRecordLog) {
    this.sendProcessed.update(value => value + 1);
    this.sendLogs.update(logs => [...logs, log]);
    this.persistWeeklySendLog(log);
    if (log.identificador) this.latestSentId.set(log.identificador);
    console.log('[PMO registro temporal]', log.identificador, log);
  }

  private logTemporarySendResponses(logs: SendRecordLog[]) {
    console.groupCollapsed('[PMO] Log temporal de registros enviados');
    console.table(logs.map(log => ({
      item: log.index + 1,
      estado: log.ok ? 'OK' : 'ERROR',
      identificador: log.identificador,
      error: log.errorMessage || '',
    })));
    console.log(logs);
    console.groupEnd();
  }

  private resetSendTracking() {
    this.sendTotal.set(0);
    this.sendProcessed.set(0);
    this.sendLogs.set([]);
    this.latestSentId.set('');
  }

  private persistWeeklySendLog(log: SendRecordLog) {
    const range = this.currentWeekRange();
    const stored: StoredSendLog = {
      ...log,
      createdAt: new Date().toISOString(),
      userEmail: this.auth.user()?.email || 'usuario',
      weekStart: range.start,
      weekEnd: range.end,
    };

    const logs = [...this.weeklySendLogs(), stored].slice(-300);
    this.weeklySendLogs.set(logs);
    localStorage.setItem(this.weeklySendLogKey(), JSON.stringify(logs));
  }

  private loadWeeklySendLogs() {
    try {
      const logs = JSON.parse(localStorage.getItem(this.weeklySendLogKey()) || '[]');
      this.weeklySendLogs.set(Array.isArray(logs) ? logs : []);
    } catch {
      this.weeklySendLogs.set([]);
    }
  }

  private weeklySendLogKey(): string {
    const user = this.normalizeText(this.auth.user()?.email || this.auth.user()?.id || 'usuario');
    return `pmo_send_logs_${user}_${this.currentWeekRange().start}`;
  }

  private currentWeekRange(): { start: string; end: string } {
    const monday = this.startOfWeek(new Date());
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: this.toDateInputValue(monday),
      end: this.toDateInputValue(sunday),
    };
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

  private refreshManagementEditValidation() {
    const draft = this.managementEditDraft();
    if (!draft) {
      this.managementEditErrors.set([]);
      return;
    }

    const errors: string[] = [];
    if (!draft.identificador) errors.push('Identificador requerido');
    if (!this.domain.isValidDateValue(draft.fecha)) errors.push('Fecha invalida');
    if (!this.domain.isValidTimeValue(draft.horaIni)) errors.push('Hora inicio invalida');
    if (!this.domain.isValidTimeValue(draft.horaFin)) errors.push('Hora fin invalida');
    if (draft.fechaEstimada && !this.domain.isValidDateValue(draft.fechaEstimada)) errors.push('Fecha estimada invalida');
    if (draft.fechaReal && !this.domain.isValidDateValue(draft.fechaReal)) errors.push('Fecha real invalida');

    const calculatedHours = this.domain.calcHoras(draft.horaIni, draft.horaFin);
    const hours = Number(draft.horas || calculatedHours || 0);
    if (!Number.isFinite(hours) || hours <= 0) errors.push('Horas debe ser mayor a 0');
    if (!calculatedHours) errors.push('Hora fin debe ser mayor a hora inicio');

    if (this.domain.isLaborHour(draft.tipoHora)) {
      const limit = this.domain.getMaxDailyLaborHours();
      if (hours > limit) errors.push(`Un registro laboral no puede superar ${limit} horas`);
      const dailyTotal = this.managementDailyLaborHoursWithDraft();
      if (dailyTotal > limit) errors.push(`El total laboral del dia queda en ${dailyTotal.toFixed(1)}h/${limit}h`);
    }

    this.managementEditErrors.set(errors);
  }

  private loginAudit() {
    return this.http
      .post<any>(`${BASE}/cuentas/authenticate`, {
        email: this.auditEmail,
        password: this.auditPassword,
      })
      .pipe(
        map(response => {
          const token = response?.token || response?.jwtToken || response?.key || response?.accessToken;
          if (!token) throw new Error(response?.mensaje || response?.message || 'No se pudo autenticar auditoria');
          return token as string;
        })
      );
  }

  private buildManagementEditBody(draft: ManagementEditDraft): object {
    const [y, mo, d] = draft.fecha.split('-');
    const [ih, im] = draft.horaIni.split(':');
    const [fh, fm] = draft.horaFin.split(':');

    return {
      HoraInicio: `${y}-${mo}-${d}T${ih}:${im}:00.000Z`,
      HoraFin: `${y}-${mo}-${d}T${fh}:${fm}:00.000Z`,
      tiempoRealHoras: draft.horas,
      fechaInicio: this.buildColombiaDateLabel(draft.fecha, '05:00'),
      fechaEstimadaPruebas: draft.fechaEstimada || null,
      fechaEstimadaRealPruebas: draft.fechaReal || null,
      tipoHora: draft.tipoHora || 'Laboral',
    };
  }

  private applyManagementEditLocally(draft: ManagementEditDraft) {
    this.managementReports.update(rows =>
      rows.map(report => {
        if ((report.identificador || '') !== draft.identificador) return report;
        return {
          ...report,
          fechaInicio: draft.fecha,
          HoraInicio: this.buildIsoDateTime(draft.fecha, draft.horaIni),
          HoraFin: this.buildIsoDateTime(draft.fecha, draft.horaFin),
          tiempoRealHoras: draft.horas,
          fechaEstimadaPruebas: draft.fechaEstimada,
          fechaEstimadaRealPruebas: draft.fechaReal,
          tipoHora: draft.tipoHora,
        };
      })
    );
  }

  private buildIsoDateTime(date: string, time: string): string {
    return `${date}T${time}:00.000Z`;
  }

  private extractTimeValue(value: string): string {
    if (!value) return '';
    const isoMatch = value.match(/T(\d{2}:\d{2})/);
    if (isoMatch) return isoMatch[1];
    const plainMatch = value.match(/^(\d{2}:\d{2})/);
    return plainMatch ? plainMatch[1] : '';
  }

  private buildColombiaDateLabel(date: string, time: string): string {
    const [y, mo, d] = date.split('-');
    const [ih, im] = time.split(':');
    const dias = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const meses = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dateObj = new Date(`${date}T12:00:00`);
    return `${dias[dateObj.getDay()]} ${meses[Number(mo) - 1]} ${d} ${y} ${ih}:${im}:00 GMT-0500 (hora estandar de Colombia)`;
  }

  private valueFromRawUser(key: string): unknown {
    const raw = this.auth.user()?.raw;
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  }

  private valueFromObject(value: unknown, key: string): unknown {
    if (!value || typeof value !== 'object') return undefined;
    const record = value as Record<string, unknown>;
    if (key in record) return record[key];

    for (const child of Object.values(record)) {
      const found = this.valueFromObject(child, key);
      if (found !== undefined && found !== null && String(found).trim() !== '') return found;
    }

    return undefined;
  }

  private collectIdentityText(value: unknown): unknown[] {
    if (!value || typeof value !== 'object') return [];
    const identityKey = /(consultor|usuario|user|email|correo|mail|funcional|nombre)/i;
    const result: unknown[] = [];

    Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
      if (identityKey.test(key) && (typeof child === 'string' || typeof child === 'number')) {
        result.push(child);
      }
      if (child && typeof child === 'object') {
        result.push(...this.collectIdentityText(child));
      }
    });

    return result;
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
